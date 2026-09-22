// Vercel Serverless Function: DeepSeek 代理
// POST /api/chat
// Body: { messages: [{role, content}], temperature?, maxTokens? }
// 返回: { content: string }
//
// 为什么要代理：之前 API Key 直接写在前端 src/utils/deepseek.ts 里，
// 任何人打开网页都能在打包后的 JS 中看到并盗用。现在 Key 只存在
// Vercel 的环境变量 DEEPSEEK_API_KEY 中，永不进入浏览器。

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

// 允許呼叫本接口的來源（防止別人把你的接口當免費 AI 網關用）。
// 瀏覽器的 CORS 由伺服器決定，這裡只放行自己的兩個域名 + 本地開發。
const ALLOWED_ORIGINS = [
  'https://hakons-mate-mobile.vercel.app',
  'https://hakons-mate-friend.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async function handler(req, res) {
  const origin = req.headers?.origin || '';
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });
  }

  const { messages, temperature = 0.7, maxTokens = 2000 } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '缺少 messages' });
  }

  try {
    const upstream = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('DeepSeek upstream error:', upstream.status, errText);
      return res.status(upstream.status).json({ error: `DeepSeek 调用失败: ${upstream.status}` });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || '';
    return res.status(200).json({ content });
  } catch (err) {
    console.error('DeepSeek proxy error:', err);
    return res.status(500).json({ error: err.message || 'DeepSeek 调用失败' });
  }
}
