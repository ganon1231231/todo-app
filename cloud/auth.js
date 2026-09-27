/* ===================================================================
 * Dr.Coach! v3.0.0 — Authentication + login overlay
 * -------------------------------------------------------------------
 * Shows a fullscreen login overlay over the existing app shell when
 * no Supabase session is available. Allows sign-in for the two
 * pre-registered users. Public registration is intentionally NOT
 * offered.
 *
 * If DrCoachCloud is disabled (no config / offline), the overlay
 * falls back to a "Local-only" gateway that lets the user proceed
 * without sync, preserving full v2.6.7 behaviour.
 * =================================================================== */

(() => {
  'use strict';

  const CLOUD = window.DrCoachCloud;
  if (!CLOUD) { console.error('DrCoachAuth requires DrCoachCloud.'); return; }

  const STATE = { ready: false, gateDeferred: null };

  // ---- DOM helpers --------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) n.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return n;
  }

  // ---- Overlay rendering --------------------------------------------
  // v3.0.0: logo embebido como data URL para que cargue en el single-file Portable
  // y no dependa de la carpeta assets/.
  const LOGO_DATA_URL = (typeof window.DRCOACH_LOGO_DATA_URL === 'string' && window.DRCOACH_LOGO_DATA_URL)
    ? window.DRCOACH_LOGO_DATA_URL
    : 'assets/img/drcoach-logo.webp';

  function buildOverlay() {
    const cfg = CLOUD.config || {};
    // v3.2.5: si no hay credenciales en ningún sitio (repo sin config, p. ej. GitHub
    // Pages), la puerta se muestra igual con la pestaña «⚙ Conectar nube» activa.
    const needsSetup = CLOUD.error === 'no-config';

    const overlay = el('div', { id: 'dcAuthOverlay', class: 'dc-auth-overlay' });
    overlay.innerHTML = `
      <div class="dc-auth-card" role="dialog" aria-modal="true" aria-label="Iniciar sesión">
        <div class="dc-auth-brand">
          <img src="${LOGO_DATA_URL}" alt="Dr.Coach!" class="dc-auth-logo" />
          <h1>Dr.Coach!</h1>
          <p class="dc-auth-tagline">Local-first · Cloud Sync</p>
        </div>

        <div class="dc-auth-mode-switch" id="dcAuthModeSwitch">
          <button type="button" class="dc-auth-tab${needsSetup ? '' : ' active'}" data-mode="login">Iniciar sesión</button>
          <button type="button" class="dc-auth-tab" data-mode="local">Solo local</button>
          ${needsSetup ? '<button type="button" class="dc-auth-tab active" data-mode="setup">⚙ Conectar nube</button>' : ''}
        </div>

        <form id="dcAuthLoginForm" class="dc-auth-form"${needsSetup ? ' hidden' : ''}>
          <label class="dc-auth-field">
            <span>Correo</span>
            <input id="dcAuthEmail" type="email" autocomplete="username" required
                   placeholder="usuario@drcoach.local" />
          </label>
          <label class="dc-auth-field">
            <span>Contraseña</span>
            <input id="dcAuthPassword" type="password" autocomplete="current-password" required
                   placeholder="••••••••" />
          </label>
          <label class="dc-auth-remember">
            <input type="checkbox" id="dcAuthRemember" />
            <span>Recordar usuario y contraseña en este dispositivo</span>
          </label>
          <button type="submit" class="dc-auth-submit" id="dcAuthSubmit">
            <span class="dc-auth-submit-label">Entrar</span>
            <span class="dc-auth-submit-spinner" hidden>⏳</span>
          </button>
          <p class="dc-auth-error" id="dcAuthError" hidden></p>
        </form>

        <div id="dcAuthLocalPanel" class="dc-auth-form dc-auth-local" hidden>
          <p>Trabajarás sin sincronización en la nube. Tus datos se guardan exclusivamente en este dispositivo, igual que en Dr.Coach! v2.6.7.</p>
          <p class="dc-auth-warning">Si más adelante configuras Supabase, podrás iniciar sesión y sincronizar el progreso local a tu cuenta.</p>
          <button type="button" class="dc-auth-submit" id="dcAuthLocalEnter">Entrar en modo local</button>
        </div>

        ${needsSetup ? `
        <div id="dcAuthSetupPanel" class="dc-auth-form dc-auth-local">
          <p>Este sitio no incluye el archivo de credenciales de Supabase (no se publica por seguridad). Pégalas aquí y quedarán guardadas <b>solo en este dispositivo</b>: la app entrará en modo nube con tu cuenta siempre.</p>
          <label class="dc-auth-field">
            <span>Project URL</span>
            <input id="dcSetupUrl" type="url" autocomplete="off" spellcheck="false"
                   placeholder="https://TU-PROYECTO.supabase.co" />
          </label>
          <label class="dc-auth-field">
            <span>Clave anónima (anon public)</span>
            <input id="dcSetupKey" type="text" autocomplete="off" spellcheck="false"
                   placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6…" />
          </label>
          <p class="dc-auth-hint">En Supabase: <b>Project Settings → API &amp; Keys</b> → «Project URL» y «anon public». La anon key es la clave pública del navegador — nunca pegues la <i>service_role</i>.</p>
          <button type="button" class="dc-auth-submit" id="dcSetupSave">Guardar y conectar</button>
          <p class="dc-auth-error" id="dcSetupError" hidden></p>
        </div>` : ''}

        <p class="dc-auth-footer">
          El registro público está deshabilitado. Las cuentas se crean manualmente
          desde el panel de Supabase.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
    bindOverlay(overlay);
    return overlay;
  }

  function bindOverlay(overlay) {
    const switchEl = $('#dcAuthModeSwitch', overlay);
    const loginForm = $('#dcAuthLoginForm', overlay);
    const localPanel = $('#dcAuthLocalPanel', overlay);
    const setupPanel = $('#dcAuthSetupPanel', overlay);
    const errorEl = $('#dcAuthError', overlay);
    const submitBtn = $('#dcAuthSubmit', overlay);
    const submitLabel = $('.dc-auth-submit-label', submitBtn);
    const submitSpinner = $('.dc-auth-submit-spinner', submitBtn);

    switchEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.dc-auth-tab');
      if (!btn) return;
      $$('.dc-auth-tab', switchEl).forEach(b => b.classList.toggle('active', b === btn));
      const mode = btn.dataset.mode;
      loginForm.hidden = mode !== 'login';
      localPanel.hidden = mode !== 'local';
      if (setupPanel) setupPanel.hidden = mode !== 'setup';
      errorEl.hidden = true;
    });

    // v3.2.5 — guardar credenciales desde la propia app (solo localStorage)
    const setupSave = $('#dcSetupSave', overlay);
    if (setupSave) {
      setupSave.addEventListener('click', () => {
        const errEl = $('#dcSetupError', overlay);
        const url = ($('#dcSetupUrl', overlay).value || '').trim().replace(/\/+$/, '');
        const key = ($('#dcSetupKey', overlay).value || '').trim();
        errEl.hidden = true;
        if (!/^https:\/\/[a-z0-9.-]+/i.test(url) || /YOUR-PROJECT/i.test(url)) {
          errEl.textContent = 'La URL debe ser https://… (ej: https://xxxx.supabase.co).';
          errEl.hidden = false;
          return;
        }
        if (key.length < 30 || /YOUR-PUBLISHABLE/i.test(key)) {
          errEl.textContent = 'Pega la clave anónima completa (anon public), empieza por eyJ…';
          errEl.hidden = false;
          return;
        }
        try {
          localStorage.setItem('dcSupabaseSetup', JSON.stringify({ url, anonKey: key }));
        } catch (_) {
          errEl.textContent = 'Este navegador no permite guardar (modo privado).';
          errEl.hidden = false;
          return;
        }
        setupSave.disabled = true;
        setupSave.textContent = 'Conectando…';
        location.reload();
      });
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // v3.2.5: sin credenciales todavía → llevar al panel de conexión
      if (!CLOUD.enabled && CLOUD.error === 'no-config' && setupPanel) {
        // v3.2.6: cambiar de pestaña ANTES de mostrar el aviso (el handler de
        // pestañas oculta los errores; así el mensaje queda visible).
        const tab = switchEl.querySelector('[data-mode="setup"]');
        if (tab) tab.click();
        errorEl.textContent = 'Conecta tu Supabase primero en «⚙ Conectar nube».';
        errorEl.hidden = false;
        return;
      }
      errorEl.hidden = true;
      submitBtn.disabled = true;
      submitLabel.textContent = 'Entrando…';
      submitSpinner.hidden = false;
      try {
        const email = $('#dcAuthEmail', overlay).value.trim();
        const password = $('#dcAuthPassword', overlay).value;
        await CLOUD.signIn(email, password);
        closeOverlay();
        if (typeof window.DrCoachOnAuth === 'function') window.DrCoachOnAuth(CLOUD.user);
      } catch (err) {
        errorEl.textContent = friendlyAuthError(err);
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitLabel.textContent = 'Entrar';
        submitSpinner.hidden = true;
      }
    });

    $('#dcAuthLocalEnter', overlay).addEventListener('click', () => {
      closeOverlay();
      if (typeof window.DrCoachOnAuth === 'function') window.DrCoachOnAuth(null);
    });

    // v3.0.0: "Recordar usuario y contraseña" — persistencia local opcional
    const REMEMBER_KEY = 'drcoach.auth.remember';
    const emailInput = $('#dcAuthEmail', overlay);
    const passInput  = $('#dcAuthPassword', overlay);
    const rememberCb = $('#dcAuthRemember', overlay);

    // Cargar credenciales guardadas (si existen)
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
      if (saved && saved.email) {
        emailInput.value = saved.email;
        if (saved.password) {
          passInput.value = saved.password;
          rememberCb.checked = true;
        }
      }
    } catch (_) {}

    // Al hacer submit, decidir si guardamos o borramos las credenciales
    const originalSubmit = loginForm.onsubmit;
    loginForm.addEventListener('submit', () => {
      // Se ejecuta ANTES del handler async original (que es el que hace signIn).
      // Usamos setTimeout 0 para preservar el orden: primero guardamos, luego signIn.
      setTimeout(() => {
        const email = emailInput.value.trim();
        const password = passInput.value;
        if (rememberCb.checked && email && password) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      }, 0);
    }, { capture: true });
  }

  function closeOverlay() {
    const ov = document.getElementById('dcAuthOverlay');
    if (ov) ov.remove();
  }

  function escapeHTML(s = '') {
    return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
  }

  function friendlyAuthError(err) {
    const msg = String(err?.message || err || '');
    if (/invalid login credentials|invalid email or password/i.test(msg)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(msg)) return 'El correo no ha sido confirmado. Revisa la bandeja de entrada.';
    if (/rate limit|too many requests/i.test(msg)) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    if (/network|fetch|Failed to fetch/i.test(msg)) return 'Sin conexión a Supabase. Verifica tu conexión o entra en modo local.';
    return 'No se pudo iniciar sesión: ' + msg;
  }

  // ---- Public gate ---------------------------------------------------
  /**
   * Returns the authenticated user, or null if the user chose to
   * proceed in local-only mode. If no session exists, shows the
   * login overlay and resolves once the user has either logged in
   * or chosen local mode.
   */
  function gate() {
    return new Promise(async (resolve) => {
      await CLOUD.ensureClient();
      if (!CLOUD.enabled) {
        // v3.2.5: sin credenciales pero conectables → puerta con «⚙ Conectar nube».
        if (CLOUD.error === 'no-config') {
          STATE.gateDeferred = resolve;
          window.DrCoachOnAuth = (user) => {
            STATE.gateDeferred = null;
            if (user) resolve({ user, mode: 'cloud' });
            else resolve({ user: null, mode: 'local' });
          };
          buildOverlay();
          return;
        }
        // Sin config Y sin conexión → modo local directo (comportamiento previo)
        resolve({ user: null, mode: 'local' });
        return;
      }
      const session = await CLOUD.getSession();
      if (session?.user) {
        resolve({ user: session.user, mode: 'cloud' });
        return;
      }
      // Show overlay; resolve once user logs in or picks local
      STATE.gateDeferred = resolve;
      window.DrCoachOnAuth = (user) => {
        STATE.gateDeferred = null;
        if (user) resolve({ user, mode: 'cloud' });
        else resolve({ user: null, mode: 'local' });
      };
      buildOverlay();
    });
  }

  async function logout() {
    await CLOUD.signOut();
    location.reload();
  }

  window.DrCoachAuth = { gate, logout, closeOverlay, get user() { return CLOUD.user; } };
})();
