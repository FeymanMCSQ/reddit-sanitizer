(() => {
  const CANONICAL_HOST = 'www.reddit.com';
  const config = window.RedditSanitizer?.config;

  function isRedditHost(hostname) {
    return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  }

  function targetUrl() {
    const subs = config?.getAllowedSubsSync?.() || ['freelancers'];
    const first = subs[0] || 'freelancers';
    return `https://${CANONICAL_HOST}/r/${first}/`;
  }

  function hardRedirect(reason = 'Not allowed') {
    window.RedditSanitizer?.banner?.setRedirectReason?.(reason);
    window.location.replace(targetUrl());
  }

  function inAllowedZone() {
    return (
      isRedditHost(window.location.hostname) &&
      window.location.hostname === CANONICAL_HOST &&
      config?.isAllowedPath?.(window.location.pathname)
    );
  }

  function enforce() {
    const host = window.location.hostname;
    if (!isRedditHost(host)) return false;

    // If config isn't loaded for some reason, stay strict-ish using default target
    if (!config?.isAllowedPath) {
      if (host !== CANONICAL_HOST) {
        hardRedirect(`Forced canonical host (${host} → ${CANONICAL_HOST})`);
        return false;
      }
      return true;
    }

    if (host !== CANONICAL_HOST) {
      hardRedirect(`Forced canonical host (${host} → ${CANONICAL_HOST})`);
      return false;
    }

    if (!config.isAllowedPath(window.location.pathname)) {
      hardRedirect(`Blocked path: ${window.location.pathname}`);
      return false;
    }

    return true;
  }

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

    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        onNavigate?.();
      }
    }, 500);
  }

  // Enforce immediately with defaults, then re-enforce once storage loads
  enforce();
  config?.loadAllowedSubs?.().then(() => enforce());

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.gate = {
    enforce,
    inAllowedZone,
    installSpaGuards,
  };
})();
