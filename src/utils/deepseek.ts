// DeepSeek API 調用工具
//
// 【安全】API Key 不再放在前端（任何人都能在打包後的 JS 裡看到），
// 改為呼叫自家後端代理 /api/chat，Key 只存在 Vercel 環境變數 DEEPSEEK_API_KEY。
// 朋友版部署在 Cloudflare Pages（純靜態、沒有 serverless），
// 因此用構建期環境變數 VITE_API_BASE 指回自用版的 Vercel 域名。
const API_BASE = import.meta.env.VITE_API_BASE || '';
const CHAT_URL = `${API_BASE}/api/chat`;

export interface DeepSeekMessage {
  role: 'system' | 'user';
  content: string;
}

/** 統一入口：丟給後端代理。失敗返回 ''（所有呼叫端都容錯，不會崩） */
async function requestChat(
  messages: DeepSeekMessage[],
  temperature: number,
  maxTokens: number
): Promise<string> {
  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature, maxTokens }),
    });
    if (!res.ok) {
      console.error('AI 代理錯誤:', res.status);
      return '';
    }
    const data = await res.json();
    return (data?.content || '').trim();
  } catch (e) {
    console.error('AI 代理呼叫失敗:', e);
    return '';
  }
}

export async function callDeepSeek(messages: DeepSeekMessage[], temperature = 0.7): Promise<string> {
  return requestChat(messages, temperature, 2000);
}

/** 每日一句 AI 點評（首頁 Daily Insight）：傳入今日數據摘要，返回一句話。失敗返回 ''。 */
export async function getDailyInsight(profile: string, lang: 'zh' | 'en'): Promise<string> {
  const sys = lang === 'zh'
    ? '你是用戶的私人學習生活助手。根據提供的今日數據，對今天說一句點評或鼓勵。硬性要求：40字以內；不用emoji；不用引號；禁止「加油」「你可以的」這類套話；口吻像溫暖又帶點冷幽默的朋友；繁體中文。只輸出這一句話，不要任何其他內容。'
    : 'You are the user\'s personal study-life companion. Given today\'s data, reply with ONE short sentence (max 20 words) of comment or encouragement. No emojis, no quotes, no clichés ("you got this" etc.), warm with a touch of dry humor. Output only the sentence.';
  const text = await requestChat(
    [
      { role: 'system', content: sys },
      { role: 'user', content: profile },
    ],
    1.0,
    120
  );
  // 去掉 AI 可能帶的引號與前綴客套
  return text.replace(/^["'「」『』\s]+|["'「」『』\s]+$/g, '').slice(0, 80);
}
