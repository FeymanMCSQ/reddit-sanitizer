(() => {
  const STYLE_ID = 'reddit-sanitizer-killcss';

  // Keep CSS conservative. Anything “heuristic” belongs in railNuke.js where
  // we can check geometry + text and avoid nuking the actual feed.
  function injectKillCSS() {
    // Minimal logging (leave on during debug; you can remove later)
    console.log('[RS:UI] injectKillCSS() called');

    if (document.getElementById(STYLE_ID)) {
      console.log('[RS:UI] CSS already injected, skipping');
      return;
    }

    const css = `
      /* ---- Reddit Sanitizer: Safe UI Kill Layer ---- */

      /* Hide rails via ARIA roles (least likely to collide with main feed) */
      [role="navigation"],
      [role="complementary"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Many Reddit desktop side rails still use <aside>. */
      aside {
        display: none !important;
        visibility: hidden !important;
      }

      /* Optional: hide top nav only if it really is navigation */
      nav[role="navigation"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Explicitly hide common algorithmic feed entry anchors (UI entry points) */
      a[href="/"],
      a[href="/best"], a[href="/best/"],
      a[href="/hot"], a[href="/hot/"],
      a[href="/new"], a[href="/new/"],
      a[href="/top"], a[href="/top/"],
      a[href="/r/all"], a[href="/r/all/"],
      a[href="/r/popular"], a[href="/r/popular/"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Center the content after removing rails */
      main, [role="main"] {
        max-width: 900px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      body { overflow-x: hidden !important; }

      /* Banner friendliness (prevents anchor jumps hiding under fixed banner) */
      html { scroll-padding-top: 32px !important; }
    `.trim();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.documentElement.appendChild(style);

    console.log('[RS:UI] Safe CSS injected:', STYLE_ID);
  }

  console.log('[RS:UI] UI module initialized');
  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.ui = { injectKillCSS };
})();
