import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, CheckSquare, MapPin, Clock,
  Plus, Trash2, X, Pencil, Sparkles, Flag,
} from 'lucide-react';
import { useLocalStorage, genId } from '../hooks/useLocalStorage';
import EmptyState from '../components/EmptyState';
import DateSlider from '../components/DateSlider';
import WeekScheduleGrid from '../components/WeekScheduleGrid';
import CourseDetailModal from '../components/CourseDetailModal';
import RailNav from '../components/RailNav';
import { todayKey, ddlInfo } from '../utils/date';
import { useLang, appDayShort, appDayLong, type Lang } from '../i18n';
import { callDeepSeek } from '../utils/deepseek';
import { playSound } from '../utils/sound';
import type { Course, Task } from '../types';

type Tab = 'schedule' | 'task';

export default function Campus() {
  const [tab, setTab] = useState<Tab>('schedule');
  const { t, school } = useLang();

  return (
    <div className="page fade-in">
      {/* 固定標題（藍塊只放標題，全 App 統一高度）；學校名跟隨「我的」頁設置 */}
      <div className="page-header">
        <div className="page-title">{school}</div>
      </div>

      {/* 可滾動內容 */}
      <div className="page-scroll">
        {/* 横向軌道導航：中心模塊最大最清晰，兩側縮小弱化，可左右滑動切換 */}
        <RailNav
          tabs={[
            { key: 'schedule', label: t('campus.tab.schedule'), icon: BookOpen },
            { key: 'task', label: t('campus.tab.task'), icon: CheckSquare },
          ]}
          active={tab}
          onChange={k => setTab(k as Tab)}
        />
        <div key={tab} className="rail-view">
          {tab === 'schedule' && <ScheduleView />}
          {tab === 'task' && <TaskView />}
        </div>
      </div>
    </div>
  );
}

// ============ 課表視圖 ============
function ScheduleView() {
  const { lang, t } = useLang();
  const [courses, setCourses] = useLocalStorage<Course[]>('campus_courses', []);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [editCourse, setEditCourse] = useState<Course | null>(null);

  const deleteCourse = (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  const updateCourse = (updated: Course) => {
    setCourses(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  };

  if (showAdd) {
    return <CourseForm onAdd={(c) => { setCourses(prev => [...prev, c]); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />;
  }

  if (editCourse) {
    return (
      <CourseForm
        initial={editCourse}
        onUpdate={(c) => { updateCourse(c); setEditCourse(null); setDetailCourse(null); }}
        onCancel={() => setEditCourse(null)}
      />
    );
  }

  // 日課表：所選日期對應的星期幾
  const selDow = new Date(selectedDate + 'T00:00:00').getDay() || 7;
  const selDate = new Date(selectedDate + 'T00:00:00');
  const weekdayLabel = lang === 'zh' ? `周${appDayShort(lang, selDow)}` : appDayLong(lang, selDow);
  const dateLabel = lang === 'en'
    ? selDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : `${selDate.getMonth() + 1}月${selDate.getDate()}日`;
  const isToday = selectedDate === todayKey();
  const dayCourses = courses
    .filter(c => c.dayOfWeek === selDow)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`liquid-seg${view === 'week' ? ' active' : ''}`} onClick={() => setView('week')}>{t('campus.weekView')}</button>
        <button className={`liquid-seg${view === 'day' ? ' active' : ''}`} onClick={() => setView('day')}>{t('campus.dayView')}</button>
        <button style={btnAdd} onClick={() => setShowAdd(true)}><Plus size={14} />{t('campus.add')}</button>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          art="/art/bear-empty.svg"
          title={t('campus.noCourse')}
          desc={t('campus.noCourseDesc')}
          actionLabel={t('campus.addCourse')}
          onAction={() => setShowAdd(true)}
        />
      ) : view === 'day' ? (
        <div>
          <DateSlider selectedDate={selectedDate} onChange={setSelectedDate} />
          <div className="section-title" style={{ marginBottom: 8 }}>
            {weekdayLabel} · {dateLabel}{isToday ? t('campus.todayMark') : ''} · {t('campus.classCount', { n: dayCourses.length })}
          </div>
          {dayCourses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Sparkles size={15} color="var(--color-ice-deep)" />
              {t('campus.noClassDay', { weekday: weekdayLabel })}
            </div>
          ) : (
            dayCourses.map(course => <CourseCard key={course.id} course={course} onDelete={deleteCourse} onEdit={() => setEditCourse(course)} />)
          )}
        </div>
      ) : (
        <WeekScheduleGrid courses={courses} onCourseClick={setDetailCourse} />
      )}

      {/* 課程詳情彈層：點課表塊查看完整信息 */}
      {detailCourse && (
        <CourseDetailModal
          course={detailCourse}
          onClose={() => setDetailCourse(null)}
          onEdit={() => setEditCourse(detailCourse)}
        />
      )}

      {/* 課程列表 */}
      <div className="section-title">{t('campus.allCourses', { n: courses.length })}</div>
      {courses.map(course => <CourseCard key={course.id} course={course} onDelete={deleteCourse} onEdit={() => setEditCourse(course)} />)}
    </div>
  );
}

function CourseForm({ initial, onAdd, onUpdate, onCancel }: {
  initial?: Course;                                  // 編輯模式：傳入已有課程
  onAdd?: (c: Course) => void;
  onUpdate?: (c: Course) => void;
  onCancel: () => void;
}) {
  const { lang, t } = useLang();
  const [form, setForm] = useState<Course>(
    initial ?? {
      id: '', name: '', code: '', teacher: '', location: '',
      dayOfWeek: 1, startTime: '08:30', endTime: '10:00',
      weeks: [], credits: 3, color: '#2E86B8',
    }
  );

  // 上課周次（第幾周~第幾周），從已有 weeks 推斷默認值
  const [weekStart, setWeekStart] = useState(
    initial && initial.weeks && initial.weeks.length > 0 ? initial.weeks[0] : 1
  );
  const [weekEnd, setWeekEnd] = useState(
    initial && initial.weeks && initial.weeks.length > 0 ? initial.weeks[initial.weeks.length - 1] : 13
  );

  const isEdit = !!initial;
  const colors = ['#7FAFD4', '#8AC0A9', '#E2C289', '#DE9C90', '#A5CEE3', '#B3A6CF'];

  // 起止周次生成 weeks 數組（第 weekStart 周到第 weekEnd 周，每週都上課）
  const buildWeeks = (): number[] => {
    const s = Math.max(1, weekStart);
    const e = Math.min(20, Math.max(s, weekEnd));
    const arr: number[] = [];
    for (let i = s; i <= e; i++) arr.push(i);
    return arr;
  };

  const submit = () => {
    if (!form.name.trim() || !form.code.trim()) {
      alert(t('campus.alertCourseName'));
      return;
    }
    if (weekStart > weekEnd) {
      alert(t('campus.alertWeeks'));
      return;
    }
    playSound('success');
    const weeks = buildWeeks();
    if (isEdit) {
      onUpdate?.({ ...form, weeks });
    } else {
      onAdd?.({ ...form, id: genId(), weeks });
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{isEdit ? t('campus.editCourse') : t('campus.addCourse')}</span>
        <X size={20} color="var(--color-text-tertiary)" style={{ cursor: 'pointer' }} onClick={onCancel} />
      </div>

      <FormField label={t('campus.f.courseName')} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder={t('campus.f.courseNamePh')} />
      <FormField label={t('campus.f.courseCode')} value={form.code} onChange={v => setForm({ ...form, code: v })} placeholder={t('campus.f.courseCodePh')} />
      <FormField label={t('campus.f.teacher')} value={form.teacher} onChange={v => setForm({ ...form, teacher: v })} placeholder={t('campus.f.teacherPh')} />
      <FormField label={t('campus.f.room')} value={form.location} onChange={v => setForm({ ...form, location: v })} placeholder={t('campus.f.roomPh')} />

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.f.weekday')}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['一','二','三','四','五','六','日'].map((d, i) => (
            <button key={d} onClick={() => setForm({ ...form, dayOfWeek: i + 1 })}
              style={{
                flex: '1 1 12%', padding: '8px 0', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                background: form.dayOfWeek === i + 1 ? 'var(--color-campus)' : '#FDFEFE',
                color: form.dayOfWeek === i + 1 ? '#FDFEFE' : 'var(--color-text-secondary)',
                border: form.dayOfWeek === i + 1 ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
                fontSize: 13, fontWeight: 600,
              }}>{lang === 'zh' ? `周${d}` : appDayShort(lang, i + 1)}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.f.startTime')}</div>
          <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.f.endTime')}</div>
          <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.f.weeks')}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="number" min={1} max={20} value={weekStart}
              onChange={e => setWeekStart(parseInt(e.target.value) || 1)}
              style={{ ...inputStyle, textAlign: 'center' }}
              placeholder={t('campus.f.weekStart')}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>~</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="number" min={1} max={20} value={weekEnd}
              onChange={e => setWeekEnd(parseInt(e.target.value) || 13)}
              style={{ ...inputStyle, textAlign: 'center' }}
              placeholder={t('campus.f.weekEnd')}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          {t('campus.f.weeksHint')}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.f.credits')}</div>
        <input type="number" min={0} max={10} step={0.5} value={form.credits} onChange={e => setForm({ ...form, credits: parseFloat(e.target.value) || 0 })} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.f.color')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {colors.map(c => (
            <button key={c} onClick={() => setForm({ ...form, color: c })}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: form.color === c ? '3px solid var(--color-text)' : 'none',
                background: c, cursor: 'pointer', flex: 1, maxWidth: 36,
              }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{isEdit ? t('common.saveChanges') : t('common.confirmAdd')}</button>
      </div>
    </div>
  );
}

function CourseCard({ course, onDelete, onEdit }: { course: Course; onDelete: (id: string) => void; onEdit: () => void }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const weekText = course.weeks && course.weeks.length > 0
    ? (course.weeks[course.weeks.length - 1] - course.weeks[0] + 1 >= 13
        ? ''
        : t('campus.card.weeksAttend', { a: course.weeks[0], b: course.weeks[course.weeks.length - 1] }))
    : '';
  return (
    <div className="card" style={{ borderLeft: `4px solid ${course.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{course.name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {course.code} · {t('campus.card.credits', { n: course.credits })}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={14} /> {course.startTime}-{course.endTime}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={14} /> {course.location}
            </span>
          </div>
          {weekText && (
            <div style={{ fontSize: 11, color: 'var(--color-campus)', marginTop: 4, fontWeight: 600 }}>
              {weekText}{/* zh 顯示「第X-Y周上課」，en 顯示「Weeks X-Y」 */}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <Pencil size={16} color="var(--color-text-tertiary)" style={{ cursor: 'pointer', marginTop: 1 }} onClick={onEdit} />
          <Trash2 size={16} color="var(--color-danger)" style={{ cursor: 'pointer' }} onClick={() => { if (confirm(t('campus.confirmDeleteCourse'))) onDelete(course.id); }} />
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)', fontSize: 13 }}>
          {course.teacher && <InfoRow label={t('campus.card.teacher')} value={course.teacher} />}
          {course.gradeComposition && <InfoRow label={t('campus.card.grading')} value={course.gradeComposition} />}
          {course.canvasLink && (
            <div style={{ marginTop: 8 }}>
              <a href={course.canvasLink} target="_blank" rel="noreferrer" style={{ color: 'var(--color-campus)', fontSize: 13 }}>{t('campus.openCanvas')}</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', marginBottom: 4 }}><span style={{ width: 70, color: 'var(--color-text-secondary)', fontSize: 12 }}>{label}</span><span style={{ flex: 1, fontSize: 13 }}>{value}</span></div>;
}

// ============ 任務視圖 ============
function TaskView() {
  const { lang, t } = useLang();
  const [tasks, setTasks] = useLocalStorage<Task[]>('campus_tasks', []);
  const [courses] = useLocalStorage<Course[]>('campus_courses', []);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayKey);

  // 打開時執行順延：未完成的過期任務自動滾到今天，rolledFrom 記錄最初日期
  useEffect(() => {
    const today = todayKey();
    setTasks(prev => {
      let changed = false;
      const next = prev.map(t => {
        if (!t.date) { changed = true; return { ...t, date: today }; }
        if (!t.completed && t.date < today) {
          changed = true;
          return { ...t, date: today, rolledFrom: t.rolledFrom || t.date };
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, []);

  const toggleTask = (id: string) => {
    const cur = tasks.find(t => t.id === id);
    // 完成播上揚音，取消完成播普通嗒聲
    playSound(cur && !cur.completed ? 'success' : 'tap');
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed, completedAt: t.completed ? undefined : new Date().toISOString() } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const dayTasks = tasks.filter(t => t.date === selectedDate);
  // 緊急度排序：未完成在前 → 截止日早的在前 → 優先級高的在前 → 先創建的在前
  // （與首頁排序一致：新插入的緊急任務因 deadline 靠前自動浮到上面）
  const pOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...dayTasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const dl = (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
    if (dl !== 0) return dl;
    const pr = pOrder[a.priority] - pOrder[b.priority];
    if (pr !== 0) return pr;
    return a.createdAt.localeCompare(b.createdAt);
  });

  // DDL 聯動：哪些日期有截止任務（紅點=還有未完成，綠點=全部搞定）
  const ddlMarks: Record<string, 'pending' | 'done'> = {};
  tasks.forEach(t => {
    if (!t.deadline) return;
    if (!t.completed) ddlMarks[t.deadline] = 'pending';
    else if (!ddlMarks[t.deadline]) ddlMarks[t.deadline] = 'done';
  });

  // 當天截止的任務（不管它安排在哪天做）
  const ddlTasks = tasks.filter(t => t.deadline === selectedDate);
  // 警示橫幅只列「安排在其他天」的截止任務；當天安排+當天截止的在下方列表帶紅色 DDL 標籤（去重）
  const remoteDdlTasks = ddlTasks.filter(t => t.date !== selectedDate);
  const remoteDdlDone = remoteDdlTasks.filter(t => t.completed).length;

  if (showAdd) {
    return (
      <AddTaskForm
        courses={courses}
        defaultDate={selectedDate}
        onAdd={(t) => { setTasks(prev => [...prev, t]); setShowAdd(false); }}
        onCancel={() => setShowAdd(false)}
      />
    );
  }

  // 編輯模式：複用同一表單，保存時按 id 覆蓋
  const editingTask = editingId ? tasks.find(t => t.id === editingId) : null;
  if (editingTask) {
    return (
      <AddTaskForm
        courses={courses}
        defaultDate={selectedDate}
        editTask={editingTask}
        onAdd={(t) => { setTasks(prev => prev.map(x => x.id === t.id ? t : x)); setEditingId(null); }}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  const isToday = selectedDate === todayKey();
  const pendingCount = dayTasks.filter(t => !t.completed).length;

  return (
    <div>
      <DateSlider selectedDate={selectedDate} onChange={setSelectedDate} marks={ddlMarks} />

      {/* AI 快速記：隨手一段話 → AI 拆成多條學業任務（關聯課程+計劃日/截止日），自動填入 */}
      <QuickNote courses={courses} onAdd={(newTasks) => setTasks(prev => [...newTasks, ...prev])} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {isToday ? t('common.today') : selectedDate.slice(5).replace('-', '/')} · {t('campus.task.pendingCount', { n: pendingCount })}
        </span>
        <button style={btnAdd} onClick={() => setShowAdd(true)}><Plus size={14} />{t('campus.task.new')}</button>
      </div>

      {/* 當日截止警示橫幅（暖珊瑚主題，與下方白卡一眼區分、不與藍底對沖）：
          只列「安排在其他天、但今天截止」的任務——當天安排+當天截止的在下面列表裡帶紅色 DDL 標籤，
          不再兩邊重複出現。行內標註「安排在 M/D 做」說明計劃日。 */}
      {remoteDdlTasks.length > 0 && (
        <div style={ddlBannerStyle}>
          <div style={ddlBannerHeadStyle}>
            <Flag size={13} color="#fff" strokeWidth={2.4} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('campus.task.dueToday')} · {remoteDdlDone}/{remoteDdlTasks.length}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 500, opacity: 0.9 }}>{t('campus.task.dueTodayHint')}</span>
          </div>
          {remoteDdlTasks.map((task, idx) => {
            const course = task.courseId ? courses.find(c => c.id === task.courseId) : null;
            return (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderBottom: idx < remoteDdlTasks.length - 1 ? '1px solid rgba(232,162,142,0.35)' : 'none',
                opacity: task.completed ? 0.6 : 1,
              }}>
                <button data-sound="none" onClick={() => toggleTask(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                  {task.completed ? <CheckSquare size={20} color="var(--color-success)" /> : <div style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid #D97354' }} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                    {course && <span style={{ fontSize: 11, fontWeight: 600, color: course.color }}>{course.code}</span>}
                    {task.date && <span style={{ fontSize: 11, color: '#C26B4F' }}>{t('campus.task.plannedOn', { md: task.date.slice(5).replace('-', '/') })}</span>}
                  </div>
                </div>
                {task.completed ? (
                  <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: '#2E86B8', color: '#fff', flexShrink: 0 }}>{t('campus.task.done')}</span>
                ) : (
                  <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: '#D97354', color: '#fff', flexShrink: 0 }}>{t('campus.task.undone')}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dayTasks.length === 0 && remoteDdlTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          art="/art/bear-empty.svg"
          title={isToday ? t('campus.task.noneToday') : t('campus.task.noneDay')}
          desc={isToday ? t('campus.task.noneTodayDesc') : t('campus.task.noneDayDesc')}
          actionLabel={t('campus.task.addTask')}
          onAction={() => setShowAdd(true)}
        />
      ) : (
        sorted.map(task => {
          const course = task.courseId ? courses.find(c => c.id === task.courseId) : null;
          const isRolled = task.rolledFrom && task.rolledFrom !== task.date;
          const ddl = task.deadline ? ddlInfo(task.deadline, lang) : null;
          return (
            <div key={task.id} className="card" style={{ opacity: task.completed ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <button data-sound="none" onClick={() => toggleTask(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 2 }}>
                  {task.completed ? <CheckSquare size={20} color="var(--color-campus)" /> : <div style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid var(--color-text-tertiary)' }} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    {course && <span className="module-tag campus" style={{ background: `${course.color}15`, color: course.color }}>{course.code}</span>}
                    <span className={`priority-tag ${task.priority}`}>{task.priority === 'high' ? t('campus.task.f.high') : task.priority === 'medium' ? t('campus.task.f.medium') : t('campus.task.f.low')}</span>
                    {ddl && <span style={{ fontSize: 11, fontWeight: 600, color: ddl.color, background: ddl.bg, padding: '2px 8px', borderRadius: 100 }}>{ddl.text}</span>}
                    {isRolled && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#B3865C', background: 'rgba(247,192,107,0.16)', padding: '2px 8px', borderRadius: 100 }}>
                        {t('date.rolledFrom', { md: task.rolledFrom!.slice(5).replace('-', '/') })}
                      </span>
                    )}
                  </div>
                </div>
                <Pencil size={15} color="var(--color-text-tertiary)" style={{ cursor: 'pointer', flexShrink: 0, marginTop: 2 }} onClick={() => setEditingId(task.id)} />
                <Trash2 size={16} color="var(--color-danger)" style={{ cursor: 'pointer', flexShrink: 0, marginTop: 2 }} onClick={() => deleteTask(task.id)} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AddTaskForm({ courses, defaultDate, onAdd, onCancel, editTask }: { courses: Course[]; defaultDate: string; onAdd: (t: Task) => void; onCancel: () => void; editTask?: Task | null }) {
  const { t } = useLang();
  const isEdit = !!editTask;
  const [title, setTitle] = useState(editTask?.title || '');
  const [courseId, setCourseId] = useState(editTask?.courseId || '');
  const [date, setDate] = useState(editTask?.date || defaultDate);
  const [deadline, setDeadline] = useState(editTask?.deadline || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(editTask?.priority || 'medium');

  const submit = () => {
    if (!title.trim()) { alert(t('campus.task.alertTitle')); return; }
    playSound('success');
    if (isEdit && editTask) {
      onAdd({
        ...editTask,
        title, courseId: courseId || undefined, date: date || undefined,
        deadline: deadline || undefined, priority,
      });
    } else {
      onAdd({
        id: genId(), title, courseId: courseId || undefined, module: 'campus',
        date: date || undefined, deadline: deadline || undefined,
        priority, completed: false, createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{isEdit ? t('campus.task.editTask') : t('campus.task.addTask')}</span>
        <X size={20} color="var(--color-text-tertiary)" style={{ cursor: 'pointer' }} onClick={onCancel} />
      </div>

      <FormField label={t('campus.task.f.title')} value={title} onChange={setTitle} placeholder={t('campus.task.f.titlePh')} />

      {courses.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.task.f.course')}</div>
          <select value={courseId} onChange={e => setCourseId(e.target.value)} style={inputStyle}>
            <option value="">{t('campus.task.f.noCourse')}</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.task.f.planDate')}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.task.f.ddl')}</div>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          {t('campus.task.f.ddlHint')}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('campus.task.f.priority')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['high', 'medium', 'low'] as const).map(p => (
            <button key={p} onClick={() => setPriority(p)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
              background: priority === p ? (p === 'high' ? 'var(--color-danger)' : p === 'medium' ? 'var(--color-warning)' : 'var(--color-success)') : '#FDFEFE',
              color: priority === p ? '#FDFEFE' : 'var(--color-text-secondary)',
              border: priority === p ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
              fontSize: 13, fontWeight: 600,
            }}>{p === 'high' ? t('campus.task.f.high') : p === 'medium' ? t('campus.task.f.medium') : t('campus.task.f.low')}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{t('common.confirm')}</button>
      </div>
    </div>
  );
}

// ============ AI 快速記（學業任務版） ============
// 用戶隨手輸入一段沒邏輯的話，AI 拆成多條學業任務（標題/關聯課程/計劃日/截止日/優先級）。
// 與 Work 版的差異：Campus 任務帶 courseId 關聯 + date(計劃日)/deadline(截止日) 雙日期。
// 註：textarea 用非受控模式（ref 直讀），打字全程 React 不介入——
//     受控 value 在 iOS 中文輸入法下會重設光標，導致「光標亂跑」。
function QuickNote({ courses, onAdd }: { courses: Course[]; onAdd: (tasks: Task[]) => void }) {
  const { lang, t } = useLang();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const run = async () => {
    if (loading) return;
    const val = taRef.current?.value ?? '';
    if (!val.trim()) { setFeedback({ ok: false, msg: t('campus.ai.empty') }); return; }
    setLoading(true);
    setFeedback(null);
    const parsed = await aiParseCampusTasks(val, lang, courses);
    if (parsed && parsed.length > 0) {
      // ⭐ 客戶端兜底：AI 漏識別課程編號時，從原始 input 提取 4+ 位數字後綴補關聯
      // 解決「輸入 5644 應該關聯 MKT5644 但 AI 沒填 courseCode」的場景
      const fixups = scanInputForCourseMatches(val, courses);
      let extra = 0;
      if (fixups.length > 0) {
        for (const task of parsed) {
          if (task.courseId) continue;
          // 任務標題裡包含的數字後綴優先
          const hit = fixups.find(f => task.title.includes(f.code));
          if (hit) { task.courseId = hit.courseId; }
        }
        // 如果 AI 完全沒輸出對應的 task（純數字輸入被丟棄），補建一條「<編號> 任務」
        for (const f of fixups) {
          if (!parsed.some(t => t.courseId === f.courseId)) {
            parsed.unshift({
              id: genId(), title: `${f.code} 任務`, courseId: f.courseId,
              module: 'campus', date: new Date().toISOString().slice(0, 10), priority: 'medium',
              completed: false, createdAt: new Date().toISOString(),
            });
            extra++;
          }
        }
      }
      onAdd(parsed);
      // 反饋條直接顯示關聯結果，用戶一眼確認課程掛沒掛上
      const linked = parsed.filter(x => x.courseId).length;
      const msg = extra > 0
        ? t('campus.ai.doneLinked', { n: parsed.length, m: linked })
        : (linked > 0 ? t('campus.ai.doneLinked', { n: parsed.length, m: linked }) : t('campus.ai.done', { n: parsed.length }));
      setFeedback({ ok: true, msg });
      if (taRef.current) taRef.current.value = '';
      playSound('success');
    } else {
      setFeedback({ ok: false, msg: t('campus.ai.fail') });
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
            <span className="ai-title-text">{t('campus.ai.title')}</span>
          </div>
          <div className="ai-bubble">{t('campus.ai.desc')}</div>
        </div>
        <img src="/art/snowman-ai.svg" alt="" aria-hidden width={76} height={76}
          className="ai-mascot" draggable={false} />
      </div>
      {/* 输入区独占整行，不再受角色占用空间挤在左边 */}
      <div className="ai-textarea-wrap">
        <textarea
          ref={taRef}
          placeholder={t('campus.ai.placeholder')}
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
            ? <><span className="ai-spinner" />{t('campus.ai.working')}</>
            : <><Sparkles size={13} />{t('campus.ai.button')}</>}
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

/** 課程匹配：AI 輸出的 courseCode → courseId。
 *  防禦：normalize（大小寫/空格/連字符）後雙向包含匹配，唯一命中才關聯；
 *  零命中（AI 幻覺課程）或多義（拼接了兩門課）一律留空——寧可不關聯，不可關聯錯。 */
function matchCourse(raw: string, courses: Course[]): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, '');
  const c = norm(raw);
  if (!c || courses.length === 0) return undefined;
  const hits = courses.filter(x => {
    const code = norm(x.code), name = norm(x.name);
    return code === c || code.includes(c) || c.includes(code) || name.includes(c) || c.includes(name);
  });
  return hits.length === 1 ? hits[0].id : undefined;
}

/** 兜底掃描：從用戶原始 input 抓所有 4+ 位連續數字，每個都嘗試做課程編號後綴匹配。
 *  解決 AI 對純數字（如 "5644"）識別不出的場景。回傳 [{code, courseId}, ...] */
function scanInputForCourseMatches(input: string, courses: Course[]): { code: string; courseId: string }[] {
  if (!input || courses.length === 0) return [];
  // 抓 4+ 位連續數字（含大寫字母+數字的混合編號如 "MKT5644" 的尾部）
  const tokens = new Set<string>();
  for (const m of input.matchAll(/\b([A-Za-z]{0,8}\d{3,6})\b/g)) tokens.add(m[1].toUpperCase());
  for (const m of input.matchAll(/\b(\d{4,6})\b/g)) tokens.add(m[1]);
  const out: { code: string; courseId: string }[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const id = matchCourse(t, courses);
    if (id && !seen.has(id)) {
      seen.add(id);
      // 還原完整編號（用 courses 裡原 code 顯示，給用戶看更直觀）
      const c = courses.find(x => x.id === id);
      out.push({ code: c?.code || t, courseId: id });
    }
  }
  return out;
}

/** 課程匹配（title 兜底）：AI 沒填 courseCode 字段時，掃描 title 裡出現的課程編號/課名。
 *  真實 API 測試發現 DeepSeek 常把課程信息只寫進 title 而漏填 courseCode，
 *  這裡從 title 反向掃描補救。同樣要求唯一命中（title 同時含兩門課編號 → 不關聯）。 */
function matchCourseFromTitle(title: string, courses: Course[]): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, '');
  const t = norm(title);
  if (!t || courses.length === 0) return undefined;
  const hits = courses.filter(x => {
    const code = norm(x.code), name = norm(x.name);
    return (code.length >= 2 && t.includes(code)) || (name.length >= 2 && t.includes(name));
  });
  return hits.length === 1 ? hits[0].id : undefined;
}

/** AI 解析：一段亂文字 → 結構化學業任務數組（含課程關聯與雙日期） */
async function aiParseCampusTasks(input: string, lang: Lang, courses: Course[]): Promise<Task[] | null> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekday = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { weekday: 'long' });

  const courseList = courses.length > 0
    ? courses.map(c => `- ${c.code}（${c.name}）`).join('\n')
    : '（用戶還沒添加課程，courseCode 一律留空 ""）';

  const prompt = `今天是 ${todayStr}（${weekday}）。用戶在記學業待辦，隨手寫了一段可能沒有邏輯的文字，請整理成學業任務列表。

【輸出格式】純淨 JSON，不要 markdown 代碼塊：
{"tasks":[{"title":"...","courseCode":"...","date":"YYYY-MM-DD","deadline":"YYYY-MM-DD","priority":"high|medium|low"}]}

【用戶已選課程列表】：
${courseList}

【課程關聯（重要）】
- 每條任務提到的課程，courseCode 必須填該課程的編號（從上面列表原樣照抄，如 "COMP5001"）
- 沒提到課程的任務 courseCode 填 ""
- 一條任務只關聯一門課；同一門課的多個事項拆成多條
- ⭐ 純數字也可能是課程編號：例如用戶單獨輸入 "5644"（對應 MKT5644）、"5001"（對應 COMP5001），
  必須把這種 4+ 位連續數字當作課程編號的後綴去匹配，命中後原樣寫進 title 並填 courseCode
- ⭐ 用戶輸入裡如果只給了 4+ 位數字，title 至少要寫成「<該編號> 任務」並把 courseCode 填那個完整編號

【核心原則：語義完整性優先】
title 必須是一句完整、自然、單獨可讀的話，課程編號寫進 title（如「交 COMP5001 作業」），
同時該條的 courseCode 填 COMP5001。你只整理語序和表達，不改變意思，更不要把一句話肢解。

【規則】
1. date：計劃哪天做（沒提計劃日就填今天 ${todayStr}）；deadline：哪天必須交/考（「……前/之前」按截止日算）。沒提截止日就省略 deadline 字段
2. 結合今天 ${todayStr} 換算相對時間；提到的星期幾或日期若已過去，取未來最近的一天
3. priority：截止日在 3 天內或語氣緊急用 high；有明確日期的普通事項用 medium；隨性無明確日期用 low
4. 多件事就輸出多條（不同課程的作業是不同的任務，各自一條）；但一件事有多個細節（哪門課、做什麼）仍是同一條，別按細節拆
   例：「周五前交COMP5001作業，下周二EE6615小測要複習」→ 兩條：①交 COMP5001 作業（courseCode: COMP5001，deadline: 周五）②複習 EE6615 備小測（courseCode: EE6615）
5. 語言跟隨用戶輸入（英文輸入輸出英文，中文輸入輸出中文）

用戶輸入：${input}`;

  const result = await callDeepSeek([
    { role: 'system', content: '你是一個學業待辦整理助手，只輸出純淨 JSON，不要任何其他文字。整理時保持每條任務的語義完整自然，課程編號必須準確填入 courseCode 字段。' },
    { role: 'user', content: prompt },
  ], 0.2);

  if (!result) return null;
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    const arr = Array.isArray(data) ? data : (data.tasks ?? data.todos);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.slice(0, 20).map((x: Record<string, unknown>): Task => {
      const title = String(x.title || '').trim().slice(0, 100);
      // ---- 防禦性清洗（AI 輸出不可信，逐字段校驗）----
      // 計劃日：格式校驗；AI 算出過去日期 → clamp 今天（與任務順延機制一致，保證立即可見）
      const rawDate = /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) ? String(x.date) : todayStr;
      const date = rawDate < todayStr ? todayStr : rawDate;
      // 截止日：格式校驗；保留逾期語義（ddlInfo 會顯示「逾期 n 天」），但計劃日不得晚於截止日
      const rawDeadline = /^\d{4}-\d{2}-\d{2}$/.test(String(x.deadline)) ? String(x.deadline) : undefined;
      const deadline = rawDeadline && rawDeadline < date ? date : rawDeadline;
      // 課程關聯（三重防禦）：
      // ① 兼容 AI 返回的多種字段名（courseCode / course / course_code）
      // ② 字段值匹配：唯一命中才關聯
      // ③ 兜底：AI 漏填字段時從 title 掃描課程編號/課名
      const rawCourse = x.courseCode ?? x.course ?? x.course_code;
      let courseId = rawCourse ? matchCourse(String(rawCourse), courses) : undefined;
      if (!courseId) courseId = matchCourseFromTitle(title, courses);
      return {
        id: genId(),
        title,
        courseId,
        module: 'campus',
        date,
        deadline,
        priority: x.priority === 'high' || x.priority === 'low' ? x.priority : 'medium',
        completed: false,
        createdAt: new Date().toISOString(),
      };
    }).filter(task => task.title.length > 0);
  } catch (e) {
    console.error('AI 學業任務解析失敗:', e);
    return null;
  }
}

// ============ 共用組件 ============
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

const btnAdd = {
  padding: '6px 12px', borderRadius: 100, border: 'none',
  background: 'var(--gradient-ice)', color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
} as const;

// ---- 當日截止警示橫幅（暖珊瑚實底，呼應手繪素材的橙色基因；不透明、不與藍底對沖）----
const ddlBannerStyle = {
  borderRadius: 18, marginBottom: 14, overflow: 'hidden',
  background: 'linear-gradient(180deg, #FBE4DC 0%, #F7D9CD 100%)',
  border: '1.5px solid #E8A28E',
  boxShadow: '0 2px 8px rgba(217, 115, 84, 0.22)',
} as const;

const ddlBannerHeadStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', color: '#fff',
  background: 'linear-gradient(135deg, #E58A6F 0%, #D97354 100%)',
} as const;

// ---- AI 快速記樣式已遷移到 index.css 的 .ai-card / .ai-bubble / .ai-textarea / .ai-submit ----
// 註：iOS WebKit 已知 bug——backdrop-filter（毛玻璃）容器內的輸入框光標會錯位亂跳；
// 且字號 <16px 會觸發 Safari 聚焦自動放大頁面。故此卡不用毛玻璃、輸入字號用 16。
