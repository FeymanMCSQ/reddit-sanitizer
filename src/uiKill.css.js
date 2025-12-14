(() => {
  const STYLE_ID = 'reddit-sanitizer-killcss';

  function injectKillCSS() {
    if (document.getElementById(STYLE_ID)) return;

    const css = `
      /* ---- Reddit Sanitizer: Base UI Kill Switch ---- */

      /* Broad sidebars / rails */
      nav, aside {
        display: none !important;
        visibility: hidden !important;
      }

      [role="navigation"], [role="complementary"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Extra rail-ish containers Reddit sometimes uses */
      [data-testid*="sidebar" i],
      [id*="sidebar" i],
      [class*="sidebar" i],
      [class*="right" i][class*="rail" i],
      [class*="right" i][class*="sidebar" i],
      [class*="recommend" i],
      [class*="related" i],
      [aria-label*="recent" i],
      [aria-label*="related" i],
      [aria-label*="recommended" i] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Explicitly hide common algorithmic feed entry links */
      a[href="/"],
      a[href="/best/"], a[href="/best"],
      a[href="/hot/"], a[href="/hot"],
      a[href="/new/"], a[href="/new"],
      a[href="/top/"], a[href="/top"],
      a[href="/r/all"], a[href="/r/all/"],
      a[href="/r/popular"], a[href="/r/popular/"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Collapse spacing so center content recenters */
      main, [role="main"] {
        max-width: 900px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      body {
        overflow-x: hidden !important;
      }
    `.trim();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.ui = { injectKillCSS };
})();
