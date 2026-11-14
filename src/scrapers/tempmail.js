import axios from 'axios';
import { withDeadline } from '../core/resilience.js';

function generateRandomCORS(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Application-Name': 'web',
  'Application-Version': '4.0.0',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

export async function createTempEmail() {
  return await withDeadline(async () => {
    const res = await axios.post(
      'https://api.internal.temp-mail.io/api/v3/email/new',
      { min_name_length: 10, max_name_length: 12 },
      { headers: { ...HEADERS, 'X-CORS-Header': generateRandomCORS() }, timeout: 10000 }
    );
    return {
      status: true,
      email: res.data.email
    };
  }, 12000, 'tempmail-create');
}

export async function getTempInbox(email) {
  if (!email) throw new Error('Parameter email wajib diisi');

  return await withDeadline(async () => {
    const res = await axios.get(
      `https://api.internal.temp-mail.io/api/v3/email/${encodeURIComponent(email.trim())}/messages`,
      { headers: { ...HEADERS, 'X-CORS-Header': generateRandomCORS() }, timeout: 10000 }
    );
    const messages = Array.isArray(res.data) ? res.data : [];
    return {
      status: true,
      email,
      total_messages: messages.length,
      messages
    };
  }, 12000, 'tempmail-inbox');
}
