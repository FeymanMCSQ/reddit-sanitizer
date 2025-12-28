// src/config.js
(() => {
  const STORAGE_KEY = 'allowedSubs';

  // Default strict: only this subreddit until options override it
  const DEFAULT_ALLOWED = ['freelance'];

  // TEMP allow (popup-driven), stored locally (not sync)
  const TEMP_KEY = 'tempAllowedSubs'; // [{ sub, expiresAt }]
  const TEMP_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

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
  let tempAllowed = []; // [{ sub, expiresAt }]

  let loaded = false;
  let loadingPromise = null;
  let tempLoaded = false;
  let tempLoadingPromise = null;

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

  function cleanupTempAllowed() {
    const now = Date.now();
    const before = tempAllowed.length;
    tempAllowed = tempAllowed.filter((x) => x.expiresAt > now);

    if (
      before !== tempAllowed.length &&
      globalThis.chrome?.storage?.local?.set
    ) {
      chrome.storage.local.set({ [TEMP_KEY]: tempAllowed });
    }
  }

  function getAllowedSubsSync() {
    return allowedSubs;
  }

  function getTempAllowedSubsSync() {
    cleanupTempAllowed();
    return tempAllowed.map((x) => x.sub);
  }

  function getCombinedAllowedSubsSync() {
    cleanupTempAllowed();
    return Array.from(
      new Set([...allowedSubs, ...tempAllowed.map((x) => x.sub)])
    );
  }

  // Subreddit allow: /r/<sub> or /r/<sub>/...
  // NOTE: This now includes TEMP subs too.
  function isAllowedPath(pathname) {
    const p = normalizePath(pathname).toLowerCase();
    if (!p.startsWith('/r/')) return false;

    const subs = getCombinedAllowedSubsSync();
    for (const sub of subs) {
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
   * - Allows whitelisted subreddits (permanent + temporary)
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

  function loadTempAllowedSubs() {
    if (tempLoaded) return Promise.resolve(tempAllowed);
    if (tempLoadingPromise) return tempLoadingPromise;

    if (!globalThis.chrome?.storage?.local?.get) {
      tempLoaded = true;
      cleanupTempAllowed();
      return Promise.resolve(tempAllowed);
    }

    tempLoadingPromise = new Promise((resolve) => {
      chrome.storage.local.get({ [TEMP_KEY]: [] }, (res) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          log('local storage.get error:', err.message);
          tempAllowed = [];
          tempLoaded = true;
          resolve(tempAllowed);
          return;
        }

        tempAllowed = sanitizeTemp(res?.[TEMP_KEY]);
        tempLoaded = true;
        cleanupTempAllowed();
        resolve(tempAllowed);
      });
    });

    return tempLoadingPromise;
  }

  // Keep in sync when storage changes
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes?.[STORAGE_KEY]) {
        allowedSubs = sanitizeSubs(changes[STORAGE_KEY].newValue);
        loaded = true;
        log('onChanged allowedSubs:', allowedSubs);
      }

      if (area === 'local' && changes?.[TEMP_KEY]) {
        tempAllowed = sanitizeTemp(changes[TEMP_KEY].newValue);
        tempLoaded = true;
        cleanupTempAllowed();
        log(
          'onChanged tempAllowed:',
          tempAllowed.map((x) => x.sub)
        );
      }
    });
  }

  globalThis.RedditSanitizer = globalThis.RedditSanitizer || {};
  globalThis.RedditSanitizer.config = {
    STORAGE_KEY,
    DEFAULT_ALLOWED,

    TEMP_KEY,
    TEMP_TTL_MS,

    normalizePath,

    loadAllowedSubs,
    loadTempAllowedSubs,

    getAllowedSubsSync,
    getTempAllowedSubsSync,
    getCombinedAllowedSubsSync,

    // subreddit-only (includes temp)
    isAllowedPath,

    // policy helpers
    isExplicitFeedPath,
    isAllowedUtilityPath,
    isAllowedRedditPath,

    // exported for transparency/debug
    DEFAULT_ALLOWED_PATH_PREFIXES,
  };

  // Kick off loads early (non-blocking).
  loadAllowedSubs();
  loadTempAllowedSubs();
})();
