import { useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';
import { useLang } from '../i18n';

/* ============================================================
 * EnergyJar · 今日能量水壺場景（v2 程序繪製水體）
 * ------------------------------------------------------------
 * 水體不再用「滿水壺圖層裁切」，而是由程序沿壺內壁輪廓
 * 實時繪製 SVG path 並填充漸變——水面是手繪弧線，
 * 貼壁、有高光、有深淺，效果自然。
 *
 * 輪廓數據 WALLS：從 jar-empty.svg 逐行像素掃描提取的
 * 壺肚內壁（y 392→1256，每 12 單位一檔，中位數濾波去標籤
 * 干擾）。壺 SVG viewBox 1050×1400，與 .sc-jar 完全重合。
 *
 * 水位規則：
 *   基準線 = 目標卡路里，畫在壺身 3/4 高度（y=503）
 *   水位上限 = 基準線上方一小段（y=402），超標 12% 即封頂
 *   新增錄入 → rAF 緩動水位即時上浮/下降
 *
 * 構圖：植物(左下+壺左前+右後) · 北極熊(左,貼壺) ·
 *       壺(中央) · 雪人+冰塊(右,貼壺) · 數字在壺外上方
 * ============================================================ */

interface EnergyJarProps {
  dayCalories: number;
  dailyTarget: number;
  isAfterCheckout: boolean;
}

/* 壺肚內壁輪廓：[y, 內壁左x, 內壁右x]（SVG 座標 1050×1400） */
const WALLS: ReadonlyArray<readonly [number, number, number]> = [
  [392, 418, 630], [404, 416, 632], [416, 411, 638], [428, 404, 646],
  [440, 393, 657], [452, 379, 670], [464, 362, 688], [476, 342, 707],
  [488, 322, 727], [500, 304, 745], [512, 288, 761], [524, 274, 776],
  [536, 260, 788], [548, 248, 800], [560, 237, 811], [572, 227, 821],
  [584, 217, 831], [596, 209, 839], [608, 200, 848], [620, 193, 855],
  [632, 186, 862], [644, 179, 869], [656, 173, 875], [668, 168, 880],
  [680, 163, 885], [692, 158, 890], [704, 154, 894], [716, 150, 898],
  [728, 146, 902], [740, 143, 905], [752, 140, 908], [764, 138, 910],
  [776, 136, 912], [788, 138, 904], [800, 149, 893], [812, 160, 883],
  [824, 166, 884], [836, 165, 884], [848, 164, 885], [860, 164, 885],
  [872, 164, 885], [884, 165, 884], [896, 165, 883], [908, 166, 882],
  [920, 168, 880], [932, 170, 878], [944, 172, 876], [956, 175, 874],
  [968, 178, 871], [980, 181, 868], [992, 184, 870], [1004, 188, 879],
  [1016, 192, 887], [1028, 197, 889], [1040, 201, 885], [1052, 203, 880],
  [1064, 197, 874], [1076, 191, 868], [1088, 188, 862], [1100, 192, 855],
  [1112, 199, 848], [1124, 207, 841], [1136, 215, 832], [1148, 224, 823],
  [1160, 234, 814], [1172, 245, 803], [1184, 256, 792], [1196, 269, 779],
  [1208, 282, 766], [1220, 293, 755], [1232, 305, 743], [1244, 318, 730],
  [1256, 326, 721],
];

/* ---- 幾何常量（SVG 座標） ---- */
const Y_BOTTOM = 1252;   // 壺底水線（底弧上方一點）
const Y_TARGET = 503;   // 基準線：壺身 3/4 高度 = 目標卡路里
const Y_CAP = 402;      // 水位上限：基準線上方一小段
const CAP_OVER = 0.12;  // 超出目標 12% 內仍線性上漲，之後封頂
const FLOOR_W = 16;     // 空壺保留的底水高度（自然感）

/** 內壁插值：給 y 返回 [左x, 右x] */
function wallAt(y: number): [number, number] {
  const first = WALLS[0];
  const last = WALLS[WALLS.length - 1];
  if (y <= first[0]) return [first[1], first[2]];
  if (y >= last[0]) return [last[1], last[2]];
  for (let i = 1; i < WALLS.length; i++) {
    if (WALLS[i][0] >= y) {
      const [y0, l0, r0] = WALLS[i - 1];
      const [y1, l1, r1] = WALLS[i];
      const t = (y - y0) / (y1 - y0);
      return [l0 + (l1 - l0) * t, r0 + (r1 - r0) * t];
    }
  }
  return [last[1], last[2]];
}

/** 攝入比例 → 水面 y（越小水位越高） */
function yForPct(pct: number): number {
  const clamped = Math.max(pct, 0);
  const y = clamped <= 1
    ? Y_BOTTOM - clamped * (Y_BOTTOM - Y_TARGET)
    : Y_TARGET - Math.min((clamped - 1) / CAP_OVER, 1) * (Y_TARGET - Y_CAP);
  return Math.min(y, Y_BOTTOM - FLOOR_W);
}

/** 水體 path：底 → 沿左壁上行 → 手繪弧水面 → 沿右壁下行 → 閉合 */
function waterBodyPath(yw: number): string {
  const seg: string[] = [];
  const [lb, rb] = wallAt(Y_BOTTOM);
  const step = 16;
  const ys: number[] = [];
  for (let y = Y_BOTTOM - step; y > yw + step; y -= step) ys.push(y);
  const [lx, rx] = wallAt(yw);
  const mid = (lx + rx) / 2;
  seg.push(`M ${lb.toFixed(1)} ${Y_BOTTOM}`);
  for (const y of ys) {
    const [l] = wallAt(y);
    seg.push(`L ${l.toFixed(1)} ${y}`);
  }
  /* 左壁貼到水面下緣，弧線跨到右壁（中點上凸 = 手繪水面） */
  const [la] = wallAt(yw + 12);
  const [, ra] = wallAt(yw + 12);
  seg.push(`L ${la.toFixed(1)} ${(yw + 12).toFixed(1)}`);
  seg.push(`Q ${mid.toFixed(1)} ${(yw - 15).toFixed(1)} ${ra.toFixed(1)} ${(yw + 12).toFixed(1)}`);
  for (let i = ys.length - 1; i >= 0; i--) {
    const [, r] = wallAt(ys[i]);
    seg.push(`L ${r.toFixed(1)} ${ys[i]}`);
  }
  seg.push(`L ${rb.toFixed(1)} ${Y_BOTTOM} Z`);
  return seg.join(' ');
}

/** 水面主弧線（白）：與水體同一水面，端點略下沉（手繪感） */
function surfaceMain(yw: number): string {
  const [l] = wallAt(yw + 8);
  const [, r] = wallAt(yw + 8);
  const mid = (l + r) / 2;
  return `M ${(l + 8).toFixed(1)} ${(yw + 6).toFixed(1)} Q ${mid.toFixed(1)} ${(yw - 17).toFixed(1)} ${(r - 10).toFixed(1)} ${(yw + 2).toFixed(1)}`;
}

/** 水面副弧線（淡藍）：主線下方一點點，雙線手繪感 */
function surfaceEcho(yw: number): string {
  const [l] = wallAt(yw + 24);
  const [, r] = wallAt(yw + 24);
  const mid = (l + r) / 2;
  return `M ${(l + 26).toFixed(1)} ${(yw + 26).toFixed(1)} Q ${mid.toFixed(1)} ${(yw + 14).toFixed(1)} ${(r - 30).toFixed(1)} ${(yw + 22).toFixed(1)}`;
}

/** 左側高光帶：水體內部靠左壁的窄豎帶（玻璃反光） */
function highlightPath(yw: number): string {
  const yTop = yw + 30;
  const yBot = Math.min(yw + (Y_BOTTOM - yw) * 0.55, Y_BOTTOM - 34);
  if (yBot - yTop < 40) return '';
  const [l0, r0] = wallAt(yTop);
  const [l1, r1] = wallAt(yBot);
  const xa = l0 + (r0 - l0) * 0.155;
  const xd = l0 + (r0 - l0) * 0.225;
  const xb = l1 + (r1 - l1) * 0.125;
  const xc = l1 + (r1 - l1) * 0.205;
  const ym = (yTop + yBot) / 2;
  return (
    `M ${xa.toFixed(1)} ${yTop} C ${(xa - 7).toFixed(1)} ${ym.toFixed(1)} ${(xb - 9).toFixed(1)} ${(yBot - 26).toFixed(1)} ${xb.toFixed(1)} ${yBot}` +
    ` L ${xc.toFixed(1)} ${yBot}` +
    ` C ${(xc + 8).toFixed(1)} ${(yBot - 44).toFixed(1)} ${(xd + 9).toFixed(1)} ${ym.toFixed(1)} ${xd.toFixed(1)} ${yTop} Z`
  );
}

const easeInOutCubic = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

export default function EnergyJar({ dayCalories, dailyTarget, isAfterCheckout }: EnergyJarProps) {
  const { t } = useLang();

  const rawPct = dailyTarget > 0 ? dayCalories / dailyTarget : 0;
  const pct = Math.min(rawPct, 1.4);
  const isOver = dayCalories > dailyTarget;
  const overBy = dayCalories - dailyTarget;

  const bodyRef = useRef<SVGPathElement>(null);
  const mainRef = useRef<SVGPathElement>(null);
  const echoRef = useRef<SVGPathElement>(null);
  const hiRef = useRef<SVGPathElement>(null);
  const curY = useRef<number>(Y_BOTTOM - FLOOR_W);

  /* 水位緩動：數據變化時 800ms easeInOut 從當前值過渡（上浮/下降動畫） */
  useEffect(() => {
    const target = yForPct(pct);
    const from = curY.current;
    const dist = target - from;
    const draw = (y: number) => {
      bodyRef.current?.setAttribute('d', waterBodyPath(y));
      mainRef.current?.setAttribute('d', surfaceMain(y));
      echoRef.current?.setAttribute('d', surfaceEcho(y));
      const hi = highlightPath(y);
      if (hi) hiRef.current?.setAttribute('d', hi);
    };
    if (Math.abs(dist) < 0.6) {
      draw(target);
      curY.current = target;
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const DUR = 800;
    const tick = (now: number) => {
      const k = Math.min((now - t0) / DUR, 1);
      const y = from + dist * easeInOutCubic(k);
      curY.current = y;
      draw(y);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  /* 基準線刻度 x 範圍（壺身右壁 → 壺外伸出） */
  const [, rT] = wallAt(Y_TARGET);
  const baseX1 = rT + 8;
  const baseX2 = rT + 46;
  const [cL, cR] = wallAt(Y_CAP);
  const capX1 = cL + (cR - cL) * 0.18;
  const capX2 = cR + 16;

  return (
    <div className="energy-scene">
      <div className="scene-title">{t('fitness.sceneTitle')}</div>

      <div className="scene-stage">
        {/* 地面：極淡接觸陰影 */}
        <i className="stage-ground" aria-hidden />

        {/* 草叢三叢：左下(熊旁) · 壺左前(前景) · 右後(冰塊旁,鏡像) */}
        <img className="sc sc-plant" src="/art/plant.svg" alt="" aria-hidden draggable={false} />
        <img className="sc sc-plant-c" src="/art/plant.svg" alt="" aria-hidden draggable={false} />
        <img className="sc sc-plant-b" src="/art/plant.svg" alt="" aria-hidden draggable={false} />

        {/* 北極熊：左側貼壺，身體輕微遮擋壺底 */}
        <img className="sc sc-bear" src="/art/bear-reading.svg" alt="" aria-hidden draggable={false} />

        {/* 儲能壺：中央主角 */}
        <div className="sc-jar">
          {/* 壺外數字：壺正上方，數據第一眼；超標變提醒色 */}
          <div className="jar-head">
            <b className={isOver ? 'over' : ''}>{dayCalories}</b>
            <span>kcal</span>
          </div>

          {/* 玻璃壺（底層，輪廓永遠完整） */}
          <img className="jar-glass" src="/art/jar-empty.svg" alt="" aria-hidden draggable={false} />

          {/* 程序繪製的水體（疊在玻璃上，貼內壁） */}
          <svg className="jar-water-svg" viewBox="0 0 1050 1400" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="jarWaterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#C7E2F2" stopOpacity="0.62" />
                <stop offset="0.55" stopColor="#84B7D8" stopOpacity="0.68" />
                <stop offset="1" stopColor="#528BAD" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path ref={bodyRef} className="jw-body" fill="url(#jarWaterGrad)" />
            <path ref={hiRef} className="jw-hi" />
            <path ref={echoRef} className="jw-echo" />
            <path ref={mainRef} className="jw-main" />

            {/* 基準線 = 目標卡路里（壺身 3/4）：壺內淡線 + 壺外刻度 + 數字 */}
            <line className="jw-base-in" x1={wallAt(Y_TARGET)[0] + 6} y1={Y_TARGET} x2={baseX1} y2={Y_TARGET} />
            <line className="jw-base" x1={baseX1} y1={Y_TARGET} x2={baseX2} y2={Y_TARGET} />
            <text className="jw-base-num" x={baseX2 + 8} y={Y_TARGET - 14}>{dailyTarget}</text>

            {/* 水位上限（基準線上方一小段，封頂位置）：極淡短線 */}
            <line className="jw-cap" x1={capX1} y1={Y_CAP} x2={capX2} y2={Y_CAP} />
          </svg>

          {/* 壺口旁小水滴 */}
          <img className="sc-drop" src="/art/jar-drop.svg" alt="" aria-hidden draggable={false} />
        </div>

        {/* 雪人+冰塊：右側貼壺 */}
        <div className="sc-right">
          <img className="sc sc-snowman" src="/art/snowman-scene.svg" alt="" aria-hidden draggable={false} />
          <img className="sc sc-ice" src="/art/ice-small.svg" alt="" aria-hidden draggable={false} />
        </div>
      </div>

      {/* 底部信息行：剩餘/超了 · 百分比 · 結賬提示 */}
      <div className="scene-foot">
        {isOver ? (
          <span className="foot-over">
            <Flame size={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />
            {t('fitness.over', { n: overBy })}
          </span>
        ) : (
          <span className="foot-left">{t('fitness.remaining', { n: dailyTarget - dayCalories })}</span>
        )}
        <i className="dot">·</i>
        <span className="foot-pct">{t('fitness.pctTaken', { n: Math.round(Math.min(rawPct, 1) * 100) })}</span>
        <i className="dot">·</i>
        <span className="foot-checkout">{isAfterCheckout ? t('fitness.settled') : t('fitness.settleHint')}</span>
      </div>
    </div>
  );
}
