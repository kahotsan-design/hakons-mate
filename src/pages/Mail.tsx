import { useState, useEffect } from 'react';
import {
  Mail, Trash2, X, RefreshCw, Settings, AlertCircle,
} from 'lucide-react';
import { useLocalStorage, genId } from '../hooks/useLocalStorage';
import { useLang } from '../i18n';
import { analyzeMailContent, isBlockedMail, pruneMails } from '../utils/mailSync';

/* ============ 郵件頁（獨立大類 · 僅自用版） ============
 * 從 Campus 的 rail 第三個 tab 提升為底部導航一級頁面。
 * 構建開關 VITE_ENABLE_MAIL=false（朋友版）時 BottomNav 不顯示入口。 */

// ============ 類型 ============
interface MailItem {
  id: string;
  subject: string;
  from: string;
  summary: string;
  category: string;
  actionItems: string[];
  importance: 'high' | 'medium' | 'low';
  date: string;
  createdAt: string;
  source: 'netease'; // 郵件來源（原本還有 outlook，用戶用不到已移除）
}

interface MailConfig {
  source: 'netease';
  // 網易郵箱
  neteaseEmail?: string;
  neteaseAuthCode?: string;
}

// 兼容舊版 MailConfig（遷移用）
interface OldMailConfig {
  email?: string;
  authCode?: string;
  source?: 'netease' | 'outlook';
}

function migrateMailConfig(raw: any): MailConfig {
  if (raw && raw.source) {
    // 老數據可能帶著 outlook 字段，一律剝掉
    return { source: 'netease', neteaseEmail: raw.neteaseEmail, neteaseAuthCode: raw.neteaseAuthCode };
  }
  const old = raw as OldMailConfig;
  if (old && old.email) {
    return { source: 'netease', neteaseEmail: old.email, neteaseAuthCode: old.authCode };
  }
  return { source: 'netease' };
}

export default function MailPage() {
  const { t } = useLang();
  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">{t('title.mail')}</div>
      </div>
      <div className="page-scroll">
        <MailView />
      </div>
    </div>
  );
}

function MailView() {
  const { lang, t } = useLang();
  const [mails, setMails] = useLocalStorage<MailItem[]>('campus_mails', []);
  const [mailConfig, setMailConfig] = useLocalStorage<MailConfig>('mail_config', migrateMailConfig({ source: 'netease' }));
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');

  // 進頁面先清一次：一週以外的自動刪除 + 領英一律剔除。
  // 這樣就算上次打開 App 到現在過了好幾天，列表裡也只剩「一週內」的郵件。
  useEffect(() => {
    try {
      const kept = pruneMails();
      setMails(kept);
    } catch { /* ignore */ }
  }, [setMails]);

  // 後台自動同步（App 啟動時的 autoFetchMails）寫入了 localStorage →
  // 監聽 'mails-updated' 事件，把最新郵件重新載入 React state（頁面若開著即時刷新）
  useEffect(() => {
    const onUpdated = () => {
      try {
        const latest = JSON.parse(localStorage.getItem('campus_mails') || '[]');
        setMails(latest);
      } catch { /* ignore */ }
    };
    window.addEventListener('mails-updated', onUpdated);
    return () => window.removeEventListener('mails-updated', onUpdated);
  }, [setMails]);

  const deleteMail = (id: string) => {
    setMails(prev => prev.filter(m => m.id !== id));
  };

  // 拉取郵件（只有 163 一個數據源，Outlook 已移除）
  const fetchMails = async () => {
    const source = 'netease' as const;
    if (!mailConfig.neteaseEmail || !mailConfig.neteaseAuthCode) {
      setFetchStatus(t('campus.mail.st.configFirst'));
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setFetchStatus(t('campus.mail.st.connectNetease'));
    try {
      const apiUrl = '/api/fetch-mails';
      // 163：一周内全部拉取（后端已按 SINCE 7天过滤，limit 上限 100）
      const reqBody = { email: mailConfig.neteaseEmail, authCode: mailConfig.neteaseAuthCode, limit: 100 };
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || t('campus.mail.st.reqFail'));
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || t('campus.mail.st.fetchFail'));

      if (data.mails.length === 0) {
        setFetchStatus(t('campus.mail.st.noNew'));
        setLoading(false);
        return;
      }

      // 領英（LinkedIn）等黑名單直接剔除，不進列表也不做 AI 分析
      const allowedMails = (data.mails || []).filter(
        (m: any) => !isBlockedMail(m?.from || '', m?.subject || '')
      );
      if (allowedMails.length === 0) {
        setFetchStatus(t('campus.mail.st.noNew'));
        setLoading(false);
        return;
      }

      const totalCount = data.total || allowedMails.length;
      const sourceLabel = '港城大郵件';
      setFetchStatus(t('campus.mail.st.fetched', {
        n: allowedMails.length,
        label: sourceLabel,
        extra: totalCount > allowedMails.length ? t('campus.mail.st.filtered', { n: totalCount - allowedMails.length }) : '',
      }));

      const existingIds = new Set(mails.map(m => m.id));
      const newRawMails = allowedMails.filter((m: any) => !existingIds.has(m.id));

      if (newRawMails.length === 0) {
        setFetchStatus(t('campus.mail.st.noNew'));
        setLoading(false);
        return;
      }

      const analyzed: MailItem[] = [];
      for (let i = 0; i < newRawMails.length; i++) {
        const raw = newRawMails[i];
        setFetchStatus(t('campus.mail.st.analyzing', { i: i + 1, n: newRawMails.length }));
        const analysis = await analyzeMailContent(raw.subject, raw.text);

        analyzed.push({
          id: raw.id || genId(),
          subject: raw.subject,
          from: raw.from,
          summary: analysis.summary,
          category: analysis.category,
          actionItems: analysis.actionItems,
          importance: analysis.importance || 'medium',
          date: raw.date,
          createdAt: new Date().toISOString(),
          source,
        });
      }

      setMails(prev => [...analyzed, ...prev]);
      setFetchStatus(t('campus.mail.st.analyzed', { n: analyzed.length }));
    } catch (e: any) {
      setFetchStatus(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (showSettings) {
    return (
      <MailSettingsForm
        config={mailConfig}
        onSave={(cfg) => { setMailConfig(cfg); setShowSettings(false); }}
        onCancel={() => setShowSettings(false)}
      />
    );
  }

  const categoryColors: Record<string, string> = {
    '課程通知': '#2E86B8',
    '考試安排': '#B8736D',
    '校園活動': '#B3865C',
    '行政事務': '#A79BC2',
    '獎學金': '#2E86B8',
    '實習就業': '#7DD3FC',
    '其他': '#A8D8EA',
  };

  const renderMailCard = (mail: MailItem) => {
    const catColor = categoryColors[mail.category] || '#A8D8EA';
    const impConfig = {
      high: { label: t('campus.mail.important'), color: '#B8736D', bg: 'rgba(194,64,42,0.22)' },
      medium: { label: t('campus.mail.normal'), color: '#B3865C', bg: 'rgba(247,192,107,0.12)' },
      low: { label: t('campus.mail.general'), color: '#1D4E73', bg: 'rgba(62,110,150,0.12)' },
    };
    const imp = impConfig[mail.importance] || impConfig.medium;
    return (
      <div key={mail.id} className="card" style={{ cursor: 'default' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${catColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Mail size={18} color={catColor} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${catColor}15`, color: catColor }}>{mail.category}</span>
              <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: imp.bg, color: imp.color }}>{imp.label}</span>
              {mail.actionItems.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--color-campus)', fontWeight: 600 }}>{t('campus.mail.nActions', { n: mail.actionItems.length })}</span>
              )}
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
                {mail.date ? new Date(mail.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{mail.from}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{mail.summary}</div>
            {mail.actionItems.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                {mail.actionItems.map((item, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '3px 0', paddingLeft: 8, borderLeft: '2px solid var(--color-campus)', marginBottom: 3, color: 'var(--color-text-secondary)' }}>{item}</div>
                ))}
              </div>
            )}
          </div>
          <Trash2 size={16} color="var(--color-danger)" style={{ cursor: 'pointer', flexShrink: 0, marginTop: 2 }} onClick={() => { if (confirm(t('campus.mail.confirmDeleteMail'))) deleteMail(mail.id); }} />
        </div>
      </div>
    );
  };

  // 用 as string 比對：歷史 localStorage 裡可能還殘留 source='outlook' 的舊郵件
  const neteaseMails = mails.filter(m => (m.source as string) !== 'outlook');

  return (
    <div>
      {/* 狀態消息 */}
      {fetchStatus && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12,
          background: fetchStatus.startsWith('已') || fetchStatus.startsWith('✅') ? 'rgba(74,155,200,0.14)' : fetchStatus.startsWith('❌') ? 'rgba(194,64,42,0.22)' : 'var(--color-campus-bg)',
          color: fetchStatus.startsWith('已') || fetchStatus.startsWith('✅') ? '#2E86B8' : fetchStatus.startsWith('❌') ? '#B8736D' : 'var(--color-campus)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {fetchStatus.startsWith('❌') && <AlertCircle size={14} />}
          {fetchStatus}
        </div>
      )}

      {/* 模塊1: 網易郵箱 */}
      <div style={{
        padding: '10px 14px', borderRadius: 10, marginBottom: 10, marginTop: 4,
        background: '#FDFEFE',
        border: '1px solid rgba(46, 110, 168, 0.28)',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
      }}>
        <Mail size={15} color="var(--color-campus)" /> {t('campus.mail.neteaseTitle')}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)' }}>
          {t('campus.mail.count', { n: neteaseMails.length })}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => fetchMails()}
          disabled={loading}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 10,
            background: loading && mailConfig.source === 'netease' ? 'rgba(251, 252, 254, 0.75)' : 'var(--color-campus)',
            color: loading && mailConfig.source === 'netease' ? 'var(--color-text-tertiary)' : '#FDFEFE',
            border: loading && mailConfig.source === 'netease' ? '1.5px solid rgba(46, 110, 168, 0.42)' : '1.5px solid #FDFEFE',
            fontSize: 12, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {loading && mailConfig.source === 'netease' ? <><RefreshCw size={14} className="spin" /> {t('campus.mail.fetching')}</> : <><RefreshCw size={14} /> {t('campus.mail.fetch')}</>}
        </button>
        <button data-sound="glass" onClick={() => setShowSettings(true)} style={{
          padding: '8px 12px', borderRadius: 10, border: '1.5px solid rgba(46, 110, 168, 0.42)',
          background: '#FDFEFE',
          color: 'var(--color-text-secondary)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Settings size={14} /> {t('common.config')}
        </button>
      </div>
      {mailConfig.neteaseEmail && neteaseMails.length > 0 && neteaseMails.map(renderMailCard)}
      {mailConfig.neteaseEmail && neteaseMails.length === 0 && !loading && (
        <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
          {t('campus.mail.noMail')}
        </div>
      )}
      {!mailConfig.neteaseEmail && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <Mail size={32} color="var(--color-text-tertiary)" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('campus.mail.connect')}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            {t('campus.mail.connectDesc')}
          </div>
          <button onClick={() => setShowSettings(true)} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none',
            background: 'var(--color-campus)', color: '#0b2136',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Settings size={13} /> {t('campus.mail.configMail')}
          </button>
        </div>
      )}

      {/* 模塊2: Outlook 已移除（用戶用不到，代碼與 OAuth 憑證一併刪除） */}
    </div>
  );
}

function MailSettingsForm({ config, onSave, onCancel }: {
  config: MailConfig;
  onSave: (c: MailConfig) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const [neteaseEmail, setNeteaseEmail] = useState(config.neteaseEmail || '');
  const [neteaseAuthCode, setNeteaseAuthCode] = useState(config.neteaseAuthCode || '');

  const submit = () => {
    onSave({
      source: 'netease',
      neteaseEmail: neteaseEmail.trim() || undefined,
      neteaseAuthCode: neteaseAuthCode.trim() || undefined,
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('campus.mail.settings')}</span>
        <X size={20} color="var(--color-text-tertiary)" style={{ cursor: 'pointer' }} onClick={onCancel} />
      </div>

      {/* 網易郵箱配置 */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>{t('campus.mail.neteaseSection')}</div>
      <div style={{
        padding: 10, borderRadius: 8, background: 'var(--color-campus-bg)',
        fontSize: 11, color: 'var(--color-campus)', marginBottom: 12, lineHeight: 1.5,
        display: 'flex', alignItems: 'flex-start', gap: 4,
      }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {t('campus.mail.neteaseHint')}
      </div>
      <FormField label={t('campus.mail.emailLabel')} value={neteaseEmail} onChange={setNeteaseEmail} placeholder="yourname@163.com" />
      <FormField label={t('campus.mail.authLabel')} value={neteaseAuthCode} onChange={setNeteaseAuthCode} placeholder={t('campus.mail.authPh')} />

      {/* Outlook 配置區塊已移除 */}

      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertCircle size={14} /> {t('campus.mail.privacyHint')}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{t('common.save')}</button>
      </div>
    </div>
  );
}

// ---- 本頁私用的小組件/樣式（與 Campus.tsx 同款） ----
function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const inputStyle = {
  width: '100%', height: 44, padding: '0 10px', borderRadius: 8,
  border: '1px solid var(--color-border)', fontSize: 16,
  outline: 'none', background: 'var(--color-snow)',
  boxSizing: 'border-box' as const,
  WebkitAppearance: 'none' as const, appearance: 'none' as const,
} as const;

const btnPrimary = {
  padding: '6px 14px', borderRadius: 8, border: 'none',
  background: 'var(--color-campus)', color: '#0b2136',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const;

const btnSecondary = {
  padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(46, 110, 168, 0.28)',
  background: 'rgba(251, 252, 254, 0.92)', color: 'var(--color-text-secondary)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const;
