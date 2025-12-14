(() => {
  const STORAGE_KEY = 'allowedSubs';
  const DEFAULT_ALLOWED = ['freelance']; // change to ['freelancers'] or both if you want

  const DEBUG = false;
  const log = (...args) => DEBUG && console.log('[RS:Config]', ...args);

  let allowedSubs = sanitizeSubs(DEFAULT_ALLOWED);
  let loaded = false;
  let loadingPromise = null;

  function normalizePath(path) {
    return (path || '').replace(/\/+$/, '') || '/';
  }

  function sanitizeSubs(list) {
    const arr = Array.isArray(list) ? list : [];
    const cleaned = arr
      .map((s) =>
        String(s ?? '')
          .trim()
          .toLowerCase()
      )
      .map((s) => s.replace(/^\/?r\//, '')) // allow "r/foo" or "/r/foo"
      .filter(Boolean);

    // de-dupe + fallback to defaults if empty
    const uniq = Array.from(new Set(cleaned));
    return uniq.length
      ? uniq
      : Array.from(
          new Set(DEFAULT_ALLOWED.map((s) => String(s).toLowerCase()))
        );
  }

  function getAllowedSubsSync() {
    return allowedSubs;
  }

  // Strictly allow only these forms:
  // /r/<sub>
  // /r/<sub>/...
  // Case-insensitive, trailing slashes ignored
  function isAllowedPath(pathname) {
    const p = normalizePath(pathname).toLowerCase();

    // quick reject: only subreddit paths are considered
    if (!p.startsWith('/r/')) return false;

    for (const sub of allowedSubs) {
      const s = String(sub).toLowerCase();
      const base = `/r/${s}`;
      if (p === base) return true;
      if (p.startsWith(base + '/')) return true;
    }
    return false;
  }

  function loadAllowedSubs() {
    if (loaded) return Promise.resolve(allowedSubs);
    if (loadingPromise) return loadingPromise;

    // If storage isn't available, just finalize defaults
    if (!globalThis.chrome?.storage?.sync?.get) {
      loaded = true;
      return Promise.resolve(allowedSubs);
    }

    loadingPromise = new Promise((resolve) => {
      chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_ALLOWED }, (res) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          // Don't brick the extension if storage is unavailable
          log('storage.get error:', err.message);
          allowedSubs = sanitizeSubs(DEFAULT_ALLOWED);
          loaded = true;
          resolve(allowedSubs);
          return;
        }

        allowedSubs = sanitizeSubs(res?.[STORAGE_KEY]);
        loaded = true;
        log('loaded allowedSubs:', allowedSubs);
        resolve(allowedSubs);
      });
    });

    return loadingPromise;
  }

  // Keep in sync when options change
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (!changes?.[STORAGE_KEY]) return;

      allowedSubs = sanitizeSubs(changes[STORAGE_KEY].newValue);
      loaded = true; // we now have a real value
      log('onChanged allowedSubs:', allowedSubs);
    });
  }

  globalThis.RedditSanitizer = globalThis.RedditSanitizer || {};
  globalThis.RedditSanitizer.config = {
    STORAGE_KEY,
    DEFAULT_ALLOWED,
    normalizePath,
    loadAllowedSubs,
    getAllowedSubsSync,
    isAllowedPath,
  };

  // Kick off load early (non-blocking). Gate still enforces defaults immediately.
  loadAllowedSubs();
})();
