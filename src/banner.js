(() => {
  const ALLOWED_SUB = 'freelancers';
  const BANNER_ID = 'rs-restricted-banner';
  const STORAGE_KEY = 'rs_last_redirect_reason';

  function ensureBanner() {
    let el = document.getElementById(BANNER_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = BANNER_ID;
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.zIndex = '2147483647';
    el.style.background = '#111';
    el.style.color = '#fff';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.2';
    el.style.padding = '6px 10px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'space-between';
    el.style.gap = '10px';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';

    const left = document.createElement('div');
    left.style.whiteSpace = 'nowrap';
    left.textContent = `Restricted to r/${ALLOWED_SUB}`;

    const right = document.createElement('div');
    right.id = `${BANNER_ID}-reason`;
    right.style.opacity = '0.85';
    right.style.overflow = 'hidden';
    right.style.textOverflow = 'ellipsis';
    right.style.whiteSpace = 'nowrap';
    right.textContent = '';

    el.appendChild(left);
    el.appendChild(right);

    document.documentElement.appendChild(el);

    // Prevent content from being hidden under the banner
    document.documentElement.style.scrollPaddingTop = '32px';
    document.body && (document.body.style.paddingTop = '32px');

    return el;
  }

  function setReasonText(text) {
    const banner = ensureBanner();
    const reasonEl = banner.querySelector(`#${BANNER_ID}-reason`);
    if (!reasonEl) return;

    reasonEl.textContent = text || '';
    if (text) {
      // Fade out reason after a few seconds so it doesn't become noise
      setTimeout(() => {
        reasonEl.textContent = '';
      }, 5000);
    }
  }

  function consumeRedirectReason() {
    try {
      const reason = sessionStorage.getItem(STORAGE_KEY);
      if (reason) {
        sessionStorage.removeItem(STORAGE_KEY);
        setReasonText(`Redirected: ${reason}`);
      }
    } catch {
      // ignore storage failures
    }
  }

  // API: gate/clickguard can set redirect reason before location.replace
  function setRedirectReason(reason) {
    try {
      sessionStorage.setItem(STORAGE_KEY, reason);
    } catch {
      // ignore
    }
  }

  function showRestrictedBanner() {
    ensureBanner();
    consumeRedirectReason();
  }

  window.RedditSanitizer = window.RedditSanitizer || {};
  window.RedditSanitizer.banner = {
    showRestrictedBanner,
    setRedirectReason,
  };
})();
