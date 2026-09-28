// ==UserScript==
// @name         Dr.Coach! Mobile Companion — Copy + Translate
// @namespace    drcoach.mobile
// @version      0.5.4
// @description  Traducción Español/Original de Medicospira y copia/selección desbloqueada — dentro del iframe del Workspace de Dr.Coach! o en pestaña propia. Multi-gestor: Tampermonkey/Violentmonkey/Stay y Userscripts (Safari iOS/iPadOS). Motor por lotes: ~25 textos por petición (hasta ~10× más rápido) + caché persistente + progreso real en la píldora. v0.5.4 RESTAURACIÓN: vuelve el motor EXACTO de la v0.5.0 (la era que traducía todo y rápido en el iPad) — Google gtx PRIMERO en lotes y por-texto, sin penalizaciones experimentales ni split-retry; y la píldora de la página Dr.Coach! se convierte en un punto discreto ARRASTRABLE (toca = panel de estado; ya no estorba la interfaz).
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
// @connect      clients5.google.com
// @connect      api.mymemory.translated.net
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
  const SCRIPT_VERSION = '0.5.4';
  const TARGET_LANG = 'es';
  const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single';
  // v0.5.0: motor por lotes — 1 petición traduce ~25 textos (antes: 1 petición POR nodo = lentísimo)
  const GOOGLE_DICT_URL = 'https://clients5.google.com/translate_a/t';
  const BATCH_MAX_TEXTS = 25;
  const BATCH_MAX_CHARS = 1600;
  const BATCH_WORKERS = 3;
  const SINGLE_WORKERS = 2;
  const RETRIES = 1;
  const PENALTY_MS = 60000;
  const LONGPRESS_MS = 700;
  const CACHE_PERSIST_KEY = 'drcoach-trans-cache-v1';
  const CACHE_PERSIST_MAX = 400;

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
  let lastError = null;
  let netFailures = 0;
  let lastNetToastAt = 0;
  // Circuit breaker (v0.5.0): si un proveedor da 429 se esquiva 60 s en vez de pagar su cascada en CADA texto
  let gtxPenaltyUntil = 0;
  let dictPenaltyUntil = 0;
  let pendingRetryTimer = null;
  let persistTimer = null;
  let cacheDirty = false;

  const EXCLUDED = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE','KBD','SAMP','SVG','MATH','CANVAS','IFRAME','VIDEO','AUDIO']);
  const INTERACTIVE = 'a,button,input,textarea,select,option,label,summary,[role="button"],[role="link"],[contenteditable="true"]';

  // --- Caché persistente (v0.5.0): revisitar una pregunta ya traducida = instantáneo ---
  async function loadPersistedCache() {
    try {
      const raw = await gmGetValue(CACHE_PERSIST_KEY, '');
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof k === 'string' && k.length <= 1500 && typeof v === 'string' && v) cache.set(k, v);
      }
      while (cache.size > CACHE_PERSIST_MAX) cache.delete(cache.keys().next().value);
    } catch (_) {}
  }
  function schedulePersistCache() {
    cacheDirty = true;
    if (persistTimer) return;
    persistTimer = setTimeout(persistCacheNow, 3000);
  }
  function persistCacheNow() {
    clearTimeout(persistTimer); persistTimer = null;
    if (!cacheDirty) return;
    cacheDirty = false;
    try {
      while (cache.size > CACHE_PERSIST_MAX) cache.delete(cache.keys().next().value);
      const obj = {};
      for (const [k, v] of cache) obj[k] = v;
      gmSetValue(CACHE_PERSIST_KEY, JSON.stringify(obj));
    } catch (_) {}
  }

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
    #drcoach-mobile-neterr {
      position: fixed !important; z-index: 2147483647 !important;
      left: 50% !important; transform: translateX(-50%) !important;
      bottom: calc(70px + env(safe-area-inset-bottom, 0px)) !important;
      max-width: min(92vw, 520px) !important;
      background: rgba(15,24,38,.96) !important; color: #fff !important;
      padding: 11px 13px !important; border-radius: 14px !important;
      border: 1px solid rgba(248,113,113,.5) !important; box-shadow: 0 16px 40px rgba(0,0,0,.35) !important;
      font: 500 12.5px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
      cursor: pointer; pointer-events: auto !important;
    }
    #drcoach-mobile-neterr b { color: #fca5a5; }
    #drcoach-mobile-pill[data-err="1"] .dc-dot { background: #f87171; }
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

  // Red a prueba de Orion (v0.4.2): PRIMERO fetch directo (CORS) — funciona aunque el gestor
  // tenga GM_xmlhttpRequest roto por permisos limitados (Orion iOS con «Limited runtime host
  // permissions»). GM_xmlhttpRequest queda como respaldo en carrera con timeout duro, para
  // que un gestor colgado no bloquee la cascada de proveedores.
  function netRequest(opts) {
    return (async () => {
      let fetchResult = null;
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
      try {
        const r = await fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || undefined, body: opts.data, signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' });
        const text = await r.text();
        fetchResult = { status: r.status, responseText: text };
        if (r.ok || !GMX.xhr) return fetchResult;
      } catch (fetchErr) {
        if (!GMX.xhr) throw fetchErr;
      } finally { if (timer) clearTimeout(timer); }
      // Respaldo GM (p. ej. Bing, que no permite CORS): si el gestor no responde en 8 s, se descarta.
      return await Promise.race([
        Promise.resolve().then(() => GMX.xhr(opts)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('gm-hang-timeout')), 8000))
      ]);
    })();
  }

  // --- Motor por lotes (v0.5.0): agrupa N textos en muy pocas peticiones ---
  function buildBatches(texts) {
    const batches = [];
    let cur = [], len = 0;
    for (const t of texts) {
      if (cur.length && (cur.length >= BATCH_MAX_TEXTS || len + t.length > BATCH_MAX_CHARS)) {
        batches.push(cur); cur = []; len = 0;
      }
      cur.push(t); len += t.length;
    }
    if (cur.length) batches.push(cur);
    return batches;
  }

  // clients5 (dict-chrome-ex) acepta MÚLTIPLES q= y devuelve una entrada por texto en orden — mapeo nativo 1:1
  async function googleDictBatchTranslate(texts) {
    const qs = texts.map(t => '&q=' + encodeURIComponent(t)).join('');
    const res = await netRequest({ url: GOOGLE_DICT_URL + '?client=dict-chrome-ex&sl=auto&tl=' + encodeURIComponent(TARGET_LANG) + qs });
    if (res.status !== 200) throw new Error('dict-http-' + res.status);
    let data; try { data = JSON.parse(res.responseText); } catch (_) { throw new Error('dict-parse'); }
    if (!Array.isArray(data)) throw new Error('dict-parse');
    const parts = texts.map((_, i) => {
      const e = data[i];
      if (typeof e === 'string') return e.trim();
      if (Array.isArray(e) && typeof e[0] === 'string') return e[0].trim();
      return '';
    });
    if (parts.some(p => !p)) throw new Error('dict-batch-incomplete');
    return parts;
  }

  // gtx clásico con delimitador @@@ (los símbolos sobreviven a la traducción)
  async function googleBatchTranslate(texts) {
    const joined = texts.join('\n@@@\n');
    const res = await netRequest({ url: GOOGLE_URL + '?client=gtx&sl=auto&tl=' + encodeURIComponent(TARGET_LANG) + '&dt=t&q=' + encodeURIComponent(joined) });
    if (res.status !== 200) throw new Error('google-http-' + res.status);
    let data; try { data = JSON.parse(res.responseText); } catch (_) { throw new Error('google-parse'); }
    if (!data || !Array.isArray(data[0])) throw new Error('google-parse');
    const joinedOut = data[0].map(seg => (seg && seg[0]) || '').join('');
    const parts = joinedOut.split(/\s*@@@\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length !== texts.length) throw new Error('google-batch-mismatch-' + parts.length + '-' + texts.length);
    return parts;
  }

  // Traduce un lote con cascada de proveedores + circuit breaker; devuelve Map texto→traducción
  // v0.5.4 RESTAURACIÓN del orden v0.5.0 (la era que SÍ funcionaba en el iPad del usuario):
  // Google gtx (translate.googleapis.com) PRIMERO, clients5 (dict-chrome-ex) de respaldo.
  // Fuera la reordenación experimental de v0.5.1 y las penalizaciones por racha de parse.
  async function translateBatchInto(texts) {
    let lastErr = null;
    const gtxOk = Date.now() >= gtxPenaltyUntil;
    const dictOk = Date.now() >= dictPenaltyUntil;
    const plans = [];
    if (gtxOk)  plans.push([() => googleBatchTranslate(texts), 1]);
    if (dictOk) plans.push([() => googleDictBatchTranslate(texts), 1]);
    if (!gtxOk)  plans.push([() => googleBatchTranslate(texts), 0]);
    if (!dictOk) plans.push([() => googleDictBatchTranslate(texts), 0]);
    for (const [fn, retries] of plans) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const parts = await fn();
          const out = new Map();
          texts.forEach((t, i) => out.set(t, parts[i]));
          return out;
        } catch (e) {
          lastErr = e;
          const m = String((e && e.message) || e);
          if (/google-http-429/.test(m)) gtxPenaltyUntil = Date.now() + PENALTY_MS;
          if (/dict-http-429/.test(m)) dictPenaltyUntil = Date.now() + PENALTY_MS;
        }
        if (attempt < retries) await new Promise(r => setTimeout(r, 350));
      }
    }
    throw lastErr || new Error('batch-failed');
  }

  async function googleTranslate(text) {
    const url = GOOGLE_URL + '?client=gtx&sl=auto&tl=' + encodeURIComponent(TARGET_LANG) + '&dt=t&q=' + encodeURIComponent(text);
    const res = await netRequest({ url });
    if (res.status !== 200) throw new Error('google-http-' + res.status);
    const data = JSON.parse(res.responseText);
    if (!data || !Array.isArray(data[0])) throw new Error('google-parse');
    return data[0].map(seg => seg?.[0] || '').join('').trim();
  }

  // Alternativa de Google por otro host (suele respetar CORS; salva rate-limits del gtx)
  async function googleDictTranslate(text) {
    const url = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=' + encodeURIComponent(TARGET_LANG) + '&q=' + encodeURIComponent(text);
    const res = await netRequest({ url });
    if (res.status !== 200) throw new Error('dict-http-' + res.status);
    const data = JSON.parse(res.responseText);
    let out = '';
    if (typeof data === 'string') out = data;
    else if (Array.isArray(data)) {
      if (typeof data[0] === 'string') out = data[0];
      else if (Array.isArray(data[0]) && typeof data[0][0] === 'string') out = data[0][0];
    }
    out = String(out || '').trim();
    if (!out) throw new Error('dict-parse');
    return out;
  }

  // Último recurso con CORS: MyMemory (memoria de traducción pública, límite ~500 car/petición)
  // v0.5.1: trocea textos largos por frases (antes se recortaban a 480 chars) y detecta cuota agotada.
  async function myMemoryChunk(chunk) {
    const url = 'https://api.mymemory.translated.net/get?langpair=en|' + encodeURIComponent(TARGET_LANG) + '&q=' + encodeURIComponent(chunk);
    const res = await netRequest({ url });
    if (res.status !== 200) throw new Error('mymemory-http-' + res.status);
    let data; try { data = JSON.parse(res.responseText); } catch (_) { throw new Error('mymemory-parse'); }
    const tr = data && data.responseData && data.responseData.translatedText;
    if (data && data.quotaFinished) throw new Error('mymemory-quota-agotada');
    if (!tr || /MYMEMORY WARNING/i.test(String(tr))) throw new Error('mymemory-parse');
    return String(tr).trim();
  }
  async function myMemoryTranslate(text) {
    const clean = String(text || '').slice(0, 1500);
    if (clean.length <= 480) return myMemoryChunk(clean);
    const pieces = [];
    let rest = clean;
    while (rest.length) {
      if (rest.length <= 480) { pieces.push(rest); break; }
      let cut = rest.lastIndexOf('. ', 480);
      if (cut < 200) cut = rest.lastIndexOf(' ', 480);
      if (cut < 120) cut = 480;
      pieces.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1).replace(/^\s+/, '');
    }
    const out = [];
    for (const p of pieces) out.push(await myMemoryChunk(p));
    return out.join(' ').trim();
  }

  async function getBingAuth(force=false) {
    if (!force && bingAuthCache && Date.now() - bingAuthCache.at < bingAuthCache.ttl) return bingAuthCache;
    const res = await netRequest({ url: 'https://www.bing.com/translator' });
    if (res.status !== 200) throw new Error('bing-auth-' + res.status);
    const html = res.responseText || '';
    const ig = /IG:"([^"]+)"/.exec(html);
    const iid = /data-iid="([^"]+)"/.exec(html);
    const p = /params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*\]/.exec(html)
      || /params_AbusePreventionHelper\s*=\s*\[\s*'(\d+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\]/.exec(html);
    if (!ig || !p) throw new Error('bing-auth-parse');
    bingAuthCache = { ig: ig[1], iid: iid ? iid[1] : 'translator.5028', key: p[1], token: p[2], ttl: Number(p[3]) || 3600000, at: Date.now() };
    return bingAuthCache;
  }

  async function bingTranslate(text, retried=false) {
    const a = await getBingAuth(false);
    const url = 'https://www.bing.com/ttranslatev3?isVertical=1&IG=' + encodeURIComponent(a.ig) + '&IID=' + encodeURIComponent(a.iid);
    const data = 'fromLang=auto-detect&to=es&text=' + encodeURIComponent(text) + '&token=' + encodeURIComponent(a.token) + '&key=' + encodeURIComponent(a.key);
    const res = await netRequest({ method:'POST', url, headers:{'Content-Type':'application/x-www-form-urlencoded'}, data });
    let json = null; try { json = JSON.parse(res.responseText); } catch (_) {}
    const tr = json?.[0]?.translations?.[0]?.text;
    if (res.status === 200 && tr) return String(tr).trim();
    if (!retried) { await getBingAuth(true); return bingTranslate(text, true); }
    throw new Error('bing-http-' + res.status);
  }

  async function translateText(text) {
    const key = text.trim();
    if (cache.has(key)) return cache.get(key);
    // Orden dinámico según circuit breaker: no repetir el proveedor que acaba de darnos 429
    // v0.5.4 RESTAURACIÓN del orden v0.5.0: Google gtx PRIMERO (con reintento), luego clients5, MyMemory y Bing
    const gtxOk = Date.now() >= gtxPenaltyUntil;
    const providers = gtxOk ? [
      ['google',     () => googleTranslate(key),     RETRIES],
      ['google-alt', () => googleDictTranslate(key), 0],
      ['mymemory',   () => myMemoryTranslate(key),   0],
      ['bing',       () => bingTranslate(key),       0]
    ] : [
      ['google-alt', () => googleDictTranslate(key), RETRIES],
      ['google',     () => googleTranslate(key),     0],
      ['mymemory',   () => myMemoryTranslate(key),   0],
      ['bing',       () => bingTranslate(key),       0]
    ];
    let lastErr;
    for (const [, fn, retries] of providers) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const tr = await fn();
          if (tr) { cache.set(key, tr); return tr; }
        } catch (e) {
          lastErr = e;
          const m = String((e && e.message) || e);
          if (/google-http-429/.test(m)) gtxPenaltyUntil = Date.now() + PENALTY_MS;
          if (/dict-http-429/.test(m)) dictPenaltyUntil = Date.now() + PENALTY_MS;
        }
        if (attempt < retries) await new Promise(r => setTimeout(r, 350));
      }
      if (currentLanguage !== 'es') break; // el usuario volvió al Original: cancelar
    }
    throw lastErr || new Error('translation-failed');
  }

  // Convierte errores técnicos en causas entendibles para el aviso en pantalla
  function describeNetError(e) {
    const msg = String((e && e.message) || e || 'error desconocido');
    if (/gm-hang-timeout/.test(msg)) return 'el gestor de scripts no respondió (Orion: reinstala el script y dale permiso)';
    if (/abort|timeout/i.test(msg)) return 'tiempo agotado';
    if (/http-\d{3}/i.test(msg)) return 'el servidor rechazó la petición (HTTP ' + (msg.split(/http-/i)[1] || '?') + ')';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return 'red bloqueada por el navegador';
    return msg;
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

  // Aplica a los nodos la traducción ya cacheada de un texto (progresivo: el usuario ve el resultado lote a lote)
  function applyTranslation(text, nodes) {
    const tr = cache.get(text);
    if (!tr) return false;
    for (const node of nodes) {
      try {
        if (currentLanguage !== 'es' || !node.isConnected) continue;
        const raw = node.nodeValue || '';
        if (raw.trim() !== text) continue;
        const leading = raw.match(/^\s*/)?.[0] || '';
        const trailing = raw.match(/\s*$/)?.[0] || '';
        records.set(node, { original: raw, translated: leading + tr + trailing });
        node.nodeValue = leading + tr + trailing;
      } catch (_) {}
    }
    return true;
  }

  // v0.5.1: cuando falló por rate-limit/bloqueo, reintenta solo cuando el circuit breaker expire —
  // el usuario ya no tiene que re-tocar la píldora ni recargar la pregunta.
  function scheduleRetryAfterPenalty() {
    if (pendingRetryTimer) return;
    const wait = Math.max(gtxPenaltyUntil, dictPenaltyUntil) - Date.now();
    if (wait <= 0) return;
    pendingRetryTimer = setTimeout(() => {
      pendingRetryTimer = null;
      if (currentLanguage === 'es' && !translating) scheduleScan(0);
    }, wait + 1500);
  }

  async function translateAll() {
    if (translating || currentLanguage !== 'es') return;
    translating = true;
    netFailures = 0;
    lastError = null;
    postStatus('translating', { done: 0, total: 0 });
    renderPill('…');
    try {
      const nodes = collectTextNodes();
      if (!nodes.length) { postStatus('ready'); return; }
      // Dedupe: nodos que comparten texto comparten traducción (1 texto = 1 petición, no N)
      const byText = new Map();
      for (const n of nodes) {
        const t = (n.nodeValue || '').trim();
        if (!t) continue;
        let arr = byText.get(t);
        if (!arr) byText.set(t, arr = []);
        arr.push(n);
      }
      const pending = [...byText.entries()].filter(([t]) => !cache.has(t));
      const total = byText.size;
      let done = total - pending.length; // lo ya cacheado cuenta como hecho
      const tick = () => {
        renderPill(done >= total ? '' : done + '/' + total);
        postStatus('translating', { done, total });
      };
      tick();
      const markError = e => { netFailures++; lastError = describeNetError(e); console.debug('[DrCoach Mobile Translate] failed', e); };
      // Fase A — LOTES (v0.5.0): ~25 textos por petición, 3 lotes en paralelo
      const batchable = [], individual = [];
      for (const [t] of pending) {
        if (t.includes('@@@') || t.length > 1500) individual.push(t); // el delimitador no puede colisionar
        else batchable.push(t);
      }
      const failedTexts = [];
      const batches = buildBatches(batchable);
      let bi = 0;
      async function batchWorker() {
        while (bi < batches.length && currentLanguage === 'es') {
          const texts = batches[bi++];
          try {
            const parts = await translateBatchInto(texts);
            texts.forEach((t, i) => { if (parts[i]) cache.set(t, parts[i]); });
            for (const t of texts) {
              if (cache.has(t)) { applyTranslation(t, byText.get(t) || []); done++; } // v0.5.2: progreso real
              else failedTexts.push(t);
            }
            schedulePersistCache();
          } catch (e) {
            // v0.5.4: comportamiento v0.5.0 — el lote que falla cae a la Fase B (cascada por texto)
            lastError = lastError || describeNetError(e);
            console.debug('[DrCoach Mobile Translate] batch failed', e);
            failedTexts.push(...texts);
          }
          tick();
        }
      }
      await Promise.all(Array.from({ length: Math.min(BATCH_WORKERS, Math.max(1, batches.length)) }, batchWorker));
      // Fase B — INDIVIDUALES (textos largos/peligrosos + restos de lotes fallidos): cascada clásica por texto
      const singles = individual.concat(failedTexts);
      let si = 0;
      async function singleWorker() {
        while (si < singles.length && currentLanguage === 'es') {
          const t = singles[si++];
          try { await translateText(t); applyTranslation(t, byText.get(t) || []); done++; schedulePersistCache(); }
          catch (e) { markError(e); done++; } // v0.5.2: cuenta aunque falle, si no el contador nunca llega al total
          tick();
        }
      }
      await Promise.all(Array.from({ length: Math.min(SINGLE_WORKERS, Math.max(1, singles.length)) }, singleWorker));
      if (currentLanguage === 'es') {
        if (netFailures > 0) {
          postStatus('error', { message: lastError || 'error del traductor' });
          showNetErrorToast(lastError || 'error desconocido');
          scheduleRetryAfterPenalty();
        } else {
          lastError = null;
          postStatus('ready');
        }
      }
    } catch (e) {
      lastError = describeNetError(e);
      postStatus('error', { message: lastError });
      showNetErrorToast(lastError);
    } finally {
      translating = false;
      renderPill();
      persistCacheNow();
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
    await loadPersistedCache();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistCacheNow(); });
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

  // ==================== Diagnóstico de proveedores (v0.5.1) ====================
  // Long-press en la píldora DC: prueba en vivo las 4 vías (clients5 lotes, gtx lotes, MyMemory, Bing)
  // y muestra ✅/❌ + latencia + motivo. El botón «Copiar resultado» permite pegarme el informe en el chat.
  function runProviderDiagnostics() {
    try {
      injectStyle(DIAG_STYLE);
      const old = document.getElementById('drcoach-mobile-diag');
      if (old) old.remove();
      const d = document.createElement('div');
      d.id = 'drcoach-mobile-diag';
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-label', 'Dr.Coach: diagnóstico del traductor');
      d.innerHTML = '<b>Diagnóstico del traductor</b> — probando proveedores…';
      const list = document.createElement('div');
      list.style.margin = '6px 0';
      d.appendChild(list);
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'dc-diag-close'; close.textContent = 'Cerrar';
      close.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); d.remove(); }, true);
      const copy = document.createElement('button');
      copy.type = 'button'; copy.className = 'dc-diag-close'; copy.style.marginRight = '8px'; copy.textContent = 'Copiar resultado';
      copy.addEventListener('click', async e => {
        e.preventDefault(); e.stopPropagation();
        const ok = await copyText(list.dataset.report || '(vacío)');
        copy.textContent = ok ? 'Copiado ✓' : 'No se pudo copiar';
        setTimeout(() => { copy.textContent = 'Copiar resultado'; }, 1600);
      }, true);
      const bar = document.createElement('div'); bar.style.marginTop = '8px';
      bar.appendChild(copy); bar.appendChild(close);
      d.appendChild(bar);
      (document.body || document.documentElement).appendChild(d);

      const report = [];
      const test = async (label, fn) => {
        const el = document.createElement('div');
        el.textContent = '⏳ ' + label + ' — probando…';
        list.appendChild(el);
        const t0 = Date.now();
        try {
          const out = await fn();
          const ms = Date.now() - t0;
          el.textContent = '✅ ' + label + ' — OK (' + ms + ' ms)' + (out ? ' → «' + String(out).slice(0, 40) + '»' : '');
          report.push(label + ': OK (' + ms + ' ms)');
        } catch (err) {
          const ms = Date.now() - t0;
          el.textContent = '❌ ' + label + ' — FALLO (' + ms + ' ms): ' + describeNetError(err);
          report.push(label + ': FALLO — ' + describeNetError(err));
        }
      };
      const SAMPLES = ['Chest pain', 'Fever and cough', 'Hypertension'];
      (async () => {
        await test('Google clients5 (lotes)', () => googleDictBatchTranslate(SAMPLES).then(p => p[0]));
        await test('Google gtx (lotes)', () => googleBatchTranslate(SAMPLES).then(p => p[0]));
        await test('MyMemory', () => myMemoryTranslate('Chest pain'));
        await test('Bing', () => bingTranslate('Chest pain'));
        list.dataset.report = 'Diagnóstico Dr.Coach Companion v' + SCRIPT_VERSION + ' — ' + new Date().toLocaleString() + '\n' + report.join('\n');
      })();
    } catch (_) {}
  }

  // --- Aviso visible cuando la traducción falla (p. ej. Orion con permisos limitados) ---
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
  }
  function showNetErrorToast(reason) {
    const now = Date.now();
    if (now - lastNetToastAt < 30000) return;
    lastNetToastAt = now;
    try {
      const old = document.getElementById('drcoach-mobile-neterr');
      if (old) old.remove();
      const t = document.createElement('div');
      t.id = 'drcoach-mobile-neterr';
      t.setAttribute('role', 'alert');
      t.title = 'Toca para cerrar';
      t.innerHTML = '<b>⚠ La traducción falló</b> — ' + escapeHtml(reason) + '.<br>' +
        'Mantén pulsada la píldora <b>DC</b> para ver qué proveedor falla. ' +
        'Orion: reinstala el script desde la guía iPad y dale «Permitir siempre en este sitio».';
      t.addEventListener('click', () => { try { t.remove(); } catch (_) {} }, true);
      (document.body || document.documentElement).appendChild(t);
      setTimeout(() => { try { t.remove(); } catch (_) {} }, 12000);
    } catch (_) {}
  }

  // --- Píldora visible «DC · Español/Original» (confirmación de que el script está vivo) ---
  let pill = null;
  function ensurePill() {
    if (pill && pill.isConnected) return pill;
    pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'drcoach-mobile-pill';
    pill.setAttribute('aria-label', 'Dr.Coach Companion: alternar traducción Español/Original. Mantener pulsada: diagnóstico del traductor.');
    // v0.5.1: pulsación larga (700 ms) = diagnóstico de proveedores; toque corto = alternar idioma
    let lpTimer = null;
    let lpFired = false;
    const cancelLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    pill.addEventListener('pointerdown', () => {
      lpFired = false;
      cancelLP();
      lpTimer = setTimeout(() => { lpTimer = null; lpFired = true; runProviderDiagnostics(); }, LONGPRESS_MS);
    }, true);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => pill.addEventListener(t, cancelLP, true));
    pill.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (lpFired) { lpFired = false; return; }
      setLanguage(currentLanguage === 'es' ? 'en' : 'es');
    }, true);
    (document.body || document.documentElement).appendChild(pill);
    return pill;
  }
  function renderPill(progress) {
    if (!IS_MEDICOSPIRA) return;
    try {
      const p = ensurePill();
      const target = currentLanguage === 'es' ? 'Original' : 'Español';
      p.dataset.lang = currentLanguage;
      if (lastError) p.dataset.err = '1'; else p.removeAttribute('data-err');
      p.textContent = '';
      const dot = document.createElement('span'); dot.className = 'dc-dot';
      p.appendChild(dot);
      p.appendChild(document.createTextNode(progress ? 'DC · ' + progress : 'DC · ' + target));
      p.title = lastError ? ('Último error: ' + lastError + ' — mantén pulsada la píldora para diagnóstico') : 'Mantén pulsada la píldora para diagnóstico del traductor';
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
    #drcoach-top-pill {
      position: fixed !important; z-index: 2147483647 !important;
      left: 14px !important; bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
      width: 16px !important; height: 16px !important;
      min-width: 0 !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important;
      border-radius: 50% !important; display: block !important;
      background: rgba(15,24,38,.88) !important; border: 2px solid rgba(255,255,255,.55) !important;
      box-shadow: 0 2px 10px rgba(0,0,0,.35) !important;
      cursor: grab !important; touch-action: none !important;
      opacity: .42; transition: opacity .45s ease; -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
    }
    #drcoach-top-pill:hover, #drcoach-top-pill:focus-visible, #drcoach-top-pill.dc-active { opacity: 1; }
    #drcoach-top-pill .dc-dot { display: block; width: 6px; height: 6px; margin: auto; border-radius: 50%; background: #94a3b8; }
    #drcoach-top-pill[data-state="ok"] .dc-dot { background: #34d399; }
    #drcoach-top-pill[data-state="warn"] .dc-dot { background: #fbbf24; }
    #drcoach-top-pill[data-state="warn"] { opacity: .85; animation: dcpillpulse 1.8s ease-in-out infinite; }
    @keyframes dcpillpulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,.55) !important; }
      50% { box-shadow: 0 0 0 8px rgba(251,191,36,0) !important; }
    }
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
      border-radius: 8px !important; padding: 10px 14px !important; font: 700 12.5px system-ui !important; cursor: pointer;
    }
    #drcoach-mobile-diag .dc-row { display: flex; gap: 8px; align-items: flex-start; margin: 3px 0; }
    #drcoach-mobile-diag .dc-ok { color: #34d399 !important; font-weight: 700; flex: 0 0 auto; }
    #drcoach-mobile-diag .dc-warn { color: #fbbf24 !important; font-weight: 700; flex: 0 0 auto; }
    #drcoach-mobile-diag .dc-diag-primary {
      border: 0 !important; background: #fbbf24 !important; color: #17223b !important;
      border-radius: 10px !important; padding: 13px 16px !important; font: 700 13.5px system-ui !important;
      cursor: pointer; width: 100%; margin: 10px 0 2px;
    }
    #drcoach-mobile-diag .dc-diag-actions { display: flex; gap: 8px; margin-top: 12px; }
    #drcoach-mobile-diag .dc-diag-actions .dc-diag-close { flex: 1; }
  `;
  let lastSignalAt = 0;
  let qbankCompanionVersion = '';
  let topPill = null;
  const SIGNAL_FRESH_MS = 15000;
  const QBANK_FALLBACK_URL = 'https://usmle.medicospira.com/s2/auth/login';

  function qbankFrame() {
    try { return document.getElementById('medicospiraFrame'); } catch (_) { return null; }
  }
  function qbankFresh() {
    try { return lastSignalAt > 0 && (Date.now() - lastSignalAt) < SIGNAL_FRESH_MS; } catch (_) { return false; }
  }
  function topPillState() {
    const f = qbankFrame();
    if (!f) return { state: 'idle', label: 'DC · v' + SCRIPT_VERSION };
    if (qbankFresh()) return { state: 'ok', label: 'DC · QBank ' + (qbankCompanionVersion ? 'v' + qbankCompanionVersion + ' ✓' : 'conectado ✓') };
    return { state: 'warn', label: 'DC · QBank sin responder' };
  }
  // v0.5.4: la píldora de la página Dr.Coach! pasa a ser un PUNTO discreto y ARRASTRABLE.
  // Nada de texto permanente pisando la interfaz: 16 px, semitransparente, movible a cualquier
  // esquina (posición recordada). Toque = panel de estado; el color del punto dice el estado.
  const TOP_PILL_POS_KEY = 'drcoach-top-pill-pos';
  let topPillDragged = false;
  function applyTopPillPos(x, y) {
    try {
      if (!topPill) return;
      const w = topPill.offsetWidth || 16, h = topPill.offsetHeight || 16;
      const cx = Math.max(4, Math.min(window.innerWidth - w - 4, x));
      const cy = Math.max(4, Math.min(window.innerHeight - h - 4, y));
      topPill.style.setProperty('left', cx + 'px', 'important');
      topPill.style.setProperty('top', cy + 'px', 'important');
      topPill.style.setProperty('right', 'auto', 'important');
      topPill.style.setProperty('bottom', 'auto', 'important');
    } catch (_) {}
  }
  async function restoreTopPillPos() {
    try {
      const raw = await gmGetValue(TOP_PILL_POS_KEY, '');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') applyTopPillPos(p.x, p.y);
    } catch (_) {}
  }
  function renderTopPill() {
    try {
      if (!topPill || !topPill.isConnected) {
        topPill = document.createElement('button');
        topPill.type = 'button';
        topPill.id = 'drcoach-top-pill';
        topPill.setAttribute('aria-label', 'Dr.Coach Companion: estado del QBank. Toca para abrir el panel; mantén pulsado y arrastra para moverlo.');
        topPill.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          if (topPillDragged) { topPillDragged = false; return; }
          showTopPanel();
        }, true);
        // v0.5.4: arrastre libre con puntero (táctil/ratón); toque corto sin movimiento = panel
        let dragging = false, moved = false, sx = 0, sy = 0;
        topPill.addEventListener('pointerdown', e => {
          try {
            dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
            topPill.classList.add('dc-active');
            try { topPill.setPointerCapture(e.pointerId); } catch (_) {}
          } catch (_) {}
        }, true);
        topPill.addEventListener('pointermove', e => {
          try {
            if (!dragging) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (!moved && Math.hypot(dx, dy) < 8) return;
            moved = true;
            const r = topPill.getBoundingClientRect();
            applyTopPillPos(r.left + dx, r.top + dy);
            sx = e.clientX; sy = e.clientY;
          } catch (_) {}
        }, true);
        const endDrag = () => {
          try {
            if (!dragging) return;
            dragging = false;
            topPill.classList.remove('dc-active');
            if (moved) {
              topPillDragged = true;
              const r = topPill.getBoundingClientRect();
              gmSetValue(TOP_PILL_POS_KEY, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
              setTimeout(() => { topPillDragged = false; }, 350);
            }
          } catch (_) {}
        };
        topPill.addEventListener('pointerup', endDrag, true);
        topPill.addEventListener('pointercancel', endDrag, true);
        const dot = document.createElement('span'); dot.className = 'dc-dot';
        topPill.appendChild(dot);
        (document.body || document.documentElement).appendChild(topPill);
        restoreTopPillPos();
        window.addEventListener('resize', () => {
          try {
            const r = topPill.getBoundingClientRect();
            if (r.left || r.top) applyTopPillPos(r.left, r.top);
          } catch (_) {}
        });
      }
      const st = topPillState();
      topPill.dataset.state = st.state;
      topPill.title = st.label + ' — toca para abrir el panel';
    } catch (_) {}
  }
  function openQBankInTab() {
    let url = '';
    try { const f = qbankFrame(); url = (f && f.src) || ''; } catch (_) {}
    if (!url) url = QBANK_FALLBACK_URL;
    try { return !!window.open(url, '_blank', 'noopener'); } catch (_) { return false; }
  }
  function buildTopReport() {
    const f = qbankFrame();
    return 'Informe Dr.Coach! Companion (página Dr.Coach!)\n' +
      '- Script en esta página: v' + SCRIPT_VERSION + '\n' +
      '- URL: ' + location.href + '\n' +
      '- Navegador: ' + (navigator.userAgent || '?') + '\n' +
      '- QBank (iframe): ' + (f ? 'presente' : 'no está en pantalla') + '\n' +
      '- Señal del QBank: ' + (qbankFresh() ? 'sí (hace ' + Math.max(0, Math.round((Date.now() - lastSignalAt) / 1000)) + ' s)' : 'NINGUNA') + '\n' +
      '- Companion dentro del QBank: ' + (qbankCompanionVersion ? 'v' + qbankCompanionVersion : 'desconocida (sin señal)') + '\n' +
      '- src del QBank: ' + ((f && f.src) || '?') + '\n';
  }
  function showTopPanel() {
    try {
      const old = document.getElementById('drcoach-mobile-diag');
      if (old) old.remove();
      const f = qbankFrame();
      const fresh = qbankFresh();
      const d = document.createElement('div');
      d.id = 'drcoach-mobile-diag';
      d.setAttribute('role', 'alertdialog');
      d.setAttribute('aria-label', 'Dr.Coach Companion móvil: estado del QBank y soluciones');
      d.innerHTML = '<b>Dr.Coach! Companion v' + SCRIPT_VERSION + '</b> — estado del QBank';
      const list = document.createElement('div');
      list.style.margin = '6px 0';
      const row = (ok, txt) => {
        const r = document.createElement('div');
        r.className = 'dc-row';
        const s = document.createElement('span');
        s.className = ok ? 'dc-ok' : 'dc-warn';
        s.textContent = ok ? '✅' : '⚠️';
        r.appendChild(s);
        r.appendChild(document.createTextNode(txt));
        list.appendChild(r);
      };
      row(true, 'Inyección en Dr.Coach!: activa (por eso ves esta píldora).');
      if (fresh) {
        row(true, 'QBank: conectado' + (qbankCompanionVersion ? ' (Companion v' + qbankCompanionVersion + ')' : '') + ' — usa el botón «Español» del Workspace.');
      } else if (f) {
        row(false, 'QBank: SIN SEÑAL — el gestor no ejecuta el script DENTRO del QBank (los iframes necesitan permiso aparte).');
      } else {
        row(false, 'QBank: no está en pantalla — entra al Workspace y vuelve a tocar la píldora.');
      }
      d.appendChild(list);
      if (f && !fresh) {
        const fixTitle = document.createElement('div');
        fixTitle.style.marginTop = '6px';
        fixTitle.innerHTML = '<b>Arreglo inmediato (siempre funciona)</b>';
        d.appendChild(fixTitle);
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'dc-diag-primary';
        open.textContent = '↗ Abrir QBank en pestaña propia';
        open.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          open.textContent = openQBankInTab() ? 'Abierto ✓ — busca la píldora DC abajo a la derecha' : 'No se pudo abrir: permite pop-ups para este sitio';
        }, true);
        d.appendChild(open);
        const hint = document.createElement('div');
        hint.style.cssText = 'opacity:.85; font-size:12px; margin-top:4px;';
        hint.textContent = 'En la pestaña nueva el QBank corre como página principal: el Companion SÍ se inyecta ahí. Toca la píldora DC para traducir (Español/Original).';
        d.appendChild(hint);
        const perm = document.createElement('div');
        perm.style.marginTop = '10px';
        perm.innerHTML = '<b>Para que vuelva a funcionar DENTRO del Workspace</b>' +
          '<ol style="margin:4px 0 0; padding-left:20px;">' +
          '<li>Ajustes → Safari → Extensiones → tu gestor → <b>«Todos los sitios web»: Permitir</b> (no «Preguntar»: en los iframes nunca pregunta).</li>' +
          '<li>Cierra Safari por completo (desliza fuera) y vuelve a abrir. No uses el icono de pantalla de inicio.</li>' +
          '</ol>';
        d.appendChild(perm);
      }
      const actions = document.createElement('div');
      actions.className = 'dc-diag-actions';
      const copy = document.createElement('button');
      copy.type = 'button'; copy.className = 'dc-diag-close'; copy.textContent = 'Copiar informe';
      copy.addEventListener('click', async e => {
        e.preventDefault(); e.stopPropagation();
        const ok = await copyText(buildTopReport());
        copy.textContent = ok ? 'Copiado ✓' : 'No se pudo copiar';
        setTimeout(() => { copy.textContent = 'Copiar informe'; }, 1600);
      }, true);
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'dc-diag-close'; close.textContent = 'Entendido';
      close.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); d.remove(); }, true);
      actions.appendChild(copy); actions.appendChild(close);
      d.appendChild(actions);
      (document.body || document.documentElement).appendChild(d);
    } catch (_) {}
  }
  function bootDiagnostics() {
    injectStyle(DIAG_STYLE);
    // punto discreto arrastrable = estado del QBank en vivo (refresco cada 2 s), sin estorbar la UI
    renderTopPill();
    setInterval(renderTopPill, 2000);
    window.addEventListener('message', ev => {
      try {
        const d = ev && ev.data;
        if (!d || typeof d !== 'object') return;
        // v0.5.3: solo señales del QBank real (el iframe de Medicospira) — nunca de otras ventanas
        const f = qbankFrame();
        if (!f || !ev.source || ev.source !== f.contentWindow) return;
        if (d.type === 'DRCOACH_TRANSLATOR_STATUS' || d.type === 'DRCOACH_COMPANION_READY') lastSignalAt = Date.now();
        if (d.type === 'DRCOACH_COMPANION_READY') {
          const m = /v(\d+\.\d+\.\d+)/.exec(String(d.translator || ''));
          if (m) qbankCompanionVersion = m[1];
        }
      } catch (_) {}
    });
    document.addEventListener('click', ev => {
      let btn = null;
      try { btn = ev.target && ev.target.closest ? ev.target.closest('#workspaceTranslateChrome') : null; } catch (_) {}
      if (!btn) return;
      setTimeout(() => {
        if (qbankFresh()) return;
        showTopPanel();
      }, 4000);
    }, true);
    try {
      window.__dcMobileProbe = {
        get lastSignalAt() { return lastSignalAt; },
        get qbankCompanionVersion() { return qbankCompanionVersion; },
        get state() { return topPillState().state; }
      };
    } catch (_) {}
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
    try { console.log('[DrCoach Companion] v' + SCRIPT_VERSION + ' boot →', IS_MEDICOSPIRA ? 'medicospira' : (IS_DRcoach_TOP ? 'drcoach-top' : 'otra página')); } catch (_) {}
    if (IS_MEDICOSPIRA) {
      try { bootMedicospira(); } catch (e) { console.error('[DrCoach Companion] boot error', e); }
      // v0.5.2: watchdog — si en 4 s la píldora no existe (arranque colgado a medias), se crea igualmente
      setTimeout(() => {
        try { if (!document.getElementById('drcoach-mobile-pill')) renderPill(); } catch (_) {}
      }, 4000);
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
