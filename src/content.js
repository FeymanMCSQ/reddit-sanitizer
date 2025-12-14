(() => {
  const gate = window.RedditSanitizer?.gate;
  const ui = window.RedditSanitizer?.ui;
  const rail = window.RedditSanitizer?.rail;
  const links = window.RedditSanitizer?.links;
  const click = window.RedditSanitizer?.click;
  const banner = window.RedditSanitizer?.banner;

  // Install once (capture-phase guard)
  click.installClickCapture();

  // ---- Debounce / batching ----
  const MAX_BATCH_NODES = 60; // cap per flush so we don't spiral
  const FLUSH_DELAY_MS = 120; // small delay smooths scroll
  let flushTimer = null;
  let railDirty = false;
  let pendingNodes = new Set();

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushWork, FLUSH_DELAY_MS);
  }

  function flushWork() {
    flushTimer = null;

    if (!gate.inAllowedZone()) {
      pendingNodes.clear();
      railDirty = false;
      return;
    }

    // Run the heavy rail nuke at most once per flush window
    if (railDirty) {
      rail.runRightRailNuke();
      railDirty = false;
    }

    // Process a limited number of newly-added nodes per flush
    let i = 0;
    for (const node of pendingNodes) {
      pendingNodes.delete(node);

      if (node && node.nodeType === 1) {
        links.scanAndLockLinks(node);
        i++;
      }

      if (i >= MAX_BATCH_NODES) {
        // More work remains; schedule another slice
        scheduleFlush();
        break;
      }
    }
  }

  function onNavigate() {
    const allowed = gate.enforce();
    if (!allowed) return;

    ui.injectKillCSS();
    banner?.showRestrictedBanner();

    // Do a single full pass on navigation (rare)
    rail.runRightRailNuke();
    links.scanAndLockLinks(document);
  }

  onNavigate();
  gate.installSpaGuards(onNavigate);

  const mo = new MutationObserver((mutations) => {
    if (!gate.inAllowedZone()) return;

    // Mark rail work dirty (but don't run it immediately)
    railDirty = true;

    // Collect added element roots; don't rescan the whole document
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n && n.nodeType === 1) pendingNodes.add(n);
      }
    }

    scheduleFlush();
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  console.log('[Reddit Sanitizer] armed + banner + debounced observer');
})();
