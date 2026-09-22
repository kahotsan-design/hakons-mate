import { useRef, useEffect, useState } from 'react';
import { useLang, jsDayShort, type Lang } from '../i18n';

interface DateSliderProps {
  selectedDate: string;
  onChange: (date: string) => void;
  /** 有 DDL 的日期標記：pending=還有未完成 / done=全部完成 */
  marks?: Record<string, 'pending' | 'done'>;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 星期顯示：zh=一/二/...，en=Mon/Tue/...（用戶允許縮寫） */
function getWeekday(d: Date, lang: Lang): string {
  return jsDayShort(lang, d.getDay());
}

export default function DateSlider({ selectedDate, onChange, marks }: DateSliderProps) {
  const { lang, t } = useLang();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 固定以今天為中心生成60天，不隨選中日期變化重建
  const totalDays = 60;
  const halfDays = Math.floor(totalDays / 2);
  const base = new Date(today);
  base.setDate(base.getDate() - halfDays);

  const dates: { key: string; day: number; weekday: string; offset: number; isToday: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
    dates.push({
      key: formatDateKey(d),
      day: d.getDate(),
      weekday: getWeekday(d, lang),
      offset: diffDays,
      isToday: diffDays === 0,
    });
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasInit, setHasInit] = useState(false);

  const offsetLabel = (offset: number) => {
    if (offset === 0) return t('date.today');
    if (offset === -1) return t('date.yesterday');
    if (offset === 1) return t('date.tomorrow');
    if (offset === 2) return t('date.dayAfter');
    if (offset < 0) return t('date.daysAgo', { n: -offset });
    return t('date.daysLater', { n: offset });
  };

  const selectedIndex = dates.findIndex(d => d.key === selectedDate);

  // 初次渲染滾動到選中日期
  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0 && !hasInit) {
      const container = scrollRef.current;
      const target = container.children[selectedIndex] as HTMLElement;
      if (target) {
        const scrollLeft = target.offsetLeft - container.offsetWidth / 2 + target.offsetWidth / 2;
        container.scrollLeft = scrollLeft;
        setHasInit(true);
      }
    }
  }, [selectedIndex, hasInit]);

  // 點擊日期：三階段絲滑反饋
  // 1) 按壓縮小(0.88, 90ms) 2) 彈起放大(1.16, spring)並切換 3) 回穩(1.12 選中態)
  const [pressKey, setPressKey] = useState<string | null>(null);
  const [popKey, setPopKey] = useState<string | null>(null);

  const handleClick = (key: string) => {
    if (key === selectedDate) return;
    setPressKey(key);
    setTimeout(() => {
      setPressKey(null);
      setPopKey(key);
      onChange(key);
      setTimeout(() => setPopKey(null), 400);
    }, 90);
  };

  // 箭頭切換（同樣三階段）
  const slideBy = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const newKey = formatDateKey(d);
    setPressKey(newKey);
    setTimeout(() => {
      setPressKey(null);
      setPopKey(newKey);
      onChange(newKey);
      setTimeout(() => setPopKey(null), 400);
    }, 90);
  };

  // 觸摸滑動只瀏覽，不切換
  const touchStartX = useRef(0);
  const isTouchMoving = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    isTouchMoving.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    if (deltaX > 5) isTouchMoving.current = true;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
      <ArrowBtn dir="‹" onClick={() => slideBy(-1)} />

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{
          flex: 1, display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          padding: '10px 0',
        }}
      >
        {dates.map((d, i) => {
          const isSelected = d.key === selectedDate;
          const isPressed = pressKey === d.key;
          const isPopping = popKey === d.key;
          return (
            <div
              key={d.key + i}
              data-sound="glass"
              onClick={() => !isTouchMoving.current && handleClick(d.key)}
              style={{
                flexShrink: 0, width: 54, borderRadius: 14,
                padding: '8px 4px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: isSelected ? '#2E86B8' : '#FDFEFE',
                color: isSelected ? '#FDFEFE' : 'var(--color-text-secondary)',
                border: isSelected
                  ? '1.5px solid #FDFEFE'
                  : d.isToday ? '1.5px solid #2E86B8' : '1.5px solid rgba(46, 110, 168, 0.42)',
                // 三階段：按下0.88 → 彈起1.16(spring) → 選中1.12
                transform: isPressed ? 'scale(0.88)' : isPopping ? 'scale(1.16)' : isSelected ? 'scale(1.12)' : 'scale(1)',
                transition: isPressed
                  ? 'transform 0.09s ease-out'
                  : 'transform 0.38s cubic-bezier(0.22, 1.61, 0.36, 1), background 0.2s, color 0.2s, border 0.2s',
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.85 }}>{d.isToday ? (lang === 'zh' ? '今' : 'Today') : (lang === 'zh' ? `周${d.weekday}` : d.weekday)}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{d.day}</span>
              <span style={{ fontSize: 9, opacity: 0.75 }}>{offsetLabel(d.offset)}</span>
              {/* DDL 標記點：紅=有未完成截止，綠=全部搞定 */}
              <div style={{ height: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {marks?.[d.key] && (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: marks[d.key] === 'pending' ? '#B8736D' : '#2E86B8',
                    boxShadow: isSelected ? '0 0 0 1.5px rgba(27, 71, 116,0.9)' : 'none',
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ArrowBtn dir="›" onClick={() => slideBy(1)} />
    </div>
  );
}

/** 箭頭按鈕：按壓縮放 + spring 回彈（與日期卡一致的物理手感） */
function ArrowBtn({ dir, onClick }: { dir: string; onClick: () => void }) {
  return (
    <button
      data-sound="glass"
      onClick={onClick}
      onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.85)'; }}
      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.85)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      style={{
        border: '1.5px solid rgba(46, 110, 168, 0.42)', background: '#FDFEFE',
        cursor: 'pointer',
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-secondary)', fontSize: 18, fontWeight: 700,
        transition: 'transform 0.32s cubic-bezier(0.22, 1.61, 0.36, 1)',
      }}
    >{dir}</button>
  );
}
