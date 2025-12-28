// /src/gate.js

(() => {
  const CANONICAL_HOST = 'www.reddit.com';

  function getConfig() {
    return window.RedditSanitizer?.config;
  }

  // Keep logs easy to kill later
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[RS:Gate]', ...args);
  const warn = (...args) => DEBUG && console.warn('[RS:Gate]', ...args);

  log('Initializing gate module');
  log('Current location:', window.location.href);
  log('Config available:', !!getConfig());

  function isRedditHost(hostname) {
    return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  }

  function targetUrl() {
    const config = getConfig();
    const subs = config?.getAllowedSubsSync?.() || ['freelance'];
    const first = subs[0] || 'freelance';
    return `https://${CANONICAL_HOST}/r/${first}/`;
  }

  function hardRedirect(reason = 'Not allowed') {
    const target = targetUrl();
    warn('⚠️ HARD REDIRECT', { reason, from: location.href, to: target });

    window.RedditSanitizer?.banner?.setRedirectReason?.(reason);
    window.location.replace(target);
  }

  function inAllowedZone() {
    const config = getConfig();
    const host = window.location.hostname;
    const path = window.location.pathname;

    const ok =
      isRedditHost(host) &&
      host === CANONICAL_HOST &&
      (config?.isAllowedRedditPath
        ? config.isAllowedRedditPath(path)
        : fallbackAllowed(path)); // strict fallback

    return ok;
  }

  function fallbackAllowed(pathname) {
    // Strict-ish fallback if config isn't ready:
    // allow only /r/<defaultSub>/... and basic utility routes.
    // (matches config defaults so we don’t brick on startup)
    const p = (pathname || '').replace(/\/+$/, '').toLowerCase() || '/';

    // hard-block feeds
    if (
      p === '/' ||
      p === '/best' ||
      p === '/hot' ||
      p === '/new' ||
      p === '/top' ||
      p === '/r/all' ||
      p.startsWith('/r/all/') ||
      p === '/r/popular' ||
      p.startsWith('/r/popular/')
    ) {
      return false;
    }

    // allow utility paths
    if (
      p === '/user' ||
      p.startsWith('/user/') ||
      p === '/message' ||
      p.startsWith('/message/') ||
      p === '/account' ||
      p.startsWith('/account/') ||
      p === '/login' ||
      p.startsWith('/login/') ||
      p === '/register' ||
      p.startsWith('/register/') ||
      p === '/password' ||
      p.startsWith('/password/')
    ) {
      return true;
    }

    // allow default subreddit only
    const def = 'freelance';
    const base = `/r/${def}`;
    return p === base || p.startsWith(base + '/');
  }

  function enforce() {
    const config = getConfig();
    const host = window.location.hostname;
    const pathname = window.location.pathname;

    log('enforce()', { host, pathname });

    if (!isRedditHost(host)) return false;

    // Force canonical host (kills old/new/m doors)
    if (host !== CANONICAL_HOST) {
      hardRedirect(`Forced canonical host (${host} → ${CANONICAL_HOST})`);
      return false;
    }

    // Prefer the new unified policy
    const allowed = config?.isAllowedRedditPath
      ? config.isAllowedRedditPath(pathname)
      : fallbackAllowed(pathname);

    if (!allowed) {
      hardRedirect(`Blocked path: ${pathname}`);
      return false;
    }

    return true;
  }

  // SPA guards
  function installSpaGuards(onNavigate) {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;

    function wrapHistoryMethod(original) {
      return function (...args) {
        const ret = original.apply(this, args);
        queueMicrotask(() => onNavigate?.());
        return ret;
      };
    }

    history.pushState = wrapHistoryMethod(_pushState);
    history.replaceState = wrapHistoryMethod(_replaceState);

    window.addEventListener('popstate', () => onNavigate?.());

    // URL watchdog
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        onNavigate?.();
      }
    }, 500);
  }

  // Enforce immediately, then re-enforce once storage loads
  const first = enforce();
  log('First enforce result:', first);

  const config = getConfig();
  if (config?.loadAllowedSubs) {
    config.loadAllowedSubs().then(() => {
      log('Storage loaded; re-enforcing');
      enforce();
    });
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.gate = {
    enforce,
    inAllowedZone,
    installSpaGuards,
    targetUrl, // handy for other modules
  };
})();
