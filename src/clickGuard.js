(() => {
  const CANONICAL_HOST = 'www.reddit.com';
  const config = window.RedditSanitizer?.config;

  function isRedditHost(hostname) {
    return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  }

  function safeNormalize(pathname) {
    if (config?.normalizePath) return config.normalizePath(pathname);
    return (pathname || '').replace(/\/+$/, '') || '/';
  }

  function isExplicitFeedPath(pathname) {
    const p = safeNormalize(pathname).toLowerCase();
    return (
      p === '/' ||
      p === '/best' ||
      p === '/hot' ||
      p === '/new' ||
      p === '/top' ||
      p === '/r/all' ||
      p === '/r/popular' ||
      p.startsWith('/r/all/') ||
      p.startsWith('/r/popular/')
    );
  }

  function homeUrl() {
    const subs = config?.getAllowedSubsSync?.() || ['freelance'];
    const first = subs[0] || 'freelance';
    return `https://${CANONICAL_HOST}/r/${first}/`;
  }

  function isAllowedUrl(url) {
    // Block explicit algorithmic feed entry points
    if (isRedditHost(url.hostname) && isExplicitFeedPath(url.pathname))
      return false;

    // External allowed by default (flip later if you want)
    if (!isRedditHost(url.hostname)) return true;

    // Force canonical host
    if (url.hostname !== CANONICAL_HOST) return false;

    // Enforce whitelist (fallback to strict freelance if config missing)
    if (config?.isAllowedPath) return config.isAllowedPath(url.pathname);

    const p = safeNormalize(url.pathname);
    return p === '/r/freelance' || p.startsWith('/r/freelance/');
  }

  function styleBlockedLink(a) {
    a.style.pointerEvents = 'none';
    a.style.opacity = '0.35';
    a.style.filter = 'grayscale(1)';
    a.style.cursor = 'not-allowed';
    a.title = 'Blocked by Reddit Sanitizer';
  }

  function installClickCapture() {
    // Capture phase so we beat Reddit handlers
    document.addEventListener(
      'click',
      (e) => {
        if (e.defaultPrevented) return;
        if (e.button !== 0) return; // left click
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const target = e.target;
        if (!(target instanceof Element)) return;

        const a = target.closest('a[href]');
        if (!a) return;

        const href = a.getAttribute('href');
        if (!href) return;

        let url;
        try {
          url = new URL(href, location.origin);
        } catch {
          return;
        }

        if (!isAllowedUrl(url)) {
          e.preventDefault();
          e.stopPropagation();

          styleBlockedLink(a);

          window.RedditSanitizer?.banner?.setRedirectReason?.(
            `Blocked click: ${url.pathname}`
          );

          queueMicrotask(() => window.location.replace(homeUrl()));
        }
      },
      true
    );

    // Middle-click (open in new tab) guard
    document.addEventListener(
      'auxclick',
      (e) => {
        if (e.defaultPrevented) return;
        if (e.button !== 1) return; // middle click

        const target = e.target;
        if (!(target instanceof Element)) return;

        const a = target.closest('a[href]');
        if (!a) return;

        const href = a.getAttribute('href');
        if (!href) return;

        let url;
        try {
          url = new URL(href, location.origin);
        } catch {
          return;
        }

        if (!isAllowedUrl(url)) {
          e.preventDefault();
          e.stopPropagation();
          styleBlockedLink(a);
        }
      },
      true
    );
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.click = { installClickCapture };
})();
