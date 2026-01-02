
// Mock logic from popup.js
function sanitizeSub(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^\/?r\//, '')
    .replace(/^r\//, '')
    .replace(/[^a-z0-9_]/g, ''); // conservative
}

// Mock logic from config.js
function normalizePath(path) {
  return (path || '').replace(/\/+$/, '') || '/';
}

function sanitizeTemp(list) {
    const arr = Array.isArray(list) ? list : [];
    const now = Date.now();

    const cleaned = arr
      .map((x) => {
        const sub = String(x?.sub ?? '')
          .trim()
          .toLowerCase()
          .replace(/^\/?r\//, '');
        const expiresAt = Number(x?.expiresAt ?? 0);
        if (!sub || !Number.isFinite(expiresAt)) return null;
        if (expiresAt <= now) return null;
        return { sub, expiresAt };
      })
      .filter(Boolean);

    // de-dupe by sub, keep latest expiry
    const bySub = new Map();
    for (const item of cleaned) {
      const prev = bySub.get(item.sub);
      if (!prev || item.expiresAt > prev.expiresAt) bySub.set(item.sub, item);
    }
    return Array.from(bySub.values());
}

function isAllowedPath(pathname, allowedSubs) {
    const p = normalizePath(pathname).toLowerCase();
    if (!p.startsWith('/r/')) return false;

    for (const sub of allowedSubs) {
      const s = String(sub).toLowerCase();
      const base = `/r/${s}`;
      if (p === base) return true;
      if (p.startsWith(base + '/')) return true;
    }
    return false;
}

// SIMULATION

const inputs = ['r/webdev', 'r/graphic_design', 'r/chatgpt'];
const now = Date.now();
const expiresAt = now + 100000;

let tempStorage = [];

console.log('--- ADDING SUBREDDITS ---');

for (const input of inputs) {
    // 1. Popup sanitization
    const sanitized = sanitizeSub(input);
    console.log(`Input: "${input}" -> SanitizeSub: "${sanitized}"`);

    // 2. Storage update simulation
    tempStorage.push({ sub: sanitized, expiresAt });
}

console.log('\n--- LOADING CONFIG ---');

// 3. Config sanitization
const tempAllowed = sanitizeTemp(tempStorage);
const allowedSubsNames = tempAllowed.map(x => x.sub);
console.log('Allowed Subs in Config:', allowedSubsNames);

console.log('\n--- VERIFYING PATHS ---');

const testPaths = [
    '/r/webdev',
    '/r/graphic_design',
    '/r/chatgpt',
    '/r/ChatGPT' // case sensitivity check
];

for (const path of testPaths) {
    const allowed = isAllowedPath(path, allowedSubsNames);
    console.log(`Path: "${path}" -> Allowed: ${allowed}`);
}
