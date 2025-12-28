// src/clickGuard.js
(() => {
  const CANONICAL_HOST = 'www.reddit.com';

  function getConfig() {
    return window.RedditSanitizer?.config;
  }

  function isRedditHost(hostname) {
    return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  }

  function normalizePath(pathname) {
    const config = getConfig();
    if (config?.normalizePath) return config.normalizePath(pathname);
    return (pathname || '').replace(/\/+$/, '') || '/';
  }

  function isExplicitFeedPath(pathname) {
    const config = getConfig();
    if (config?.isExplicitFeedPath) return config.isExplicitFeedPath(pathname);

    // fallback (strict)
    const p = normalizePath(pathname).toLowerCase();
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
    const config = getConfig();
    const subs = config?.getAllowedSubsSync?.() || ['freelance'];
    const first = subs[0] || 'freelance';
    return `https://${CANONICAL_HOST}/r/${first}/`;
  }

  function isAllowedUrl(url) {
    // External links allowed by default
    if (!isRedditHost(url.hostname)) return true;

    // Block explicit algorithmic feeds (always)
    if (isExplicitFeedPath(url.pathname)) return false;

    // Force canonical host
    if (url.hostname !== CANONICAL_HOST) return false;

    const config = getConfig();

    // Preferred unified policy
    if (config?.isAllowedRedditPath) {
      return config.isAllowedRedditPath(url.pathname);
    }

    // Fallback: strict to default subreddit only
    const p = normalizePath(url.pathname).toLowerCase();
    const base = '/r/freelance';
    return p === base || p.startsWith(base + '/');
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
        if (e.button !== 0) return; // left click only
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
            `Blocked click: ${normalizePath(url.pathname)}`
          );

          queueMicrotask(() => window.location.replace(homeUrl()));
        }
      },
      true
    );

    // Middle-click guard (open in new tab)
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
