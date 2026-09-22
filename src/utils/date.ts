// ============ 日期工具 ============
import type { Lang } from '../i18n';

/** 今天的日期鍵 YYYY-MM-DD */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 相對今天的描述：今天/明天/X天后/X天前/M/D（支持中英） */
export function relativeDay(dateStr: string, lang: Lang = 'zh'): string {
  const diff = dayDiff(dateStr);
  if (lang === 'en') {
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 7) return `in ${diff}d`;
    if (diff < 0) return `${-diff}d ago`;
    return dateStr.slice(5).replace('-', '/');
  }
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff > 1 && diff <= 7) return `${diff}天后`;
  if (diff < 0) return `${-diff}天前`;
  return dateStr.slice(5).replace('-', '/');
}

/** DDL 倒計時標籤：距離截止還有幾天 / 是否逾期（支持中英） */
export function ddlInfo(deadline: string, lang: Lang = 'zh'): { text: string; color: string; bg: string } {
  const diff = dayDiff(deadline);
  const md = deadline.slice(5).replace('-', '/');
  if (lang === 'en') {
    if (diff > 7) return { text: `Due ${md}`, color: '#a8d8ea', bg: 'rgba(168,216,234,0.12)' };
    if (diff >= 2) return { text: `${diff}d left`, color: '#F7C06B', bg: 'rgba(247,192,107,0.14)' };
    if (diff === 1) return { text: 'Due tomorrow', color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
    if (diff === 0) return { text: 'Due today', color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
    return { text: `${-diff}d overdue`, color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
  }
  if (diff > 7) return { text: `截止 ${md}`, color: '#a8d8ea', bg: 'rgba(168,216,234,0.12)' };
  if (diff >= 2) return { text: `剩 ${diff} 天`, color: '#F7C06B', bg: 'rgba(247,192,107,0.14)' };
  if (diff === 1) return { text: '明天截止', color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
  if (diff === 0) return { text: '今天截止', color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
  return { text: `逾期 ${-diff} 天`, color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
}

/** 待辦日期徽章：以「日期+星期」為主（如 9/9 周四 / Thu 9/9），今天/明天/逾期用醒目色。
 *  有 startDate 時顯示範圍（如 9/5 → 9/20 周日）。 */
export function todoDateBadge(deadline: string, lang: Lang = 'zh', startDate?: string): { text: string; color: string; bg: string } {
  const diff = dayDiff(deadline);
  const d = new Date(deadline.slice(0, 10) + 'T00:00:00');
  const dow = d.getDay() || 7; // 1=週一...7=週日
  const WEEK_ZH = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const WEEK_EN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const wd = lang === 'en' ? WEEK_EN[dow] : WEEK_ZH[dow];
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  const dateText = lang === 'en' ? `${wd} ${md}` : `${md} ${wd}`;
  // 時間範圍：從 startDate 開始到 deadline 截止（如復習、寫論文的跨天任務）
  if (startDate && startDate !== deadline) {
    const s = new Date(startDate.slice(0, 10) + 'T00:00:00');
    const smd = `${s.getMonth() + 1}/${s.getDate()}`;
    const sdiff = dayDiff(startDate);
    if (sdiff <= 0) {
      // 已開始、尚未截止：強調截止日
      return { text: lang === 'en' ? `Started · Due ${md}` : `進行中 · 截止 ${md}`, color: '#F7C06B', bg: 'rgba(247,192,107,0.14)' };
    }
    return { text: lang === 'en' ? `${smd} → ${wd} ${md}` : `${smd} → ${md} ${wd}`, color: '#5BB8E5', bg: 'rgba(91,184,229,0.14)' };
  }
  if (diff < 0) return { text: lang === 'en' ? `Overdue · ${dateText}` : `逾期 · ${dateText}`, color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
  if (diff === 0) return { text: lang === 'en' ? 'Today' : '今天', color: '#FF8B7C', bg: 'rgba(255,139,124,0.16)' };
  if (diff === 1) return { text: lang === 'en' ? `Tomorrow · ${md}` : `明天 · ${md}`, color: '#F7C06B', bg: 'rgba(247,192,107,0.14)' };
  if (diff <= 7) return { text: dateText, color: '#5BB8E5', bg: 'rgba(91,184,229,0.14)' };
  return { text: dateText, color: '#a8d8ea', bg: 'rgba(168,216,234,0.12)' };
}

/** dateStr 距今天的天數（正=未來，負=過去） */
export function dayDiff(dateStr: string): number {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const now = new Date(todayKey() + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}
