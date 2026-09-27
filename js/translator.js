/* =========================================================================
 * Dr.Coach! — js/translator.js  ·  Traductor integrado (sin extensiones)
 * -------------------------------------------------------------------------
 * Traducción EN↔ES en CUALQUIER dispositivo — Mac, Windows, tablets con
 * Chrome/Edge y también iPad/iPhone (Safari), Firefox y Chrome Android —
 * sin instalar ninguna extensión de navegador.
 *
 * POR QUÉ EXISTE: el Companion (companions/browser-extension) traduce el
 * QBank de Medicospira inline porque un content script SÍ puede inyectarse
 * en todos los frames de usmle.medicospira.com… pero solo se instala en
 * Chrome/Edge de escritorio. Una página web JAMÁS puede tocar el DOM de un
 * iframe cross-origin (política de mismo origen del navegador), así que en
 * iPad el inline es técnicamente imposible. Este módulo cubre el resto:
 *
 *   · Panel del Workspace: copia cualquier texto del QBank → «Pegar y
 *     traducir» → traducción al instante junto al QBank.
 *   · Burbuja de selección: selecciona texto en CUALQUIER vista de
 *     Dr.Coach! (notas, board, dossier) → botón Traducir → tarjeta.
 *
 * CADENA DE MOTORES con degradación elegante (si uno falla, prueba el
 * siguiente y el badge muestra cuál respondió):
 *   1) On-device — Chrome Translator API (Chrome/Edge 138+): gratis,
 *      offline y privado; con detección de idioma (LanguageDetector).
 *   2) Google    — endpoint público translate_a/single (CORS abierto,
 *      detecta el idioma solo, textos largos por fragmentos).
 *   3) MyMemory  — API pública de respaldo (CORS abierto, ≤480 car/petición).
 * ========================================================================= */
(() => {
  'use strict';

  if (window.DCTranslator) return; // montaje único

  /* ------------------------------------------------------------------ *
   * Estado y utilidades
   * ------------------------------------------------------------------ */
  const PREFS_KEY = 'dcTranslatorPrefs';
  const MAX_CHARS = 20000;
  const deviceTranslators = new Map(); // "en>es" -> Translator instanciado
  const ENGINE_LABEL = {
    device: '⚡ En el dispositivo',
    google: '🌐 Google',
    mymemory: '📦 MyMemory'
  };

  const prefs = loadPrefs();
  function loadPrefs() {
    try { return { from: 'en', to: 'es', auto: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
    catch (_) { return { from: 'en', to: 'es', auto: true }; }
  }
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ from: prefs.from, to: prefs.to, auto: prefs.auto })); } catch (_) {} }
  function say(msg) { try { if (typeof window.toast === 'function') window.toast(msg); } catch (_) {} }

  function fetchTimeout(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 12000);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* ------------------------------------------------------------------ *
   * Fragmentación: cada motor tiene su límite cómodo por petición
   * ------------------------------------------------------------------ */
  function chunkText(text, limit) {
    if (String(text).length <= limit) return [String(text)];
    const pieces = [];
    for (const para of String(text).split('\n')) {
      let rest = para;
      if (!rest.length) { pieces.push(''); continue; }
      while (rest.length > limit) {
        let cut = rest.lastIndexOf('. ', limit);
        if (cut < limit * 0.4) cut = rest.lastIndexOf(' ', limit);
        if (cut < limit * 0.3) cut = limit;
        pieces.push(rest.slice(0, cut + 1));
        rest = rest.slice(cut + 1).replace(/^ /, '');
      }
      if (rest.length) pieces.push(rest);
    }
    const merged = [];
    let cur = '';
    for (const piece of pieces) {
      if (!cur.length) cur = piece;
      else if (cur.length + 1 + piece.length <= limit) cur += '\n' + piece;
      else { merged.push(cur); cur = piece; }
    }
    if (cur.length) merged.push(cur);
    return merged;
  }

  /* ------------------------------------------------------------------ *
   * Motor 1 — Chrome Translator API (en el dispositivo, gratis/offline)
   * ------------------------------------------------------------------ */
  async function translateOnDevice(text, from, to, onProgress) {
    if (!('Translator' in self) || typeof self.Translator?.create !== 'function') throw new Error('device: no disponible');
    const key = from + '>' + to;
    let inst = deviceTranslators.get(key);
    if (!inst) {
      let availability = 'unavailable';
      try { availability = await self.Translator.availability({ sourceLanguage: from, targetLanguage: to }); } catch (_) {}
      if (availability === 'unavailable') throw new Error('device: par no disponible');
      inst = await self.Translator.create({
        sourceLanguage: from,
        targetLanguage: to,
        monitor(m) {
          try { m.addEventListener('downloadprogress', (e) => { const p = Math.max(0, Math.min(100, Math.round(Number(e.loaded || 0) * 100))); if (onProgress) onProgress(p); }); } catch (_) {}
        }
      });
      deviceTranslators.set(key, inst);
    }
    const out = await inst.translate(text);
    if (!out) throw new Error('device: respuesta vacía');
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Motor 2 — Google (endpoint público gtx; CORS abierto; detecta idioma)
   * ------------------------------------------------------------------ */
  async function translateGoogle(text, from, to) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + (from || 'auto') + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(text);
    const resp = await fetchTimeout(url, 12000);
    if (!resp.ok) throw new Error('google: HTTP ' + resp.status);
    const data = await resp.json();
    const segs = Array.isArray(data?.[0]) ? data[0].map((s) => (s && s[0]) || '').join('') : '';
    if (!segs) throw new Error('google: respuesta inesperada');
    const detected = typeof data?.[2] === 'string' && data[2] ? data[2].split('-')[0] : (from || 'auto');
    return { text: segs, from: detected };
  }

  /* ------------------------------------------------------------------ *
   * Motor 3 — MyMemory (respaldo público; ≤480 caracteres por petición)
   * ------------------------------------------------------------------ */
  async function translateMyMemory(text, from, to) {
    const src = from && from !== 'auto' ? from : 'en';
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + src + '|' + to;
    const resp = await fetchTimeout(url, 12000);
    if (!resp.ok) throw new Error('mymemory: HTTP ' + resp.status);
    const json = await resp.json();
    const out = String(json?.responseData?.translatedText || '');
    if (!out || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID SOURCE|INVALID TARGET/i.test(out)) throw new Error('mymemory: respuesta inválida');
    return { text: out, from: src };
  }

  /* ------------------------------------------------------------------ *
   * API principal: DCTranslator.translate(texto, {from, to})
   * Devuelve { text, engine, from }  ·  engine: device|google|mymemory
   * ------------------------------------------------------------------ */
  async function translate(raw, opts = {}) {
    const from = opts.from || 'auto';
    const to = opts.to || 'es';
    let text = String(raw || '').trim();
    if (!text) throw new Error('Nada que traducir.');
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

    // Resolver "auto" con el detector local si existe (Chrome 138+)
    let resolved = from;
    if (resolved === 'auto' && 'LanguageDetector' in self && typeof self.LanguageDetector?.create === 'function') {
      try {
        const detector = await self.LanguageDetector.create();
        const hits = await detector.detect(text);
        const top = hits && hits[0];
        if (top && top.detectedLanguage) resolved = String(top.detectedLanguage).split('-')[0];
      } catch (_) {}
    }

    // 1) On-device (requiere idioma concreto distinto del destino)
    if (resolved && resolved !== 'auto' && resolved !== to) {
      try {
        const out = await translateOnDevice(text, resolved, to);
        return { text: out, engine: 'device', from: resolved };
      } catch (_) { /* degrada al siguiente motor */ }
    }

    // 2) Google (maneja auto nativamente)
    try {
      const chunks = chunkText(text, 1500);
      const parts = [];
      let detected = resolved;
      for (const chunk of chunks) {
        const r = await translateGoogle(chunk, from, to);
        parts.push(r.text);
        if (r.from && r.from !== 'auto') detected = r.from;
      }
      return { text: parts.join('\n'), engine: 'google', from: detected };
    } catch (_) { /* degrada al siguiente motor */ }

    // 3) MyMemory
    const chunks = chunkText(text, 480);
    const src = resolved !== 'auto' ? resolved : 'en';
    const parts = [];
    for (const chunk of chunks) parts.push((await translateMyMemory(chunk, src, to)).text);
    return { text: parts.join('\n'), engine: 'mymemory', from: src };
  }

  /* ------------------------------------------------------------------ *
   * PANEL DEL WORKSPACE — el traductor que funciona hasta en iPad
   * ------------------------------------------------------------------ */
  let panel = null; // refs de elementos

  function ensurePanel() {
    if (panel) return panel;
    const host = document.getElementById('integratedCoachPanel');
    if (!host) return null;
    host.insertAdjacentHTML('beforeend', `
      <div id="dcTrPanel" class="dc-tr-panel" hidden>
        <div class="dc-tr-head">
          <b>Traductor integrado</b>
          <div class="dc-tr-head-right">
            <span class="dc-tr-dir" id="dcTrDir">EN → ES</span>
            <span class="dc-tr-engine" id="dcTrEngine">listo</span>
            <button id="dcTrSwap" class="dc-tr-mini" type="button" title="Intercambiar idiomas">⇄</button>
            <button id="dcTrClose" class="dc-tr-mini" type="button" aria-label="Cerrar traductor">✕</button>
          </div>
        </div>
        <textarea id="dcTrSource" class="dc-tr-area" placeholder="Pega aquí el texto del QBank (pregunta, opciones, explicación)…" aria-label="Texto original"></textarea>
        <div class="dc-tr-actions">
          <button id="dcTrPaste" class="btn btn-secondary btn-small" type="button">📋 Pegar y traducir</button>
          <button id="dcTrGo" class="btn btn-primary btn-small" type="button">Traducir</button>
          <button id="dcTrCopy" class="btn btn-secondary btn-small" type="button">Copiar</button>
          <label class="dc-tr-auto"><input type="checkbox" id="dcTrAuto" checked> automático</label>
        </div>
        <div id="dcTrResult" class="dc-tr-result" role="status">La traducción aparecerá aquí.</div>
        <p class="dc-tr-tip" id="dcTrTip" hidden></p>
      </div>`);
    const $ = (id) => document.getElementById(id);
    panel = {
      root: $('dcTrPanel'), source: $('dcTrSource'), result: $('dcTrResult'),
      engine: $('dcTrEngine'), dir: $('dcTrDir'), tip: $('dcTrTip'),
      auto: $('dcTrAuto'), timer: null, lastResult: '', busy: false
    };
    panel.auto.checked = !!prefs.auto;
    panel.dir.textContent = prefs.from.toUpperCase() + ' → ' + prefs.to.toUpperCase();
    refreshEngineBadge();
    refreshTip();

    $('dcTrClose').addEventListener('click', () => toggleWorkspacePanel(false));
    $('dcTrSwap').addEventListener('click', swapDirection);
    $('dcTrGo').addEventListener('click', runPanelTranslation);
    $('dcTrCopy').addEventListener('click', copyResult);
    $('dcTrPaste').addEventListener('click', pasteAndTranslate);
    panel.auto.addEventListener('change', () => { prefs.auto = panel.auto.checked; savePrefs(); });
    panel.source.addEventListener('input', () => {
      if (!prefs.auto) return;
      clearTimeout(panel.timer);
      panel.timer = setTimeout(runPanelTranslation, 700);
    });
    return panel;
  }

  function refreshEngineBadge(text, cls) {
    if (!panel) return;
    panel.engine.textContent = text || 'listo';
    panel.engine.className = 'dc-tr-engine' + (cls ? ' ' + cls : '');
  }
  function refreshTip() {
    if (!panel) return;
    const hasDevice = 'Translator' in self;
    if (hasDevice) { panel.tip.hidden = true; return; }
    panel.tip.hidden = false;
    panel.tip.textContent = isIOS
      ? '💡 iPad/iPhone: pulsa ↗ en la barra del QBank para abrirlo en su propia pestaña y usa aA → «Traducir página» de Safari. Para textos sueltos, cópialos y pégalos aquí: este panel funciona siempre, sin extensiones.'
      : '💡 Este panel funciona en cualquier navegador, sin extensiones. También puedes traducir la página entera con el traductor de tu navegador (Safari: aA → Traducir; Chrome: menú ⋮ → Traducir).';
  }

  function setBusy(busy, label) {
    if (!panel) return;
    panel.busy = busy;
    // Solo toca el badge al ENTRAR en busy: al salir, el try/catch ya dejó
    // puesto el resultado (motor que respondió / ✗ sin conexión) y no hay
    // que sobreescribirlo con «listo».
    if (busy) refreshEngineBadge(label || '… traduciendo', 'busy');
  }

  async function runPanelTranslation() {
    const p = ensurePanel(); if (!p || p.busy) return;
    const text = p.source.value.trim();
    if (!text.length) { p.result.textContent = 'Escribe o pega texto para traducir.'; p.result.classList.remove('error'); return; }
    setBusy(true);
    try {
      const r = await translate(text, { from: prefs.from, to: prefs.to });
      p.result.textContent = r.text;
      p.result.classList.remove('error');
      p.lastResult = r.text;
      refreshEngineBadge(ENGINE_LABEL[r.engine] || r.engine + (r.from && r.from !== 'auto' ? ' · detectado: ' + r.from.toUpperCase() : ''));
    } catch (err) {
      p.result.textContent = 'No se pudo traducir ahora: ' + (err && err.message ? err.message : 'sin conexión con los motores.') + ' Revisa tu conexión y vuelve a intentar.';
      p.result.classList.add('error');
      refreshEngineBadge('✗ sin conexión');
    } finally {
      setBusy(false);
    }
  }

  async function pasteAndTranslate() {
    const p = ensurePanel(); if (!p) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) { say('El portapapeles está vacío.'); return; }
      p.source.value = text.trim();
      await runPanelTranslation();
    } catch (_) {
      p.source.focus();
      say('Tu navegador bloqueó el portapapeles: mantén pulsado en el cuadro y elige «Pegar».');
    }
  }

  async function copyResult() {
    const p = ensurePanel(); if (!p) return;
    if (!p.lastResult) { say('Todavía no hay traducción que copiar.'); return; }
    try { await navigator.clipboard.writeText(p.lastResult); say('Traducción copiada.'); }
    catch (_) { say('No se pudo copiar automáticamente.'); }
  }

  function swapDirection() {
    const p = ensurePanel(); if (!p) return;
    const tmpF = prefs.from, tmpT = prefs.to;
    prefs.from = tmpT; prefs.to = tmpF; savePrefs();
    p.dir.textContent = prefs.from.toUpperCase() + ' → ' + prefs.to.toUpperCase();
    const oldResult = p.lastResult;
    if (oldResult) {
      p.source.value = oldResult;
      p.result.textContent = 'La traducción aparecerá aquí.';
      p.lastResult = '';
      if (prefs.auto) { clearTimeout(p.timer); p.timer = setTimeout(runPanelTranslation, 350); }
    }
    refreshEngineBadge();
  }

  function toggleWorkspacePanel(force) {
    const p = ensurePanel(); if (!p) return;
    const show = typeof force === 'boolean' ? force : p.root.hidden;
    p.root.hidden = !show;
    const btn = document.getElementById('workspaceTranslator');
    if (btn) btn.classList.toggle('translation-active', show);
    if (show) { p.source.focus(); refreshTip(); }
  }
  function openWorkspacePanel() { toggleWorkspacePanel(true); }
  function closeWorkspacePanel() { toggleWorkspacePanel(false); }

  /* ------------------------------------------------------------------ *
   * BURBUJA DE SELECCIÓN — traduce texto seleccionado en CUALQUIER vista
   * (funciona dentro de Dr.Coach!; un iframe cross-origin es inalcanzable
   * por diseño del navegador — para eso está el Companion o el panel)
   * ------------------------------------------------------------------ */
  let bubble = null, card = null, selTimer = null, lastSelection = '';

  function inTranslatorUI(node) {
    return !!(node && node.parentElement && node.parentElement.closest('#dcTrPanel,#dcTrCard,#dcTrBubble,#toast'));
  }

  function ensureBubbleCard() {
    if (!bubble) {
      document.body.insertAdjacentHTML('beforeend', `
        <button id="dcTrBubble" class="dc-tr-bubble" type="button">🌐 Traducir</button>
        <div id="dcTrCard" class="dc-tr-card" role="dialog" aria-label="Traducción de la selección">
          <div class="dc-tr-card-top"><b>Traducción</b><span class="dc-tr-engine" id="dcTrCardEngine"></span><button id="dcTrCardClose" class="dc-tr-mini" type="button" aria-label="Cerrar">✕</button></div>
          <div class="dc-tr-card-text" id="dcTrCardText"></div>
          <div class="dc-tr-actions"><button id="dcTrCardCopy" class="btn btn-secondary btn-small" type="button">Copiar</button><button id="dcTrCardGo" class="btn btn-primary btn-small" type="button">Traducir de nuevo</button></div>
        </div>`);
      bubble = document.getElementById('dcTrBubble');
      card = document.getElementById('dcTrCard');
      document.getElementById('dcTrCardClose').addEventListener('click', hideCard);
      document.getElementById('dcTrCardCopy').addEventListener('click', async () => {
        const t = document.getElementById('dcTrCardText').textContent;
        try { await navigator.clipboard.writeText(t); say('Traducción copiada.'); } catch (_) { say('No se pudo copiar.'); }
      });
      document.getElementById('dcTrCardGo').addEventListener('click', () => { if (lastSelection) showCardFor(lastSelection); });
      bubble.addEventListener('click', () => { if (lastSelection) showCardFor(lastSelection); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideCard(); bubble.classList.remove('show'); } });
      window.addEventListener('scroll', () => { bubble.classList.remove('show'); }, { passive: true, capture: true });
    }
    return { bubble, card };
  }

  function currentSelectionText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return '';
    const text = String(sel.toString() || '').trim();
    if (text.length < 2 || text.length > 5000) return '';
    if (inTranslatorUI(sel.anchorNode)) return '';
    return text;
  }

  function positionBubble() {
    const sel = window.getSelection();
    const { bubble: b } = ensureBubbleCard();
    if (!sel || sel.rangeCount === 0) return;
    let rect = null;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (_) { return; }
    if (!rect || (!rect.width && !rect.height)) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - 44, vw - 110));
    let top = rect.top - 44;
    if (top < 54) top = Math.min(rect.bottom + 10, vh - 60);
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    b.classList.add('show');
  }

  function scheduleBubbleCheck() {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const text = currentSelectionText();
      const { bubble: b } = ensureBubbleCard();
      if (!text) { b.classList.remove('show'); if (card && card.classList.contains('show') && !lastSelection) hideCard(); return; }
      lastSelection = text;
      positionBubble();
    }, 380);
  }

  async function showCardFor(text) {
    const { card: c, bubble: b } = ensureBubbleCard();
    const txt = document.getElementById('dcTrCardText');
    const badge = document.getElementById('dcTrCardEngine');
    txt.textContent = '… traduciendo';
    badge.textContent = '';
    badge.className = 'dc-tr-engine busy';
    c.classList.add('show');
    b.classList.remove('show');
    try {
      const r = await translate(text, { from: 'auto', to: 'es' });
      txt.textContent = r.text;
      badge.textContent = ENGINE_LABEL[r.engine] || r.engine;
      badge.className = 'dc-tr-engine';
    } catch (err) {
      txt.textContent = 'No se pudo traducir: ' + (err && err.message ? err.message : 'sin conexión.');
      badge.textContent = '✗';
      badge.className = 'dc-tr-engine';
    }
  }

  function hideCard() {
    if (card) card.classList.remove('show');
  }

  function initBubble() {
    document.addEventListener('selectionchange', scheduleBubbleCheck);
    document.addEventListener('pointerup', (e) => {
      if (e.target && e.target.closest && e.target.closest('#dcTrCard,#dcTrBubble')) return;
      scheduleBubbleCheck();
    });
    document.addEventListener('pointerdown', (e) => {
      if (card && card.classList.contains('show') && e.target && !(e.target.closest && e.target.closest('#dcTrCard,#dcTrBubble'))) hideCard();
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * Arranque + API pública
   * ------------------------------------------------------------------ */
  function init() { initBubble(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.DCTranslator = {
    translate,
    toggleWorkspacePanel,
    openWorkspacePanel,
    closeWorkspacePanel,
    isIOS,
    hasOnDeviceEngine: () => 'Translator' in self
  };
})();
