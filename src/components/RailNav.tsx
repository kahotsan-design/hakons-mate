import { useRef, type ComponentType, type ReactNode } from 'react';

/* ============================================================
 * RailNav · 横向軌道導航（Horizontal Rail / Center Focus）
 * ------------------------------------------------------------
 * 三個模塊均分橫向空間、同屏全可見（新用戶一眼知道有哪些功能）：
 *   - 當前模塊：字最大、全對比、下方一條短線
 *   - 相鄰模塊：縮小、半透明白、保持可點
 *   - 切換時：文字呼吸 + 短線在軌道間滑動（內容在軌道上移動的感覺）
 *   - 左右滑動 / 點擊均可切換
 * ============================================================ */

export interface RailTab {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  badge?: ReactNode;
}

interface RailNavProps {
  tabs: RailTab[];
  active: string;
  onChange: (key: string) => void;
}

export default function RailNav({ tabs, active, onChange }: RailNavProps) {
  const activeIdx = Math.max(0, tabs.findIndex(t2 => t2.key === active));

  /* 左右滑動切換（水平位移 > 42px 且水平分量佔優） */
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      const next = activeIdx + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < tabs.length) onChange(tabs[next].key);
    }
  };

  const n = Math.max(tabs.length, 1);

  return (
    <nav className="rail-nav" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {tabs.map((t2, i) => {
        const isCenter = i === activeIdx;
        return (
          <button
            key={t2.key}
            className={`rail-item${isCenter ? ' center' : ''}`}
            onClick={() => onChange(t2.key)}
          >
            <t2.icon size={isCenter ? 20 : 16} strokeWidth={1.9} />
            <span className="rail-label">{t2.label}</span>
            {t2.badge}
          </button>
        );
      })}
      {/* 真實滑軌：內凹軌槽 + 每檔一個定位凹點（與滑塊同基準定位，保證對齊） */}
      <div className="rail-track" aria-hidden="true" />
      {tabs.map((t2, i) => (
        <i key={t2.key} className="rail-notch" style={{ left: `${((i + 0.5) / n) * 100}%` }} aria-hidden />
      ))}
      {/* 冰山滑塊騎在槽上滑動，壓住當前檔位的凹點 */}
      <img
        src="/art/mountain-hero.svg"
        className="rail-ink rail-ink-art"
        style={{ left: `calc(${(activeIdx + 0.5) / n * 100}% - 14px)` }}
        alt=""
        aria-hidden
        draggable={false}
      />
    </nav>
  );
}
