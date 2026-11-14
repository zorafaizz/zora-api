import axios from 'axios';
import crypto from 'node:crypto';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Bounded in-memory session store so getTempInbox(email) stays 100% backward-compatible
// with `?email=...` without exposing provider session tokens to callers.
const INBOX_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_STORED_SESSIONS = 2000;
const inboxSessions = new Map();

function saveInboxSession(email, sessionData) {
  const now = Date.now();
  if (inboxSessions.size >= MAX_STORED_SESSIONS) {
    for (const [k, v] of inboxSessions.entries()) {
      if (now > v.expiresAt) inboxSessions.delete(k);
      if (inboxSessions.size < MAX_STORED_SESSIONS) break;
    }
    if (inboxSessions.size >= MAX_STORED_SESSIONS) {
      const oldestKey = inboxSessions.keys().next().value;
      if (oldestKey) inboxSessions.delete(oldestKey);
    }
  }
  inboxSessions.set(email.toLowerCase(), {
    ...sessionData,
    expiresAt: now + INBOX_SESSION_TTL_MS
  });
}

function getInboxSession(email) {
  const entry = inboxSessions.get(String(email || '').toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inboxSessions.delete(String(email || '').toLowerCase());
    return null;
  }
  return entry;
}

function randomAlphaNum(len = 10) {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

// ============================================================================
// Provider 1 (Tier 1): Mail.tm Official Public API (Benchmarked 330ms p50)
// ============================================================================
async function createMailTm({ signal, timeoutMs }) {
  const stepTimeout = Math.max(2500, Math.floor(timeoutMs / 3));
  const domRes = await axios.get('https://api.mail.tm/domains', {
    headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
    timeout: stepTimeout,
    signal
  });
  const domains = domRes.data?.['hydra:member'] || (Array.isArray(domRes.data) ? domRes.data : []);
  const activeDomain = domains.find((d) => d.isActive !== false)?.domain;
  if (!activeDomain) throw new Error('Domain Mail.tm tidak tersedia');

  const address = `zora${randomAlphaNum(8)}@${activeDomain}`;
  const password = `Zr!${randomAlphaNum(14)}`;

  await axios.post(
    'https://api.mail.tm/accounts',
    { address, password },
    { headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA }, timeout: stepTimeout, signal }
  );

  const tokRes = await axios.post(
    'https://api.mail.tm/token',
    { address, password },
    { headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA }, timeout: stepTimeout, signal }
  );

  const jwt = tokRes.data?.token;
  if (!jwt) throw new Error('Gagal mendapatkan token sesi Mail.tm');

  saveInboxSession(address, { provider: 'mail_tm', token: jwt });

  return {
    status: true,
    engine: 'Mail.tm (Tier-1)',
    email: address
  };
}

async function inboxMailTm(email, token, { signal, timeoutMs }) {
  const res = await axios.get('https://api.mail.tm/messages', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': BROWSER_UA
    },
    timeout: timeoutMs,
    signal
  });

  const rawList = res.data?.['hydra:member'] || (Array.isArray(res.data) ? res.data : []);
  const messages = rawList.map((m) => ({
    id: m.id,
    from: m.from?.address || m.from?.name || '',
    subject: m.subject || '(No Subject)',
    intro: m.intro || '',
    date: m.createdAt || null
  }));

  return {
    status: true,
    engine: 'Mail.tm (Tier-1)',
    email,
    total_messages: messages.length,
    messages
  };
}

// ============================================================================
// Provider 2 (Tier 1): TempMail.lol v2 API (Benchmarked 387ms p50)
// ============================================================================
async function createTempMailLol({ signal, timeoutMs }) {
  const res = await axios.post(
    'https://api.tempmail.lol/v2/inbox/create',
    {},
    { headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA }, timeout: timeoutMs, signal }
  );
  const { address, token } = res.data || {};
  if (!address || !token) throw new Error('TempMail.lol tidak mengembalikan alamat email');

  saveInboxSession(address, { provider: 'tempmail_lol', token });
  return {
    status: true,
    engine: 'TempMail.lol v2 (Tier-1)',
    email: address
  };
}

async function inboxTempMailLol(email, token, { signal, timeoutMs }) {
  const res = await axios.get('https://api.tempmail.lol/v2/inbox', {
    params: { token },
    headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });
  const rawEmails = Array.isArray(res.data?.emails) ? res.data.emails : [];
  const messages = rawEmails.map((m, idx) => ({
    id: m.id || idx + 1,
    from: m.from || '',
    subject: m.subject || '(No Subject)',
    body: m.body || m.html || '',
    date: m.date ? new Date(m.date).toISOString() : null
  }));
  return {
    status: true,
    engine: 'TempMail.lol v2 (Tier-1)',
    email,
    total_messages: messages.length,
    messages
  };
}

// ============================================================================
// Provider 3 (Tier 2): GuerrillaMail Public JSON API (Benchmarked 391ms p50)
// ============================================================================
async function createGuerrillaMail({ signal, timeoutMs }) {
  const res = await axios.get('https://api.guerrillamail.com/ajax.php', {
    params: { f: 'get_email_address', ip: '127.0.0.1', agent: 'KanjutGedeAPI' },
    headers: { 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });
  const { email_addr: address, sid_token: sidToken } = res.data || {};
  if (!address || !sidToken) throw new Error('GuerrillaMail gagal membuat alamat');

  saveInboxSession(address, { provider: 'guerrillamail', token: sidToken });
  return {
    status: true,
    engine: 'GuerrillaMail (Tier-2)',
    email: address
  };
}

async function inboxGuerrillaMail(email, sidToken, { signal, timeoutMs }) {
  const res = await axios.get('https://api.guerrillamail.com/ajax.php', {
    params: { f: 'check_email', seq: 0, sid_token: sidToken },
    headers: { 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });
  const list = Array.isArray(res.data?.list) ? res.data.list : [];
  const messages = list.map((m) => ({
    id: m.mail_id,
    from: m.mail_from || '',
    subject: m.mail_subject || '',
    intro: m.mail_excerpt || '',
    date: m.mail_timestamp ? new Date(Number(m.mail_timestamp) * 1000).toISOString() : null
  }));
  return {
    status: true,
    engine: 'GuerrillaMail (Tier-2)',
    email,
    total_messages: messages.length,
    messages
  };
}

// ============================================================================
// Provider 4 (Tier 2): temp-mail.io Internal v3 API (Existing retained)
// ============================================================================
const TEMPMAIL_IO_HEADERS = {
  'Content-Type': 'application/json',
  'Application-Name': 'web',
  'Application-Version': '4.0.0',
  'User-Agent': BROWSER_UA
};

async function createTempMailIo({ signal, timeoutMs }) {
  const res = await axios.post(
    'https://api.internal.temp-mail.io/api/v3/email/new',
    { min_name_length: 10, max_name_length: 12 },
    {
      headers: { ...TEMPMAIL_IO_HEADERS, 'X-CORS-Header': randomAlphaNum(16) },
      timeout: timeoutMs,
      signal
    }
  );
  if (!res.data?.email) throw new Error('temp-mail.io tidak mengembalikan email');
  saveInboxSession(res.data.email, { provider: 'tempmail_io', token: null });
  return {
    status: true,
    engine: 'temp-mail.io v3 (Tier-2)',
    email: res.data.email
  };
}

async function inboxTempMailIo(email, { signal, timeoutMs }) {
  const res = await axios.get(
    `https://api.internal.temp-mail.io/api/v3/email/${encodeURIComponent(email.trim())}/messages`,
    {
      headers: { ...TEMPMAIL_IO_HEADERS, 'X-CORS-Header': randomAlphaNum(16) },
      timeout: timeoutMs,
      signal
    }
  );
  const messages = Array.isArray(res.data) ? res.data : [];
  return {
    status: true,
    engine: 'temp-mail.io v3 (Tier-2)',
    email,
    total_messages: messages.length,
    messages
  };
}

export async function createTempEmail() {
  const { data } = await executeMultiProvider(
    'tool.tempmail.create',
    [
      {
        id: 'tempmail_mailtm',
        failureDomain: 'api.mail.tm',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => createMailTm(ctx)
      },
      {
        id: 'tempmail_lol',
        failureDomain: 'api.tempmail.lol',
        tier: 1,
        timeoutMs: 8000,
        allowTransientRetry: true,
        fn: (ctx) => createTempMailLol(ctx)
      },
      {
        id: 'tempmail_guerrilla',
        failureDomain: 'api.guerrillamail.com',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => createGuerrillaMail(ctx)
      },
      {
        id: 'tempmail_io_v3',
        failureDomain: 'temp-mail.io',
        tier: 2,
        timeoutMs: 8500,
        fn: (ctx) => createTempMailIo(ctx)
      }
    ],
    {
      totalDeadlineMs: 18000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.email && r.email.includes('@'))
    }
  );
  return data;
}

export async function getTempInbox(email) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new ValidationError('Parameter email wajib diisi');
  }

  const cleanEmail = email.trim();
  const session = getInboxSession(cleanEmail);

  if (session?.provider === 'mail_tm' && session.token) {
    const { data } = await executeMultiProvider(
      'tool.tempmail.inbox',
      [
        {
          id: 'tempmail_mailtm_inbox',
          failureDomain: 'api.mail.tm',
          tier: 1,
          timeoutMs: 8500,
          allowTransientRetry: true,
          fn: (ctx) => inboxMailTm(cleanEmail, session.token, ctx)
        }
      ],
      { totalDeadlineMs: 12000, retryBudget: 1 }
    );
    return data;
  }

  if (session?.provider === 'tempmail_lol' && session.token) {
    const { data } = await executeMultiProvider(
      'tool.tempmail.inbox',
      [
        {
          id: 'tempmail_lol_inbox',
          failureDomain: 'api.tempmail.lol',
          tier: 1,
          timeoutMs: 8500,
          allowTransientRetry: true,
          fn: (ctx) => inboxTempMailLol(cleanEmail, session.token, ctx)
        }
      ],
      { totalDeadlineMs: 12000, retryBudget: 1 }
    );
    return data;
  }

  if (session?.provider === 'guerrillamail' && session.token) {
    const { data } = await executeMultiProvider(
      'tool.tempmail.inbox',
      [
        {
          id: 'tempmail_guerrilla_inbox',
          failureDomain: 'api.guerrillamail.com',
          tier: 1,
          timeoutMs: 8500,
          allowTransientRetry: true,
          fn: (ctx) => inboxGuerrillaMail(cleanEmail, session.token, ctx)
        }
      ],
      { totalDeadlineMs: 12000, retryBudget: 1 }
    );
    return data;
  }

  // Fallback for stateless / temp-mail.io addresses
  const { data } = await executeMultiProvider(
    'tool.tempmail.inbox',
    [
      {
        id: 'tempmail_io_v3_inbox',
        failureDomain: 'temp-mail.io',
        tier: 1,
        timeoutMs: 9000,
        allowTransientRetry: true,
        fn: (ctx) => inboxTempMailIo(cleanEmail, ctx)
      }
    ],
    { totalDeadlineMs: 12000, retryBudget: 1 }
  );
  return data;
}
