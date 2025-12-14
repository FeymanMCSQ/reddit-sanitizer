(() => {
  const CANONICAL_HOST = 'www.reddit.com';
  const FLAG_LINK = 'data-rs-link-locked';

  const config = window.RedditSanitizer?.config;

  function isRedditHost(hostname) {
    return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  }

  function isExplicitFeedPath(pathname) {
    const norm = config?.normalizePath
      ? config.normalizePath(pathname)
      : pathname || '';
    const p = (norm || '').replace(/\/+$/, '') || '/';
    const lower = p.toLowerCase();

    return (
      lower === '/' ||
      lower === '/best' ||
      lower === '/hot' ||
      lower === '/new' ||
      lower === '/top' ||
      lower === '/r/all' ||
      lower === '/r/popular' ||
      lower.startsWith('/r/all/') ||
      lower.startsWith('/r/popular/')
    );
  }

  function shouldBlockUrl(url) {
    // only police reddit navigation
    if (!isRedditHost(url.hostname)) return false;

    // block explicit feed endpoints no matter what
    if (isExplicitFeedPath(url.pathname)) return true;

    // force everything to stay within canonical host
    if (url.hostname !== CANONICAL_HOST) return true;

    // enforce whitelist via config (default strict)
    if (config?.isAllowedPath) {
      if (!config.isAllowedPath(url.pathname)) return true;
    } else {
      // if config missing, stay strict to freelancers
      const p = (url.pathname || '').replace(/\/+$/, '') || '/';
      if (!(p === '/r/freelancers' || p.startsWith('/r/freelancers/')))
        return true;
    }

    return false;
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
      return;
    }

    const isSubredditLink = url.pathname.startsWith('/r/');
    const isFeedEntry =
      isRedditHost(url.hostname) && isExplicitFeedPath(url.pathname);

    // If it's neither subreddit wander nor feed entry nor disallowed, mark and skip
    if (!isSubredditLink && !isFeedEntry && !shouldBlockUrl(url)) {
      a.setAttribute(FLAG_LINK, '1');
      return;
    }

    if (shouldBlockUrl(url)) {
      a.removeAttribute('href'); // kills left-click/middle-click/open-in-new-tab
      a.setAttribute(FLAG_LINK, '1');
      styleBlockedLink(a);
    } else {
      a.setAttribute(FLAG_LINK, '1');
    }
  }

  function scanAndLockLinks(root = document) {
    root.querySelectorAll('a[href]').forEach(lockLink);
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.links = { scanAndLockLinks };
})();
