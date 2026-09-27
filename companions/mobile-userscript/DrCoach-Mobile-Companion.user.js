// ==UserScript==
// @name         Dr.Coach! Mobile Companion — Copy + Translate
// @namespace    drcoach.mobile
// @version      0.4.1
// @description  Traducción Español/Original de Medicospira y copia/selección desbloqueada — dentro del iframe del Workspace de Dr.Coach! o en pestaña propia. Multi-gestor: Tampermonkey/Violentmonkey/Stay y Userscripts (Safari iOS/iPadOS). Muestra píldora «DC · Español/Original» para confirmar que está activo y autodiagnostica si el gestor no inyecta en iframes.
// @match        *://*.medicospira.com/*
// @match        https://ganon1231231.github.io/todo-app/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM_setValue
// @grant        GM.setValue
// @grant        GM_addStyle
// @grant        GM.addStyle
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @connect      www.bing.com
// @homepageURL  https://github.com/ganon1231231/todo-app
// @updateURL    https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js
// @downloadURL  https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js
// ==/UserScript==

(() => {
  'use strict';

  // --- GM shim: compatible con TODOS los gestores ---
  // Tampermonkey/Violentmonkey/Stay → funciones GM_* clásicas.
  // Userscripts (Safari iOS/iPadOS) y Greasemonkey 4 → objeto GM.* con promesas.
  // Sin ninguno → localStorage para preferencias y fetch directo cuando el endpoint permite CORS.
  const GMX = (() => {
    const dotted = (typeof GM !== 'undefined' && GM && typeof GM === 'object') ? GM : {};
    const hasDotted = k => typeof dotted[k] === 'function';
    const xhrVia = fn => opts => new Promise((resolve, reject) => {
      try {
        fn(Object.assign({ timeout: 30000, onload: null, onerror: () => reject(new Error('network')), ontimeout: () => reject(new Error('timeout')) }, opts));
      } catch (e) { reject(e); }
    });
    return {
      get: hasDotted('getValue')
        ? (k, d) => Promise.resolve().then(() => dotted.getValue(k)).then(v => (v === undefined || v === null) ? d : v)
        : (typeof GM_getValue === 'function')
          ? (k, d) => { try { const v = GM_getValue(k, d); return (v === undefined || v === null) ? d : v; } catch (_) { return d; } }
          : (k, d) => { try { const v = localStorage.getItem('dcgm:' + k); return v === null ? d : v; } catch (_) { return d; } },
      set: hasDotted('setValue')
        ? (k, v) => Promise.resolve().then(() => dotted.setValue(k, v)).catch(() => {})
        : (typeof GM_setValue === 'function')
          ? (k, v) => { try { GM_setValue(k, v); } catch (_) {} }
          : (k, v) => { try { localStorage.setItem('dcgm:' + k, String(v)); } catch (_) {} },
      clipboard: hasDotted('setClipboard')
        ? t => Promise.resolve().then(() => dotted.setClipboard(t, 'text')).then(() => true).catch(() => false)
        : (typeof GM_setClipboard === 'function')
          ? t => { try { GM_setClipboard(t, 'text'); return true; } catch (_) { return false; } }
          : null,
      addStyle: hasDotted('addStyle')
        ? css => Promise.resolve().then(() => dotted.addStyle(css)).catch(() => {})
        : null,
      xhr: hasDotted('xmlHttpRequest') ? xhrVia(dotted.xmlHttpRequest)
        : (typeof GM_xmlhttpRequest === 'function') ? xhrVia(GM_xmlhttpRequest)
        : null,
      menu: (typeof GM_registerMenuCommand === 'function') ? GM_registerMenuCommand : (hasDotted('registerMenuCommand') ? dotted.registerMenuCommand : null)
    };
  })();

  async function gmGetValue(key, def) {
    try { const v = await GMX.get(key, def); return (v === undefined || v === null) ? def : v; } catch (_) { return def; }
  }
  function gmSetValue(key, val) {
    try { const r = GMX.set(key, val); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch (_) {}
  }
  function injectStyle(css) {
    try { if (typeof GM_addStyle === 'function') { GM_addStyle(css); return; } } catch (_) {}
    try { if (GMX.addStyle) { GMX.addStyle(css); return; } } catch (_) {}
    try { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); } catch (_) {}
  }

  const LANG_KEY = 'drcoach-mobile-language';
  const SCRIPT_VERSION = '0.4.1';
  const TARGET_LANG = 'es';
  const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single';
  const MAX_CONCURRENCY = 4;
  const RETRIES = 2;

  const IS_MEDICOSPIRA = /(^|\.)medicospira\.com$/i.test(location.hostname);
  const IS_DRcoach_TOP = (window.parent === window) && /(^|\.)github\.io$/i.test(location.hostname) && location.pathname.indexOf('/todo-app') === 0;

  // ==================== Motor de traducción (solo Medicospira) ====================
  const records = new Map(); // Text -> { original, translated }
  const cache = new Map();
  let currentLanguage = 'en';
  let translating = false;
  let scanTimer = null;
  let observer = null;
  let bingAuthCache = null;

  const EXCLUDED = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE','KBD','SAMP','SVG','MATH','CANVAS','IFRAME','VIDEO','AUDIO']);
  const INTERACTIVE = 'a,button,input,textarea,select,option,label,summary,[role="button"],[role="link"],[contenteditable="true"]';

  const MED_STYLE = `
    html.drcoach-copy-enabled body,
    html.drcoach-copy-enabled body *:not(input):not(textarea):not(select):not(option):not([contenteditable="true"]) {
      -webkit-user-select: text !important;
      user-select: text !important;
      -webkit-touch-callout: default !important;
    }
    html.drcoach-copy-enabled ::selection { background: rgba(47,125,255,.28) !important; color: inherit !important; }
    #drcoach-mobile-copybar {
      position: fixed !important; z-index: 2147483647 !important; display: none; gap: 6px; align-items: center;
      padding: 6px; border-radius: 12px; background: rgba(15,24,38,.94); border: 1px solid rgba(255,255,255,.14);
      box-shadow: 0 12px 30px rgba(0,0,0,.28); backdrop-filter: blur(10px);
      font: 700 12px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    #drcoach-mobile-copybar button { border:0; border-radius:9px; padding:8px 10px; font:inherit; cursor:pointer; background:#eef5ff; color:#173d70; }
    #drcoach-mobile-copybar button.secondary { background:rgba(255,255,255,.10); color:#fff; }
    #drcoach-mobile-pill {
      position: fixed !important; z-index: 2147483647 !important;
      right: 14px !important; bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
      display: flex; gap: 7px; align-items: center;
      padding: 10px 14px !important; border-radius: 999px !important;
      background: rgba(15,24,38,.92) !important; border: 1px solid rgba(255,255,255,.18) !important;
      color: #fff !important; box-shadow: 0 10px 24px rgba(0,0,0,.30) !important; backdrop-filter: blur(10px);
      font: 700 12.5px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
      cursor: pointer !important; opacity: .93; -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
    }
    #drcoach-mobile-pill .dc-dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; flex: 0 0 auto; }
    #drcoach-mobile-pill[data-lang="es"] .dc-dot { background: #fbbf24; }
    #drcoach-mobile-hello {
      position: fixed !important; z-index: 2147483647 !important;
      left: 14px !important; bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
      padding: 9px 13px !important; border-radius: 999px !important;
      background: rgba(15,24,38,.92) !important; color: #fff !important;
      border: 1px solid rgba(255,255,255,.18) !important; box-shadow: 0 10px 24px rgba(0,0,0,.30) !important;
      font: 700 12.5px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
      pointer-events: none !important; opacity: .95; transition: opacity .6s ease;
    }
    #drcoach-mobile-hello.dc-fade { opacity: 0; }
  `;

  function post(type, payload={}) {
    if (window.parent === window) return;
    try { window.parent.postMessage({ type, ...payload }, '*'); } catch (_) {}
  }
  function postStatus(status, extra={}) {
    post('DRCOACH_TRANSLATOR_STATUS', { status, language: currentLanguage, ...extra });
  }
  function postReady() {
    post('DRCOACH_COMPANION_READY', { language: currentLanguage, mobile: true, translator: 'drcoach-mobile-v' + SCRIPT_VERSION });
  }

  function gmRequest(opts) {
    if (GMX.xhr) return GMX.xhr(opts);
    // Último recurso (entorno sin API GM): fetch directo — solo funciona si el endpoint
    // permite CORS (Google gtx suele permitirlo; Bing no, en ese caso fallará y se registrará).
    return (async () => {
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;
      try {
        const r = await fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || undefined, body: opts.data, signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' });
        const text = await r.text();
        return { status: r.status, responseText: text };
      } finally { if (timer) clearTimeout(timer); }
    })();
  }

  async function googleTranslate(text) {
    const url = GOOGLE_URL + '?client=gtx&sl=auto&tl=' + encodeURIComponent(TARGET_LANG) + '&dt=t&q=' + encodeURIComponent(text);
    const res = await gmRequest({ url });
    if (res.status !== 200) throw new Error('google-http-' + res.status);
    const data = JSON.parse(res.responseText);
    if (!data || !Array.isArray(data[0])) throw new Error('google-parse');
    return data[0].map(seg => seg?.[0] || '').join('').trim();
  }

  async function getBingAuth(force=false) {
    if (!force && bingAuthCache && Date.now() - bingAuthCache.at < bingAuthCache.ttl) return bingAuthCache;
    const res = await gmRequest({ url: 'https://www.bing.com/translator' });
    if (res.status !== 200) throw new Error('bing-auth-' + res.status);
    const html = res.responseText || '';
    const ig = /IG:"([^"]+)"/.exec(html);
    const iid = /data-iid="([^"]+)"/.exec(html);
    const p = /params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*\]/.exec(html);
    if (!ig || !p) throw new Error('bing-auth-parse');
    bingAuthCache = { ig: ig[1], iid: iid ? iid[1] : 'translator.5028', key: p[1], token: p[2], ttl: Number(p[3]) || 3600000, at: Date.now() };
    return bingAuthCache;
  }

  async function bingTranslate(text, retried=false) {
    const a = await getBingAuth(false);
    const url = 'https://www.bing.com/ttranslatev3?isVertical=1&IG=' + encodeURIComponent(a.ig) + '&IID=' + encodeURIComponent(a.iid);
    const data = 'fromLang=auto-detect&to=es&text=' + encodeURIComponent(text) + '&token=' + encodeURIComponent(a.token) + '&key=' + encodeURIComponent(a.key);
    const res = await gmRequest({ method:'POST', url, headers:{'Content-Type':'application/x-www-form-urlencoded'}, data });
    let json = null; try { json = JSON.parse(res.responseText); } catch (_) {}
    const tr = json?.[0]?.translations?.[0]?.text;
    if (res.status === 200 && tr) return String(tr).trim();
    if (!retried) { await getBingAuth(true); return bingTranslate(text, true); }
    throw new Error('bing-http-' + res.status);
  }

  async function translateText(text) {
    const key = text.trim();
    if (cache.has(key)) return cache.get(key);
    let lastErr;
    for (let attempt=0; attempt<=RETRIES; attempt++) {
      try {
        const tr = await googleTranslate(key);
        if (tr) { cache.set(key, tr); return tr; }
      } catch (e) { lastErr = e; }
      if (attempt < RETRIES) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
    try {
      const tr = await bingTranslate(key);
      if (tr) { cache.set(key, tr); return tr; }
    } catch (e) { lastErr = e; }
    throw lastErr || new Error('translation-failed');
  }

  function shouldTranslateNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.parentElement) return false;
    if (records.has(node)) return false;
    let el = node.parentElement;
    if (el.closest?.('#drcoach-mobile-copybar') || el.closest?.('#drcoach-mobile-pill')) return false;
    if (el.closest?.('[contenteditable="true"]')) return false;
    while (el) {
      if (EXCLUDED.has(el.tagName)) return false;
      el = el.parentElement;
    }
    const text = (node.nodeValue || '').replace(/\s+/g,' ').trim();
    if (text.length < 2 || !/[A-Za-z]/.test(text)) return false;
    if (/^[\d\s.,:;()\-–—/%+#]+$/.test(text)) return false;
    return true;
  }

  function collectTextNodes(root=document.body) {
    if (!root) return [];
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) if (shouldTranslateNode(node)) out.push(node);
    return out;
  }

  async function translateNode(node) {
    if (!shouldTranslateNode(node) || currentLanguage !== 'es') return;
    const originalRaw = node.nodeValue || '';
    const leading = originalRaw.match(/^\s*/)?.[0] || '';
    const trailing = originalRaw.match(/\s*$/)?.[0] || '';
    const original = originalRaw.trim();
    if (!original) return;
    try {
      const translated = await translateText(original);
      if (currentLanguage !== 'es' || !node.isConnected) return;
      if ((node.nodeValue || '').trim() !== original) return;
      records.set(node, { original: originalRaw, translated: leading + translated + trailing });
      node.nodeValue = leading + translated + trailing;
    } catch (e) {
      console.debug('[DrCoach Mobile Translate] node failed', e);
    }
  }

  async function translateAll() {
    if (translating || currentLanguage !== 'es') return;
    translating = true;
    postStatus('translating');
    renderPill();
    try {
      const nodes = collectTextNodes();
      let index = 0;
      async function worker() {
        while (index < nodes.length && currentLanguage === 'es') {
          const n = nodes[index++];
          await translateNode(n);
        }
      }
      await Promise.all(Array.from({length: Math.min(MAX_CONCURRENCY, Math.max(1, nodes.length))}, worker));
      if (currentLanguage === 'es') postStatus('ready');
    } catch (e) {
      postStatus('error', { message: String(e?.message || e) });
    } finally {
      translating = false;
      renderPill();
    }
  }

  function scheduleScan(delay=220) {
    clearTimeout(scanTimer);
    if (currentLanguage !== 'es') return;
    scanTimer = setTimeout(translateAll, delay);
  }

  async function setLanguage(lang) {
    if (lang === 'es') {
      currentLanguage = 'es';
      gmSetValue(LANG_KEY, 'es');
      document.documentElement.setAttribute('data-drcoach-mobile-lang','es');
      renderPill();
      await translateAll();
    } else {
      currentLanguage = 'en';
      gmSetValue(LANG_KEY, 'en');
      for (const [node, rec] of records) {
        try { if (node.isConnected && node.nodeValue === rec.translated) node.nodeValue = rec.original; } catch (_) {}
      }
      records.clear();
      document.documentElement.setAttribute('data-drcoach-mobile-lang','en');
      renderPill();
      postStatus('ready');
    }
    postReady();
  }

  async function bootTranslator() {
    try { currentLanguage = (await gmGetValue(LANG_KEY, 'en')) === 'es' ? 'es' : 'en'; } catch (_) { currentLanguage = 'en'; }
    observer = new MutationObserver(() => scheduleScan(260));
    if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    renderPill();
    showHello();
    postReady();
    if (currentLanguage === 'es') setTimeout(() => translateAll(), 350);
  }

  // --- Aviso efímero «Companion vX activo»: prueba inequívoca de que el gestor inyectó el script ---
  function showHello() {
    try {
      const t = document.createElement('div');
      t.id = 'drcoach-mobile-hello';
      t.textContent = '🧩 Companion v' + SCRIPT_VERSION + ' activo';
      (document.body || document.documentElement).appendChild(t);
      setTimeout(() => { t.classList.add('dc-fade'); setTimeout(() => { try { t.remove(); } catch (_) {} }, 700); }, 3200);
    } catch (_) {}
  }

  // --- Píldora visible «DC · Español/Original» (confirmación de que el script está vivo) ---
  let pill = null;
  function ensurePill() {
    if (pill && pill.isConnected) return pill;
    pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'drcoach-mobile-pill';
    pill.setAttribute('aria-label', 'Dr.Coach Companion: alternar traducción Español/Original');
    pill.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      setLanguage(currentLanguage === 'es' ? 'en' : 'es');
    }, true);
    (document.body || document.documentElement).appendChild(pill);
    return pill;
  }
  function renderPill() {
    if (!IS_MEDICOSPIRA) return;
    try {
      const p = ensurePill();
      const target = currentLanguage === 'es' ? 'Original' : 'Español';
      p.dataset.lang = currentLanguage;
      p.textContent = '';
      const dot = document.createElement('span'); dot.className = 'dc-dot';
      p.appendChild(dot);
      p.appendChild(document.createTextNode('DC · ' + target));
      p.setAttribute('aria-pressed', currentLanguage === 'es' ? 'true' : 'false');
    } catch (_) {}
  }

  // --- Copy assist (solo Medicospira) ---
  let lastText = '';
  let bar = null;
  function selectionText() {
    try { const s=window.getSelection(); return (!s || !s.rangeCount || s.isCollapsed) ? '' : String(s.toString()||'').replace(/\u00a0/g,' ').trim(); } catch (_) { return ''; }
  }
  function isInteractive(target) { try { return !!target?.closest?.(INTERACTIVE); } catch (_) { return false; } }
  function stopPageBlocker(ev) { if (!isInteractive(ev.target)) ev.stopPropagation(); }
  function clearInlineBlocks(root=document) {
    try {
      const nodes=root.querySelectorAll?.('[oncopy],[oncut],[onselectstart]')||[];
      for (const el of nodes) { el.removeAttribute('oncopy'); el.removeAttribute('oncut'); el.removeAttribute('onselectstart'); }
      if (document.body) { document.body.oncopy=null; document.body.oncut=null; document.body.onselectstart=null; }
      document.oncopy=null; document.oncut=null; document.onselectstart=null;
    } catch (_) {}
  }
  async function copyText(text) {
    if (!text) return false;
    try { if (GMX.clipboard && await GMX.clipboard(text)) return true; } catch (_) {}
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    try { const ta=document.createElement('textarea'); ta.value=text; ta.readOnly=true; ta.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0'; document.documentElement.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return !!ok; } catch (_) { return false; }
  }
  function sendToDrCoach(text) {
    if (!text) return;
    post('DRCOACH_MOBILE_SELECTION', { text, source:'medicospira', href:location.href });
  }
  function ensureBar() {
    if (bar?.isConnected) return bar;
    bar=document.createElement('div'); bar.id='drcoach-mobile-copybar';
    bar.innerHTML='<button type="button" data-copy>Copiar</button><button type="button" class="secondary" data-send>→ Stem</button>';
    document.documentElement.appendChild(bar);
    bar.querySelector('[data-copy]').addEventListener('click', async e=>{ e.preventDefault();e.stopPropagation();await copyText(selectionText()||lastText);hideBar(); });
    bar.querySelector('[data-send]').addEventListener('click', e=>{ e.preventDefault();e.stopPropagation();sendToDrCoach(selectionText()||lastText);hideBar(); });
    return bar;
  }
  function hideBar(){ if(bar) bar.style.display='none'; }
  function showBar(){
    const text=selectionText(); if(!text) return hideBar(); lastText=text;
    const b=ensureBar(); let rect; try{rect=window.getSelection().getRangeAt(0).getBoundingClientRect()}catch(_){return}
    const width=178, x=Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2)), y=Math.max(8,Math.min(innerHeight-56,rect.top-52));
    b.style.left=x+'px'; b.style.top=y+'px'; b.style.display='flex';
  }

  // ==================== Autodiagnóstico en Dr.Coach! (página superior) ====================
  // Vigila el botón «Español» del Workspace: si tras pulsarlo el QBank no responde,
  // muestra un aviso con los pasos exactos para arreglarlo en iPad (permisos, Safari, etc.).
  const DIAG_STYLE = `
    #drcoach-top-badge {
      position: fixed !important; z-index: 2147483647 !important;
      left: 14px !important; bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
      padding: 9px 13px !important; border-radius: 999px !important;
      background: rgba(15,24,38,.92) !important; color: #fff !important;
      border: 1px solid rgba(255,255,255,.18) !important; box-shadow: 0 10px 24px rgba(0,0,0,.30) !important;
      font: 700 12.5px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
      pointer-events: none !important; opacity: .95; transition: opacity .7s ease;
    }
    #drcoach-top-badge.dc-fade { opacity: 0; }
    #drcoach-mobile-diag {
      position: fixed !important; z-index: 2147483647 !important;
      left: 50% !important; transform: translateX(-50%) !important;
      bottom: calc(18px + env(safe-area-inset-bottom, 0px)) !important;
      max-width: min(92vw, 560px) !important;
      background: rgba(15,24,38,.96) !important; color: #fff !important;
      padding: 12px 14px !important; border-radius: 14px !important;
      border: 1px solid rgba(255,255,255,.16) !important; box-shadow: 0 16px 40px rgba(0,0,0,.35) !important;
      font: 500 13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
    }
    #drcoach-mobile-diag b { color: #fbbf24; }
    #drcoach-mobile-diag ol { margin: 6px 0 8px; padding-left: 20px; }
    #drcoach-mobile-diag li { margin: 2px 0; }
    #drcoach-mobile-diag .dc-diag-close {
      border: 0 !important; background: rgba(255,255,255,.14) !important; color: #fff !important;
      border-radius: 8px !important; padding: 6px 12px !important; font: 700 12px system-ui !important; cursor: pointer;
    }
  `;
  let lastSignalAt = 0;
  let diagShown = false;
  function showDiag() {
    if (diagShown) return;
    diagShown = true;
    try {
      injectStyle(DIAG_STYLE);
      const old = document.getElementById('drcoach-mobile-diag');
      if (old) old.remove();
      const d = document.createElement('div');
      d.id = 'drcoach-mobile-diag';
      d.setAttribute('role', 'alertdialog');
      d.setAttribute('aria-label', 'Dr.Coach Companion móvil: diagnóstico del QBank');
      d.innerHTML =
        '<b>Dr.Coach! Companion móvil</b> — el QBank no contestó al botón «Español».' +
        '<ol>' +
        '<li>Ajustes → Safari → Extensiones → tu gestor → <b>«Todos los sitios web»: Permitir</b>.</li>' +
        '<li>Cierra Safari por completo (desliza fuera) y vuelve a abrir. <b>No uses el icono de pantalla de inicio</b>: las extensiones solo corren en Safari.</li>' +
        '<li>Abre el Workspace: dentro del QBank debe verse la píldora <b>«DC · Español»</b>. Si no aparece, abre el QBank en pestaña propia (ahí sí funciona) o usa Orion + Tampermonkey.</li>' +
        '</ol>';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'dc-diag-close';
      close.textContent = 'Entendido';
      close.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); d.remove(); }, true);
      d.appendChild(close);
      (document.body || document.documentElement).appendChild(d);
      setTimeout(() => { try { d.remove(); } catch (_) {} }, 20000);
    } catch (_) {}
  }
  function bootDiagnostics() {
    // badge efímero: confirma que el gestor EJECUTA el script en la página de Dr.Coach!
    try {
      injectStyle(DIAG_STYLE);
      const b = document.createElement('div');
      b.id = 'drcoach-top-badge';
      b.textContent = '🧩 Companion v' + SCRIPT_VERSION + ' activo';
      (document.body || document.documentElement).appendChild(b);
      setTimeout(() => { b.classList.add('dc-fade'); setTimeout(() => { try { b.remove(); } catch (_) {} }, 800); }, 5200);
    } catch (_) {}
    window.addEventListener('message', ev => {
      try {
        const d = ev && ev.data;
        if (!d || typeof d !== 'object') return;
        if (d.type === 'DRCOACH_TRANSLATOR_STATUS' || d.type === 'DRCOACH_COMPANION_READY') lastSignalAt = Date.now();
      } catch (_) {}
    });
    document.addEventListener('click', ev => {
      let btn = null;
      try { btn = ev.target && ev.target.closest ? ev.target.closest('#workspaceTranslateChrome') : null; } catch (_) {}
      if (!btn) return;
      setTimeout(() => {
        if (Date.now() - lastSignalAt < 15000) return;
        showDiag();
      }, 4000);
    }, true);
    try { window.__dcMobileProbe = { get lastSignalAt() { return lastSignalAt; }, get diagShown() { return diagShown; } }; } catch (_) {}
  }

  // ==================== Arranque por rama ====================
  function bootMedicospira() {
    injectStyle(MED_STYLE);
    document.documentElement.classList.add('drcoach-copy-enabled');
    // puente con el padre (Workspace de Dr.Coach!)
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
      const d=event.data;
      if (d.type==='DRCOACH_COMPANION_PING') { postReady(); return; }
      if (d.type==='DRCOACH_TRANSLATE_REQUEST') {
        const lang=d.targetLanguage==='es'?'es':'en';
        setLanguage(lang);
      }
    });
    // bloqueadores de copia fuera
    clearInlineBlocks();
    const copyObs=new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes||[])if(n.nodeType===1)clearInlineBlocks(n)});
    if(document.documentElement)copyObs.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(clearInlineBlocks,2500);
    // barrita de selección
    window.addEventListener('pointerdown',stopPageBlocker,true);
    window.addEventListener('touchstart',stopPageBlocker,true);
    window.addEventListener('mousedown',stopPageBlocker,true);
    window.addEventListener('selectstart',stopPageBlocker,true);
    window.addEventListener('copy',ev=>{ const text=selectionText(); if(!text)return; try{ev.stopImmediatePropagation();if(ev.clipboardData){ev.clipboardData.setData('text/plain',text);ev.preventDefault()}}catch(_){} },true);
    window.addEventListener('selectionchange',()=>{clearTimeout(window.__drcoachSelTimer);window.__drcoachSelTimer=setTimeout(showBar,140)},true);
    window.addEventListener('scroll',hideBar,{passive:true,capture:true});
    // traductor + píldora
    bootTranslator();
  }

  function boot() {
    if (IS_MEDICOSPIRA) {
      bootMedicospira();
    } else if (IS_DRcoach_TOP) {
      bootDiagnostics();
    }
    // otras páginas bajo @match: nada (sin efectos secundarios)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();

  try {
    if (GMX.menu && IS_MEDICOSPIRA) {
      GMX.menu('Dr.Coach: Traducir a español',()=>setLanguage('es'));
      GMX.menu('Dr.Coach: Ver original',()=>setLanguage('en'));
    }
  } catch (_) {}
})();
