// (() => {
//   const STORAGE_KEY = 'allowedSubs';
//   const DEFAULT_ALLOWED = ['freelance']; // change to ['freelancers'] or both if you want

//   const DEBUG = false;
//   const log = (...args) => DEBUG && console.log('[RS:Config]', ...args);

//   let allowedSubs = sanitizeSubs(DEFAULT_ALLOWED);
//   let loaded = false;
//   let loadingPromise = null;

//   function normalizePath(path) {
//     return (path || '').replace(/\/+$/, '') || '/';
//   }

//   function sanitizeSubs(list) {
//     const arr = Array.isArray(list) ? list : [];
//     const cleaned = arr
//       .map((s) =>
//         String(s ?? '')
//           .trim()
//           .toLowerCase()
//       )
//       .map((s) => s.replace(/^\/?r\//, '')) // allow "r/foo" or "/r/foo"
//       .filter(Boolean);

//     // de-dupe + fallback to defaults if empty
//     const uniq = Array.from(new Set(cleaned));
//     return uniq.length
//       ? uniq
//       : Array.from(
//           new Set(DEFAULT_ALLOWED.map((s) => String(s).toLowerCase()))
//         );
//   }

//   function getAllowedSubsSync() {
//     return allowedSubs;
//   }

//   // Strictly allow only these forms:
//   // /r/<sub>
//   // /r/<sub>/...
//   // Case-insensitive, trailing slashes ignored
//   function isAllowedPath(pathname) {
//     const p = normalizePath(pathname).toLowerCase();

//     // quick reject: only subreddit paths are considered
//     if (!p.startsWith('/r/')) return false;

//     for (const sub of allowedSubs) {
//       const s = String(sub).toLowerCase();
//       const base = `/r/${s}`;
//       if (p === base) return true;
//       if (p.startsWith(base + '/')) return true;
//     }
//     return false;
//   }

//   function loadAllowedSubs() {
//     if (loaded) return Promise.resolve(allowedSubs);
//     if (loadingPromise) return loadingPromise;

//     // If storage isn't available, just finalize defaults
//     if (!globalThis.chrome?.storage?.sync?.get) {
//       loaded = true;
//       return Promise.resolve(allowedSubs);
//     }

//     loadingPromise = new Promise((resolve) => {
//       chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_ALLOWED }, (res) => {
//         const err = chrome.runtime?.lastError;
//         if (err) {
//           // Don't brick the extension if storage is unavailable
//           log('storage.get error:', err.message);
//           allowedSubs = sanitizeSubs(DEFAULT_ALLOWED);
//           loaded = true;
//           resolve(allowedSubs);
//           return;
//         }

//         allowedSubs = sanitizeSubs(res?.[STORAGE_KEY]);
//         loaded = true;
//         log('loaded allowedSubs:', allowedSubs);
//         resolve(allowedSubs);
//       });
//     });

//     return loadingPromise;
//   }

//   // Keep in sync when options change
//   if (globalThis.chrome?.storage?.onChanged) {
//     chrome.storage.onChanged.addListener((changes, area) => {
//       if (area !== 'sync') return;
//       if (!changes?.[STORAGE_KEY]) return;

//       allowedSubs = sanitizeSubs(changes[STORAGE_KEY].newValue);
//       loaded = true; // we now have a real value
//       log('onChanged allowedSubs:', allowedSubs);
//     });
//   }

//   globalThis.RedditSanitizer = globalThis.RedditSanitizer || {};
//   globalThis.RedditSanitizer.config = {
//     STORAGE_KEY,
//     DEFAULT_ALLOWED,
//     normalizePath,
//     loadAllowedSubs,
//     getAllowedSubsSync,
//     isAllowedPath,
//   };

//   // Kick off load early (non-blocking). Gate still enforces defaults immediately.
//   loadAllowedSubs();
// })();

(() => {
  const STORAGE_KEY = 'allowedSubs';

  // Default strict: only this subreddit until options override it
  const DEFAULT_ALLOWED = ['freelance'];

  // Non-subreddit Reddit routes you *want* to allow (for marketing workflows)
  // Keep these conservative: utility pages, not feeds.
  const DEFAULT_ALLOWED_PATH_PREFIXES = [
    '/user/', // profiles (for DM / context)
    '/message/', // inbox/compose
    '/account/', // account settings pages
    '/login', // auth
    '/register',
    '/password', // password recovery flows
  ];

  // Hard-block algorithmic feeds no matter what
  const BLOCKED_FEED_PATHS = new Set(['/', '/best', '/hot', '/new', '/top']);
  const BLOCKED_FEED_PREFIXES = ['/r/all', '/r/popular'];

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

    const uniq = Array.from(new Set(cleaned));
    if (uniq.length) return uniq;

    return Array.from(
      new Set(DEFAULT_ALLOWED.map((s) => String(s).toLowerCase()))
    );
  }

  function getAllowedSubsSync() {
    return allowedSubs;
  }

  // Subreddit allow: /r/<sub> or /r/<sub>/...
  function isAllowedPath(pathname) {
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

  // Explicit algorithmic feed detection
  function isExplicitFeedPath(pathname) {
    const p = normalizePath(pathname).toLowerCase();

    if (BLOCKED_FEED_PATHS.has(p)) return true;

    for (const pref of BLOCKED_FEED_PREFIXES) {
      if (p === pref || p.startsWith(pref + '/')) return true;
    }

    return false;
  }

  // Non-subreddit allowlist (profiles, messaging, auth)
  function isAllowedUtilityPath(pathname) {
    const p = normalizePath(pathname).toLowerCase();

    // exact matches allowed
    if (p === '/user' || p === '/message' || p === '/account') return true;

    // prefix matches allowed
    for (const pref of DEFAULT_ALLOWED_PATH_PREFIXES) {
      if (p.startsWith(pref)) return true;
    }

    return false;
  }

  /**
   * Single source of truth for "can I be on this Reddit route?"
   * - Always blocks algorithmic feeds
   * - Allows whitelisted subreddits
   * - Allows utility routes (profiles/messages/auth)
   * - Blocks everything else inside Reddit
   */
  function isAllowedRedditPath(pathname) {
    if (isExplicitFeedPath(pathname)) return false;
    if (isAllowedPath(pathname)) return true;
    if (isAllowedUtilityPath(pathname)) return true;
    return false;
  }

  function loadAllowedSubs() {
    if (loaded) return Promise.resolve(allowedSubs);
    if (loadingPromise) return loadingPromise;

    if (!globalThis.chrome?.storage?.sync?.get) {
      loaded = true;
      return Promise.resolve(allowedSubs);
    }

    loadingPromise = new Promise((resolve) => {
      chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_ALLOWED }, (res) => {
        const err = chrome.runtime?.lastError;
        if (err) {
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
      loaded = true;
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

    // subreddit-only
    isAllowedPath,

    // new policy helpers
    isExplicitFeedPath,
    isAllowedUtilityPath,
    isAllowedRedditPath,

    // exported for transparency/debug
    DEFAULT_ALLOWED_PATH_PREFIXES,
  };

  // Kick off load early (non-blocking). Gate can enforce defaults immediately.
  loadAllowedSubs();
})();
