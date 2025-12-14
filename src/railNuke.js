(() => {
  const FLAG_RAIL = 'data-rs-rail-killed';
  const FLAG_TEXTKILL = 'data-rs-text-killed';

  function hideEl(el) {
    if (!el || el.nodeType !== 1) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
  }

  // Main content column (where posts + in-feed inserts live)
  function getMain(root = document) {
    return root.querySelector('main, [role="main"]');
  }

  function isInMainFeed(el) {
    return !!el.closest('main, [role="main"]');
  }

  // Right rail tends to be narrow and on the right side of the viewport
  function looksLikeRightRail(el) {
    const rect = el.getBoundingClientRect?.();
    if (!rect) return false;

    if (rect.width < 200 || rect.height < 60) return false;
    if (rect.width > 650) return false;

    return rect.left > window.innerWidth * 0.55;
  }

  // Protect real posts so we don't delete content by mistake
  function looksLikePost(el) {
    if (!el || el.nodeType !== 1) return false;

    // New Reddit uses web components
    if (el.matches?.('shreddit-post')) return true;
    if (el.querySelector?.('shreddit-post')) return true;

    // Some UIs tag post containers
    const dt = el.getAttribute?.('data-testid');
    if (dt && dt.toLowerCase() === 'post-container') return true;

    // Common signal: comments link inside a post card
    if (el.querySelector?.('a[href*="/comments/"]')) return true;

    return false;
  }

  // ---- Right rail nukes ----
  function killStickyWidgets(root = document) {
    const sticky = root.querySelectorAll(
      '[style*="position:sticky" i], [style*="position: sticky" i]'
    );

    sticky.forEach((el) => {
      if (el.getAttribute(FLAG_RAIL) === '1') return;

      // Only kill sticky things that behave like right-rail widgets
      if (isInMainFeed(el)) return;
      if (!looksLikeRightRail(el)) return;

      el.setAttribute(FLAG_RAIL, '1');
      hideEl(el);
    });
  }

  function killSidebarLikeContainers(root = document) {
    const candidates = root.querySelectorAll(`
      [data-testid*="sidebar" i],
      [id*="sidebar" i],
      [class*="sidebar" i],
      [class*="right" i][class*="rail" i],
      [class*="right" i][class*="sidebar" i],
      [class*="recommend" i],
      [class*="related" i]
    `);

    candidates.forEach((el) => {
      if (el.getAttribute(FLAG_RAIL) === '1') return;
      el.setAttribute(FLAG_RAIL, '1');
      hideEl(el);
    });
  }

  function killRightRailByText(root = document) {
    const KEYWORDS = [
      'recent posts',
      'recently viewed',
      'recent communities',
      'related posts',
      'related communities',
      'recommended',
      'you might like',
      'similar to',
      'trending',
      'popular on reddit',
      'more posts you may like',
    ];

    const blocks = root.querySelectorAll('section, aside, div');

    blocks.forEach((el) => {
      if (el.getAttribute(FLAG_TEXTKILL) === '1') return;
      el.setAttribute(FLAG_TEXTKILL, '1');

      if (isInMainFeed(el)) return;
      if (!looksLikeRightRail(el)) return;

      const text = (el.textContent || '').trim().toLowerCase();
      if (!text) return;

      if (!KEYWORDS.some((k) => text.includes(k))) return;

      const h = el.offsetHeight || 0;
      if (h < 60 || h > 900) return;

      hideEl(el);
    });
  }

  // ---- In-feed recommendation nukes (between posts) ----
  function killInFeedRecommendations(root = document) {
    const KEYWORDS = [
      'because you visited',
      'because you showed interest in',
      'recommended',
      'you might like',
      'similar to',
      'trending',
      'popular on reddit',
      'posts you may like',
      'more posts you may like',
      'communities you may like',
      'suggested',
    ];

    const main = getMain(root);
    if (!main) return;

    // Best-effort scan for inserted widgets in the feed column
    const candidates = main.querySelectorAll('section, article, div');

    candidates.forEach((el) => {
      if (el.getAttribute(FLAG_TEXTKILL) === '1') return;
      el.setAttribute(FLAG_TEXTKILL, '1');

      // Protect actual posts
      if (looksLikePost(el)) return;

      const text = (el.textContent || '').trim().toLowerCase();
      if (!text) return;

      if (!KEYWORDS.some((k) => text.includes(k))) return;

      // Size bounds: rec widgets are medium, not tiny and not the entire feed
      const h = el.offsetHeight || 0;
      if (h < 60 || h > 700) return;

      // Extra safety: if it contains multiple comment links, it's probably real content
      const commentLinks =
        el.querySelectorAll?.('a[href*="/comments/"]').length || 0;
      if (commentLinks >= 2) return;

      hideEl(el);
    });
  }

  function runRightRailNuke() {
    // Right rail
    killSidebarLikeContainers(document);
    killStickyWidgets(document);
    killRightRailByText(document);

    // In-feed inserts
    killInFeedRecommendations(document);
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.rail = { runRightRailNuke };
})();
