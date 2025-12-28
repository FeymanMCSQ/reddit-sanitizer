// src/linkLock.js
(() => {
  const CANONICAL_HOST = 'www.reddit.com';
  const FLAG_LINK = 'data-rs-link-locked';

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

    // fallback
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

  function shouldBlockUrl(url) {
    // only police reddit navigation
    if (!isRedditHost(url.hostname)) return false;

    // block explicit feeds always
    if (isExplicitFeedPath(url.pathname)) return true;

    // force canonical host
    if (url.hostname !== CANONICAL_HOST) return true;

    const config = getConfig();

    // preferred unified policy
    if (config?.isAllowedRedditPath) {
      return !config.isAllowedRedditPath(url.pathname);
    }

    // fallback: strict to default subreddit only
    const p = normalizePath(url.pathname).toLowerCase();
    const base = '/r/freelance';
    return !(p === base || p.startsWith(base + '/'));
  }

  function styleBlockedLink(a) {
    a.style.pointerEvents = 'none';
    a.style.opacity = '0.35';
    a.style.filter = 'grayscale(1)';
    a.style.cursor = 'not-allowed';
    a.title = 'Blocked by Reddit Sanitizer';
  }

  function lockLink(a) {
    if (!a || a.nodeType !== 1) return;
    if (a.getAttribute(FLAG_LINK) === '1') return;

    const href = a.getAttribute('href');
    if (!href) return;

    let url;
    try {
      url = new URL(href, location.origin);
    } catch {
      // If URL parsing fails, don’t touch it
      a.setAttribute(FLAG_LINK, '1');
      return;
    }

    // External links are allowed; mark as scanned and skip
    if (!isRedditHost(url.hostname)) {
      a.setAttribute(FLAG_LINK, '1');
      return;
    }

    // If it’s allowed, mark and keep it intact
    if (!shouldBlockUrl(url)) {
      a.setAttribute(FLAG_LINK, '1');
      return;
    }

    // Block it
    a.removeAttribute('href'); // kills click + middle-click + open-in-new-tab
    a.setAttribute(FLAG_LINK, '1');
    styleBlockedLink(a);
  }

  function scanAndLockLinks(root = document) {
    root.querySelectorAll('a[href]').forEach(lockLink);
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.links = { scanAndLockLinks };
})();
