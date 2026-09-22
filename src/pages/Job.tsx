import { useState } from 'react';
import { Plus, Trash2, X, Pencil, Briefcase, } from 'lucide-react';
import { useLocalStorage, genId } from '../hooks/useLocalStorage';
import EmptyState from '../components/EmptyState';
import { useLang, type TKey } from '../i18n';
import type { JobRecord } from '../types';
import { playSound } from '../utils/sound';

type WrittenTest = JobRecord['writtenTest'];
type Stage = JobRecord['stage'];
type Result = JobRecord['result'];

// ---- 狀態配置（label 改為 i18n key，渲染時翻譯） ----
const writtenTestConfig: Record<WrittenTest, { labelKey: TKey; color: string; bg: string }> = {
  none: { labelKey: 'job.wt.none', color: '#1D4E73', bg: 'rgba(62,110,150,0.12)' },
  pass: { labelKey: 'job.wt.pass', color: '#2E86B8', bg: 'rgba(74,155,200,0.14)' },
  fail: { labelKey: 'job.wt.fail', color: '#B8736D', bg: 'rgba(194,64,42,0.28)' },
};

const stageConfig: Record<Stage, { labelKey: TKey; color: string; bg: string }> = {
  applied: { labelKey: 'job.stage.applied', color: '#2E86B8', bg: 'rgba(125,211,252,0.14)' },
  written: { labelKey: 'job.stage.written', color: '#2E86B8', bg: 'rgba(201,168,232,0.14)' },
  r1: { labelKey: 'job.stage.r1', color: '#3D97CE', bg: 'rgba(46,134,184,0.13)' },
  r2: { labelKey: 'job.stage.r2', color: '#1D4E73', bg: 'rgba(46,134,184,0.13)' },
  r3: { labelKey: 'job.stage.r3', color: '#2E6A94', bg: 'rgba(46,134,184,0.13)' },
  hr: { labelKey: 'job.stage.hr', color: '#8A7BA8', bg: 'rgba(201,168,232,0.12)' },
  offer: { labelKey: 'job.stage.offer', color: '#FDFEFE', bg: '#2E86B8' },
  ended: { labelKey: 'job.stage.ended', color: '#1D4E73', bg: 'rgba(62,110,150,0.12)' },
};

const resultConfig: Record<Result, { labelKey: TKey; color: string; bg: string }> = {
  ongoing: { labelKey: 'job.result.ongoing', color: '#B3865C', bg: 'rgba(247,192,107,0.16)' },
  pass: { labelKey: 'job.result.pass', color: '#2E86B8', bg: 'rgba(74,155,200,0.14)' },
  fail: { labelKey: 'job.result.fail', color: '#B8736D', bg: 'rgba(194,64,42,0.28)' },
};

const stageOrder: Stage[] = ['applied', 'written', 'r1', 'r2', 'r3', 'hr', 'offer', 'ended'];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Job() {
  const { t } = useLang();
  const [records, setRecords] = useLocalStorage<JobRecord[]>('job_records', []);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addRecord = (r: JobRecord) => setRecords(prev => [r, ...prev]);

  const updateRecord = (r: JobRecord) => {
    setRecords(prev => prev.map(x => (x.id === r.id ? r : x)));
  };

  const deleteRecord = (id: string) => {
    if (confirm(t('job.confirmDelete'))) {
      setRecords(prev => prev.filter(x => x.id !== id));
      if (editingId === id) setEditingId(null);
    }
  };

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  const ongoing = records.filter(r => r.result === 'ongoing').length;
  const passed = records.filter(r => r.result === 'pass').length;
  const failed = records.filter(r => r.result === 'fail').length;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minWidth: 0 }}>
          <div className="page-title" style={{ flexShrink: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('title.job')}</div>
          <button data-sound="glass" style={{ ...btnAdd, flexShrink: 0 }} onClick={() => { setShowAdd(true); setEditingId(null); }}>
            <Plus size={14} />{t('job.newRecord')}
          </button>
        </div>
      </div>

      <div className="page-scroll">
        {records.length > 0 && (
          <div style={{ fontSize: 13, fontWeight: 500, color: '#F9EDC4', marginBottom: 8 }}>
            {t('job.summary', { total: records.length, ongoing, passed, failed })}
          </div>
        )}
        {showAdd ? (
          <RecordForm
            onCancel={() => setShowAdd(false)}
            onSave={r => { addRecord(r); setShowAdd(false); }}
          />
        ) : records.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            art="/art/bear-empty.svg"
            title={t('job.none')}
            desc={t('job.noneDesc')}
            actionLabel={t('job.addFirst')}
            onAction={() => setShowAdd(true)}
          />
        ) : (
          sorted.map(r =>
            editingId === r.id ? (
              <RecordForm
                key={r.id}
                initial={r}
                onCancel={() => setEditingId(null)}
                onSave={updated => { updateRecord(updated); setEditingId(null); }}
              />
            ) : (
              <RecordCard
                key={r.id}
                record={r}
                onEdit={() => setEditingId(r.id)}
                onDelete={() => deleteRecord(r.id)}
              />
            )
          )
        )}
      </div>
    </div>
  );
}

// ============ 記錄卡片 ============
function RecordCard({ record, onEdit, onDelete }: { record: JobRecord; onEdit: () => void; onDelete: () => void }) {
  const { t } = useLang();
  const wt = writtenTestConfig[record.writtenTest];
  const st = stageConfig[record.stage];
  const rs = resultConfig[record.result];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{record.company}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {record.position} · {record.date}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginTop: 2 }}>
          <Pencil size={15} color="var(--color-text-tertiary)" style={{ cursor: 'pointer' }} onClick={onEdit} />
          <Trash2 size={15} color="var(--color-danger)" style={{ cursor: 'pointer' }} onClick={onDelete} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={tag(wt)}>{t(wt.labelKey)}</span>
        <span style={tag(st)}>{t(st.labelKey)}</span>
        <span style={tag(rs)}>{t(rs.labelKey)}</span>
      </div>

      {record.notes && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)', background: 'var(--color-job-bg)', padding: '6px 10px', borderRadius: 8, lineHeight: 1.5 }}>
          {record.notes}
        </div>
      )}
    </div>
  );
}

function tag({ color, bg }: { color: string; bg: string }) {
  return { padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, color, background: bg } as const;
}

// ============ 添加 / 編輯表單 ============
function RecordForm({ initial, onSave, onCancel }: {
  initial?: JobRecord;
  onSave: (r: JobRecord) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const [company, setCompany] = useState(initial?.company ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [writtenTest, setWrittenTest] = useState<WrittenTest>(initial?.writtenTest ?? 'none');
  const [stage, setStage] = useState<Stage>(initial?.stage ?? 'applied');
  const [result, setResult] = useState<Result>(initial?.result ?? 'ongoing');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const submit = () => {
    if (!company.trim()) { alert(t('job.alertCompany')); return; }
    playSound('success');
    onSave({
      id: initial?.id ?? genId(),
      company: company.trim(),
      position: position.trim() || t('job.noPosition'),
      date,
      writtenTest,
      stage,
      result,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{initial ? t('job.f.editTitle') : t('job.f.addTitle')}</span>
        <X size={20} color="var(--color-text-tertiary)" style={{ cursor: 'pointer' }} onClick={onCancel} />
      </div>

      <FormField label={t('job.f.company')} value={company} onChange={setCompany} placeholder={t('job.f.companyPh')} />
      <FormField label={t('job.f.position')} value={position} onChange={setPosition} placeholder={t('job.f.positionPh')} />

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>{t('job.f.date')}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>{t('job.f.written')}</div>
        <ChoiceButtons
          options={(['none', 'pass', 'fail'] as const).map(v => ({ value: v, label: t(writtenTestConfig[v].labelKey), color: writtenTestConfig[v].color }))}
          value={writtenTest}
          onChange={setWrittenTest}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>{t('job.f.stage')}</div>
        <ChoiceButtons
          options={stageOrder.map(v => ({ value: v, label: t(stageConfig[v].labelKey), color: v === 'offer' ? '#2E86B8' : stageConfig[v].color }))}
          value={stage}
          onChange={setStage}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>{t('job.f.result')}</div>
        <ChoiceButtons
          options={(['ongoing', 'pass', 'fail'] as const).map(v => ({ value: v, label: t(resultConfig[v].labelKey), color: resultConfig[v].color }))}
          value={result}
          onChange={setResult}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>{t('common.notesOptional')}</div>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('job.f.notesPh')} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{t('common.save')}</button>
      </div>
    </div>
  );
}

// ============ 小組件 ============
function ChoiceButtons<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; color: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: '1 1 21%', padding: '9px 2px', borderRadius: 8, cursor: 'pointer',
          background: value === o.value ? o.color : '#FDFEFE',
          color: value === o.value ? '#FDFEFE' : 'var(--color-text-secondary)',
          border: value === o.value ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
          fontSize: 13, fontWeight: 600, textAlign: 'center' as const, whiteSpace: 'nowrap' as const,
          transition: 'background 0.15s, color 0.15s',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelStyle}>{label}</div>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

// ============ 樣式 ============
const labelStyle = { fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 } as const;

const inputStyle = {
  width: '100%', height: 44, padding: '0 10px', borderRadius: 8,
  border: '1px solid var(--color-border)', fontSize: 16,
  outline: 'none', background: 'var(--color-snow)',
  boxSizing: 'border-box' as const,
  WebkitAppearance: 'none' as const, appearance: 'none' as const,
} as const;

const btnPrimary = {
  padding: '6px 14px', borderRadius: 8, border: '1.5px solid #FDFEFE',
  background: 'var(--color-job)', color: '#0b2136',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const;

const btnSecondary = {
  padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(46, 110, 168, 0.42)',
  background: '#FDFEFE', color: 'var(--color-text-secondary)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const;

const btnAdd = {
  padding: '6px 12px', borderRadius: 100, border: '1.5px solid rgba(46, 110, 168, 0.42)',
  background: '#FDFEFE', color: '#1D4E73',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
} as const;
