(() => {
  const FLAG_RAIL = 'data-rs-rail-killed';
  const FLAG_TEXTKILL = 'data-rs-text-killed';

  const DEBUG = false;
  const log = (...args) => DEBUG && console.log('[RS:Rail]', ...args);

  function hideEl(el, why = '') {
    if (!el || el.nodeType !== 1) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    if (why) el.setAttribute('data-rs-hide-why', why);
  }

  function isInMainFeed(el) {
    // If it’s inside main, we treat it as “potential real content”
    return !!el.closest('main, [role="main"]');
  }

  function looksLikeRightRail(el) {
    const rect = el.getBoundingClientRect?.();
    if (!rect) return false;

    // ignore invisible/tiny
    if (rect.width < 220 || rect.height < 80) return false;

    // ignore very wide containers (likely main feed shells)
    if (rect.width > 650) return false;

    // must be on right half-ish of screen
    return rect.left > window.innerWidth * 0.55;
  }

  function killExplicitRails(root = document) {
    // Prefer structural, semantically-right-rail stuff
    root.querySelectorAll('[role="complementary"], aside').forEach((el) => {
      if (el.getAttribute(FLAG_RAIL) === '1') return;
      // never touch within main
      if (isInMainFeed(el)) return;
      el.setAttribute(FLAG_RAIL, '1');
      hideEl(el, 'explicit-rail');
    });
  }

  function killStickyRightRail(root = document) {
    // Sticky is common for the right rail, but sticky can also appear in-feed.
    root
      .querySelectorAll(
        '[style*="position:sticky" i], [style*="position: sticky" i]'
      )
      .forEach((el) => {
        if (el.getAttribute(FLAG_RAIL) === '1') return;
        if (isInMainFeed(el)) return;
        if (!looksLikeRightRail(el)) return;
        el.setAttribute(FLAG_RAIL, '1');
        hideEl(el, 'sticky-right-rail');
      });
  }

  function killSidebarLikeByShape(root = document) {
    // Keep this list *tight*. No "recommend"/"related" here because those
    // can appear in main feed wrappers.
    const candidates = root.querySelectorAll(`
      [data-testid*="sidebar" i],
      [id*="sidebar" i],
      [class*="sidebar" i],
      [class*="right" i][class*="rail" i]
    `);

    candidates.forEach((el) => {
      if (el.getAttribute(FLAG_RAIL) === '1') return;
      if (isInMainFeed(el)) return;
      if (!looksLikeRightRail(el)) return;
      el.setAttribute(FLAG_RAIL, '1');
      hideEl(el, 'sidebar-like-shape');
    });
  }

  function killByRailWidgetText(root = document) {
    // Text-based kill, but only for right-rail-shaped blocks outside main.
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
      'because you visited',
    ];

    root.querySelectorAll('section, div, aside').forEach((el) => {
      if (el.getAttribute(FLAG_TEXTKILL) === '1') return;
      el.setAttribute(FLAG_TEXTKILL, '1');

      if (isInMainFeed(el)) return;
      if (!looksLikeRightRail(el)) return;

      const text = (el.textContent || '').trim().toLowerCase();
      if (!text) return;

      if (KEYWORDS.some((k) => text.includes(k))) {
        hideEl(el, 'rail-text');
      }
    });
  }

  function runRightRailNuke(root = document) {
    log('runRightRailNuke');
    killExplicitRails(root);
    killSidebarLikeByShape(root);
    killStickyRightRail(root);
    killByRailWidgetText(root);
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.rail = { runRightRailNuke };
})();
