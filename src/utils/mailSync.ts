import { callDeepSeek } from './deepseek';
import { genId } from '../hooks/useLocalStorage';

/* ============ 郵件後台自動同步（無感拉取）============
 * 用戶要求：打開 App 就自動拉取，點開郵件頁永遠有最新郵件，全程無感知。
 * 策略：
 *  - App 啟動 / 從後台回前台時觸發（30 分鐘節流，避免頻繁連 IMAP）
 *  - 全程靜默：不彈任何 UI，出錯只 console.error
 *  - 新郵件逐封 AI 分析（失敗自動降級為原文摘要），寫回 localStorage
 *  - 完成後 dispatch 'mails-updated' 事件，郵件頁（若開著）即時刷新列表 */

const AUTO_FETCH_INTERVAL = 30 * 60 * 1000; // 30 分鐘
const MAIL_KEEP_DAYS = 7;                   // 只保留 7 天內
const MAIL_KEEP_MS = MAIL_KEEP_DAYS * 24 * 3600 * 1000;

/* ============ 黑名單：領英（LinkedIn）等純營銷推送 ============
 * 用戶明確要求「不要拉取領英的郵件」。
 * 領英發信域很多（linkedin.com / e.linkedin.com / mailer.linkedin.com /
 * linkedin-europe.com / 1.linkedin.com ...），所以用「地址含 linkedin」全擋。 */
const BLOCKED_SENDERS = ['linkedin'];

export function isBlockedMail(from: string, subject = ''): boolean {
  const s = `${from} ${subject}`.toLowerCase();
  return BLOCKED_SENDERS.some(k => s.includes(k));
}

/** 郵件時間戳（date 或 createdAt 任一，取得到就用） */
function mailTime(m: any): number {
  const raw = m?.date || m?.createdAt;
  const ts = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(ts) ? 0 : ts;
}

/** 是否已過期（超過 7 天） */
export function isMailExpired(m: any): boolean {
  const ts = mailTime(m);
  if (!ts) return false;              // 沒日期的保守保留，不誤刪
  return Date.now() - ts > MAIL_KEEP_MS;
}

/**
 * 清理過期郵件：一週以外的自動刪除，領英的一律刪除。
 * 直接改寫 localStorage（如果有刪掉東西），回傳清理後的列表。
 * App 啟動、郵件頁載入、每次拉取完成後都會呼叫 → 列表永遠只剩一週內。
 */
export function pruneMails(): any[] {
  try {
    const list = JSON.parse(localStorage.getItem('campus_mails') || '[]');
    if (!Array.isArray(list) || list.length === 0) return [];
    const kept = list.filter((m: any) => !isBlockedMail(m?.from || '', m?.subject || '') && !isMailExpired(m));
    if (kept.length !== list.length) {
      localStorage.setItem('campus_mails', JSON.stringify(kept));
    }
    return kept;
  } catch {
    return [];
  }
}

export interface RawMail {
  id: string;
  subject: string;
  from: string;
  date: string;
  text: string;
}

export interface MailAnalysis {
  summary: string;
  category: string;
  actionItems: string[];
  importance: 'high' | 'medium' | 'low';
}

/** AI 分析單封郵件（自動拉取與手動拉取共用） */
export async function analyzeMailContent(subject: string, text: string): Promise<MailAnalysis> {
  const prompt = `你是一個大學郵件助手。請分析以下來自香港城市大學的郵件，輸出JSON格式（不要markdown代碼塊，直接輸出JSON）：

{
  "summary": "用一兩句話中文概括郵件核心內容",
  "category": "從以下選一個：課程通知、考試安排、校園活動、行政事務、獎學金、實習就業、廣告營銷、安全提醒、其他",
  "actionItems": ["需要做的事項1", "需要做的事項2"],
  "importance": "高/中/低"
}

重要程度判斷標準（這是香港城市大學的郵件）：
- 高：選課相關、繳費通知、學期開始/結束、考試安排、成績公佈、獎學金、DDL截止、賬號安全、畢業相關
- 中：一般課程通知、作業提醒、行政公告、活動邀請、講座通知
- 低：廣告營銷、無關推送、歡迎郵件、系統自動通知（不含重要內容）

注意：凡是香港城市大學官方發出的關於學習、財務、行政的通知，默認標為"高"或"中"，只有明顯的廣告營銷才標"低"。

郵件主題：${subject}
郵件內容：${text.slice(0, 2500)}`;

  const result = await callDeepSeek([
    { role: 'system', content: '你是一個幫助大學生整理郵件的AI助手。請始終輸出純淨的JSON，不要加markdown代碼塊標記。' },
    { role: 'user', content: prompt },
  ], 0.3);

  if (!result) return { summary: '(AI分析失敗)', category: '其他', actionItems: [], importance: 'low' };

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { summary: result.slice(0, 100), category: '其他', actionItems: [], importance: 'low' };
  }
}

/**
 * 後台自動拉取 163 郵件（一周內全部，領英除外）。全靜默，永不拋錯。
 * @param force true = 忽略 30 分鐘節流（App 冷啟動用），
 *              但仍有 60 秒硬下限，避免 React StrictMode 雙跑 / 重複掛載打爆 IMAP。
 */
export async function autoFetchMails(opts?: { force?: boolean }): Promise<void> {
  try {
    const last = Number(localStorage.getItem('mail_last_auto_fetch') || 0);
    const gap = Date.now() - last;
    if (opts?.force) {
      if (gap < 60 * 1000) return;   // 60 秒硬下限
    } else {
      if (gap < AUTO_FETCH_INTERVAL) return;
    }

    // 未配置 163 郵箱 → 靜默跳過
    const cfgRaw = localStorage.getItem('mail_config');
    if (!cfgRaw) return;
    const cfg = JSON.parse(cfgRaw);
    const email = cfg?.neteaseEmail;
    const authCode = cfg?.neteaseAuthCode;
    if (!email || !authCode) return;

    localStorage.setItem('mail_last_auto_fetch', String(Date.now()));

    const res = await fetch('/api/fetch-mails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, authCode, limit: 100 }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.mails)) return;

    // 過濾領英（服務端已擋，這裡再兜一道，歷史數據也一併清）
    const incoming = (data.mails as RawMail[]).filter(
      m => m && m.id && !isBlockedMail(m.from || '', m.subject || '')
    );

    // 只處理還沒有的新郵件
    let existing: string[] = [];
    try {
      existing = JSON.parse(localStorage.getItem('campus_mails') || '[]').map((m: any) => m.id);
    } catch { existing = []; }
    const existingSet = new Set(existing);
    const newRaw = incoming.filter(m => !existingSet.has(m.id));
    if (newRaw.length === 0) {
      pruneMails();          // 沒有新郵件也要清掉過期的
      return;
    }

    // 逐封 AI 分析（失敗自動降級，不中斷）
    const analyzed = [];
    for (const raw of newRaw) {
      const a = await analyzeMailContent(raw.subject, raw.text);
      analyzed.push({
        id: raw.id || genId(),
        subject: raw.subject,
        from: raw.from,
        summary: a.summary,
        category: a.category,
        actionItems: a.actionItems,
        importance: a.importance || 'medium',
        date: raw.date,
        createdAt: new Date().toISOString(),
        source: 'netease',
      });
    }

    // 寫回 localStorage + 清掉一週以前的，再通知郵件頁刷新
    let prev: any[] = [];
    try { prev = JSON.parse(localStorage.getItem('campus_mails') || '[]'); } catch { prev = []; }
    localStorage.setItem('campus_mails', JSON.stringify([...analyzed, ...prev]));
    pruneMails();
    window.dispatchEvent(new Event('mails-updated'));
  } catch (e) {
    console.error('autoFetchMails failed:', e);
  }
}
