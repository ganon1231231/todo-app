/* ===================================================================
 * Dr.Coach! v3.0.0 — Supabase client loader
 * -------------------------------------------------------------------
 * Loads the user-supplied `supabase.config.js` and the Supabase JS
 * library (via ESM CDN) and exposes a single global `DrCoachCloud`.
 *
 * If config is missing or contains placeholders, the app continues
 * in local-only mode and `DrCoachCloud.ready` stays `false`.
 * =================================================================== */

(() => {
  'use strict';

  const PLACEHOLDER = /YOUR-PROJECT|YOUR-PUBLISHABLE/i;

  const state = {
    ready: false,
    enabled: false,
    supabase: null,
    config: null,
    configError: null,
    authUser: null,
  };

  function log(...args) { console.log('[DrCoachCloud]', ...args); }
  function warn(...args) { console.warn('[DrCoachCloud]', ...args); }

  // ---- Public API ----------------------------------------------------
  const api = {
    get ready() { return state.ready; },
    get enabled() { return state.enabled; },
    get supabase() { return state.supabase; },
    get config() { return state.config; },
    get user() { return state.authUser; },
    get userId() { return state.authUser?.id || null; },
    get userEmail() { return state.authUser?.email || null; },
    error: null,

    async ensureClient() {
      if (state.ready) return state.supabase;
      try {
        // 1. Load user config (script tag points at config/supabase.config.js)
        let cfg = await loadUserConfig();
        // v3.2.5: si no hay archivo de config (p. ej. en GitHub Pages, donde el
        // config real nunca se publica por seguridad), usar las credenciales que
        // el usuario guardó desde la propia app (localStorage del dispositivo).
        if (!cfg || PLACEHOLDER.test(cfg.url || '') || PLACEHOLDER.test(cfg.anonKey || '')) {
          const saved = readSetupFromLS();
          if (saved) {
            cfg = saved;
            log('Usando credenciales guardadas en este dispositivo (sin archivo de config).');
          }
        }
        if (!cfg || PLACEHOLDER.test(cfg.url || '') || PLACEHOLDER.test(cfg.anonKey || '')) {
          warn('Config missing or contains placeholders — running in local-only mode.');
          api.error = 'no-config';
          return null;
        }
        state.config = cfg;

        // 2. Load Supabase JS v2 ESM bundle
        const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
        const { createClient } = mod;
        state.supabase = createClient(cfg.url, cfg.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            storageKey: 'drcoach.supabase.auth',
            storage: window.localStorage,
            detectSessionInUrl: false,
          },
          realtime: { params: { eventsPerSecond: 2 } },
        });
        state.ready = true;
        state.enabled = true;
        log('Supabase client ready.');
        return state.supabase;
      } catch (err) {
        warn('Failed to init Supabase client:', err);
        api.error = String(err?.message || err);
        return null;
      }
    },

    async getSession() {
      if (!state.supabase) return null;
      const { data, error } = await state.supabase.auth.getSession();
      if (error) { warn('getSession error:', error.message); return null; }
      state.authUser = data?.session?.user || null;
      return data?.session || null;
    },

    async signIn(email, password) {
      const sb = await api.ensureClient();
      if (!sb) throw new Error('Supabase no inicializado');
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.authUser = data.user;
      return data.user;
    },

    async signOut() {
      if (!state.supabase) return;
      try { await state.supabase.auth.signOut(); } catch (_) {}
      state.authUser = null;
    },

    onAuthChange(cb) {
      if (!state.supabase) return () => {};
      const { data } = state.supabase.auth.onAuthStateChange((_evt, session) => {
        state.authUser = session?.user || null;
        cb(session?.user || null);
      });
      return () => data?.subscription?.unsubscribe?.();
    },
  };

  function loadUserConfig() {
    return new Promise((resolve) => {
      // The config script is loaded statically in index.html; once it
      // executes it sets window.DRCOACH_SUPABASE_CONFIG. We poll briefly
      // in case scripts load out of order.
      let tries = 0;
      const tick = () => {
        if (window.DRCOACH_SUPABASE_CONFIG) return resolve(window.DRCOACH_SUPABASE_CONFIG);
        if (tries++ > 40) return resolve(null); // ~2 s
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  // v3.2.5 — credenciales guardadas desde el panel «⚙ Conectar nube» del gate.
  // Viven SOLO en el localStorage del dispositivo: nunca en el repositorio.
  const SETUP_KEY = 'dcSupabaseSetup';
  function readSetupFromLS() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETUP_KEY) || 'null');
      if (raw && typeof raw.url === 'string' && typeof raw.anonKey === 'string') {
        return { url: raw.url.trim(), anonKey: raw.anonKey.trim() };
      }
    } catch (_) {}
    return null;
  }

  window.DrCoachCloud = api;
})();
