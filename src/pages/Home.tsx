import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Dumbbell, CalendarDays } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { todayKey, ddlInfo } from '../utils/date';
import { getDailyInsight } from '../utils/deepseek';
import { useLang } from '../i18n';
import CourseDetailModal from '../components/CourseDetailModal';
import NoticeBoard from '../components/NoticeBoard';
import type { Course, Task, ExerciseRecord, MealRecord } from '../types';

/* ============ 極地藍 · 手繪雪山 ============
 * 深藍夜空 + 奶油白卡 + 粉藍/亮天藍點綴。
 * 素材以 /art/ 名固定：你的 SVG 進來同檔名替換即生效。
 * img 載入失敗 → fallback 到內聯簡版 SVG / Caveat 字體 / lucide 圖標，
 * 任何時候頁面都完整好看。 */

const MOUNTAIN = '/art/mountain-hero.svg';
const DONE = '/art/done.svg';
const BEAR = '/art/bear-empty.svg';

/* ---- 素材組件：SVG 圖 → fallback 內聯 ---- */
function Art({ src, fallback, style, alt = '', className }: {
 src: string; fallback?: ReactNode; style?: CSSProperties; alt?: string; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} className={className} style={style} draggable={false} onError={() => setFailed(true)} />;
}

/* 手寫大數字（刊頭）：SVG → Caveat 字體 fallback */
function ArtNumber({ n, h = 64 }: { n: number | string; h?: number }) {
  const src = `/art/num-${n}.svg`;
  return (
    <span className="home-num-wrap" style={{ height: h }}>
      <Art
        src={src}
        style={{ height: h, width: 'auto', display: 'block' }}
        fallback={<span className="hand-num" style={{ fontSize: h * 1.04, lineHeight: `${h * 0.86}px` }}>{n}</span>}
      />
    </span>
  );
}

/* 通用雪山 fallback（內聯簡版 · 亮色線稿） */
function FallbackMountain({ width = 104 }: { width?: number }) {
  const h = Math.round(width * 320 / 260);
  return (
    <svg width={width} height={h} viewBox="0 0 260 320" fill="none" aria-hidden>
      <path d="M104 196 L186 124 L240 196 L222 202 L208 192 L194 202 L180 192 L166 200 L152 192 L138 202 L124 192 Z" fill="#2E5A85" stroke="#A8D8EA" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M168 142 L186 124 L206 146 L196 140 L186 152 L176 140 Z" fill="#A8D8EA" stroke="#A8D8EA" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M22 270 L120 74 L218 270 L208 260 L196 272 L182 258 L168 272 L154 258 L140 272 L126 258 L112 272 L98 258 L84 272 L70 260 L58 270 Z" fill="#C6DFEF" stroke="#A8D8EA" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M94 134 L120 74 L146 134 L138 126 L130 138 L122 124 L114 138 L106 126 Z" fill="#2E86B8" stroke="#A8D8EA" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M48 42 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#2E86B8"/>
      <path d="M204 56 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#A8D8EA"/>
      <circle cx="60" cy="284" r="3" fill="#C6DFEF"/>
      <circle cx="148" cy="290" r="3" fill="#C6DFEF"/>
      <circle cx="200" cy="282" r="3" fill="#C6DFEF"/>
    </svg>
  );
}

/* 雪花 fallback（內聯通用四芒星） */
function FallbackFlake({ kind, size }: { kind: string; size: number }) {
  if (kind === 'a') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <g stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 5 L20 35"/><path d="M6.96 12.5 L33.04 27.5"/><path d="M33.04 12.5 L6.96 27.5"/>
          <path d="M20 5 l-3.5 3.5 M20 5 l3.5 3.5 M20 35 l-3.5 -3.5 M20 35 l3.5 -3.5"/>
          <circle cx="20" cy="20" r="1.4" fill="#FFFFFF" stroke="none"/>
        </g>
      </svg>
    );
  }
  if (kind === 'b') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path d="M20 4 L23.5 16.5 L36 20 L23.5 23.5 L20 36 L16.5 23.5 L4 20 L16.5 16.5 Z" fill="#FFFFFF"/>
        <circle cx="20" cy="20" r="2.4" fill="#0E2A4A"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="3" fill="#FFFFFF"/>
      <circle cx="9" cy="13" r="1.8" fill="#FFFFFF"/><circle cx="31" cy="12" r="1.8" fill="#FFFFFF"/>
      <circle cx="10" cy="30" r="1.8" fill="#FFFFFF"/><circle cx="31" cy="29" r="1.8" fill="#FFFFFF"/>
      <path d="M14 16 v4 M12 18 h4 M26 24 v4 M24 26 h4" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

/* 完成态 fallback（山顶插旗 · 亮色线稿） */
function FallbackDone({ width = 140 }: { width?: number }) {
  const h = Math.round(width * 200 / 200);
  return (
    <svg width={width} height={h} viewBox="0 0 200 200" fill="none" aria-hidden>
      <path d="M30 168 L100 84 L168 168 L156 160 L146 170 L134 158 L122 170 L110 158 L98 170 L86 160 L76 170 L64 160 L54 168 Z" fill="#2E5A85" stroke="#A8D8EA" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M82 116 L100 84 L118 116 L110 110 L102 120 L94 110 Z" fill="#C6DFEF" stroke="#A8D8EA" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M100 84 L100 34" stroke="#A8D8EA" strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M100 34 L140 44 L100 56 Z" fill="#2E86B8" stroke="#A8D8EA" strokeWidth="3.5" strokeLinejoin="round"/>
      <path d="M158 40 l2.4 6.4 6.4 2.4 -6.4 2.4 -2.4 6.4 -2.4 -6.4 -6.4 -2.4 6.4 -2.4z" fill="#2E86B8"/>
    </svg>
  );
}

/* 空態北極熊 fallback（躺平小熊 · 亮色線稿） */
function FallbackBear({ width = 84 }: { width?: number }) {
  const h = Math.round(width * 160 / 200);
  return (
    <svg width={width} height={h} viewBox="0 0 200 160" fill="none" aria-hidden>
      <path d="M52 38 L44 22 L62 28 Z" fill="#C6DFEF" stroke="#A8D8EA" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M92 34 L96 16 L108 32 Z" fill="#C6DFEF" stroke="#A8D8EA" strokeWidth="4" strokeLinejoin="round"/>
      <circle cx="76" cy="56" r="30" fill="#C6DFEF" stroke="#A8D8EA" strokeWidth="4.5"/>
      <path d="M60 66 q4 -4 8 0 M84 66 q4 -4 8 0" stroke="#2E5A85" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="76" cy="76" rx="5" ry="3.5" fill="#2E5A85"/>
      <path d="M76 79 q-6 6 -14 3 M76 79 q6 6 14 3" stroke="#2E5A85" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M104 74 q28 -18 52 -6 q14 8 10 26 q-4 16 -24 22 q-28 8 -52 -2 q-16 -8 -12 -26 q3 -10 26 -14 Z" fill="#C6DFEF" stroke="#A8D8EA" strokeWidth="4.5" strokeLinejoin="round"/>
      <circle cx="142" cy="92" r="9" fill="#2E5A85" stroke="#A8D8EA" strokeWidth="3"/>
      <path d="M112 118 q4 12 -2 18 M136 122 q4 10 0 16" stroke="#A8D8EA" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M46 92 q-10 4 -18 2 M50 104 q-8 8 -16 8" stroke="#A8D8EA" strokeWidth="3" strokeLinecap="round"/>
      <path d="M20 60 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#2E86B8"/>
    </svg>
  );
}

/* 語義色映射已移至 NoticeBoard 組件 */

// 朋友版（Cloudflare Pages）構建開關：VITE_FRIEND=1 時，問候語與 AI prompt 均不帶用戶名
const FRIEND_BUILD = import.meta.env.VITE_FRIEND === '1';

export default function Home() {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const [userName] = useLocalStorage<string>('user_name', 'HAKON');
  const [courses] = useLocalStorage<Course[]>('campus_courses', []);
  const [tasks, setTasks] = useLocalStorage<Task[]>('campus_tasks', []);
  const [workTasks, setWorkTasks] = useLocalStorage<Task[]>('work_tasks', []);
  const [exercises] = useLocalStorage<ExerciseRecord[]>('fitness_exercises', []);
  const [meals] = useLocalStorage<MealRecord[]>('fitness_meals', []);

  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const todayDate = todayKey();

  // 夜空接管
  useEffect(() => {
    document.getElementById('root')?.classList.add('home-night');
    const meta = document.querySelector('meta[name="theme-color"]');
    const oldColor = meta?.getAttribute('content') ?? '';
    meta?.setAttribute('content', '#5B97CB');
    return () => {
      document.getElementById('root')?.classList.remove('home-night');
      if (meta && oldColor) meta.setAttribute('content', oldColor);
    };
  }, []);

  // 學校任務順延
  useEffect(() => {
    setTasks(prev => {
      let changed = false;
      const next = prev.map(t => {
        if (!t.date) { changed = true; return { ...t, date: todayDate }; }
        if (!t.completed && t.date < todayDate) {
          changed = true;
          return { ...t, date: todayDate, rolledFrom: t.rolledFrom || t.date };
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, [todayDate, setTasks]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayDow = now.getDay() || 7;

  // ---- 今日數據 ----
  const dayCourses = courses.filter(c => c.dayOfWeek === todayDow).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const inClass = dayCourses.filter(c => toMin(c.startTime) <= nowMin && nowMin < toMin(c.endTime));
  const nextClass = dayCourses.find(c => toMin(c.startTime) > nowMin);

  const pendingCampusTasks = tasks.filter(t => !t.completed && (!t.date || t.date <= todayDate));
  const pendingWorkTasks = workTasks.filter(t => !t.completed && (!t.deadline || t.deadline >= todayDate));
  const dueTodayAll = [...pendingCampusTasks, ...pendingWorkTasks].filter(t => t.deadline === todayDate);
  const doneToday = [...tasks, ...workTasks].filter(t => t.completed && (t.completedAt ?? '').slice(0, 10) === todayDate).length;

  const pOrder = { high: 0, medium: 1, low: 2 } as const;
  const byUrgency = (a: Task, b: Task) =>
    (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
    || pOrder[a.priority] - pOrder[b.priority]
    || a.createdAt.localeCompare(b.createdAt);
  const sortedCampusTasks = [...pendingCampusTasks].sort(byUrgency);
  const sortedWorkTasks = [...pendingWorkTasks].sort(byUrgency);

  // ---- Hero ----
  const heroDue = dueTodayAll.length > 0 ? [...dueTodayAll].sort(byUrgency)[0] : null;
  const heroInClass = inClass[0] ?? null;
  const hero = heroDue
    ? { kind: 'due' as const, task: heroDue, isWork: workTasks.includes(heroDue) }
    : heroInClass
      ? { kind: 'inclass' as const, course: heroInClass }
      : nextClass
        ? { kind: 'next' as const, course: nextClass }
        : sortedCampusTasks[0]
          ? { kind: 'prio' as const, task: sortedCampusTasks[0], isWork: false }
          : sortedWorkTasks[0]
            ? { kind: 'prio' as const, task: sortedWorkTasks[0], isWork: true }
            : null;

  const heroLabel = hero
    ? hero.kind === 'due' ? t('home.heroDue')
      : hero.kind === 'inclass' ? t('home.heroInClass')
        : hero.kind === 'next' ? t('home.heroNext')
          : t('home.heroPriority')
    : '';
  const heroColor = hero
    ? hero.kind === 'due' ? '#B96655'
      : hero.kind === 'prio' ? '#2E86B8'
        : hero.course.color
    : '#2E86B8';

  const cdText = (mins: number): string => {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h > 0 && m > 0) return t('home.leftHM', { h, m });
    if (h > 0) return t('home.leftH', { h });
    return t('home.leftM', { m: Math.max(m, 1) });
  };

  // ---- 時間線 ----
  const todayExercises = exercises.filter(e => e.date === todayDate);
  const timeline = [
    ...dayCourses.map(c => ({
      key: c.id, kind: 'course' as const,
      time: c.startTime, title: c.code || c.name, sub: c.location,
      color: c.color,
      state: toMin(c.endTime) <= nowMin ? 'past' as const
        : toMin(c.startTime) <= nowMin ? 'current' as const : 'upcoming' as const,
      course: c as Course | undefined,
    })),
    ...dueTodayAll.map(tk => ({
      key: `d-${tk.id}`, kind: 'due' as const,
      time: t('home.weekDue'), title: tk.title,
      sub: (() => {
        const c = tk.courseId ? courses.find(x => x.id === tk.courseId) : undefined;
        return c ? (c.code || c.name) : (tk.company ?? '');
      })(),
      color: '#B96655', state: 'upcoming' as const,
      course: undefined as Course | undefined,
    })),
    ...todayExercises.map(e => ({
      key: `e-${e.id}`, kind: 'exercise' as const,
      time: e.time, title: e.category, sub: `${e.duration} ${lang === 'en' ? 'min' : '分鐘'}`,
      color: '#2E86B8', state: 'past' as const,
      course: undefined as Course | undefined,
    })),
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  const hasAnyData = courses.length > 0 || tasks.length > 0 || workTasks.length > 0 || exercises.length > 0 || meals.length > 0;

  // ---- AI Daily Insight：每日一句點評（當日 + 語言 緩存一次） ----
  useEffect(() => {
    if (!hasAnyData) return;
    const cacheKey = `home_insight_v1_${todayDate}_${lang}`;
    let cached: string | null = null;
    try { cached = localStorage.getItem(cacheKey); } catch { /* ignore */ }
    if (cached) { setInsight(cached); return; }

    setInsightLoading(true);
    const courseDesc = dayCourses.length > 0
      ? dayCourses.map(c => `${c.code || c.name} ${c.startTime}`).join(', ')
      : (lang === 'en' ? 'none' : '無');
    const dueDesc = dueTodayAll.length > 0
      ? dueTodayAll.map(tk => tk.title).join(', ')
      : (lang === 'en' ? 'none' : '無');
    const nextDesc = hero
      ? (hero.kind === 'due' || hero.kind === 'prio'
        ? `${hero.task.title}${hero.kind === 'due' ? (lang === 'en' ? ' (due today)' : '（今天截止）') : ''}`
        : `${hero.course.startTime} ${hero.course.name}`)
      : (lang === 'en' ? 'nothing scheduled' : '沒有安排');
    const profile = lang === 'en'
      ? `Today: ${DOW_EN[now.getDay()]}; ${dayCourses.length} classes (${courseDesc}); due today: ${dueTodayAll.length} (${dueDesc}); ${sortedCampusTasks.length + sortedWorkTasks.length} open to-dos; ${doneToday} done today; next up: ${nextDesc}.${FRIEND_BUILD ? '' : ` User name: ${userName}.`}`
      : `今天：${DOW_ZH[now.getDay()]}；${dayCourses.length}節課（${courseDesc}）；今天截止 ${dueTodayAll.length} 項（${dueDesc}）；待辦未完成 ${sortedCampusTasks.length + sortedWorkTasks.length} 項；今天已完成 ${doneToday} 項；接下來：${nextDesc}。${FRIEND_BUILD ? '' : `用戶名字：${userName}。`}`;

    let alive = true;
    getDailyInsight(profile, lang).then(text => {
      if (!alive) return;
      setInsightLoading(false);
      if (text) {
        setInsight(text);
        try { localStorage.setItem(cacheKey, text); } catch { /* ignore */ }
      }
    }).catch(() => { if (alive) setInsightLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyData, todayDate, lang]);

  /* ---- 撕掉告示 → 完成（數據邏輯與原 checkbox 完成完全一致） ---- */
  const handleTearOff = (id: string, isWork: boolean) => {
    const at = new Date().toISOString();
    if (isWork) {
      setWorkTasks(prev => prev.map(t2 => t2.id === id ? { ...t2, completed: true, completedAt: at } : t2));
    } else {
      setTasks(prev => prev.map(t2 => t2.id === id ? { ...t2, completed: true, completedAt: at } : t2));
    }
  };

  // ---- 刊頭 ----
  const monthStr = lang === 'en' ? MONTH_EN[now.getMonth()] : MONTH_ZH[now.getMonth()];
  const dowStr = lang === 'en' ? DOW_EN[now.getDay()] : DOW_ZH[now.getDay()];
  const dateNum = now.getDate();
  const hour = now.getHours();
  // 朋友版：greet 去掉 {name}（模板尾逗號一併清除），AI 不叫名字
  const greetName = FRIEND_BUILD ? '' : userName;
  const stripGreet = (s: string) => FRIEND_BUILD ? s.replace(/[，,]\s*$/, '').trim() : s;
  const greet = hour < 11 ? stripGreet(t('home.greetMorning', { name: greetName }))
    : hour < 18 ? stripGreet(t('home.greetAfternoon', { name: greetName }))
    : stripGreet(t('home.greetEvening', { name: greetName }));
  const greetSub = dueTodayAll.length > 0
    ? t('home.greetDue', { n: dueTodayAll.length })
    : (sortedCampusTasks.length + sortedWorkTasks.length) > 0
      ? t('home.briefTodos', { n: sortedCampusTasks.length + sortedWorkTasks.length })
      : (tasks.length + workTasks.length) > 0 && doneToday > 0
        ? t('home.greetAllDone')
        : hasAnyData ? t('home.greetClear') : '';

  // 夜空雪花 5 顆
  const flakes = [
    { f: 'a', top: '6%', left: '5%', size: 44, o: 0.32, d: 0 },
    { f: 'b', top: '10%', left: '82%', size: 30, o: 0.22, d: 1.4 },
    { f: 'c', top: '32%', left: '92%', size: 36, o: 0.18, d: 0.7 },
    { f: 'a', top: '58%', left: '2%', size: 26, o: 0.14, d: 2.0 },
    { f: 'b', top: '78%', left: '88%', size: 48, o: 0.13, d: 0.4 },
  ];

  return (
    <div className="page page-home">
      {/* 夜空散雪（固定視口，不隨滾動） */}
      <div className="home-sky" aria-hidden>
        {flakes.map((x, i) => (
          <div key={i} className="home-flake" style={{ top: x.top, left: x.left, opacity: x.o, animationDelay: `${x.d}s` }}>
            <Art src={`/art/flake-${x.f}.svg`} style={{ width: x.size, height: x.size, display: 'block' }} fallback={<FallbackFlake kind={x.f} size={x.size} />} />
          </div>
        ))}
      </div>

      <div className="page-header home-masthead">
        <div className="home-mast-top">
          <span className="home-kicker">HAKON&rsquo;S&nbsp;MATE</span>
          <span className="home-kicker">{t('home.mastheadWeek', { n: isoWeek(now) })}</span>
        </div>
        <div className="home-date-row">
          <span className="home-date-num-wrap">
            <ArtNumber n={dateNum} h={64} />
          </span>
          <span className="home-date-side">
            <span className="home-date-month">{monthStr} · {dowStr}</span>
            <span className="home-date-year">{now.getFullYear()}</span>
          </span>
        </div>
      </div>

      <div className="page-scroll home-body">
        <div className="home-greet">
          <span className="home-greet-main">{greet}</span>
          {greetSub && <span className="home-greet-sub"> — {greetSub}</span>}
        </div>

        {/* AI Daily Insight：每日一句 */}
        {(insight || insightLoading) && (
          <div className="home-insight">
            <span className="home-insight-star" aria-hidden>✦</span>
            {insightLoading
              ? <span className="home-insight-loading">…</span>
              : <span className="home-insight-text">{insight}</span>}
          </div>
        )}

        {!hasAnyData && (
          <div className="home-hint">{t('home.startHint')}</div>
        )}

        {/* ---- HERO ---- */}
        {hero ? (
          hero.kind === 'due' || hero.kind === 'prio' ? (
            <div className="home-hero" style={{ ['--hero' as string]: heroColor }}>
              <div className="home-hero-text">
                <div className="home-hero-kicker" style={{ color: hero.kind === 'due' ? '#B96655' : '#2E86B8' }}>{heroLabel}</div>
                <div className="home-hero-title">{hero.task.title}</div>
                <div className="home-hero-meta">
                  {hero.task.deadline && ddlInfo(hero.task.deadline, lang).text}
                  {!hero.isWork && hero.task.courseId && (() => {
                    const c = courses.find(x => x.id === hero.task.courseId);
                    return c ? <span style={{ color: c.color }}>{c.code || c.name}</span> : null;
                  })()}
                  {hero.isWork && hero.task.company && <span>{hero.task.company}</span>}
                </div>
              </div>
              <Art src={MOUNTAIN} className="hero-art" style={{ width: 92, height: 'auto', flexShrink: 0 }} fallback={<FallbackMountain width={92} />} />
            </div>
          ) : (
            <div className="home-hero home-hero-click" style={{ ['--hero' as string]: heroColor }} onClick={() => setDetailCourse(hero.course)}>
              <div className="home-hero-text">
                <div className="home-hero-kicker" style={{ color: hero.kind === 'inclass' ? '#2E86B8' : hero.course.color }}>
                  {heroLabel}
                </div>
                <div className="home-hero-title">{hero.course.name}</div>
                <div className="home-hero-meta">
                  <span>{hero.course.startTime}–{hero.course.endTime}</span>
                  <span>{hero.course.code}</span>
                  {hero.course.location && <span>{hero.course.location}</span>}
                  {hero.kind === 'next' && <span style={{ color: '#2E86B8' }}>{cdText(toMin(hero.course.startTime) - nowMin)}</span>}
                  {hero.kind === 'inclass' && <span style={{ color: '#2E86B8' }}>{cdText(toMin(hero.course.endTime) - nowMin)}</span>}
                </div>
              </div>
              <Art src={MOUNTAIN} className="hero-art" style={{ width: 92, height: 'auto', flexShrink: 0 }} fallback={<FallbackMountain width={92} />} />
            </div>
          )
        ) : (
          <div className="home-hero home-hero-empty">
            <div className="home-hero-text">
              <div className="home-hero-title">{t('home.heroFree')}</div>
              <div className="home-hero-meta">{t('home.heroFreeSub')}</div>
            </div>
            <Art src={BEAR} style={{ width: 88, height: 'auto', flexShrink: 0 }} fallback={<FallbackBear width={88} />} />
          </div>
        )}

        {/* ---- 今日時間線 ---- */}
        <div className="home-divider">
          <Art src="/art/divider-ridge.svg" style={{ width: '100%', height: 'auto', display: 'block' }} fallback={<div className="home-rule" />} />
        </div>
        <div className="home-sec-label">
          <span>{t('home.todayLabel')}</span>
          <span className="home-sec-count">{timeline.length > 0 ? timeline.length : ''}</span>
        </div>
        {timeline.length > 0 ? (
          <div className="home-timeline">
            {timeline.map(item => (
              <button
                key={item.key}
                data-sound={item.course ? 'tap' : 'none'}
                className={`home-tl-card${item.state === 'current' ? ' current' : ''}${item.state === 'past' ? ' past' : ''}`}
                style={{ ['--tl' as string]: item.color }}
                onClick={() => item.course && setDetailCourse(item.course)}
              >
                {item.kind === 'due' && <span className="home-tl-flag">{t('home.heroDue')}</span>}
                <span className="home-tl-time">{item.time || '—'}</span>
                <span className="home-tl-title">{item.title}</span>
                {item.sub && <span className="home-tl-sub">{item.sub}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="home-bear-empty">
            <Art src={BEAR} style={{ width: 76, height: 'auto', display: 'block' }} fallback={<FallbackBear width={76} />} />
            <span className="home-empty-line">{t('home.todayEmpty')}</span>
          </div>
        )}

        {/* ---- 速覽 ---- */}
        <div className="home-brief">
          <span className="home-brief-item">
            <b className="hand-num">{todayDow ? dayCourses.length : 0}</b>{dayCourses.length > 0 ? t('home.briefClasses', { n: '' }) : t('home.briefNoClass')}
          </span>
          <i />
          <span className="home-brief-item">
            <b className="hand-num" style={{ color: dueTodayAll.length > 0 ? '#B8736D' : undefined }}>{dueTodayAll.length}</b>{dueTodayAll.length > 0 ? t('home.briefDue', { n: '' }) : t('home.briefNoDue')}
          </span>
          <i />
          <span className="home-brief-item">
            <b className="hand-num">{sortedCampusTasks.length + sortedWorkTasks.length}</b>{(sortedCampusTasks.length + sortedWorkTasks.length) > 0 ? t('home.briefTodos', { n: '' }) : t('home.briefNoTodo')}
          </span>
          {doneToday > 0 && (
            <>
              <i />
              <span className="home-brief-item" style={{ color: '#2E86B8' }}><b className="hand-num">{doneToday}</b>{t('home.briefDone', { n: '' })}</span>
            </>
          )}
        </div>

        {/* ---- 數字告示欄：學校 + 生活待辦同一空間（撕掉告示 = 完成） ---- */}
        <div className="home-rule" />
        <NoticeBoard
          schoolTasks={sortedCampusTasks}
          lifeTasks={sortedWorkTasks}
          courses={courses}
          onTear={handleTearOff}
        />

        {/* ---- 全完成大插畫（兩個區塊都空時） ---- */}
        {hasAnyData && sortedCampusTasks.length === 0 && sortedWorkTasks.length === 0 && (
          <div className="home-done">
            <Art src={DONE} style={{ width: 120, height: 'auto' }} fallback={<FallbackDone width={120} />} />
            <div className="home-done-text">{t('home.greetAllDone')}</div>
          </div>
        )}

        {/* ---- 快速開始 ---- */}
        <div className="home-rule" />
        <div className="home-sec-label"><span>{t('home.quickStart')}</span></div>
        <div className="home-actions">
          <button className="home-action" onClick={() => navigate('/campus')}>
            <Art src="/art/icon-add.svg" style={{ width: 26, height: 26, display: 'block' }} fallback={<Plus size={17} strokeWidth={1.8} />} />
            <span>{t('home.addTask')}</span>
          </button>
          <button className="home-action" onClick={() => navigate('/fitness')}>
            <Art src="/art/icon-run.svg" style={{ width: 26, height: 26, display: 'block' }} fallback={<Dumbbell size={17} strokeWidth={1.8} />} />
            <span>{t('home.logWorkout')}</span>
          </button>
          <button className="home-action" onClick={() => navigate('/campus')}>
            <Art src="/art/icon-cal.svg" style={{ width: 26, height: 26, display: 'block' }} fallback={<CalendarDays size={17} strokeWidth={1.8} />} />
            <span>{t('home.fullSchedule')}</span>
          </button>
        </div>

        {/* 頁尾冰山收尾 */}
        <div className="home-divider home-divider-end">
          <Art src="/art/divider-ridge.svg" style={{ width: '100%', height: 'auto', display: 'block' }} fallback={null} />
        </div>
      </div>

      {detailCourse && (
        <CourseDetailModal course={detailCourse} onClose={() => setDetailCourse(null)} />
      )}
    </div>
  );
}

/* ---- 墨色板/月份/周次常數（同舊）---- */
const MONTH_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const DOW_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DOW_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const toMin = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}