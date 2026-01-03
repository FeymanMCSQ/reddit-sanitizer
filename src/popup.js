const UNLOCK_MS = 1000; // 3 minutes
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const TEMP_KEY = 'tempAllowedSubs';

const stateKey = 'tempUnlockState'; // local, to survive popup close
// { sub: "forhire", startedAt: 123 }

const $sub = document.getElementById('sub');
const $status = document.getElementById('status');
const $start = document.getElementById('start');
const $add = document.getElementById('add');

function sanitizeSub(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^\/?r\//, '')
    .replace(/^r\//, '')
    .replace(/[^a-z0-9_]/g, ''); // conservative
}

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function setStatus(text) {
  $status.textContent = text;
}

async function getLocal(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

async function setLocal(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function loadUnlock() {
  const res = await getLocal({ [stateKey]: null });
  return res[stateKey];
}

async function saveUnlock(st) {
  await setLocal({ [stateKey]: st });
}

async function clearUnlock() {
  await setLocal({ [stateKey]: null });
}

async function loadTempList() {
  const res = await getLocal({ [TEMP_KEY]: [] });
  const now = Date.now();
  // cleanup
  const cleaned = (Array.isArray(res[TEMP_KEY]) ? res[TEMP_KEY] : [])
    .map((x) => ({
      sub: sanitizeSub(x?.sub),
      expiresAt: Number(x?.expiresAt || 0),
    }))
    .filter((x) => x.sub && x.expiresAt > now);

  await setLocal({ [TEMP_KEY]: cleaned });
  return cleaned;
}

async function addTempSub(sub) {
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  const list = await loadTempList();

  // update or insert (keep latest expiry)
  const bySub = new Map(list.map((x) => [x.sub, x]));
  const prev = bySub.get(sub);
  bySub.set(sub, { sub, expiresAt: Math.max(prev?.expiresAt || 0, expiresAt) });

  const next = Array.from(bySub.values());
  await setLocal({ [TEMP_KEY]: next });
}

let timer = null;

async function render() {
  const unlock = await loadUnlock();
  const now = Date.now();

  const inputSub = sanitizeSub($sub.value);

  if (!unlock) {
    $add.disabled = true;
    $start.disabled = !inputSub;
    setStatus('Locked. Start unlock to add.');
    return;
  }

  // if user changed input, require restarting unlock
  if (sanitizeSub(unlock.sub) !== inputSub) {
    $add.disabled = true;
    $start.disabled = !inputSub;
    setStatus('Sub changed. Start unlock again.');
    return;
  }

  const elapsed = now - unlock.startedAt;
  const remaining = UNLOCK_MS - elapsed;

  if (remaining > 0) {
    $add.disabled = true;
    $start.disabled = true;
    setStatus(`Unlocking… ${fmt(remaining)} remaining`);
    return;
  }

  // unlocked
  $start.disabled = true;
  $add.disabled = !inputSub;
  setStatus('Unlocked. You can add it (expires in 6h).');
}

function startTicker() {
  if (timer) clearInterval(timer);
  timer = setInterval(render, 250);
}

$start.addEventListener('click', async () => {
  const sub = sanitizeSub($sub.value);
  if (!sub) return;

  await saveUnlock({ sub, startedAt: Date.now() });
  await render();
  startTicker();
});

$add.addEventListener('click', async () => {
  const sub = sanitizeSub($sub.value);
  if (!sub) return;

  // must be unlocked for same sub
  const unlock = await loadUnlock();
  if (!unlock || sanitizeSub(unlock.sub) !== sub) {
    setStatus('Locked. Start unlock first.');
    return;
  }
  if (Date.now() - unlock.startedAt < UNLOCK_MS) {
    setStatus('Still unlocking…');
    return;
  }

  await addTempSub(sub);
  await clearUnlock();
  setStatus(`Added r/${sub} for 6 hours.`);
  $add.disabled = true;
  $start.disabled = false;
});

$sub.addEventListener('input', async () => {
  await render();
});

(async () => {
  await render();
  startTicker();
})();
