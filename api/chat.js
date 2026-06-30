// Vercel Serverless Function: /api/chat
// 支持 Claude 和 DeepSeek 双 API，通过环境变量切换
//
// 环境变量：
//   API_PROVIDER       = "deepseek" | "claude"  （默认 deepseek）
//   DEEPSEEK_API_KEY   = sk-xxx
//   DEEPSEEK_MODEL     = deepseek-chat（默认，图片功能需用支持视觉的模型）
//   ANTHROPIC_API_KEY  = sk-ant-xxx
//   ANTHROPIC_MODEL    = claude-sonnet-4-6（默认）

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provider = (process.env.API_PROVIDER || 'deepseek').toLowerCase();

  try {
    const { messages, max_tokens = 1500 } = req.body;

    if (provider === 'deepseek') {
      return await handleDeepSeek(req, res, messages, max_tokens);
    } else {
      return await handleClaude(req, res, messages, max_tokens);
    }
  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ─── DeepSeek ───
async function handleDeepSeek(req, res, messages, max_tokens) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  // Claude message 格式 → OpenAI 格式
  const convertedMessages = messages.map(msg => {
    if (typeof msg.content === 'string') return msg;
    const parts = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        parts.push({ type: 'text', text: block.text });
      } else if (block.type === 'image') {
        const dataUrl = `data:${block.source.media_type};base64,${block.source.data}`;
        parts.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    }
    return { role: msg.role, content: parts };
  });

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens, messages: convertedMessages }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);

  // OpenAI 格式 → 统一的前端格式
  const text = data.choices?.[0]?.message?.content || '';
  return res.status(200).json({ content: [{ type: 'text', text }] });
}

// ─── Claude ───
async function handleClaude(req, res, messages, max_tokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens, messages }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  return res.status(200).json(data);
}
