// Vercel Serverless Function: 从163邮箱获取邮件
// POST /api/fetch-mails
// Body: { email, authCode, limit? }

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// ============ 黑名單寄件人 ============
// 用戶明確要求：不要拉取領英（LinkedIn）的郵件。
// 領英發信域極多（linkedin.com / e.linkedin.com / mailer.linkedin.com /
// linkedin-europe.com / 1.linkedin.com ...），一律用「地址含 linkedin」判斷。
const BLOCKED_SENDERS = ['linkedin'];

function isBlocked(from, subject) {
  const s = `${from || ''} ${subject || ''}`.toLowerCase();
  return BLOCKED_SENDERS.some(k => s.includes(k));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求' });
  }

  const { email, authCode, limit = 100 } = req.body;

  if (!email || !authCode) {
    return res.status(400).json({ error: '请提供邮箱地址和授权码' });
  }

  if (!email.endsWith('@163.com') && !email.endsWith('@126.com')) {
    return res.status(400).json({ error: '目前仅支持163和126邮箱' });
  }

  try {
    const mails = await fetchUnreadMails(email, authCode, limit);
    // 用戶要求：163 收到的郵件都有用，全部返回（不再只留城大相關）；
    //    唯一例外 = 領英，直接剔除，連 AI 分析的額度都省下來。
    const filtered = mails.filter(m => !isBlocked(m.from, m.subject));
    return res.status(200).json({
      success: true,
      mails: filtered,
      count: filtered.length,
      total: mails.length,
    });
  } catch (err) {
    console.error('获取邮件失败:', err);
    return res.status(500).json({ error: err.message || '获取邮件失败，请检查邮箱和授权码' });
  }
}

function fetchUnreadMails(email, authCode, limit) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: authCode,
      host: 'imap.163.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 20000,
      authTimeout: 20000,
      id: {
        name: 'HAKONS-MATE',
        version: '1.0.0',
        vendor: 'HAKON',
        'support-email': email,
      },
    });

    const mails = [];

    imap.once('ready', () => {
      // 163邮箱要求发送IMAP ID命令，否则报Unsafe Login
      imap._enqueue && imap._enqueue('ID ("name" "HAKONS-MATE" "version" "1.0.0" "vendor" "HAKON")');

      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          imap.end();
          return reject(new Error('无法打开收件箱: ' + (err.message || JSON.stringify(err))));
        }

        // 只拉最近7天内的邮件（用户要求全部拉取、范围一周）
        const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        imap.search([['SINCE', since]], (searchErr, results) => {
          if (searchErr) {
            imap.end();
            return reject(new Error('搜索邮件失败: ' + (searchErr.message || JSON.stringify(searchErr))));
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          // 取最近的邮件
          const targetIds = results.slice(-Math.min(limit, results.length));
          const fetch = imap.fetch(targetIds, { bodies: '', struct: true });

          fetch.on('message', (msg) => {
            let body = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                body += chunk.toString('utf8');
              });
            });

            msg.once('end', () => {
              simpleParser(body, (parseErr, parsed) => {
                if (!parseErr && parsed) {
                  mails.push({
                    id: parsed.messageId || '',
                    subject: parsed.subject || '(无主题)',
                    from: parsed.from?.text || '',
                    date: parsed.date?.toISOString() || '',
                    text: parsed.text?.slice(0, 3000) || '',
                  });
                }
              });
            });
          });

          fetch.once('error', (fetchErr) => {
            imap.end();
            reject(new Error('读取邮件内容失败: ' + fetchErr.message));
          });

          fetch.once('end', () => {
            imap.end();
            mails.sort((a, b) => b.date.localeCompare(a.date));
            resolve(mails);
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(new Error('IMAP连接失败: ' + (err.message || JSON.stringify(err))));
    });

    imap.connect();
  });
}
