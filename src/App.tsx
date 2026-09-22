import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LangProvider } from './i18n';
import { playSound, warmUpSound, type SoundName } from './utils/sound';
import Home from './pages/Home';
import Campus from './pages/Campus';
import Work from './pages/Work';
import Job from './pages/Job';
import Fitness from './pages/Fitness';
import Profile from './pages/Profile';
import MailPage from './pages/Mail';
import BottomNav from './components/BottomNav';
import SplashScreen from './components/SplashScreen';
import { autoFetchMails, pruneMails } from './utils/mailSync';

// 頁面切換動畫包裹
function PageWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('splash_shown')) {
      setShowSplash(true);
      sessionStorage.setItem('splash_shown', '1');
    }
  }, []);

  // ============ 郵件後台自動拉取（無感 · 僅自用版）============
  // 打開 App / 從後台回前台時靜默拉取 163 郵件：
  //  - 啟動立刻 force 拉一次（忽略 30 分鐘節流，僅留 60 秒硬下限），
  //    所以「每次打開軟件」必定會拉，不用等用戶點任何按鈕；
  //  - 開機先 pruneMails()：一週以外 + 領英 一律自動刪除；
  //  - 回前台走 30 分鐘節流，避免頻繁連 IMAP 被 163 限流。
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_MAIL === 'false') return; // 朋友版：無郵件 API，直接跳過
    pruneMails();                                             // 先清過期（同步、立即生效）
    autoFetchMails({ force: true });                          // 立即拉取，不等點擊
    const onVis = () => { if (document.visibilityState === 'visible') autoFetchMails(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // ============ 全局點擊音效 ============
  // 所有可交互元素（button / 鏈接 / 帶 pointer 樣式的圖標）默認播 tap；
  // 玻璃質感模塊（底部導航 / Liquid Glass tabs / 週日切換 / 日期格）播清脆的 glass；
  // data-sound="none" 的元素由組件自行控制（如完成待辦的 success 音）。
  useEffect(() => {
    // iOS：首次觸摸預熱 AudioContext，保證第一次點擊就有聲
    const warm = () => warmUpSound();
    document.addEventListener('touchstart', warm, { once: true, passive: true });
    document.addEventListener('pointerdown', warm, { once: true, passive: true });

    const INTERACTIVE = 'button, a, [role="button"], [data-sound], [style*="cursor: pointer"], [style*="cursor:pointer"]';
    const GLASS = '.nav-item, .liquid-tab, .liquid-seg, [data-sound="glass"]';

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      const el = target.closest<HTMLElement>(INTERACTIVE);
      if (!el) return;
      const ds = el.getAttribute('data-sound');
      if (ds === 'none') return; // 組件自行控制音效
      if (ds === 'glass' || el.closest(GLASS)) { playSound('glass'); return; }
      if (ds && ds !== 'tap') { playSound(ds as SoundName); return; }
      playSound('tap');
    };
    document.addEventListener('click', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', warm);
      document.removeEventListener('pointerdown', warm);
    };
  }, []);

  return (
    <LangProvider>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <BrowserRouter>
        <PageWrapper>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/campus" element={<Campus />} />
            <Route path="/work" element={<Work />} />
            <Route path="/job" element={<Job />} />
            <Route path="/fitness" element={<Fitness />} />
            <Route path="/profile" element={<Profile />} />
            {/* 郵件獨立頁：入口由 BottomNav 的 ENABLE_MAIL 開關控制（朋友版不顯示） */}
            <Route path="/mail" element={<MailPage />} />
          </Routes>
        </PageWrapper>
        <BottomNav />
      </BrowserRouter>
    </LangProvider>
  );
}
