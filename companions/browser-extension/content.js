(() => {
  'use strict';

  const isPrimaryMedicospiraContext = window.top === window || window.parent === window.top;
  if (!isPrimaryMedicospiraContext) return;

  const SOURCE = 'en';
  const TARGET = 'es';
  const HOST_ID = 'drcoach-companion-translator';
  const originalText = new WeakMap();
  const translatedText = new WeakMap();
  const translatedNodes = new Set();
  let translator = null;
  let translating = false;
  let enabled = false;
  let internalMutation = false;
  let translateGeneration = 0;
  let observer = null;
  let scrollTimer = null;

  function postToParent(payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (_) {}
  }

  function report(status, extra = {}) {
    const payload = { type: 'DRCOACH_TRANSLATOR_STATUS', status, language: enabled ? 'es' : 'en', ...extra };
    postToParent(payload);
    if (status === 'needs-user-activation') showActivationPrompt();
    else if (status === 'ready' || status === 'error' || status === 'unsupported') hideActivationPrompt();
  }

  function isTranslatorSupported() {
    return 'Translator' in self && typeof self.Translator?.create === 'function';
  }

  async function ensureTranslator() {
    if (translator) return translator;
    if (!isTranslatorSupported()) {
      report('unsupported', { message: 'Chrome desktop 138+ requerido' });
      throw new Error('Translator API no disponible');
    }

    let availability = 'unavailable';
    try {
      availability = await Translator.availability({ sourceLanguage: SOURCE, targetLanguage: TARGET });
    } catch (err) {
      report('error', { message: err?.message || 'No se pudo comprobar el traductor' });
      throw err;
    }

    if (availability === 'unavailable') {
      report('unsupported', { message: 'Par en→es no disponible' });
      throw new Error('Traducción en→es no disponible');
    }

    try {
      translator = await Translator.create({
        sourceLanguage: SOURCE,
        targetLanguage: TARGET,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            report('downloading', { progress: Math.max(0, Math.min(100, Number(e.loaded || 0) * 100)) });
          });
        }
      });
      report('ready');
      return translator;
    } catch (err) {
      const name = String(err?.name || '');
      const msg = String(err?.message || '');
      if (/NotAllowed|user activation|activation/i.test(name + ' ' + msg)) {
        report('needs-user-activation', { message: 'Haz clic en ES dentro de Medicospira' });
      } else {
        report('error', { message: msg || name || 'No se pudo iniciar el traductor' });
      }
      throw err;
    }
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function looksTranslatable(text) {
    const t = normalizeText(text);
    if (t.length < 2) return false;
    if (!/[A-Za-z]/.test(t)) return false;
    if (/^(https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.)/i.test(t)) return false;
    if (/^[A-Z]?\d+(?:[.:/-]\d+)*$/.test(t)) return false;
    return true;
  }

  function shouldSkipParent(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest(`#${HOST_ID}`)) return true;
    if (el.closest('[data-drcoach-no-translate]')) return true;
    if (el.closest('script,style,noscript,template,svg,canvas,math,code,pre,textarea,input,[contenteditable="true"]')) return true;
    return false;
  }

  function isNearViewport(el) {
    try {
      const r = el.getBoundingClientRect();
      const pad = 900;
      return r.bottom >= -pad && r.top <= innerHeight + pad && r.right >= -pad && r.left <= innerWidth + pad;
    } catch (_) {
      return true;
    }
  }

  function collectTextNodes(root = document.body, nearViewportOnly = true) {
    if (!root) return [];
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (shouldSkipParent(parent)) return NodeFilter.FILTER_REJECT;
        if (!looksTranslatable(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (nearViewportOnly && !isNearViewport(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function splitWhitespace(raw) {
    const m1 = raw.match(/^\s*/)?.[0] || '';
    const m2 = raw.match(/\s*$/)?.[0] || '';
    return { lead: m1, core: raw.slice(m1.length, raw.length - m2.length), tail: m2 };
  }

  async function translateNode(node, generation) {
    if (!node?.isConnected || generation !== translateGeneration || !enabled) return false;
    const current = node.nodeValue || '';
    const lastTranslated = translatedText.get(node);
    if (lastTranslated && current === lastTranslated) return false;

    if (!originalText.has(node) || (lastTranslated && current !== lastTranslated && !internalMutation)) {
      originalText.set(node, current);
    }

    const sourceRaw = originalText.get(node) ?? current;
    const { lead, core, tail } = splitWhitespace(sourceRaw);
    if (!looksTranslatable(core)) return false;

    const t = await ensureTranslator();
    if (generation !== translateGeneration || !enabled) return false;
    let result;
    try {
      result = await t.translate(core);
    } catch (err) {
      report('error', { message: err?.message || 'Falló una traducción' });
      return false;
    }
    if (generation !== translateGeneration || !enabled || !node.isConnected) return false;
    const next = lead + result + tail;
    internalMutation = true;
    node.nodeValue = next;
    internalMutation = false;
    translatedText.set(node, next);
    translatedNodes.add(node);
    return true;
  }

  async function translateVisible() {
    if (!enabled || translating) return;
    translating = true;
    const generation = ++translateGeneration;
    try {
      const nodes = collectTextNodes(document.body, true);
      let done = 0;
      const total = nodes.length;
      report('translating', { progress: total ? 0 : 100 });
      for (const node of nodes) {
        if (!enabled || generation !== translateGeneration) break;
        await translateNode(node, generation);
        done++;
        if (done === total || done % 4 === 0) report('translating', { progress: total ? (done / total) * 100 : 100 });
      }
      if (enabled && generation === translateGeneration) report('ready');
    } catch (err) {
      if (enabled) report('error', { message: err?.message || 'No se pudo traducir' });
    } finally {
      translating = false;
    }
  }

  function restoreEnglish() {
    enabled = false;
    translateGeneration++;
    internalMutation = true;
    for (const node of translatedNodes) {
      if (!node?.isConnected) continue;
      const original = originalText.get(node);
      if (typeof original === 'string') node.nodeValue = original;
    }
    internalMutation = false;
    translatedNodes.clear();
    report('ready');
    chrome.storage.local.set({ drcoachMedicospiraLanguage: 'en' }).catch(() => {});
  }

  async function enableSpanish(fromDirectClick = false) {
    enabled = true;
    chrome.storage.local.set({ drcoachMedicospiraLanguage: 'es' }).catch(() => {});
    try {
      await ensureTranslator();
      await translateVisible();
    } catch (err) {
      enabled = false;
      if (!fromDirectClick) report('needs-user-activation', { message: 'Haz clic en ES dentro de Medicospira' });
    }
  }

  function scheduleTranslation() {
    if (!enabled) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => translateVisible(), 180);
  }

  function startObserver() {
    observer = new MutationObserver((mutations) => {
      if (internalMutation || !enabled) return;
      let relevant = false;
      for (const m of mutations) {
        if (m.type === 'characterData') {
          const n = m.target;
          const last = translatedText.get(n);
          if (last && n.nodeValue === last) continue;
          if (!shouldSkipParent(n.parentElement) && looksTranslatable(n.nodeValue)) {
            originalText.set(n, n.nodeValue || '');
            translatedText.delete(n);
            relevant = true;
          }
        } else if (m.type === 'childList' && m.addedNodes.length) {
          relevant = true;
        }
        if (relevant) break;
      }
      if (relevant) scheduleTranslation();
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    addEventListener('scroll', scheduleTranslation, { passive: true });
  }

  function showActivationPrompt() {
    // Only shown when Chrome explicitly requires a click inside the Medicospira frame.
    // It is never a persistent translation widget.
    let host = document.getElementById(HOST_ID);
    if (host) return;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-drcoach-no-translate', 'true');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        .prompt{position:fixed;right:16px;top:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:8px 9px 8px 11px;border-radius:12px;background:rgba(15,29,48,.96);border:1px solid rgba(255,255,255,.16);box-shadow:0 12px 34px rgba(0,0,0,.24);backdrop-filter:blur(12px);font:650 11px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f5f8fc;user-select:none}
        .prompt span{opacity:.82;white-space:nowrap}
        button{appearance:none;border:0;border-radius:8px;padding:7px 10px;background:#edf4ff;color:#153d72;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
        button:hover{background:#fff}
      </style>
      <div class="prompt" role="status"><span>Chrome necesita una activación única</span><button id="activate" type="button">Activar español</button></div>`;
    document.documentElement.appendChild(host);
    shadow.getElementById('activate').addEventListener('click', async () => {
      await enableSpanish(true);
      if (enabled) hideActivationPrompt();
    });
  }

  function hideActivationPrompt() {
    document.getElementById(HOST_ID)?.remove();
  }

  function onMessage(event) {
    const data = event?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'DRCOACH_COMPANION_PING') {
      postToParent({ type: 'DRCOACH_COMPANION_READY', language: enabled ? 'es' : 'en', supported: isTranslatorSupported() });
      return;
    }
    if (data.type === 'DRCOACH_TRANSLATE_REQUEST') {
      if (data.targetLanguage === 'en') restoreEnglish();
      else if (data.targetLanguage === 'es') enableSpanish(false);
    }
  }

  window.addEventListener('message', onMessage);
  startObserver();
  postToParent({ type: 'DRCOACH_COMPANION_READY', language: 'en', supported: isTranslatorSupported() });

  chrome.storage.local.get('drcoachMedicospiraLanguage').then((r) => {
    if (r?.drcoachMedicospiraLanguage === 'es') {
      report('needs-user-activation', { message: 'Chrome requiere una activación única dentro de Medicospira' });
    }
  }).catch(() => {});
})();
