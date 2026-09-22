import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ============ 雪花特效组件集（SnowFX） ============
 * 硬性约束（需求 10）：
 * - 所有容器 pointer-events:none，不挡任何交互
 * - z-index 全部低于底部导航（nav=100），特效置于业务 UI 底层/边缘
 * - 无全屏持续飘雪：只有首页顶部 200px 落雪 + 0.5~0.9s 短时交互彩蛋
 * - 不修改任何业务逻辑，纯视觉层
 */

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * 雪花粒子样式工厂（双主题）：
 * - white：纯白圆点 + 淡冰蓝光晕 —— 首页顶部落雪 / Tab 切换边缘彩蛋（大面积慢速，白色朦胧感）
 * - ice： 冰蓝圆点（白心渐变）+ 双层光晕 —— 勾选迸发 / 饮食雪粒（白卡片上高对比，确保看得见）
 */
const flakeStyle = (size: number, variant: 'white' | 'ice' = 'white'): React.CSSProperties =>
  variant === 'white'
    ? {
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.95)',
        boxShadow: '0 0 4px rgba(147,205,253,0.85)',
      }
    : {
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 32% 32%, #ffffff 0%, #bae6fd 40%, #38bdf8 100%)',
        boxShadow: '0 0 5px rgba(56,189,248,0.95), 0 0 11px rgba(125,211,252,0.55)',
      };

/** 四芒星形状（冰晶星芒）：clip-path 裁出菱形四角星 */
const starStyle = (size: number): React.CSSProperties => ({
  position: 'absolute',
  width: size,
  height: size,
  clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)',
  background: 'linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 45%, #38bdf8 100%)',
  filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.9))',
});

/**
 * ① 首页顶部 200px 落雪（需求 2）
 * - 容器 overflow:hidden，雪花 translateY 超出 200px 即被裁剪销毁
 * - z-index:0 置于业务 UI 底层（雪花飘在玻璃卡片后面，透出朦胧感）
 * - 需求 9：仅首页使用；课表页不引入
 */
export function HomeSnowfall({ count = 13 }: { count?: number }) {
  const flakes = useMemo(() => Array.from({ length: count }, () => ({
    left: rand(2, 98),          // 水平位置 %
    size: rand(2.5, 6.5),       // 雪花大小 px
    dur: rand(7, 13),           // 一轮飘落时长（缓慢）
    delay: rand(-13, 0),        // 负 delay = 动画中途开场，避免集体出发
    drift: rand(-28, 28),       // 横向漂移
    opacity: rand(0.35, 0.75),  // 透明度
  })), [count]);

  return (
    <div aria-hidden className="snowfx-home" style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 200,
      overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
    }}>
      {flakes.map((f, i) => (
        <span key={i} style={{
          ...flakeStyle(f.size),
          top: 0, left: `${f.left}%`,
          ['--snow-x' as string]: `${f.drift}px`,
          ['--snow-o' as string]: f.opacity,
          animation: `snow-drift ${f.dur}s linear ${f.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

/**
 * ② Tab 切换边缘雪花彩蛋（需求 6）
 * - 监听路由变化，切换时屏幕左右边缘出现少量小雪花，0.8s 自动消散
 * - z-index:90（低于底部导航 100，导航不被特效遮挡）
 * - 需求 9：目标页是秋招（/job）时不触发（秋招页移除全部冰雪动画）
 */
export function EdgeSnowFX() {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;
    if (location.pathname === '/job') return; // 秋招页：商务干练，无冰雪
    setBurst(b => b + 1);
  }, [location.pathname]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(0), 850);
    return () => clearTimeout(t);
  }, [burst]);

  const flakes = useMemo(() => {
    if (!burst) return [];
    return Array.from({ length: 14 }, () => {
      const side = Math.random() < 0.5 ? 'left' : 'right';
      return {
        side,
        x: rand(3, 16),             // 距边缘距离
        top: rand(6, 90),           // 垂直位置 %
        size: rand(2.5, 5),
        dur: rand(0.55, 0.8),
        ex: side === 'left' ? rand(8, 26) : rand(-26, -8),  // 向外飘
        ey: rand(18, 52),           // 向下落
      };
    });
  }, [burst]);

  if (!burst) return null;

  return (
    <div aria-hidden className="snowfx-edge" style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 90, // 低于底部导航(100)
    }}>
      {flakes.map((f, i) => (
        <span key={`${burst}-${i}`} style={{
          ...flakeStyle(f.size),
          top: `${f.top}%`,
          [f.side]: f.x,
          ['--ex' as string]: `${f.ex}px`,
          ['--ey' as string]: `${f.ey}px`,
          animation: `snow-edge ${f.dur}s ease-out forwards`,
        }} />
      ))}
    </div>
  );
}

/**
 * ③ 待办勾选完成：冰蓝星芒迸发 + 冲击波（v2 重制版，需求 7）
 * - v1 问题：白色粒子在白卡片上对比度为零、350ms 就卸载、粒子太小 —— 用户看不见
 * - v2 方案：
 *   1) 冲击波涟漪：冰蓝圆环从勾选圆圈扩散，瞬间可见的完成反馈
 *   2) 14 个冰蓝粒子（1/3 四芒星 + 2/3 白心圆点，4~8px），向四周飞散并旋转
 *   3) 时长 0.9~1.3s，父组件需在 ~1100ms 后卸载（配合 setTimeout 时长）
 * - 放在任务行（position:relative + overflow:hidden）内，范围限制在行边界
 */
export function SnowBurst({ x = 12, y = 22 }: { x?: number; y?: number }) {
  const parts = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = rand(0, Math.PI * 2);
    const r = rand(8, 22);
    return {
      bx: Math.cos(angle) * r,
      by: Math.sin(angle) * r * 0.7, // 稍扁的迸发（行高有限）
      size: rand(4, 8),
      star: i % 3 === 0,             // 1/3 用四芒星形状
      dur: rand(0.9, 1.3),
      rot: rand(-90, 90),            // 轻旋转（位移小，不必大幅自旋）
    };
  }), []);

  return (
    <div aria-hidden className="snowfx-burst" style={{
      position: 'absolute', left: x, top: y, width: 0, height: 0,
      pointerEvents: 'none', zIndex: 5,
    }}>
      <span className="snowfx-ripple" />
      {parts.map((p, i) => (
        <span key={i} style={{
          ...(p.star ? starStyle(p.size) : flakeStyle(p.size, 'ice')),
          left: 0, top: 0,
          ['--bx' as string]: `${p.bx}px`,
          ['--by' as string]: `${p.by}px`,
          ['--rot' as string]: `${p.rot}deg`,
          animation: `snow-burst ${p.dur}s ease-out forwards`,
        }} />
      ))}
    </div>
  );
}

/**
 * ④ 饮食保存成功：卡片右下角冰蓝雪粒（v2，需求 8）
 * - 挂在饮食记录列表容器（position:relative）的右下角
 * - v2：冰蓝高对比粒子、3~5px、时长 ~1s，由父组件条件渲染 + ~1.1s 后卸载
 */
export function SnowGrain() {
  const grains = useMemo(() => Array.from({ length: 9 }, () => ({
    x: rand(2, 62),
    y: rand(4, 28),
    size: rand(3, 5),
    dur: rand(0.75, 1.05),
    delay: rand(0, 0.2),
  })), []);

  return (
    <div aria-hidden className="snowfx-grain" style={{
      position: 'absolute', right: 8, bottom: 6, width: 72, height: 48,
      pointerEvents: 'none', zIndex: 5,
    }}>
      {grains.map((g, i) => (
        <span key={i} style={{
          ...flakeStyle(g.size, 'ice'),
          left: g.x, bottom: g.y,
          animation: `snow-grain ${g.dur}s ease-out ${g.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}
