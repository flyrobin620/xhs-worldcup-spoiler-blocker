/**
 * XHS World Cup Spoiler Blocker
 * --------------------------------
 * Hides match scores and result spoilers on Xiaohongshu's 2026 World Cup pages.
 *
 * Two pages are handled:
 *   1. World Cup home  (/worldcup26...) – keep the schedule header and every
 *      match card, hide the surrounding news feeds, and mask revealed scores.
 *   2. Replay note     (/explore/...)   – when the author is the official replay
 *      channel "世界杯高清回放", hide the title, note content and comments.
 *
 * The feature can be toggled on/off from the toolbar popup; the choice is
 * stored in chrome.storage and applied live without reloading the page.
 *
 * Xiaohongshu is a single-page app whose content is rendered/updated by Vue
 * after navigation, so every change runs through an idempotent `update()` that
 * is re-triggered by a MutationObserver (plus a light interval fallback).
 */
(function () {
  'use strict';

  const HIDDEN_CLASS = 'xhs-spoiler-hidden';
  const REPLAY_USERNAME = '世界杯高清回放';
  const MASKED_SCORE = '? : ?';
  const ORIGINAL_ATTR = 'data-xhs-original-score';
  // Class added to <html> to mask video covers via CSS (see styles.css).
  // Applying it at document_start prevents the original poster from painting
  // even for a single frame, so the cover never flashes a spoiler.
  const POSTER_GUARD_CLASS = 'xhs-guard-posters';

  // Whether spoiler-hiding is active. Controlled by the popup toggle and
  // persisted in chrome.storage. Defaults to on so spoilers are hidden fast.
  let enabled = true;
  // Real tab title captured before we overwrite it, so it can be restored.
  let savedTitle = null;

  function hide(el) {
    if (el && !el.classList.contains(HIDDEN_CLASS)) {
      el.classList.add(HIDDEN_CLASS);
    }
  }

  function show(el) {
    if (el && el.classList.contains(HIDDEN_CLASS)) {
      el.classList.remove(HIDDEN_CLASS);
    }
  }

  /** Undo every change this script made (used when the feature is disabled). */
  function revertAll() {
    document.querySelectorAll('.' + HIDDEN_CLASS).forEach(show);
    document.querySelectorAll('[' + ORIGINAL_ATTR + ']').forEach((span) => {
      span.textContent = span.getAttribute(ORIGINAL_ATTR);
      span.removeAttribute(ORIGINAL_ATTR);
    });
    setPosterGuard(false);
    if (savedTitle !== null) {
      document.title = savedTitle;
      savedTitle = null;
    }
  }

  /**
   * World Cup home page: keep the schedule header, every match card, and the
   * match-strip nav / "all matches" buttons visible (they are siblings of each
   * other), and hide the surrounding news-feed blocks that often reveal
   * results. Scores in the cards are then masked.
   */
  function processHomePage() {
    const home = document.querySelector('.xhs-world-cup-home');
    if (!home) return;

    // Elements that must stay visible together with their whole subtree.
    const keepEls = [];
    const scheduleHeader = home.querySelector(
      '.xhs-world-cup-home-section-header-schedule'
    );
    if (scheduleHeader) keepEls.push(scheduleHeader);
    // Match cards plus the strip's nav arrows and "all matches" entry button,
    // which sit next to the cards and must stay usable.
    home
      .querySelectorAll(
        '.xhs-match-card, .xhs-match-nav-btn, .xhs-match-all-entry'
      )
      .forEach((el) => keepEls.push(el));

    if (keepEls.length === 0) {
      // Nothing recognised yet; don't hide anything blindly this pass.
      maskScores(home);
      return;
    }

    // Keep a node if it is a keep element (entire subtree) or an ancestor of
    // one (so the path down to the kept element stays visible).
    const keepSet = new Set(keepEls);
    const keepAncestors = new Set();
    for (const el of keepEls) {
      let n = el.parentElement;
      while (n && n !== home) {
        keepAncestors.add(n);
        n = n.parentElement;
      }
    }

    // Walk down the spine of kept ancestors, hiding every off-path sibling.
    (function walk(node) {
      for (const child of node.children) {
        if (keepSet.has(child)) {
          show(child); // keep the whole match card / schedule subtree
        } else if (keepAncestors.has(child)) {
          show(child); // on the path to a kept element
          walk(child);
        } else {
          hide(child); // news feed / unrelated block
        }
      }
    })(home);

    maskScores(home);
    hideHighlights(home);
  }

  /**
   * Hide the match-card highlight blurb (e.g. "维尼修斯救主 巴西战平摩洛哥"),
   * which spoils the result in text form even though the card is kept visible.
   */
  function hideHighlights(root) {
    const scope = root || document;
    scope.querySelectorAll('.xhs-match-card-match-highlight').forEach(hide);
  }

  /**
   * Replace any revealed score inside a `.xhs-match-card-vs` span with "? : ?".
   * Upcoming matches show "VS" and are left untouched.
   */
  function maskScores(root) {
    const scope = root || document;
    const spans = scope.querySelectorAll('.xhs-match-card-vs');
    spans.forEach((span) => {
      const text = span.textContent.trim();
      // "VS" (any case) means the match has not started yet -> leave as is.
      // Anything that still contains a digit is a real/live score -> mask it.
      if (text && text.toUpperCase() !== 'VS' && /\d/.test(text)) {
        if (span.textContent !== MASKED_SCORE) {
          // Remember the real score so the toggle can restore it later.
          span.setAttribute(ORIGINAL_ATTR, span.textContent);
          span.textContent = MASKED_SCORE;
        }
      }
    });
  }

  /** Toggle the CSS class on <html> that masks video covers (see styles.css). */
  function setPosterGuard(on) {
    const root = document.documentElement;
    if (!root) return;
    if (on) root.classList.add(POSTER_GUARD_CLASS);
    else root.classList.remove(POSTER_GUARD_CLASS);
  }

  /**
   * Decide whether the video cover should be masked. On a note/replay page the
   * cover stays masked until the author is positively confirmed to NOT be the
   * replay channel, so a spoiler poster never shows — not even for one frame,
   * since the mask is CSS applied at document_start.
   */
  function applyPosterGuard() {
    const path = location.pathname;
    const onNotePage =
      path.indexOf('/explore/') !== -1 ||
      path.indexOf('/discovery/item/') !== -1 ||
      !!document.querySelector('.note-content, .note-detail-mask, #noteContainer');

    if (!enabled || !onNotePage) {
      setPosterGuard(false);
      return;
    }

    const usernames = document.querySelectorAll('.username');
    if (usernames.length === 0) {
      // Author not loaded yet -> keep the cover hidden to avoid a spoiler flash.
      setPosterGuard(true);
      return;
    }
    let isReplay = false;
    for (const el of usernames) {
      if (el.textContent.trim() === REPLAY_USERNAME) {
        isReplay = true;
        break;
      }
    }
    setPosterGuard(isReplay);
  }

  /**
   * Replay note page: if the author is the official replay channel, hide the
   * title, the note content and the comments so the result is not spoiled.
   */
  function processReplayPage() {
    const usernames = document.querySelectorAll('.username');
    let isReplay = false;
    for (const el of usernames) {
      if (el.textContent.trim() === REPLAY_USERNAME) {
        isReplay = true;
        break;
      }
    }
    if (!isReplay) return;

    document.querySelectorAll('.note-content').forEach(hide);
    document.querySelectorAll('.comments-container').forEach(hide);
    hide(document.querySelector('#detail-title'));

    // The browser tab title also leaks the result, so neutralise it.
    if (document.title !== REPLAY_USERNAME) {
      savedTitle = document.title;
      document.title = REPLAY_USERNAME;
    }
  }

  function update() {
    // Evaluated regardless of `enabled` so the cover mask is removed when the
    // feature is turned off.
    applyPosterGuard();
    if (!enabled) return;
    const path = location.pathname;

    if (path.indexOf('worldcup') !== -1) {
      processHomePage();
    }

    // A note can be a full page (/explore/, /discovery/item/) or an overlay
    // opened on top of another page (e.g. clicked from the home feed).
    const noteOpen =
      path.indexOf('/explore/') !== -1 ||
      path.indexOf('/discovery/item/') !== -1 ||
      document.querySelector('.note-content, .note-detail-mask, #noteContainer');
    if (noteOpen) {
      processReplayPage();
    }
  }

  // Debounce work to once per frame to stay cheap during heavy SPA re-renders.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      try {
        update();
      } catch (e) {
        /* ignore transient DOM errors */
      }
    });
  }

  // Only childList/characterData are observed (not attributes), so the class
  // toggling and text edits this script performs never re-trigger itself.
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Apply the current on/off state: hide spoilers, or undo all changes.
  function applyState() {
    if (enabled) {
      schedule();
    } else {
      revertAll();
    }
  }

  const storageAvailable =
    typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  // Mask the cover immediately at document_start (before the poster paints),
  // optimistically assuming the feature is on; corrected once storage loads.
  applyPosterGuard();

  // Load the saved toggle state and react to changes made from the popup.
  if (storageAvailable) {
    chrome.storage.local.get({ enabled: true }, (res) => {
      enabled = res.enabled !== false;
      applyState();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.enabled) {
        enabled = changes.enabled.newValue !== false;
        applyState();
      }
    });
  }

  schedule();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  }
  window.addEventListener('load', schedule);

  // Fallback loop: re-read the toggle from storage (in case an onChanged event
  // was missed) and re-apply spoiler hiding for SPA updates the observer misses.
  setInterval(function () {
    if (storageAvailable) {
      chrome.storage.local.get({ enabled: true }, function (res) {
        const next = res.enabled !== false;
        if (next !== enabled) {
          enabled = next;
          applyState();
        } else {
          schedule();
        }
      });
    } else {
      schedule();
    }
  }, 1000);
})();
