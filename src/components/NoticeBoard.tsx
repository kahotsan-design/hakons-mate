import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Course, Task } from '../types';
import { ddlInfo } from '../utils/date';
import { useLang, type Lang } from '../i18n';
import { playSound } from '../utils/sound';

/* ============================================================
 * Modern Digital Notice Board · 數字告示欄
 * ------------------------------------------------------------
 * 首頁待辦的全新呈現方式：
 *   - 學校 + 生活任務進入同一個告示欄空間（極簡編輯設計）
 *   - 每個任務是一張「告示紙」：輕微旋轉 + 水平錯位 + 寬度自適應
 *   - 完成交互：按住告示向上滑 → 撕掉（Tear Off）
 *   - 撕掉後其餘告示 FLIP 平滑重排
 * 佈局採「有秩序的不規則」：垂直流 + 確定性偽隨機（同一任務
 * 永遠同一傾角/錯位，重渲染不抖動，也避免隨機到像故意做亂）。
 * ============================================================ */

/* ---- 確定性偽隨機：基於任務 id 的穩定 hash → 檔位 ---- */
function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
/* avalanche 混合（murmur3 fmix32 風格）：把相鄰 hash 值打散，
   否則短 id（t1/t2/w1…）的 hash 彼此只差幾位，直接取模會全部落在同一檔 */
function mix(x: number, seed: number): number {
  let v = (x ^ seed) >>> 0;
  v = Math.imul(v, 0x9E3779B1) >>> 0;
  v ^= v >>> 15;
  v = Math.imul(v, 0x85EBCA6B) >>> 0;
  v ^= v >>> 13;
  return v >>> 0;
}
/* 微傾角：整齊為主，僅保留 ±0.7° 內的細微歪斜——
   完全 0° 會退回普通列表，微傾才是「貼上去的紙」的真實感 */
const TILTS = [0.7, -0.4, 0.4, -0.7, 0.5, -0.5, 0.3, -0.3, 0.6, -0.6];

/* ---- 固定件（確定性隨機）：部分貼膠帶、部分圖釘，位置多變 ----
   膠帶可貼 頂中/左上/右上/左下；圖釘釘 頂中/左上/右上；
   圖釘色從冰雪藍系的協調色板取（絕不用鮮豔紅）；
   紙的底色每張微微不同（不同批次的紙，白度有極微差異） */
const TAPE_POS = ['top-c', 'top-l', 'top-r', 'bot-l'] as const;
const PIN_POS = ['top-c', 'top-l', 'top-r'] as const;
const PIN_COLORS = ['#4A7FAE', '#A8D8EA', '#1D4E73', '#7FA8C9', '#5E86A8'];
const PAPER_TINTS = ['#FFFFFF', '#FEFEFB', '#FCFDFE', '#FDFDF9'];

/* ---- 語義色映射（淺底白卡上用深版，避免刺眼） ---- */
const BRIGHT_MAP: Record<string, string> = {
  '#dc2626': '#B8736D',
  '#ea580c': '#B3865C',
  '#b45309': '#A66A16',
  '#64748b': '#1D4E73',
  '#0284c7': '#2E86B8',
};
const brighten = (c: string): string => BRIGHT_MAP[c] ?? c;

/* ---- 撕掉手勲參數 ---- */
const HOLD_MS = 280;    // 長按激活延時（期間移動 > 10px 視為滾動，放行）
const TEAR_DIST = 68;   // 向上拖動超過此距離 → 完成
const FLY_MS = 420;     // 撕掉飛出時長

type Phase = 'idle' | 'armed' | 'drag' | 'fly' | 'rebound';

export interface NoticeItem {
  task: Task;
  isWork: boolean;      // true=生活 false=學校
}

interface NoticeBoardProps {
  schoolTasks: Task[];
  lifeTasks: Task[];
  courses: Course[];
  onTear: (id: string, isWork: boolean) => void;
}

export default function NoticeBoard({ schoolTasks, lifeTasks, courses, onTear }: NoticeBoardProps) {
  const { t, lang } = useLang();
  const spaceRef = useRef<HTMLDivElement>(null);
  /* FLIP：上一幀每張告示的位置（撕掉一張後其餘平滑位移補位） */
  const prevRects = useRef<Map<string, { top: number; left: number; tilt: number }>>(new Map());

  const notices = useMemo<NoticeItem[]>(() => {
    const all: NoticeItem[] = [
      ...schoolTasks.map(task => ({ task, isWork: false })),
      ...lifeTasks.map(task => ({ task, isWork: true })),
    ];
    const order = { high: 0, medium: 1, low: 2 } as const;
    return all.sort((a, b) =>
      (a.task.deadline ?? '9999').localeCompare(b.task.deadline ?? '9999')
      || order[a.task.priority] - order[b.task.priority]
      || a.task.createdAt.localeCompare(b.task.createdAt));
  }, [schoolTasks, lifeTasks]);

  /* FLIP：DOM 更新後對比新舊位置，從舊位置補償位移 → 動畫歸位 */
  useLayoutEffect(() => {
    const space = spaceRef.current;
    if (!space) return;
    const next = new Map<string, { top: number; left: number; tilt: number }>();
    space.querySelectorAll<HTMLElement>('.notice').forEach(el => {
      const key = el.dataset.key ?? '';
      const r = el.getBoundingClientRect();
      const tilt = parseFloat(el.dataset.tilt || '0');
      next.set(key, { top: r.top, left: r.left, tilt });
      const old = prevRects.current.get(key);
      if (old && (Math.abs(old.top - r.top) > 1.5 || Math.abs(old.left - r.left) > 1.5)) {
        const dx = old.left - r.left;
        const dy = old.top - r.top;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) rotate(${old.tilt}deg)` },
            { transform: `rotate(${old.tilt}deg)` },
          ],
          { duration: 400, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' },
        );
      }
    });
    prevRects.current = next;
  }, [notices]);

  const schoolCount = schoolTasks.length;
  const lifeCount = lifeTasks.length;
  const total = schoolCount + lifeCount;

  return (
    <section className="notice-board">
      {/* 板頭索引：只作告示欄的索引信息，克制 */}
      <header className="board-head">
        <span className="board-title">{t('home.boardTitle')}</span>
        <span className="board-index">
          <b>{schoolCount}</b>{t('home.boardIndexSchool')}
          <i className="sep">·</i>
          <b>{lifeCount}</b>{t('home.boardIndexLife')}
        </span>
      </header>

      {/* 告示欄板面：釘在牆上的告示板——四角螺絲 + 貼牆投影（見 CSS） */}
      <div className="board-space" ref={spaceRef}>
        <i className="rivet tl" aria-hidden="true" />
        <i className="rivet tr" aria-hidden="true" />
        <i className="rivet bl" aria-hidden="true" />
        <i className="rivet br" aria-hidden="true" />
        <div className="board-mark" aria-hidden="true">{t('home.boardLabel')}</div>
        {total === 0 ? (
          <div className="board-empty">
            <span>{t('home.boardEmpty')}</span>
          </div>
        ) : (
          notices.map(({ task, isWork }) => (
            <TaskNotice
              key={task.id}
              task={task}
              isWork={isWork}
              courses={courses}
              lang={lang}
              labels={{
                school: t('home.noticeSchool'),
                life: t('home.noticeLife'),
                rolled: t('home.noticeRolled'),
              }}
              onTear={() => onTear(task.id, isWork)}
            />
          ))
        )}
      </div>

      {total > 0 && <div className="board-hint">{t('home.boardSwipeHint')}</div>}
    </section>
  );
}

/* ============================================================
 * TaskNotice · 單張任務告示（含 Tear-Off 手勢）
 * ------------------------------------------------------------
 * 手勢狀態機：
 *   idle ──長按 280ms──▶ armed（拿起，微抬起+陰影）
 *   armed ──上滑>4px──▶ drag（跟手，preventDefault 鎖滾動）
 *   drag ──釋放且距離>68px──▶ fly（撕掉飛出 420ms → 數據完成）
 *   drag ──釋放未達閾值──▶ rebound（彈簧回位）
 *   idle 期間移動>10px → 取消長按，讓位頁面滾動（不衝突）
 * ============================================================ */

interface TaskNoticeProps {
  task: Task;
  isWork: boolean;
  courses: Course[];
  lang: Lang;
  labels: { school: string; life: string; rolled: string };
  onTear: () => void;
}

function TaskNotice({ task, isWork, courses, lang, labels, onTear }: TaskNoticeProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const g = useRef({
    y0: 0,
    dy: 0,
    phase: 'idle' as Phase,
    timer: 0 as ReturnType<typeof setTimeout> | null,
    moved: false,
  });

  /* 確定性微傾角 + 固定件 + 紙色（同一任務永遠一致）；統一寬度、無錯位——整齊貼放 */
  const h = hashStr(task.id);
  const tilt = TILTS[h % TILTS.length];
  /* 固定件：約 40% 圖釘 / 60% 膠帶；各特徵用不同 seed 的 mix 派生，
     保證傾角/固定件/位置/顏色彼此獨立（自然、不規律但穩定） */
  const isPin = mix(h, 0x51ab) % 5 < 2;
  const fixType = isPin ? 'pin' : 'tape';
  const pos = isPin
    ? PIN_POS[mix(h, 0x9e37) % PIN_POS.length]
    : TAPE_POS[mix(h, 0x7f4a) % TAPE_POS.length];
  const pinColor = PIN_COLORS[mix(h, 0x2b1f) % PIN_COLORS.length];
  const paperTint = PAPER_TINTS[mix(h, 0x77e5) % PAPER_TINTS.length];

  const course = !isWork && task.courseId ? courses.find(c => c.id === task.courseId) : undefined;
  const isRolled = !!task.rolledFrom && task.rolledFrom !== task.date;

  const setPhase = (p: Phase) => {
    g.current.phase = p;
    const el = elRef.current;
    if (el) el.dataset.phase = p;
  };

  /* 拖動中每幀應用變換：跟手上移 + 撕角暗示 + 底部微拉伸 */
  const applyDrag = () => {
    const el = elRef.current;
    if (!el) return;
    const d = Math.min(0, g.current.dy);                 // 只跟隨向上（d ≤ 0）
    const tiltExtra = d * 0.02;                         // 向上拖時撕角微增
    const stretch = 1 + Math.min(-d, 100) / 1600;       // 底部微拉伸 ≤ 1.0625
    el.style.transform = `translateY(${d}px) rotate(${(tilt + tiltExtra).toFixed(2)}deg) scaleY(${stretch.toFixed(4)})`;
  };

  const clearTimer = () => {
    if (g.current.timer) { clearTimeout(g.current.timer); g.current.timer = null; }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g.current.y0 = e.clientY;
    g.current.dy = 0;
    g.current.moved = false;
    clearTimer();
    g.current.timer = setTimeout(() => {
      if (g.current.phase !== 'idle') return;
      setPhase('armed');
      playSound('tap');
      /* 拿起：微抬 + 微放大（走 CSS transition 平滑） */
      const el = elRef.current;
      if (el) el.style.transform = `translateY(-3px) rotate(${tilt}deg) scale(1.02)`;
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current;
    const total = e.clientY - st.y0;
    if (st.phase === 'idle' || st.phase === 'fly' || st.phase === 'rebound') {
      /* 未激活時移動 → 判定為滾動意圖，取消長按（讓位頁面滾動） */
      if (!st.moved && Math.abs(total) > 10) {
        st.moved = true;
        clearTimer();
      }
      return;
    }
    st.dy = total;
    if (st.phase === 'armed' && Math.abs(total) > 4) setPhase('drag');
    if (st.phase === 'drag') applyDrag();
  };

  const finish = () => {
    const st = g.current;
    clearTimer();
    const el = elRef.current;
    if (st.phase === 'idle' || !el) return;
    if (st.phase === 'armed') {
      /* 拿起後沒動就鬆手 → 輕放回 */
      setPhase('rebound');
      el.style.transform = '';
      setTimeout(() => setPhase('idle'), 340);
      st.dy = 0;
      return;
    }
    const d = Math.min(0, st.dy);
    if (d < -TEAR_DIST) {
      /* 達到撕掉閾值 → 向上飛出 + 微微加大撕角，全隱喻、零粒子 */
      setPhase('fly');
      playSound('success');
      const flyDist = d - 190;
      el.style.transform = `translateY(${flyDist}px) rotate(${(tilt * 2.2).toFixed(1)}deg)`;
      setTimeout(() => onTear(), FLY_MS - 20);
    } else {
      /* 未達閾值 → 彈簧回位（清 inline transform，回到 CSS 基態傾角） */
      setPhase('rebound');
      el.style.transform = '';
      setTimeout(() => setPhase('idle'), 340);
    }
    st.dy = 0;
  };

  /* 拖動期間鎖定頁面滾動：armed/drag 時 touchmove preventDefault */
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      const p = g.current.phase;
      if (p === 'armed' || p === 'drag') e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const ddl = task.deadline ? ddlInfo(task.deadline, lang) : null;

  return (
    <article
      ref={elRef as React.RefObject<HTMLElement>}
      className={`notice${isWork ? ' life' : ' school'}`}
      data-key={task.id}
      data-tilt={tilt}
      data-fix={fixType}
      data-pos={pos}
      style={{
        ['--tilt' as string]: `${tilt}deg`,
        ['--pin-color' as string]: pinColor,
        ['--paper-tint' as string]: paperTint,
      } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <span className="notice-tag">{isWork ? labels.life : labels.school}</span>
      <h3 className="notice-title">{task.title}</h3>
      {(ddl || course || isRolled || (isWork && task.company)) && (
        <div className="notice-meta">
          {ddl && <span style={{ color: brighten(ddl.color) }}>{ddl.text}</span>}
          {course && <span style={{ color: course.color }}>{course.code || course.name}</span>}
          {!course && isWork && task.company && <span style={{ color: '#5E86A8' }}>{task.company}</span>}
          {isRolled && <span style={{ color: '#B3865C' }}>{labels.rolled}</span>}
        </div>
      )}
    </article>
  );
}
