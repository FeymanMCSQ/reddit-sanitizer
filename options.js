const STORAGE_KEY = 'allowedSubs';
const DEFAULT_ALLOWED = ['freelancers'];

const $subs = document.getElementById('subs');
const $save = document.getElementById('save');
const $status = document.getElementById('status');

function sanitizeSubs(lines) {
  const cleaned = lines
    .map((s) =>
      String(s || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
    .map((s) => s.replace(/^\/?r\//, '')); // allow "r/foo" or "/r/foo"

  // de-dupe
  const uniq = Array.from(new Set(cleaned));
  return uniq.length ? uniq : [...DEFAULT_ALLOWED];
}

function render(list) {
  $subs.value = (list && list.length ? list : DEFAULT_ALLOWED).join('\n');
}

function setStatus(msg, ok = true) {
  $status.textContent = msg || '';
  $status.style.color = ok ? '#0a662e' : '#a11a1a';
  if (msg) setTimeout(() => ($status.textContent = ''), 2000);
}

function load() {
  chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_ALLOWED }, (res) => {
    render(res[STORAGE_KEY]);
  });
}

function save() {
  const lines = $subs.value.split('\n');
  const allowedSubs = sanitizeSubs(lines);

  chrome.storage.sync.set({ [STORAGE_KEY]: allowedSubs }, () => {
    render(allowedSubs);
    setStatus('Saved.');
  });
}

document.addEventListener('DOMContentLoaded', load);
$save.addEventListener('click', save);

// Ctrl/Cmd+S
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
  }
});
