// pages/api/qwen.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array' });
    }

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'QWEN_API_KEY is not configured' });
    }

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        input: { messages },
        parameters: { result_format: 'message' },
      }),
    });

    // 即使状态码不是 200，也要尝试读取 body
    const data = await response.json();

    if (!response.ok) {
      console.error('DashScope API error:', data);
      return res.status(response.status).json({ error: data });
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}