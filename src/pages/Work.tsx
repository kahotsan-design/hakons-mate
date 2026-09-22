import { useRef, useState } from 'react';
import { CheckSquare, Plus, Trash2, X, Circle, Pencil, ArrowRight, Sparkles, } from 'lucide-react';
import { useLocalStorage, genId } from '../hooks/useLocalStorage';
import EmptyState from '../components/EmptyState';
import DateSlider from '../components/DateSlider';
import { SnowBurst } from '../components/SnowFX';
import { useLang, type Lang } from '../i18n';
import { todoDateBadge } from '../utils/date';
import { callDeepSeek } from '../utils/deepseek';
import { playSound } from '../utils/sound';
import type { Task } from '../types';

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function Work() {
  const { lang, t } = useLang();
  const [tasks, setTasks] = useLocalStorage<Task[]>('work_tasks', []);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [completingId, setCompletingId] = useState<string | null>(null);

  const today = todayLocal();

  const autoCarryOver = () => {
    setTasks(prev => prev.map(t => {
      if (!t.completed && t.deadline && t.deadline < today) {
        return { ...t, deadline: today };
      }
      return t;
    }));
  };
  useState(() => { autoCarryOver(); });

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const toggleTask = (id: string) => {
    if (completingId) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    // 完成播上揚音，取消完成播普通嗒聲
    playSound(task.completed ? 'tap' : 'success');

    if (!task.completed) {
      setCompletingId(id);
      setTimeout(() => {
        setTasks(prev => prev.map(t =>
          t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
        ));
        setCompletingId(null);
      }, 1100);
    } else {
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, completed: false, completedAt: undefined, deadline: today } : t
      ));
    }
  };

  const dayCompleted = tasks.filter(t => {
    if (!t.completed || !t.completedAt) return false;
    return t.completedAt.slice(0, 10) === selectedDate;
  });

  const dayPending = tasks.filter(t => {
    if (t.completed) return false;
    // 截止日 = 所選日期；或跨天範圍任務已開始且未截止（從9/10複習到9/20，中間每天都該看到它）
    if (t.deadline === selectedDate) return true;
    return !!(t.startDate && t.startDate <= selectedDate && t.deadline && t.deadline > selectedDate);
  });
  // 未來待辦（今天之後）：AI 快速記填入的待辦都在這裡，隨時可見、可編輯
  // 已開始的範圍任務（startDate ≤ 今天）不算未來，它在今天的待完成裡
  const upcoming = tasks.filter(t => !t.completed && t.deadline && t.deadline > today
    && !(t.startDate && t.startDate <= today));
  // 緊急度排序：截止日期早的在前 → 優先級高的在前 → 先創建的在前
  // 新插入的緊急事項因 deadline 靠前會自動浮到最上面
  const pOrder = { high: 0, medium: 1, low: 2 } as const;
  const byUrgency = (a: Task, b: Task) =>
    (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
    || pOrder[a.priority] - pOrder[b.priority]
    || a.createdAt.localeCompare(b.createdAt);
  const sortedPending = [...dayPending].sort(byUrgency);
  const sortedUpcoming = [...upcoming].sort(byUrgency);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - todayD.getTime()) / 86400000);
    if (lang === 'en') {
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      if (diffDays > 1 && diffDays <= 7) return `in ${diffDays}d`;
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays === -1) return '昨天';
    if (diffDays > 1 && diffDays <= 7) return `${diffDays}天后`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const isToday = selectedDate === today;

  if (showAdd) {
    return <AddWorkTaskForm defaultDate={selectedDate} onAdd={(t) => { setTasks(prev => [...prev, t]); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />;
  }

  const editingTask = editId ? tasks.find(t => t.id === editId) : null;
  if (editingTask) {
    return <EditWorkTaskForm task={editingTask} onSave={(updates) => { updateTask(editingTask.id, updates); setEditId(null); }} onCancel={() => setEditId(null)} />;
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">{t('title.work')}</div>
      </div>

      <div className="page-scroll">
      {/* AI 快速記：隨手一段話 → AI 拆成多條待辦，按日期填入，緊急的排前 */}
      <QuickNote onAdd={(newTasks) => setTasks(prev => [...newTasks, ...prev])} />
      <DateSlider selectedDate={selectedDate} onChange={setSelectedDate} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#F9EDC4' }}>
          {isToday ? t('common.today') : formatDate(selectedDate)} · {t('work.nPending', { n: dayPending.length })} · {t('work.nDone', { n: dayCompleted.length })}
        </span>
        <button style={btnAdd} onClick={() => setShowAdd(true)}><Plus size={14} /> {t('work.add')}</button>
      </div>
      {dayPending.length === 0 && dayCompleted.length === 0 && (!isToday || sortedUpcoming.length === 0) ? (
        <EmptyState
          icon={CheckSquare}
          art="/art/bear-empty.svg"
          title={isToday ? t('work.noneToday') : t('work.noneDay')}
          desc={t('work.noneDesc')}
          actionLabel={t('work.add')}
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <>
          {dayPending.length > 0 && (
            <>
              <div className="section-title">{t('work.pending')} ({dayPending.length})</div>
              {sortedPending.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showDate={!isToday}
                  isCompleting={completingId === task.id}
                  isCarriedOver={!isToday && task.deadline === today}
                  onToggle={() => toggleTask(task.id)}
                  onEdit={() => setEditId(task.id)}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
            </>
          )}

          {/* 即將到來：所有未來待辦（含 AI 快速記填入的），按緊急度排序 */}
          {isToday && sortedUpcoming.length > 0 && (
            <>
              <div className="section-title">{t('work.upcoming')} ({sortedUpcoming.length})</div>
              {sortedUpcoming.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showDate
                  isCompleting={completingId === task.id}
                  isCarriedOver={false}
                  onToggle={() => toggleTask(task.id)}
                  onEdit={() => setEditId(task.id)}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
            </>
          )}

          {dayCompleted.length > 0 && (
            <>
              <div className="section-title">{t('work.completed')} ({dayCompleted.length})</div>
              {dayCompleted.map(task => (
                <div key={task.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: 0.6, borderLeft: '3px solid rgba(74, 155, 200, 0.55)', borderRadius: '0 14px 14px 0' }}>
                  <button data-sound="none" onClick={() => toggleTask(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 2 }}>
                    <CheckSquare size={20} color="var(--color-success)" />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, textDecoration: 'line-through' }}>{task.title}</div>
                    {task.company && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, fontWeight: 500 }}>{task.company}</div>}
                  </div>
                  <Trash2 size={16} color="var(--color-danger)" style={{ cursor: 'pointer', flexShrink: 0, marginTop: 2 }} onClick={() => deleteTask(task.id)} />
                </div>
              ))}
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}

/** 單條待辦卡片：勾選 + 標題/備註 + 日期徽章（日期+星期）+ 地點徽章 + 編輯/刪除 */
function TaskRow({ task, showDate, isCompleting, isCarriedOver, onToggle, onEdit, onDelete }: {
  task: Task;
  showDate: boolean;
  isCompleting: boolean;
  isCarriedOver: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { lang, t } = useLang();
  const badge = task.deadline ? todoDateBadge(task.deadline, lang, task.startDate) : null;
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: isCompleting ? 0.5 : 1, transition: 'opacity 0.3s', borderLeft: '3px solid #4A9BC8', borderRadius: '0 14px 14px 0' }}>
      {isCompleting && <SnowBurst x={12} y={24} />}
      <button data-sound="none" onClick={onToggle} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 2, transition: 'transform 0.2s', transform: isCompleting ? 'scale(1.2)' : 'scale(1)' }}>
        {isCompleting ? (
          <CheckSquare size={22} color="var(--color-success)" style={{ animation: 'selectPulse 0.3s ease' }} />
        ) : (
          <Circle size={20} color="var(--color-ice)" />
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, textDecoration: isCompleting ? 'line-through' : 'none', transition: 'text-decoration 0.3s' }}>{task.title}</div>
        {task.notes && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{task.notes}</div>}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', minWidth: 0 }}>
          {showDate && badge && (
            <span style={{ padding: '1px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.text}</span>
          )}
          {task.company && !task.title.includes(task.company) && (
            <span style={{ padding: '1px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--color-campus)', color: '#FDFEFE', whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.company}</span>
          )}
          {isCarriedOver && (
            <span style={{ fontSize: 11, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <ArrowRight size={10} /> {t('work.carried')}
            </span>
          )}
        </div>
      </div>
      <Pencil size={15} color="var(--color-text-tertiary)" style={{ cursor: 'pointer', flexShrink: 0, marginTop: 3 }} onClick={onEdit} />
      <Trash2 size={16} color="var(--color-danger)" style={{ cursor: 'pointer', flexShrink: 0, marginTop: 2 }} onClick={onDelete} />
    </div>
  );
}

function AddWorkTaskForm({ defaultDate, onAdd, onCancel }: { defaultDate: string; onAdd: (t: Task) => void; onCancel: () => void }) {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');

  const submit = () => {
    if (!title.trim()) { alert(t('work.alertContent')); return; }
    playSound('success');
    onAdd({
      id: genId(), title, module: 'work',
      priority: 'medium', completed: false, createdAt: new Date().toISOString(),
      deadline: defaultDate,
      company: company.trim() || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('work.f.addTitle')}</span>
        <X size={20} color="var(--color-text-tertiary)" onClick={onCancel} style={{ cursor: 'pointer' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('work.f.content')}</div>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('work.f.contentPh')} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('work.f.company')}</div>
        <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder={t('work.f.companyPh')} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.notesOptional')}</div>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('work.f.notesPh')} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{t('common.confirm')}</button>
      </div>
    </div>
  );
}

function EditWorkTaskForm({ task, onSave, onCancel }: { task: Task; onSave: (updates: Partial<Task>) => void; onCancel: () => void }) {
  const { t } = useLang();
  const [title, setTitle] = useState(task.title);
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [startDate, setStartDate] = useState(task.startDate || '');
  const [company, setCompany] = useState(task.company || '');
  const [notes, setNotes] = useState(task.notes || '');

  const submit = () => {
    if (!title.trim()) { alert(t('work.alertContent')); return; }
    playSound('success');
    onSave({
      title,
      deadline: deadline || task.deadline,
      // 起始日僅在早於截止日時保存（跨天範圍），否則視為普通單日待辦
      startDate: startDate && deadline && startDate < deadline ? startDate : undefined,
      company: company.trim() || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('work.f.editTitle')}</span>
        <X size={20} color="var(--color-text-tertiary)" onClick={onCancel} style={{ cursor: 'pointer' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('work.f.content')}</div>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('work.f.date')}</div>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('work.f.startDate')}（{t('work.f.startDateHint')}）</div>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('work.f.company2')}</div>
        <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder={t('work.f.companyPh')} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.notesOptional')}</div>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{t('common.save')}</button>
      </div>
    </div>
  );
}

// ============ AI 快速記 ============
// 用戶隨手輸入一段沒邏輯的話，AI 拆成多條待辦（含日期/地點/緊急度），自動填入列表。
// 註：textarea 用非受控模式（ref 直讀），打字全程 React 不介入——
//     受控 value 在 iOS 中文輸入法下會重設光標，導致「光標亂跑」。
function QuickNote({ onAdd }: { onAdd: (tasks: Task[]) => void }) {
  const { lang, t } = useLang();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const run = async () => {
    if (loading) return;
    const val = taRef.current?.value ?? '';
    if (!val.trim()) { setFeedback({ ok: false, msg: t('work.ai.empty') }); return; }
    setLoading(true);
    setFeedback(null);
    const parsed = await aiParseTodos(val, lang);
    if (parsed && parsed.length > 0) {
      onAdd(parsed);
      setFeedback({ ok: true, msg: t('work.ai.done', { n: parsed.length }) });
      if (taRef.current) taRef.current.value = '';
      playSound('success');
    } else {
      setFeedback({ ok: false, msg: t('work.ai.fail') });
    }
    setLoading(false);
    // 反饋條 6 秒後自動消失
    setTimeout(() => setFeedback(null), 6000);
  };

  return (
    <div className="ai-card">
      {/* 头部：标题 + 气泡 + 右侧说话角色。气泡尾巴指向右上的角色 */}
      <div className="ai-body">
        <div className="ai-main">
          <div className="ai-title">
            <Sparkles size={15} color="#2E86B8" strokeWidth={2.2} />
            <span className="ai-title-text">{t('work.ai.title')}</span>
          </div>
          <div className="ai-bubble">{t('work.ai.desc')}</div>
        </div>
        <img src="/art/bear-sitting.svg" alt="" aria-hidden width={76} height={76}
          className="ai-mascot" draggable={false} />
      </div>
      {/* 输入区独占整行，不再受角色占用空间挤在左边 */}
      <div className="ai-textarea-wrap">
        <textarea
          ref={taRef}
          placeholder={t('work.ai.placeholder')}
          rows={3}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="ai-textarea"
        />
      </div>
      <div className="ai-submit-row">
        <button
          onClick={run}
          disabled={loading}
          className="ai-submit"
        >
          {loading
            ? <><span className="ai-spinner" />{t('work.ai.working')}</>
            : <><Sparkles size={13} />{t('work.ai.button')}</>}
        </button>
      </div>
      {feedback && (
        <div className={`ai-feedback ${feedback.ok ? 'ok' : 'fail'}`}>
          {feedback.ok ? '✓ ' : '✕ '}{feedback.msg}
        </div>
      )}
    </div>
  );
}

/** AI 解析：一段亂文字 → 結構化待辦數組 */
async function aiParseTodos(input: string, lang: Lang): Promise<Task[] | null> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekday = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { weekday: 'long' });

  const prompt = `今天是 ${todayStr}（${weekday}）。用戶隨手記了一段可能沒有邏輯的文字，請整理成待辦事項列表。

【輸出格式】純淨 JSON，不要 markdown 代碼塊：
{"todos":[{"title":"...","date":"YYYY-MM-DD","startDate":"YYYY-MM-DD","location":"...","notes":"...","priority":"high|medium|low"}]}

【核心原則：語義完整性優先】
title 必須是一句完整、自然、單獨可讀的話。你只整理語序和表達，不改變意思，更不要把一句話肢解：
- 正例：「9/12 去百佳超市買牛奶和雞蛋」→ title：「去百佳超市買牛奶和雞蛋」（地點融在動作裡，留在 title，不提取 location）
- 反例：title「買牛奶和雞蛋」+ location「百佳超市」——句子被拆散，單看 title 不知道去哪買，禁止這樣拆
- location 只在它是獨立場所、抽走後 title 依然完整時才提取（如「去入境事務處續身份證」→ title「續身份證」+ location「入境事務處」）
- 拿不準要不要拆，就整句放進 title——寧可信息重複，不可語義殘缺

【規則】
1. title：完整自然的短句；可以理順用戶的語序、去掉口語碎詞（「對了」「還得」「吧」），但不增刪實際事項
2. date：截止/執行日 YYYY-MM-DD。結合今天 ${todayStr} 換算相對時間；「……之前/前」按截止日算；提到的星期幾或日期若已過去，取未來最近的一天；沒提日期用今天 ${todayStr}
3. startDate：僅當是跨天範圍（「從9/10複習到9/20」「這週開始做，月底交」）才填起始日，date 填截止日；普通事項省略
4. notes：需要帶的東西或注意點（帶齊證件、記得預約）；拿不準就併入 title，別硬拆
5. priority：截止日在 3 天內或語氣緊急用 high；有明確日期的普通事項用 medium；隨性無明確日期用 low
6. 多件事就輸出多條；但一件事有多個細節（去哪、買啥）仍是同一條，別按細節拆
7. 語言跟隨用戶輸入（英文輸入輸出英文，中文輸入輸出中文）

用戶輸入：${input}`;

  const result = await callDeepSeek([
    { role: 'system', content: '你是一個待辦事項整理助手，只輸出純淨 JSON，不要任何其他文字。整理時保持每條待辦的語義完整自然。' },
    { role: 'user', content: prompt },
  ], 0.2);

  if (!result) return null;
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    const arr = Array.isArray(data) ? data : data.todos;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.slice(0, 20).map((x: { title?: unknown; date?: unknown; startDate?: unknown; location?: unknown; notes?: unknown; priority?: unknown }): Task => {
      // AI 偶爾會把「周五前」算成已過去的日期，clamp 到今天保證立即可見
      const rawDate = /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) ? String(x.date) : todayStr;
      const rawStart = /^\d{4}-\d{2}-\d{2}$/.test(String(x.startDate)) ? String(x.startDate) : undefined;
      return {
        id: genId(),
        title: String(x.title || '').trim().slice(0, 100),
        module: 'work',
        priority: x.priority === 'high' || x.priority === 'low' ? x.priority : 'medium',
        completed: false,
        createdAt: new Date().toISOString(),
        deadline: rawDate < todayStr ? todayStr : rawDate,
        startDate: rawStart && rawStart < rawDate ? rawStart : undefined,
        company: x.location ? String(x.location).trim().slice(0, 50) : undefined,
        notes: x.notes ? String(x.notes).trim().slice(0, 200) : undefined,
      };
    }).filter(task => task.title.length > 0);
  } catch (e) {
    console.error('AI 待辦解析失敗:', e);
    return null;
  }
}

const inputStyle = { width: '100%', height: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 16, outline: 'none', background: 'var(--color-snow)', boxSizing: 'border-box' as const, WebkitAppearance: 'none' as const, appearance: 'none' as const };
// AI 快速記樣式已遷移到 index.css 的 .ai-card / .ai-bubble / .ai-textarea / .ai-submit
// 註：iOS WebKit 已知 bug——backdrop-filter（毛玻璃）容器內的輸入框光標會錯位亂跳；
// 且字號 <16px 會觸發 Safari 聚焦自動放大頁面。故此卡不用毛玻璃、輸入字號用 16。
const btnPrimary = { padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--color-campus)', color: '#0b2136', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
const btnSecondary = { padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(46, 110, 168, 0.28)', background: 'rgba(251, 252, 254, 0.92)', color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
const btnAdd = { padding: '6px 12px', borderRadius: 100, border: 'none', background: 'var(--gradient-ice)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap' as const } as const;
