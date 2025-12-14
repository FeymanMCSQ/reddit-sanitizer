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
    console.log(
      '[RS:Content] flushWork() called, pendingNodes:',
      pendingNodes.size
    );

    const inZone = gate.inAllowedZone();
    console.log('[RS:Content] inAllowedZone() =', inZone);

    if (!inZone) {
      console.log('[RS:Content] Not in allowed zone, clearing work');
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
    console.log('[RS:Content] ========== onNavigate() called ==========');
    console.log('[RS:Content] Current URL:', window.location.href);
    const allowed = gate.enforce();
    console.log('[RS:Content] Gate enforce() returned:', allowed);

    if (!allowed) {
      console.log('[RS:Content] ✗ Navigation blocked, stopping');
      return;
    }

    console.log('[RS:Content] ✓ Navigation allowed, proceeding...');
    console.log('[RS:Content] Injecting CSS...');
    ui.injectKillCSS();
    console.log('[RS:Content] Showing banner...');
    banner?.showRestrictedBanner();

    console.log('[RS:Content] Running rail nuke...');
    rail.runRightRailNuke();
    console.log('[RS:Content] Scanning and locking links...');
    links.scanAndLockLinks(document);
    console.log('[RS:Content] onNavigate() complete');
  }

  console.log('[RS:Content] ========== Content script starting ==========');
  console.log('[RS:Content] Current URL:', window.location.href);
  console.log('[RS:Content] Gate available:', !!gate);
  console.log('[RS:Content] UI available:', !!ui);
  console.log('[RS:Content] Rail available:', !!rail);
  console.log('[RS:Content] Links available:', !!links);
  console.log('[RS:Content] Click available:', !!click);
  console.log('[RS:Content] Banner available:', !!banner);

  onNavigate();
  console.log('[RS:Content] Installing SPA guards...');
  gate.installSpaGuards(onNavigate);

  const mo = new MutationObserver((mutations) => {
    const inZone = gate.inAllowedZone();
    if (!inZone) {
      console.log(
        '[RS:Content] MutationObserver: not in allowed zone, skipping'
      );
      return;
    }

    console.log(
      '[RS:Content] MutationObserver: DOM changed, mutations:',
      mutations.length
    );
    // Mark rail work dirty (but don't run it immediately)
    railDirty = true;

    // Collect added element roots; don't rescan the whole document
    let addedCount = 0;
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n && n.nodeType === 1) {
          pendingNodes.add(n);
          addedCount++;
        }
      }
    }
    console.log(
      '[RS:Content] MutationObserver: added',
      addedCount,
      'nodes, total pending:',
      pendingNodes.size
    );

    scheduleFlush();
  });

  console.log('[RS:Content] Setting up MutationObserver...');
  mo.observe(document.documentElement, { childList: true, subtree: true });
  console.log('[RS:Content] MutationObserver installed');

  console.log(
    '[RS:Content] ========== Content script fully initialized =========='
  );
  console.log('[Reddit Sanitizer] armed + banner + debounced observer');
})();
