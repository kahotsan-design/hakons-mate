import { useRef, useState } from 'react';
import {
  Info, Download, RotateCcw, Camera, Upload, Languages, Check, X, Pencil,
  GraduationCap, Briefcase, Dumbbell, CheckSquare, Snowflake,
  BarChart3, Database,
} from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useLang } from '../i18n';
import { playSound } from '../utils/sound';
import type { Course, JobRecord, WeightRecord, Task } from '../types';

export default function Profile() {
  const { lang, setLang, t, school, setSchool } = useLang();
  const [courses] = useLocalStorage<Course[]>('campus_courses', []);
  const [campusTasks] = useLocalStorage<Task[]>('campus_tasks', []);
  const [workTasks] = useLocalStorage<Task[]>('work_tasks', []);
  const [jobs] = useLocalStorage<JobRecord[]>('job_records', []);
  const [weights] = useLocalStorage<WeightRecord[]>('fitness_weights', []);
  const [avatar, setAvatar] = useLocalStorage<string>('user_avatar', '/avatar.jpg');
  const [name, setName] = useLocalStorage<string>('user_name', 'HAKON');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingSchool, setEditingSchool] = useState(false);
  const [schoolDraft, setSchoolDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const startEditName = () => {
    setNameDraft(name);
    setEditingName(true);
  };
  const saveName = () => {
    const v = nameDraft.trim();
    if (!v) { alert(t('profile.nameEmpty')); return; }
    setName(v.slice(0, 20));
    setEditingName(false);
  };

  const startEditSchool = () => {
    setSchoolDraft(school);
    setEditingSchool(true);
  };
  const saveSchool = () => {
    const v = schoolDraft.trim().toUpperCase();
    if (!v) { setEditingSchool(false); return; } // 清空 = 恢复默认 CITYUHK
    if (!/^[A-Z0-9 ]+$/.test(v)) { alert(t('profile.schoolInvalid')); return; }
    setSchool(v.slice(0, 14));
    setEditingSchool(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(t('profile.alertImg'));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert(t('profile.alertSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const pendingCampusTasks = campusTasks.filter(t => !t.completed).length;
  const pendingWorkTasks = workTasks.filter(t => !t.completed).length;
  const jobInProgress = jobs.filter(j => j.result === 'ongoing').length;
  const currentWeight = weights.length > 0 ? weights[weights.length - 1].weight : 0;

  const exportData = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hakons-mate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(t('profile.confirmImport'))) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key, value as string);
        }
        alert(t('profile.importOk'));
        window.location.reload();
      } catch {
        alert(t('profile.importBad'));
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = () => {
    if (confirm(t('profile.confirmClear1'))) {
      if (confirm(t('profile.confirmClear2'))) {
        localStorage.clear();
        window.location.reload();
      }
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">{t('profile.title')}</div>
      </div>

      <div className="page-scroll">
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
          <img
            src={avatar}
            alt={t('profile.avatarAlt')}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              objectFit: 'cover', border: '2px solid rgba(168,216,234,0.3)',
              boxShadow: 'var(--shadow-ice)',
            }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--gradient-ice)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: '2px solid rgba(168,216,234,0.3)',
              boxShadow: '0 2px 6px rgba(13,110,253,0.3)',
            }}
          >
            <Camera size={11} color="#fff" />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
                placeholder={t('profile.namePh')}
                autoFocus
                maxLength={20}
                style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 16, fontWeight: 700, outline: 'none', background: 'var(--color-snow)', boxSizing: 'border-box', minWidth: 0 }}
              />
              <Check size={18} color="var(--color-success)" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => { playSound('success'); saveName(); }} />
              <X size={18} color="var(--color-text-tertiary)" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setEditingName(false)} />
            </div>
          ) : (
            <div
              onClick={startEditName}
              style={{ fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              title={t('profile.editName')}
            >
              {name}
              <Pencil size={12} color="var(--color-text-tertiary)" />
            </div>
          )}
          {editingSchool ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <input
                type="text"
                value={schoolDraft}
                onChange={e => setSchoolDraft(e.target.value.replace(/[^A-Za-z0-9 ]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') saveSchool(); }}
                placeholder={t('profile.schoolPh')}
                autoFocus
                maxLength={14}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                style={{ flex: 1, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 16, outline: 'none', background: 'var(--color-snow)', boxSizing: 'border-box', minWidth: 0, letterSpacing: 0.5 }}
              />
              <Check size={18} color="var(--color-success)" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => { playSound('success'); saveSchool(); }} />
              <X size={18} color="var(--color-text-tertiary)" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setEditingSchool(false)} />
            </div>
          ) : (
            <div
              onClick={startEditSchool}
              style={{ fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title={t('profile.editSchool')}
            >
              {school}
              <Pencil size={10} color="var(--color-text-tertiary)" />
            </div>
          )}
        </div>
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            fontSize: 12, color: 'var(--color-campus)', cursor: 'pointer',
            padding: '6px 12px', borderRadius: 20, background: 'rgba(91,184,229,0.12)',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          {t('profile.changeAvatar')}
        </div>
      </div>

      {/* ============ 語言選擇：即時切換，純顯示層，不動任何數據 ============ */}
      <div className="section-title"><Languages size={15} strokeWidth={2.2} style={{ verticalAlign: -2, marginRight: 5 }} />{t('profile.language')}</div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['zh', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                background: lang === l ? '#2E86B8' : '#FDFEFE',
                color: lang === l ? '#FDFEFE' : 'var(--color-text-secondary)',
                border: lang === l ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
                fontSize: 14, fontWeight: 700,
                transition: 'background 0.2s, color 0.2s, border 0.2s',
              }}
            >
              {t(l === 'zh' ? 'profile.langZh' : 'profile.langEn')}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          {t('profile.langDesc')}
        </div>
      </div>

      <div className="section-title"><BarChart3 size={15} strokeWidth={2.2} style={{ verticalAlign: -2, marginRight: 5 }} />{t('profile.overview')}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <OverviewRow icon={GraduationCap} color="var(--color-campus)" label={t('tag.campus')}
          value={t('profile.ovCampus', { c: courses.length, t: pendingCampusTasks })} />
        <OverviewRow icon={Dumbbell} color="var(--color-fitness)" label={t('tag.fitness')}
          value={currentWeight > 0 ? t('profile.ovFitnessCur', { w: currentWeight }) : t('profile.ovFitnessNone')} />
        <OverviewRow icon={CheckSquare} color="var(--color-campus)" label={t('tag.work')}
          value={t('profile.ovWork', { n: pendingWorkTasks })} />
        <OverviewRow icon={Briefcase} color="var(--color-job)" label={t('tag.job')}
          value={t('profile.ovJob', { n: jobs.length, m: jobInProgress })} />
      </div>

      <div className="section-title"><Database size={15} strokeWidth={2.2} style={{ verticalAlign: -2, marginRight: 5 }} />{t('profile.dataManagement')}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <SettingItem icon={Download} label={t('profile.export')} onClick={exportData} />
        <SettingItem icon={Upload} label={t('profile.import')} onClick={() => importRef.current?.click()} />
        <SettingItem icon={RotateCcw} label={t('profile.clear')} onClick={clearAllData} danger />
      </div>
      <input
        ref={importRef}
        type="file"
        accept=".json"
        onChange={importData}
        style={{ display: 'none' }}
      />

      <div className="section-title"><Info size={15} strokeWidth={2.2} style={{ verticalAlign: -2, marginRight: 5 }} />{t('profile.about')}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <SettingItem icon={Info} label={t('profile.aboutItem')} value={t('profile.themeLabel')} />
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(253, 254, 254, 0.85)', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Snowflake size={12} strokeWidth={2} color="var(--color-ice-deep)" />
        {t('profile.footer1')}
        <Snowflake size={12} strokeWidth={2} color="var(--color-ice-deep)" />
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(253, 254, 254, 0.85)' }}>
        {t('profile.footer2')}
      </div>
      </div>
    </div>
  );
}

function OverviewRow({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
      <Icon size={20} color={color} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{value}</div>
      </div>
    </div>
  );
}

function SettingItem({ icon: Icon, label, value, onClick, danger }: { icon: any; label: string; value?: string; onClick?: () => void; danger?: boolean }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: '1px solid var(--color-border)', cursor: onClick ? 'pointer' : 'default',
    }}>
      <Icon size={18} color={danger ? 'var(--color-danger)' : 'var(--color-text-secondary)'} />
      <span style={{ flex: 1, fontSize: 14, color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{value}</span>}
    </div>
  );
}
