import axios from 'axios';

async function queryModel(prompt, system, modelName) {
  const res = await axios.post(
    'https://text.pollinations.ai/',
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt.trim() }
      ],
      model: modelName,
      seed: Math.floor(Math.random() * 100000)
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );

  const reply = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  return reply.trim();
}

export async function askAI(prompt, system = 'Kamu adalah AI asisten pintar dan ramah berbahasa Indonesia.', model = 'openai') {
  if (!prompt) throw new Error('Parameter prompt wajib diisi');

  const models = [model, 'mistral', 'qwen'];
  let lastErr = null;

  for (const m of models) {
    try {
      const reply = await queryModel(prompt, system, m);
      if (reply) {
        return {
          status: true,
          engine: `Pollinations (${m})`,
          prompt,
          reply
        };
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[AI] Model ${m} gagal (${err.message}), mencoba fallback berikutnya...`);
    }
  }

  throw new Error(`Semua engine AI gagal: ${lastErr?.message}`);
}
