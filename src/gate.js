(() => {
  const CANONICAL_HOST = 'www.reddit.com';
  const config = window.RedditSanitizer?.config;

  console.log('[RS:Gate] Initializing gate module');
  console.log('[RS:Gate] Current location:', window.location.href);
  console.log('[RS:Gate] Config available:', !!config);
  console.log('[RS:Gate] Config object:', config);

  function isRedditHost(hostname) {
    const result =
      hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
    console.log('[RS:Gate] isRedditHost(' + hostname + ') =', result);
    return result;
  }

  function targetUrl() {
    const subs = config?.getAllowedSubsSync?.() || ['freelance'];
    const first = subs[0] || 'freelance';
    const url = `https://${CANONICAL_HOST}/r/${first}/`;
    console.log('[RS:Gate] targetUrl() =', url, 'from subs:', subs);
    return url;
  }

  function hardRedirect(reason = 'Not allowed') {
    const target = targetUrl();
    console.error('[RS:Gate] ⚠️ HARD REDIRECT triggered!');
    console.error('[RS:Gate] Reason:', reason);
    console.error('[RS:Gate] Current URL:', window.location.href);
    console.error('[RS:Gate] Redirecting to:', target);
    window.RedditSanitizer?.banner?.setRedirectReason?.(reason);
    window.location.replace(target);
  }

  function inAllowedZone() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const isReddit = isRedditHost(hostname);
    const isCanonical = hostname === CANONICAL_HOST;
    const isAllowed = config?.isAllowedPath?.(pathname);

    console.log('[RS:Gate] inAllowedZone() check:');
    console.log('[RS:Gate]   hostname:', hostname);
    console.log('[RS:Gate]   pathname:', pathname);
    console.log('[RS:Gate]   isRedditHost:', isReddit);
    console.log('[RS:Gate]   isCanonical:', isCanonical);
    console.log('[RS:Gate]   isAllowedPath:', isAllowed);
    console.log('[RS:Gate]   config exists:', !!config);
    console.log(
      '[RS:Gate]   config.isAllowedPath exists:',
      !!config?.isAllowedPath
    );

    const result = isReddit && isCanonical && isAllowed;
    console.log('[RS:Gate] inAllowedZone() =', result);
    return result;
  }

  function enforce() {
    console.log('[RS:Gate] ========== enforce() called ==========');
    const host = window.location.hostname;
    const pathname = window.location.pathname;
    console.log('[RS:Gate] Current URL:', window.location.href);
    console.log('[RS:Gate] Host:', host);
    console.log('[RS:Gate] Pathname:', pathname);

    if (!isRedditHost(host)) {
      console.log('[RS:Gate] Not a Reddit host, returning false');
      return false;
    }

    // If config isn't loaded for some reason, stay strict-ish using default target
    console.log('[RS:Gate] Checking config availability...');
    console.log('[RS:Gate] config exists:', !!config);
    console.log(
      '[RS:Gate] config.isAllowedPath exists:',
      !!config?.isAllowedPath
    );

    if (!config?.isAllowedPath) {
      console.log('[RS:Gate] Config not available, using fallback logic');
      if (host !== CANONICAL_HOST) {
        hardRedirect(`Forced canonical host (${host} → ${CANONICAL_HOST})`);
        return false;
      }
      console.log('[RS:Gate] Fallback: allowing (canonical host check passed)');
      return true;
    }

    if (host !== CANONICAL_HOST) {
      console.log('[RS:Gate] Non-canonical host, redirecting');
      hardRedirect(`Forced canonical host (${host} → ${CANONICAL_HOST})`);
      return false;
    }

    console.log('[RS:Gate] Calling config.isAllowedPath(' + pathname + ')...');
    const pathAllowed = config.isAllowedPath(pathname);
    console.log('[RS:Gate] Path allowed result:', pathAllowed);

    if (!pathAllowed) {
      console.log('[RS:Gate] Path NOT allowed, redirecting');
      hardRedirect(`Blocked path: ${pathname}`);
      return false;
    }

    console.log('[RS:Gate] ✓ enforce() passed, page allowed');
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
  console.log('[RS:Gate] Calling enforce() immediately...');
  const firstResult = enforce();
  console.log('[RS:Gate] First enforce() result:', firstResult);

  if (config?.loadAllowedSubs) {
    console.log('[RS:Gate] Loading allowed subs from storage...');
    config.loadAllowedSubs().then((subs) => {
      console.log('[RS:Gate] Storage loaded, got subs:', subs);
      console.log('[RS:Gate] Re-enforcing after storage load...');
      const secondResult = enforce();
      console.log('[RS:Gate] Second enforce() result:', secondResult);
    });
  } else {
    console.log('[RS:Gate] No loadAllowedSubs function available');
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.gate = {
    enforce,
    inAllowedZone,
    installSpaGuards,
  };
})();
