// Popup toggle: reads and writes the `enabled` flag in chrome.storage.local.
// The content script reads the same flag (on load, via storage.onChanged, and
// via a 1s polling fallback) and applies the change live.
(function () {
  'use strict';

  function init() {
    const toggle = document.getElementById('toggle');
    const status = document.getElementById('status');
    if (!toggle || !status) return;

    function render(enabled) {
      toggle.checked = enabled;
      status.textContent = enabled ? 'ON' : 'OFF';
      status.className = 'status ' + (enabled ? 'on' : 'off');
    }

    // `storage` permission is declared in the manifest, so this should always
    // be available in the popup; guard anyway and surface the problem clearly.
    if (
      typeof chrome === 'undefined' ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      status.textContent = 'ERR';
      status.className = 'status off';
      console.error(
        '[XHS spoiler] chrome.storage unavailable — check the "storage" permission in manifest.json'
      );
      return;
    }

    chrome.storage.local.get({ enabled: true }, function (res) {
      render(res.enabled !== false);
    });

    toggle.addEventListener('change', function () {
      const enabled = toggle.checked;
      render(enabled);
      chrome.storage.local.set({ enabled: enabled }, function () {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error(
            '[XHS spoiler] failed to save toggle:',
            chrome.runtime.lastError
          );
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
