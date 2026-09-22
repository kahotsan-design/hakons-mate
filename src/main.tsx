import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ============ 朋友版专属 CSS 标记 ============
// PWA 恢复保留（autoUpdate 机制让朋友的旧 PWA 正常收到新版本）。
// 这里只给 <html> 打上 data-friend 标记，配合 index.css 里的
// html[data-friend='1'] 规则实现朋友版专属样式（底部蓝带变白 + 按钮贴底）。
// 自用版构建时 import.meta.env.VITE_FRIEND === '1' 被静态替换为 false，
// 整段死代码消除，html 上永远不会出现该标记，CSS 规则永不命中。
if (import.meta.env.VITE_FRIEND === '1') {
  document.documentElement.setAttribute('data-friend', '1')
}

// ============ iOS 視口高度修正（划不到底修復 + 藍色遮罩修復）============
// 問題：html/body 用 100vh + position:fixed + overflow:hidden。
//  - Safari 瀏覽器模式下 100vh = 「地址欄收起」的大視口，實際可視矮 ~90px；
//    頁面永不滾動窗口 → 地址欄永不收起 → 底部一截永久不可達。
//  - 軟鍵盤彈出時 visualViewport 骤降 —— 若無腦跟隨，html/body/#root 被壓縮到
//    鍵盤上方的高度，root 之外露出的區域就是 html 的純藍背景 =「藍色遮罩」。
// 修復：
//  1) --app-h 只跟隨「非鍵盤態」的真實可視高度（地址欄收展 ~90px，<15%）；
//     高度骤降超過 15% 判定為軟鍵盤，保持原高不壓縮 → 藍底永不露出。
//  2) 鍵盤彈起後輸入框可能被擋 → focusin 自動滾 .page-scroll 把它露出。
//  3) focusout（鍵盤收起）時 window.scrollTo(0,0) 清掉 iOS 殘留偏移。
{
  let baseAppH = 0
  const setAppH = () => {
    const h = window.visualViewport?.height ?? window.innerHeight
    if (!(h > 0)) return
    // 鍵盤檢測：高度相對基準骤降 >15% → 鍵盤態，跳過（不壓縮頁面）
    if (baseAppH > 0 && h < baseAppH * 0.85) return
    const prev = parseFloat(document.documentElement.style.getPropertyValue('--app-h')) || 0
    if (Math.abs(prev - h) > 0.5) {
      baseAppH = h
      document.documentElement.style.setProperty('--app-h', `${h}px`)
    } else {
      baseAppH = h
    }
  }
  setAppH()
  window.visualViewport?.addEventListener('resize', setAppH)
  window.addEventListener('resize', setAppH)
  window.addEventListener('orientationchange', () => setTimeout(setAppH, 120))
  // 鍵盤收起：清 iOS fixed 佈局的殘留視口偏移，並複測高度
  window.addEventListener('focusout', () => {
    window.scrollTo(0, 0)
    setTimeout(setAppH, 60)
    setTimeout(setAppH, 250)
  })
  window.addEventListener('pageshow', setAppH)

  /* ---- 輸入框藍色色塊根治 ----
   * 真兇：iOS 聚焦輸入框時會「滾動整份文檔」把輸入框送進可視區。
   *   html 不是 fixed（只有 body fixed + overflow:hidden），iOS 仍可滾動 window；
   *   一滾，fixed 的 body 之外露出來的正是 html 的純藍背景 = 你看到的藍色色塊。
   * 三重封鎖：
   *   1) window 任何滾動立刻拉回 0（滾了就按回去，物理上滾不動）
   *   2) focusin 當幀就把輸入框滾進 .page-scroll 可視區 —— iOS 沒理由再滾文檔
   *   3) html/body 背景改為與頁面同款（index.css），萬一露出也不突兀 */
  const lockWindowScroll = () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
  }
  // 1) 全局封鎖（被動監聽，不擋內部容器的滑動手勢）
  window.addEventListener('scroll', lockWindowScroll, { passive: true })

  const revealInput = (el: HTMLElement) => {
    const vh = window.visualViewport?.height ?? window.innerHeight
    const r = el.getBoundingClientRect()
    if (r.bottom > vh - 24) {
      const sc = el.closest('.page-scroll') as HTMLElement | null
      if (sc) sc.scrollTop += r.bottom - (vh - 64)
    }
  }

  window.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement | null
    if (!el) return
    const tag = el.tagName
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !el.isContentEditable) return
    // 2) 當幀就露出輸入框（IO S 因此不必滾文檔），鍵盤動畫後再校正一次
    revealInput(el)
    lockWindowScroll()
    requestAnimationFrame(lockWindowScroll)
    setTimeout(lockWindowScroll, 50)
    setTimeout(lockWindowScroll, 150)
    setTimeout(lockWindowScroll, 300)
    setTimeout(() => { revealInput(el); lockWindowScroll() }, 350)
  })
}

// ============ PWA 更新自動刷新 ============
// Service Worker 更新激活後(controllerchange)自動重載一次頁面，
// 根治"已部署新版本但用户看到的還是舊緩存"的問題。
// 僅在本次會話原本就有舊 SW 控制時才刷新(首次安裝不刷)。
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) {
      reloaded = true
      window.location.reload()
    }
  })

  // iOS PWA 從後台恢復時不會自動檢查 SW 更新——
  // 每次頁面重新可見時主動檢查一次（60 秒節流），配合上面的自動刷新，
  // 後台掛起幾小時回來也能立刻發現新版本。
  let lastCheck = 0
  const checkUpdate = () => {
    if (Date.now() - lastCheck < 60_000) return
    lastCheck = Date.now()
    navigator.serviceWorker.getRegistration()
      .then(reg => reg?.update())
      .catch(() => {})
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpdate()
  })
  window.addEventListener('focus', checkUpdate)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
