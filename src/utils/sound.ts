// ============ 全局點擊音效引擎（v2） ============
// Web Audio API 純合成，無音頻文件。
// 三種音色：
//   tap     —— 柔和短促的「嗒」（默認按鈕）
//   glass   —— 清脆的冰裂「叮」（玻璃質感模塊：底部導航 / Liquid Glass tabs / 日期格）
//   success —— 完成待辦的上行雙音
//
// v2 修復：
//   1) 「時有時無」—— 原因：AudioContext 處於 suspended 時直接丟棄本次播放
//      （iOS 切後台回來 / PWA 冷啟動尤其常見）。現在：suspended 時先 resume，
//      resume 成功後補播本次音效，保證每一次點擊最終都有聲。
//      另加 visibilitychange 監聽：回到前台主動 resume。
//   2) 「太小聲」—— 峰值增益整體放大约 3 倍，經 master → DynamicsCompressor
//      → destination 鏈路輸出，多音疊加也不會爆音。
//
// 靜音邏輯：iOS 物理靜音開關會自動讓 Web Audio 無聲，
// Android 受媒體音量控制 —— 天然滿足「有聲才有反饋」。

export type SoundName = 'tap' | 'glass' | 'success';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  // iOS：必須在手勢裡 resume，否則一直 suspended
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ });
  }
  return ctx;
}

/** 主輸出鏈：master 增益 → 壓縮器（防多音疊加爆音）→ 揚聲器 */
function getMaster(c: AudioContext): GainNode {
  if (!master) {
    master = c.createGain();
    master.gain.value = 0.95;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    master.connect(comp);
    comp.connect(c.destination);
  }
  return master;
}

/** 首次觸摸預熱（保證 iOS 上第一次點擊就有聲音） */
export function warmUpSound() {
  if (unlocked) return;
  const c = getCtx();
  if (c && c.state === 'running') unlocked = true;
}

// 頁面回到前台：主動 resume，避免「切走再回來就沒聲」
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* ignore */ });
    }
  });
}

interface ToneOpts {
  freq: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;   // 起振時間 s
  decay?: number;    // 衰減時間 s
  delay?: number;    // 相對起始延遲 s
}

function tone(c: AudioContext, o: ToneOpts) {
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  const peak = o.gain ?? 0.05;
  const attack = o.attack ?? 0.002;
  const decay = o.decay ?? 0.05;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  osc.connect(g);
  g.connect(getMaster(c));
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.02);
}

/** 實際發聲（v2 音量：峰值約為 v1 的 3 倍） */
function emit(c: AudioContext, name: SoundName) {
  switch (name) {
    case 'tap': {
      // 柔和的「嗒」：中低頻主音 + 一點高頻起振
      tone(c, { freq: 660, type: 'sine', gain: 0.14, decay: 0.045 });
      tone(c, { freq: 1320, type: 'sine', gain: 0.055, decay: 0.025 });
      break;
    }
    case 'glass': {
      // 清脆的冰裂「叮」：高頻雙分音 + 極短高頻閃
      tone(c, { freq: 1975, type: 'sine', gain: 0.15, decay: 0.09 });
      tone(c, { freq: 2637, type: 'sine', gain: 0.085, decay: 0.07 });
      tone(c, { freq: 3520, type: 'sine', gain: 0.065, decay: 0.03 });
      break;
    }
    case 'success': {
      // 完成的上行雙音 D5 → A5
      tone(c, { freq: 587, type: 'sine', gain: 0.16, decay: 0.09 });
      tone(c, { freq: 880, type: 'sine', gain: 0.16, decay: 0.14, delay: 0.085 });
      break;
    }
  }
}

export function playSound(name: SoundName) {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'running') {
      emit(c, name);
    } else {
      // v2 核心修復：suspended 不再丟棄 —— resume 成功後補播本次音效
      c.resume()
        .then(() => { try { emit(c, name); } catch { /* ignore */ } })
        .catch(() => { /* ignore */ });
    }
  } catch {
    // 音頻失敗靜默忽略，絕不影響交互
  }
}
