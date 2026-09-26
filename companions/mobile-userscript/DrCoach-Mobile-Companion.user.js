// ==UserScript==
// @name         Dr.Coach! Mobile Companion — Copy + Translate
// @namespace    drcoach.mobile
// @version      0.2.0
// @description  Habilita selección/copia en Medicospira y traducción Español/Original dentro del iframe de Dr.Coach! en Android/Edge/Tampermonkey.
// @match        https://usmle.medicospira.com/*
// @run-at       document-start
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @connect      www.bing.com
// ==/UserScript==

(() => {
  'use strict';

  const LANG_KEY = 'drcoach-mobile-language';
  const TARGET_LANG = 'es';
  const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single';
  const MAX_CONCURRENCY = 4;
  const RETRIES = 2;
  const records = new Map(); // Text -> { original, translated }
  const cache = new Map();
  let currentLanguage = 'en';
  let translating = false;
  let scanTimer = null;
  let observer = null;
  let bingAuthCache = null;

  const EXCLUDED = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE','KBD','SAMP','SVG','MATH','CANVAS','IFRAME','VIDEO','AUDIO']);
  const INTERACTIVE = 'a,button,input,textarea,select,option,label,summary,[role="button"],[role="link"],[contenteditable="true"]';

  const COPY_STYLE = `
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
  `;

  function addStyle(css) {
    try { if (typeof GM_addStyle === 'function') return GM_addStyle(css); } catch (_) {}
    const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s);
  }
  addStyle(COPY_STYLE);
  document.documentElement.classList.add('drcoach-copy-enabled');

  function post(type, payload={}) {
    if (window.parent === window) return;
    try { window.parent.postMessage({ type, ...payload }, '*'); } catch (_) {}
  }
  function postStatus(status, extra={}) {
    post('DRCOACH_TRANSLATOR_STATUS', { status, language: currentLanguage, ...extra });
  }
  function postReady() {
    post('DRCOACH_COMPANION_READY', { language: currentLanguage, mobile: true, translator: 'drcoach-mobile-v0.2' });
  }

  function gmRequest(opts) {
    return new Promise((resolve, reject) => {
      try {
        GM_xmlhttpRequest({
          method: opts.method || 'GET', url: opts.url, headers: opts.headers || {}, data: opts.data,
          timeout: 30000,
          onload: resolve,
          onerror: () => reject(new Error('network')),
          ontimeout: () => reject(new Error('timeout'))
        });
      } catch (e) { reject(e); }
    });
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
    if (el.closest?.('#drcoach-mobile-copybar')) return false;
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
      try { GM_setValue(LANG_KEY, 'es'); } catch (_) {}
      document.documentElement.setAttribute('data-drcoach-mobile-lang','es');
      await translateAll();
    } else {
      currentLanguage = 'en';
      try { GM_setValue(LANG_KEY, 'en'); } catch (_) {}
      for (const [node, rec] of records) {
        try { if (node.isConnected && node.nodeValue === rec.translated) node.nodeValue = rec.original; } catch (_) {}
      }
      records.clear();
      document.documentElement.setAttribute('data-drcoach-mobile-lang','en');
      postStatus('ready');
    }
    postReady();
  }

  function bootTranslator() {
    try { currentLanguage = GM_getValue(LANG_KEY, 'en') === 'es' ? 'es' : 'en'; } catch (_) { currentLanguage = 'en'; }
    observer = new MutationObserver(() => scheduleScan(260));
    if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    postReady();
    if (currentLanguage === 'es') setTimeout(() => translateAll(), 350);
  }

  // --- Copy assist ---
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
    try { if (typeof GM_setClipboard==='function') { GM_setClipboard(text,'text'); return true; } } catch (_) {}
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

  window.addEventListener('pointerdown',stopPageBlocker,true);
  window.addEventListener('touchstart',stopPageBlocker,true);
  window.addEventListener('mousedown',stopPageBlocker,true);
  window.addEventListener('selectstart',stopPageBlocker,true);
  window.addEventListener('copy',ev=>{ const text=selectionText(); if(!text)return; try{ev.stopImmediatePropagation();if(ev.clipboardData){ev.clipboardData.setData('text/plain',text);ev.preventDefault()}}catch(_){} },true);
  window.addEventListener('selectionchange',()=>{clearTimeout(window.__drcoachSelTimer);window.__drcoachSelTimer=setTimeout(showBar,140)},true);
  window.addEventListener('scroll',hideBar,{passive:true,capture:true});

  // --- Dr.Coach parent bridge ---
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
    const d=event.data;
    if (d.type==='DRCOACH_COMPANION_PING') { postReady(); return; }
    if (d.type==='DRCOACH_TRANSLATE_REQUEST') {
      const lang=d.targetLanguage==='es'?'es':'en';
      setLanguage(lang);
    }
  });

  try {
    if (typeof GM_registerMenuCommand==='function') {
      GM_registerMenuCommand('Dr.Coach: Traducir a español',()=>setLanguage('es'));
      GM_registerMenuCommand('Dr.Coach: Ver original',()=>setLanguage('en'));
    }
  } catch (_) {}

  function boot() {
    clearInlineBlocks();
    const copyObs=new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes||[])if(n.nodeType===1)clearInlineBlocks(n)});
    if(document.documentElement)copyObs.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(clearInlineBlocks,2500);
    bootTranslator();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
