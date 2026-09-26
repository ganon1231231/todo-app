(() => {
  'use strict';

  // Dr.Coach! Copy Assist is intentionally manual-selection only.
  // It does not crawl pages, collect question banks, or export content in bulk.
  const HOST_ID = 'drcoach-copy-assist';
  const STYLE_ID = 'drcoach-copy-assist-style';
  let enabled = true;
  let hideTimer = null;
  let lastSelection = '';

  const INTERACTIVE_SELECTOR = [
    'a','button','input','textarea','select','option','label','summary',
    '[role="button"]','[role="link"]','[contenteditable="true"]',
    '[draggable="true"]', `#${HOST_ID}`
  ].join(',');

  function injectSelectionCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.drcoach-copy-enabled body,
      html.drcoach-copy-enabled body *:not(input):not(textarea):not(select):not(option):not(button):not([contenteditable="true"]) {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      html.drcoach-copy-enabled img,
      html.drcoach-copy-enabled svg,
      html.drcoach-copy-enabled canvas {
        -webkit-user-drag: auto;
      }
      ::selection { background: rgba(62, 143, 255, .30) !important; color: inherit !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.toggle('drcoach-copy-enabled', enabled);
  }

  function selectionText() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';
      return String(sel.toString() || '').replace(/\u00a0/g, ' ').trim();
    } catch (_) {
      return '';
    }
  }

  function isInteractiveTarget(target) {
    try { return !!target?.closest?.(INTERACTIVE_SELECTOR); }
    catch (_) { return false; }
  }

  // Run at window capture level, before most document/body anti-copy handlers.
  function preserveTextSelection(event) {
    if (!enabled || isInteractiveTarget(event.target)) return;
    // Let the browser perform its native selection, but keep page-level blockers
    // from receiving this gesture.
    event.stopPropagation();
  }

  function protectSelectStart(event) {
    if (!enabled || isInteractiveTarget(event.target)) return;
    event.stopPropagation();
  }

  function copySelectedText(event) {
    if (!enabled) return;
    const text = selectionText();
    if (!text) return;
    // Handle the user's explicit Copy command before page scripts can cancel it.
    try {
      event.stopImmediatePropagation();
      if (event.clipboardData) {
        event.clipboardData.setData('text/plain', text);
        event.preventDefault();
      }
      lastSelection = text;
      showToast('Copiado');
    } catch (_) {}
  }

  async function writeClipboard(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-10000px;top:-10000px;opacity:0';
        document.documentElement.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return !!ok;
      } catch (_) {
        return false;
      }
    }
  }

  function ensureUI() {
    if (document.getElementById(HOST_ID)) return document.getElementById(HOST_ID);
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-drcoach-no-translate', 'true');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        .bubble{position:fixed;z-index:2147483646;display:none;align-items:center;gap:6px;padding:6px;border-radius:12px;background:rgba(13,22,36,.96);border:1px solid rgba(255,255,255,.15);box-shadow:0 12px 34px rgba(0,0,0,.30);backdrop-filter:blur(12px);font:650 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f9fc;user-select:none}
        .bubble.show{display:flex}
        button{appearance:none;border:0;border-radius:8px;padding:7px 10px;background:#edf4ff;color:#153d72;font:750 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
        button:hover{background:#fff}
        .hint{color:#94a7be;padding:0 5px;font-size:10px;white-space:nowrap}
        .toast{position:fixed;left:50%;bottom:68px;transform:translateX(-50%) translateY(8px);opacity:0;pointer-events:none;z-index:2147483647;background:#102036;color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 32px rgba(0,0,0,.25);border-radius:999px;padding:8px 12px;font:700 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transition:.18s ease}
        .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      </style>
      <div class="bubble" id="bubble">
        <button id="copy" type="button">Copiar selección</button>
        <span class="hint">⌘C / Ctrl+C también funciona</span>
      </div>
      <div class="toast" id="toast">Copiado</div>`;
    document.documentElement.appendChild(host);
    shadow.getElementById('copy').addEventListener('click', async () => {
      const text = selectionText() || lastSelection;
      if (!text) return;
      const ok = await writeClipboard(text);
      showToast(ok ? 'Copiado' : 'No se pudo copiar');
      hideBubble();
    });
    return host;
  }

  function showToast(message) {
    const host = ensureUI();
    const toast = host?.shadowRoot?.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toast.classList.remove('show'), 1200);
  }

  function hideBubble() {
    const host = document.getElementById(HOST_ID);
    host?.shadowRoot?.getElementById('bubble')?.classList.remove('show');
  }

  function positionBubble(range) {
    const host = ensureUI();
    const bubble = host?.shadowRoot?.getElementById('bubble');
    if (!bubble || !range) return;
    let rect;
    try { rect = range.getBoundingClientRect(); } catch (_) { return; }
    if (!rect || (!rect.width && !rect.height)) return;
    const width = 205;
    const x = Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
    const y = Math.max(8, rect.top - 46);
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.classList.add('show');
  }

  function updateSelectionUI() {
    if (!enabled) return hideBubble();
    const text = selectionText();
    if (!text) return hideBubble();
    lastSelection = text;
    try {
      const sel = window.getSelection();
      if (sel?.rangeCount) positionBubble(sel.getRangeAt(0));
    } catch (_) {}
  }

  function setEnabled(value) {
    enabled = !!value;
    injectSelectionCSS();
    document.documentElement.classList.toggle('drcoach-copy-enabled', enabled);
    if (!enabled) hideBubble();
    chrome.storage.local.set({ drcoachCopyAssistEnabled: enabled }).catch(() => {});
  }

  // Early capture listeners. We only intercept non-interactive text gestures.
  window.addEventListener('mousedown', preserveTextSelection, true);
  window.addEventListener('pointerdown', preserveTextSelection, true);
  window.addEventListener('selectstart', protectSelectStart, true);
  window.addEventListener('copy', copySelectedText, true);
  window.addEventListener('mouseup', () => setTimeout(updateSelectionUI, 0), true);
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key.startsWith('Arrow')) setTimeout(updateSelectionUI, 0);
  }, true);
  window.addEventListener('scroll', hideBubble, { passive: true, capture: true });

  // Keep inline event attributes from reappearing on navigation-heavy SPAs.
  function clearInlineCopyBlocks(root = document) {
    try {
      const targets = root.querySelectorAll?.('[oncopy],[oncut],[onselectstart],[oncontextmenu]') || [];
      for (const el of targets) {
        el.removeAttribute('oncopy');
        el.removeAttribute('oncut');
        el.removeAttribute('onselectstart');
        // Do not remove oncontextmenu globally: some pages use it for legitimate UI.
      }
      if (document.body) {
        document.body.oncopy = null;
        document.body.oncut = null;
        document.body.onselectstart = null;
      }
      document.oncopy = null;
      document.oncut = null;
      document.onselectstart = null;
    } catch (_) {}
  }

  function boot() {
    injectSelectionCSS();
    ensureUI();
    clearInlineCopyBlocks();
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length) {
          for (const n of m.addedNodes) if (n.nodeType === 1) clearInlineCopyBlocks(n);
        }
      }
    });
    if (document.documentElement) obs.observe(document.documentElement, { subtree: true, childList: true });

    chrome.storage.local.get('drcoachCopyAssistEnabled').then((r) => {
      if (typeof r?.drcoachCopyAssistEnabled === 'boolean') setEnabled(r.drcoachCopyAssistEnabled);
      else setEnabled(true);
    }).catch(() => setEnabled(true));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    // CSS can be applied even before DOMContentLoaded.
    if (document.documentElement) injectSelectionCSS();
  } else boot();
})();
