import axios from 'axios';

export async function askAI(prompt, system = 'Kamu adalah AI asisten pintar dan ramah berbahasa Indonesia.') {
  if (!prompt) throw new Error('Parameter prompt wajib diisi');

  try {
    const res = await axios.post(
      'https://text.pollinations.ai/',
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt.trim() }
        ],
        model: 'openai',
        seed: Math.floor(Math.random() * 100000)
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
      }
    );

    const reply = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    return {
      status: true,
      prompt,
      reply: reply.trim()
    };
  } catch (err) {
    throw new Error(`AI Service Error: ${err.message}`);
  }
}
