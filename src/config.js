(() => {
  const DEFAULT_ALLOWED = ['freelancers'];
  const STORAGE_KEY = 'allowedSubs';

  let allowedSubs = [...DEFAULT_ALLOWED];
  let loaded = false;
  let loadingPromise = null;

  function normalizePath(path) {
    return (path || '').replace(/\/+$/, '') || '/';
  }

  function sanitizeSubs(list) {
    if (!Array.isArray(list)) return [...DEFAULT_ALLOWED];
    const cleaned = list
      .map((s) =>
        String(s || '')
          .trim()
          .toLowerCase()
      )
      .map((s) => s.replace(/^\/?r\//, '')) // allow "r/foo" or "/r/foo"
      .filter(Boolean);

    return cleaned.length ? cleaned : [...DEFAULT_ALLOWED];
  }

  function getAllowedSubsSync() {
    return allowedSubs;
  }

  function isAllowedPath(pathname) {
    const p = normalizePath(pathname);
    for (const sub of allowedSubs) {
      if (p === `/r/${sub}` || p.startsWith(`/r/${sub}/`)) return true;
    }
    return false;
  }

  function loadAllowedSubs() {
    if (loaded) return Promise.resolve(allowedSubs);
    if (loadingPromise) return loadingPromise;

    // If chrome.storage isn't available for some reason, keep defaults
    if (!globalThis.chrome?.storage?.sync?.get) {
      loaded = true;
      return Promise.resolve(allowedSubs);
    }

    loadingPromise = new Promise((resolve) => {
      chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_ALLOWED }, (res) => {
        allowedSubs = sanitizeSubs(res?.[STORAGE_KEY]);
        loaded = true;
        resolve(allowedSubs);
      });
    });

    return loadingPromise;
  }

  // Keep in sync when user changes options later
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (!changes[STORAGE_KEY]) return;

      allowedSubs = sanitizeSubs(changes[STORAGE_KEY].newValue);
      loaded = true;
    });
  }

  globalThis.RedditSanitizer = globalThis.RedditSanitizer || {};
  globalThis.RedditSanitizer.config = {
    DEFAULT_ALLOWED,
    STORAGE_KEY,
    normalizePath,
    loadAllowedSubs,
    getAllowedSubsSync,
    isAllowedPath,
  };
})();
