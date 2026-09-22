import type { Course } from '../types';
import { useLang, appDayShort } from '../i18n';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_PX = 44;        // 每小時高度
const TIME_COL_PX = 36;    // 左側時間列寬度
const HEADER_PX = 32;      // 頂部表頭高度
const TOTAL_PX = (END_HOUR - START_HOUR) * HOUR_PX;

/** 把 HH:MM 轉成相對 8 點的偏移小時（浮點） */
function timeToOffset(t: string): number {
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return 0;
  return (h - START_HOUR) + (m || 0) / 60;
}

/** 課程持續小時數 */
function duration(start: string, end: string): number {
  return Math.max(0.25, timeToOffset(end) - timeToOffset(start));
}

/** 課程色塊自適應字色：亮底（新極地藍亮色系 #2E86B8 等）用深藍字，
 *  深底（舊數據深色系 #0d6efd 等）保留白字。按感知亮度 150 分界。 */
function textOn(bg: string): string {
  const h = bg.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (n.length !== 6) return '#fff';
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b2136' : '#fff';
}

/**
 * 根據課程名長度和塊內可用高度，挑選能完整顯示的最大字號
 * 從 10px 逐級降到 7px，都塞不下就用 7px（最後一檔，寧可小也要全）
 */
function pickNameSize(name: string, availHeight: number, colWidthPx: number): number {
  const usableWidth = colWidthPx - 8; // 扣除塊內左右 padding
  for (const size of [10, 9, 8, 7]) {
    const charsPerLine = Math.max(1, Math.floor(usableWidth / size));
    const lines = Math.ceil(name.length / charsPerLine);
    const needed = lines * size * 1.25; // lineHeight 1.25
    if (needed <= availHeight) return size;
  }
  return 7;
}

interface WeekScheduleGridProps {
  courses: Course[];
  /** 點擊課程塊回調（彈出詳情） */
  onCourseClick?: (course: Course) => void;
}

/**
 * 周課表網格（按真實時長定位）
 * - 列 = 週一到週日，今天的列背景高亮
 * - 課程塊用 position:absolute，按 start/end 算出縱向位置和高度，跨跨時段
 * - 時間刻度畫橫線，每 2 小時一個標籤
 */
export default function WeekScheduleGrid({ courses, onCourseClick }: WeekScheduleGridProps) {
  const { lang } = useLang();
  const todayDow = new Date().getDay() || 7;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderRadius: 12,
      }}
    >
      {/* 頂部表頭：週一~週日，自帶冰藍淡色背景與下方玻璃卡區分 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))`,
          height: HEADER_PX,
          background: 'rgba(253, 254, 254, 0.4)',
          borderBottom: '1px solid rgba(22, 60, 91, 0.22)',
        }}
      >
        <div /> {/* 左上角空 */}
        {WEEKDAYS.map((d, i) => {
          const isToday = todayDow === i + 1;
          return (
            <div
              key={d}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: isToday ? '#FDFEFE' : 'var(--color-ice-deep)',
                background: isToday ? 'var(--color-campus)' : 'transparent',
                borderRight: i < 6 ? '1px solid rgba(22, 60, 91, 0.10)' : 'none',
              }}
            >{lang === 'zh' ? `周${d}` : appDayShort(lang, i + 1)}</div>
          );
        })}
      </div>

      {/* 主體：左側時間軸 + 右側 7 列課程區 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))`,
          height: TOTAL_PX,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 左：時間軸 */}
        <div style={{ position: 'relative', borderRight: '1px solid var(--color-border)' }}>
          {hours.map((h, i) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                top: i * HOUR_PX,
                left: 0, right: 0,
                height: HOUR_PX,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                paddingTop: 2,
                fontSize: 9, color: 'var(--color-text-tertiary)',
                fontWeight: 600,
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* 右：7 列課程區，每列絕對定位課程塊 */}
        {WEEKDAYS.map((_, dayIdx) => {
          const isTodayCol = todayDow === dayIdx + 1;
          const dayCourses = courses
            .filter(c => c.dayOfWeek === dayIdx + 1)
            .filter(c => timeToOffset(c.endTime) > 0 && timeToOffset(c.startTime) < END_HOUR - START_HOUR)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div
              key={dayIdx}
              style={{
                position: 'relative',
                height: TOTAL_PX,
                borderRight: dayIdx < 6 ? '1px solid var(--color-border)' : 'none',
                background: isTodayCol ? 'rgba(240,166,60,0.12)' : 'transparent',
              }}
            >
              {/* 小時刻度橫線 */}
              {hours.map((h, i) => (
                <div
                  key={h}
                  style={{
                    position: 'absolute',
                    top: i * HOUR_PX,
                    left: 0, right: 0,
                    borderTop: i % 2 === 0 ? '1px solid var(--color-border)' : '1px dashed rgba(22, 60, 91, 0.13)',
                  }}
                />
              ))}

              {/* 課程塊（按真實時長） */}
              {dayCourses.map(c => {
                const top = timeToOffset(c.startTime) * HOUR_PX;
                const h = duration(c.startTime, c.endTime) * HOUR_PX;
                const showMeta = h >= 56;   // 塊夠高才顯示時間（次要信息，可讓位）
                // 課程名可用高度（扣除 padding 和時間行）
                const nameAvail = h - 6 - (showMeta ? 12 : 0);
                const fs = pickNameSize(c.name, nameAvail, 45);
                return (
                  <div
                    key={c.id}
                    onClick={onCourseClick ? () => onCourseClick(c) : undefined}
                    style={{
                      position: 'absolute',
                      top, left: 2, right: 2,
                      height: h,
                      minHeight: 24,
                      background: c.color,
                      color: textOn(c.color),
                      borderRadius: 11,
                      border: '1.5px solid rgba(253, 254, 254,0.85)',
                      padding: '3px 4px',
                      fontSize: 9,
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      cursor: onCourseClick ? 'pointer' : 'default',
                      boxShadow: '0 2px 6px rgba(27, 71, 116, 0.22)',
                      display: 'flex', flexDirection: 'column',
                    }}
                    title={`${c.code} ${c.name} · ${c.startTime}-${c.endTime} · ${c.location}`}
                  >
                    {/* 課程名：完整顯示，自動換行；字號自適應保證塞得下 */}
                    <div style={{
                      fontWeight: 700, fontSize: fs,
                      flex: 1, minHeight: 0,
                      overflowWrap: 'break-word', wordBreak: 'break-word',
                      lineHeight: 1.25,
                    }}>{c.name}</div>
                    {showMeta && (
                      <div style={{ opacity: 0.88, fontSize: 8, marginTop: 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {c.startTime}-{c.endTime}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}