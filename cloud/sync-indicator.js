/* ===================================================================
 * Dr.Coach! v3.0.0 — Sync indicator widget
 * -------------------------------------------------------------------
 * Renders into the existing `#saveState` slot and shows one of:
 *
 *   💾 Solo local          — no Supabase session / config missing
 *   ☁ Guardado             — last push succeeded
 *   ☁ Sincronizando…       — push or pull in progress
 *   ☁ N cambios pendientes — local changes queued, not yet pushed
 *   ⚠ Sin conexión         — offline
 *
 * It also keeps the legacy save pulse messages working by listening
 * for `savePulse()` calls made by app.js.
 * =================================================================== */

(() => {
  'use strict';

  const ICONS = {
    idle:        '☁',
    saving:      '☁',
    syncing:     '☁',
    pending:     '☁',
    offline:     '⚠',
    error:       '⚠',
    local:       '💾',
  };
  const LABELS = {
    idle:        'Guardado',
    saving:      'Guardando…',
    syncing:     'Sincronizando…',
    pending:     (n) => `${n} cambio${n === 1 ? '' : 's'} pendiente${n === 1 ? '' : 's'}`,
    offline:     'Sin conexión',
    error:       'Error de sync',
    local:       'Solo local',
  };

  const rootEl = () => document.getElementById('saveState');
  let lastCloudState = null;
  let legacyPulseTimer = null;

  function update(status, meta = {}) {
    const el = rootEl();
    if (!el) return;
    lastCloudState = status;
    const icon = ICONS[status] || '☁';
    const labelFn = LABELS[status] || (() => status);
    const label = typeof labelFn === 'function' ? labelFn(meta?.count || 0) : labelFn;
    el.innerHTML = `<span class="save-dot save-dot-${status}"></span> ${icon} ${label}`;
    el.classList.remove('is-syncing', 'is-pending', 'is-offline', 'is-local', 'is-idle');
    el.classList.add(`is-${status}`);
    // Refresh title for accessibility
    el.setAttribute('title', `Dr.Coach! Cloud: ${label}`);
  }

  // Observe legacy `savePulse` text changes so we can interleave:
  // when app.js says "Guardado local" via savePulse, we keep the cloud
  // icon but flash the local save event briefly.
  function observeLegacy() {
    const el = rootEl();
    if (!el) return;
    const obs = new MutationObserver(() => {
      const txt = el.textContent || '';
      if (!lastCloudState) return;
      if (/Guardado local|Borrador guardado|Guardado/i.test(txt) && !legacyPulseTimer) {
        // Briefly show "Guardando…" then restore cloud state
        el.classList.add('is-saving');
        legacyPulseTimer = setTimeout(() => {
          legacyPulseTimer = null;
          update(lastCloudState);
        }, 1100);
      }
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function init() {
    // Wait until DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { observeLegacy(); });
    } else observeLegacy();
  }

  init();

  window.DrCoachSyncIndicator = { update, init };
  if (window.DrCoachSync) window.DrCoachSync.registerIndicator(window.DrCoachSyncIndicator);
})();
