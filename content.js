(() => {
  console.log('[Reddit Sanitizer] content script loaded');

  // Temporary visual proof
  const banner = document.createElement('div');
  banner.textContent = 'Reddit Sanitizer ACTIVE';
  banner.style.position = 'fixed';
  banner.style.bottom = '10px';
  banner.style.right = '10px';
  banner.style.zIndex = '999999';
  banner.style.background = 'black';
  banner.style.color = 'white';
  banner.style.padding = '6px 10px';
  banner.style.fontSize = '12px';
  banner.style.borderRadius = '4px';

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(banner);
  });
})();
