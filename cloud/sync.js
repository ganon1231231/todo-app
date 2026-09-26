/* ===================================================================
 * Dr.Coach! v3.0.4 — Sync Engine
 * -------------------------------------------------------------------
 * Pull / Push / Background sync between IndexedDB (local) and
 * Supabase (cloud). Designed for two users, no realtime collab.
 *
 * v3.0.4 · Engine hardening (fixes the lingering "⚠ Error de sync"):
 *   • Every pull/push now refreshes the access token BEFORE running
 *     (the old code fired requests with an expired JWT after the
 *     device slept → 401 → "Error de sync").
 *   • pull() retries itself up to 2× after transient failures, and the
 *     45 s poller re-pulls every 3rd tick — one failed boot pull no
 *     longer sticks the error label for the whole session, and changes
 *     made on the OTHER device arrive without reloading.
 *   • Auth failures get their own status "auth" ("⚠ Sesión expirada")
 *     instead of being reported as connectivity problems.
 *
 * Strategy:
 *   • Pull  — fetch all rows for current user from cloud, upsert into
 *             IndexedDB; only newer rows overwrite local (last-write-wins
 *             by `updated_at`).
 *   • Push  — drain local `pending_syncs` queue: for each pending op,
 *             upsert (or delete) the entity in Supabase, then remove
 *             the queue entry.
 *   • Background — every 45 s, if online + authed + queue non-empty,
 *                  run Push.
 *
 * Visual indicator (window.DrCoachSyncIndicator):
 *   states: idle | saving | syncing | pending | offline | local
 * =================================================================== */

(() => {
  'use strict';

  const CLOUD = window.DrCoachCloud;
  const DB = window.DrCoachDB || window.MediospiraDB;
  if (!CLOUD || !DB) { console.error('DrCoachSync requires DrCoachCloud + DrCoachDB.'); return; }

  const QUEUE_STORE = 'pending_syncs';   // {id, table, op:'upsert'|'delete', payload, ts}
  const SYNCED_AT_KEY = 'drcoach.lastSyncAt'; // localStorage
  const DLQ_KEY = 'drcoach.sync.dlq';   // localStorage dead-letter queue

  // v3.0.3 · Column whitelist — the ONLY columns each cloud table accepts.
  // Uploading a row built from the local IndexedDB schema with a whitelist
  // guarantees PostgREST never sees a camelCase/legacy field again.
  // (The old blacklist-based sanitizer let `updatedAt` slip through on any
  // edited attempt → Supabase rejected the upsert with PGRST204 "Could not
  // find the 'updatedAt' column" → permanent "Error de sync".)
  const CLOUD_COLUMNS = {
    attempts: [
      'id', 'session_id', 'question_id', 'subject', 'system', 'topic', 'focus',
      'result', 'confidence', 'stem', 'key_concept', 'memory_rule', 'notes',
      'error_reasons', 'attachment_ids', 'board_attachment_id',
      'study_board_id', 'study_board', 'is_review', 'mastered',
      'review_events', 'ordinal', 'created_at', 'updated_at',
    ],
    sessions: [
      'id', 'subject', 'planned_count', 'completed_count', 'elapsed_sec',
      'paused', 'running_since', 'started_at', 'ended_at', 'status',
      'created_at', 'updated_at',
    ],
    canvas_objects: [
      'id', 'board_id', 'attempt_id', 'type', 'data', 'z_index',
      'created_at', 'updated_at',
    ],
  };

  const TABLES = ['attempts', 'sessions', 'canvas_objects'];
  // Settings: only sync the white-listed subset. Everything else stays local.
  const SYNCED_SETTINGS_KEYS = new Set([
    'dailyGoal', 'deadline', 'trackerStartDate', 'schemaVersion', 'themeMode',
    // Add anything else that should follow the user across devices here.
  ]);
  const LOCAL_ONLY_SETTINGS_KEYS = new Set([
    'focusDockVisible', 'focusCustomLinks', 'focusVolume', 'focusPlaying',
    'focusCurrentTrack', 'focusRepeatMode', 'focusShuffleMode', 'focusQueue',
    // These are device-specific (radio / music / volume / player state).
  ]);

  const POLL_INTERVAL_MS = 45000;
  const PULL_EVERY_TICKS = 3;          // v3.0.4: auto re-pull ≈ every 2 min
  const PULL_RETRY_DELAY_MS = 4000;    // v3.0.4: first transient retry
  const PULL_RETRY_MAX = 2;            // v3.0.4: 2 automatic retries per burst
  const TOKEN_MARGIN_MS = 60000;       // v3.0.4: refresh JWT 60 s before expiry
  // v3.0.5 · Anti-wedge: NO network call may hold a sync operation forever.
  const NET_TIMEOUT_MS = 30000;        // per-request cap (pull selects, upserts…)
  const AUTH_TIMEOUT_MS = 15000;       // session/refresh cap
  const RUNNING_WATCHDOG_MS = 90000;   // if running=true beyond this, force-release

  const state = {
    status: 'idle',
    running: false,
    online: navigator.onLine,
    pullAt: 0,
    lastError: null,
    lastErrorKind: null, // v3.0.4: 'network' | 'auth' | 'supabase' | null
    indicator: null, // updated via setStatus
    tickCount: 0,
    pullRetries: 0,
    pullRetryTimer: null,
    runningWatchdog: null, // v3.0.5
    stuckCount: 0,         // v3.0.5: hung operations recovered by the watchdog
  };

  // v3.0.4 · One place decides WHY a request failed, so the indicator can
  // say "Sin conexión" (your internet), "Sesión expirada" (log in again)
  // or "Error de sync" (Supabase rejected something) truthfully.
  function classifyError(msg) {
    const m = String(msg || '');
    if (/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|network|load failed/i.test(m)) return 'network';
    if (/JWT|jwt expired|invalid JWT|PGRST301|PGRST302|401\b|invalid refresh token|session missing|Invalid API key|signature|expired/i.test(m)) return 'auth';
    return 'supabase';
  }

  // v3.0.5 · supabase-js requests have NO built-in timeout. A single hung
  // request (mobile network switch, laptop sleeping mid-request…) left
  // state.running = true FOREVER: every later push()/pull() silently
  // returned "busy" and the upload queue never drained again (the classic
  // "N cambio(s) pendientes" with DLQ empty and no error anywhere).
  // Every network await now goes through withTimeout(); the watchdog
  // (below) is the last-resort self-heal.
  function withTimeout(promise, ms, label = 'Red') {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        // "NetworkTimeout" is matched by classifyError() → 'network'.
        reject(new Error(`NetworkTimeout: ${label} no respondió en ${Math.round(ms / 1000)} s`));
      }, ms);
      Promise.resolve(promise).then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });
  }

  // v3.0.5 · Self-heal: an auth event can momentarily null CLOUD.user (e.g.
  // a failed token refresh fires with session=null). The old code then
  // silently skipped EVERY push/pull while the Sync Doctor — which calls
  // getSession() itself — kept reporting "Sesión ✓". If the user is missing
  // but the client is enabled, try to recover the session once.
  async function ensureUser() {
    if (CLOUD.user) return true;
    if (!CLOUD.enabled) return false;
    try {
      const s = await withTimeout(CLOUD.getSession(), AUTH_TIMEOUT_MS, 'getSession');
      return !!(s?.user);
    } catch (_) { return false; }
  }

  // v3.0.5 · Last-resort guard: if state.running stays true for >90 s
  // something wedged despite the timeouts — release it so sync resumes.
  function armRunningWatchdog() {
    clearTimeout(state.runningWatchdog);
    state.runningWatchdog = setTimeout(() => {
      state.runningWatchdog = null;
      if (!state.running) return;
      state.running = false;
      state.stuckCount++;
      console.warn('[DrCoachSync] watchdog: una operación llevaba >90 s colgada; motor liberado.');
      setStatus('error', { error: 'supabase', lastError: 'Una operación de sync se quedó colgada y fue reiniciada (watchdog).' });
      refreshPendingCount();
    }, RUNNING_WATCHDOG_MS);
  }
  function disarmRunningWatchdog() {
    clearTimeout(state.runningWatchdog);
    state.runningWatchdog = null;
  }

  function setStatus(s, meta = {}) {
    const KIND_TAGS = { supabase: 1, auth: 1, network: 1 };
    state.lastError = meta?.lastError || (KIND_TAGS[meta?.error] ? null : meta?.error) || null;
    state.lastErrorKind = s === 'error' ? 'supabase' : (s === 'auth' ? 'auth' : (s === 'offline' ? (meta?.error === 'auth' ? 'auth' : 'network') : null));
    return rawSetStatus(s, meta);
  }
  // original setStatus from v3.0.3 (renamed so the wrapper above can enrich it)
  function rawSetStatus(s, meta = {}) {
    state.status = s;
    const indicator = state.indicator || window.DrCoachSyncIndicator;
    if (indicator && typeof indicator.update === 'function') {
      indicator.update(s, meta);
    }
    document.dispatchEvent(new CustomEvent('drcoach:sync-status', { detail: { status: s, ...meta } }));
  }

  // ---------- queue helpers (IndexedDB via DrCoachDB) ----------------
  // We piggy-back on the existing object stores. The pending_syncs
  // store is created lazily the first time we need it.

  async function ensureQueueStore() {
    return DB.ensureStore ? DB.ensureStore(QUEUE_STORE, { keyPath: 'id' }) : null;
  }

  async function enqueue(table, op, payload) {
    await ensureQueueStore();
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random().toString(36).slice(2)) + Date.now());
    const entry = { id, table, op, payload, ts: Date.now() };
    // v3.0.5 · Dedupe: ONE pending entry per table+op+row. "Subir todo a la
    // nube" re-enqueues every local row on each press — pressing it twice
    // (or across versions) used to STACK duplicate entries, inflating the
    // "Cola de subida" counter with rows that were already in the cloud.
    try {
      const existing = await DB.getAll(QUEUE_STORE);
      const dup = existing.find(e => e && e.table === table && e.op === op &&
        (op === 'settings' || String(e.payload?.id) === String(payload?.id)));
      if (dup) {
        // Replace with the newest payload; keep the failure history.
        await DB.put(QUEUE_STORE, { ...dup, payload: entry.payload, ts: entry.ts });
        refreshPendingCount();
        return;
      }
    } catch (_) { /* dedupe is best-effort; fall through to plain enqueue */ }
    await DB.put(QUEUE_STORE, entry);
    refreshPendingCount();
  }

  async function dequeue(id) {
    await DB.del(QUEUE_STORE, id);
    refreshPendingCount();
  }

  async function getQueue() {
    await ensureQueueStore();
    return DB.getAll(QUEUE_STORE);
  }

  async function refreshPendingCount() {
    const queue = await getQueue();
    // v3.0.5 · 'error' / 'auth' / 'offline' are STICKY. The old code replaced
    // them with "Cambios pendientes de subir" on the very next poll tick, so
    // a failing upload masked itself as a harmless pending count — the real
    // error was only visible inside the Sync Doctor. If entries are failing,
    // the error label stays until a push/pull actually recovers.
    const sticky = state.status === 'error' || state.status === 'auth' || state.status === 'offline';
    if (queue.length > 0) {
      if (!sticky) setStatus('pending', { count: queue.length });
    } else if (state.status === 'pending' || state.status === 'error' || state.status === 'auth') {
      setStatus('idle');
    } else if (state.status === 'offline' && navigator.onLine) {
      setStatus('idle');
    }
    return queue.length;
  }

  // ---------- public API ---------------------------------------------

  // v3.0.3 · Dead-letter recovery — entries that failed 3 times used to be
  // parked forever, so a device hit by the old `updatedAt` bug stayed broken
  // ("se queda buggeado") even after the code was fixed. Re-queueing on every
  // app start gives each stuck entry one fresh chance per session; if it
  // still fails it simply returns to the DLQ (no infinite loops: push() only
  // runs when the queue is non-empty and each entry gets 3 attempts).
  async function requeueDLQ() {
    let dlq = [];
    try { dlq = JSON.parse(localStorage.getItem(DLQ_KEY) || '[]'); } catch (_) { return 0; }
    if (!Array.isArray(dlq) || dlq.length === 0) return 0;
    let n = 0;
    for (const entry of dlq) {
      if (!entry || !entry.table || !entry.op) continue;
      // v3.0.5: KEEP lastError — the Sync Doctor shows why the entry failed
      // before. Only the failure counter resets so it gets fresh attempts.
      const { failures, ...clean } = entry;
      try { await DB.put(QUEUE_STORE, { ...clean, failures: 0 }); n++; } catch (_) {}
    }
    try { localStorage.setItem(DLQ_KEY, '[]'); } catch (_) {}
    if (n > 0) console.info(`[DrCoachSync] ${n} registro(s) en error reincorporados a la cola de subida.`);
    refreshPendingCount();
    return n;
  }

  // v3.0.4 · Refresh the access token BEFORE it expires. After a laptop
  // sleeps or the app sits in the background, supabase-js keeps the old
  // JWT until its own timer wakes up; the first request then 401s and the
  // old code reported "Error de sync". Proactively refreshing removes the
  // whole class of failures.
  async function ensureFreshSession() {
    const sb = CLOUD.supabase;
    if (!sb) throw new Error('Cliente de Supabase no inicializado.');
    const session = await CLOUD.getSession();
    if (!session) throw new Error('Sin sesión activa.');
    const expMs = (session.expires_at || 0) * 1000;
    if (!expMs || expMs - Date.now() < TOKEN_MARGIN_MS) {
      const { data, error } = await sb.auth.refreshSession();
      if (error || !data?.session) {
        const msg = error?.message || 'no se pudo renovar la sesión';
        throw new Error(`Sesión expirada (${msg}). Inicia sesión de nuevo desde la vista Datos.`);
      }
    }
    return session;
  }

  // v3.0.4 · pull() self-recovery: a transient failure (sleep/wake, DNS
  // hiccup, token refresh race) retries automatically instead of leaving
  // "⚠ Error de sync" glued to the header until the next reload.
  function schedulePullRetry() {
    if (state.pullRetryTimer) clearTimeout(state.pullRetryTimer);
    if (state.pullRetries >= PULL_RETRY_MAX) return;
    state.pullRetries++;
    state.pullRetryTimer = setTimeout(() => {
      state.pullRetryTimer = null;
      if (navigator.onLine && CLOUD.enabled && CLOUD.user) pull();
    }, PULL_RETRY_DELAY_MS);
  }

  async function init() {
    // Try to recover Supabase session; if present, do an initial Pull
    // and start the background poller.
    if (!CLOUD.enabled) {
      setStatus('local');
      return;
    }
    const session = await CLOUD.getSession();
    if (!session?.user) {
      setStatus('local');
      return;
    }
    state.pullRetries = 0;
    await requeueDLQ(); // v3.0.3: self-heal entries parked by older versions
    // Subscribe to auth changes
    CLOUD.onAuthChange((user) => {
      if (!user) {
        setStatus('local');
        stopPolling();
      } else {
        startPolling();
      }
    });
    window.addEventListener('online', () => { state.online = true; pull(true); });
    window.addEventListener('offline', () => { state.online = false; setStatus('offline'); });
    startPolling();
    await refreshPendingCount();
    if (state.online) await pull(true);
  }

  let pollTimer = null;
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (state.running) return;
      // v3.0.5: recover a momentarily-null user instead of skipping forever
      if (!CLOUD.user) { const ok = await ensureUser(); if (!ok) return; }
      state.tickCount++;
      const pending = await refreshPendingCount();
      // v3.0.4: pending changes → push (as before). Every 3rd tick → also
      // PULL, so (a) a pull that failed at boot self-heals without a
      // reload, and (b) progress saved on the OTHER device arrives here
      // automatically instead of only after reopening the app.
      if (state.online && pending > 0) await push();
      if (state.online && state.tickCount % PULL_EVERY_TICKS === 0) {
        state.pullRetries = 0; // fresh budget for the periodic pull
        await pull();
      }
    }, POLL_INTERVAL_MS);
  }
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function pull(force = false) {
    if (!CLOUD.enabled || !navigator.onLine) { if (!navigator.onLine) setStatus('offline'); return; }
    if (!(await ensureUser())) return; // v3.0.5: try to self-heal a null user
    if (state.running) return;
    state.running = true;
    armRunningWatchdog(); // v3.0.5
    setStatus('syncing', { phase: 'pull' });
    try {
      await withTimeout(ensureFreshSession(), AUTH_TIMEOUT_MS, 'Renovación de sesión'); // v3.0.4/5: never fire requests with a dying (or hanging) JWT
      const sb = CLOUD.supabase;
      // v3.0.3 · Always FULL pull. The old incremental filter
      // (`.gt('updated_at', localTimestamp)`) compared the DEVICE clock
      // against the SERVER clock: on a device whose clock runs slightly
      // ahead, brand-new cloud rows were silently skipped — the other
      // device looked like it "never saved the progress". The dataset is
      // small (2 users), so a full pull is cheap and bulletproof.
      let totalMerged = 0;
      // Rows with unsynced local changes must not be overwritten by cloud.
      const dirty = await dirtyRowSet();

      for (const table of TABLES) {
        const { data, error } = await withTimeout(
          sb.from(table).select('*').eq('user_id', CLOUD.userId),
          NET_TIMEOUT_MS, `Descarga de ${table}`
        );
        if (error) throw error;
        if (!data?.length) continue;
        // Merge into IndexedDB (cloud wins unless the local row has
        // pending changes in the sync queue).
        for (const row of data) {
          if (dirty.has(`${table}:${row.id}`)) continue;
          await mergeRowToLocal(table, row);
          totalMerged++;
        }
      }
      localStorage.setItem(SYNCED_AT_KEY, String(Date.now()));
      state.pullRetries = 0; // v3.0.4: success resets the retry budget
      setStatus('idle', { merged: totalMerged });
      // Push anything queued while we were pulling
      const pending = await refreshPendingCount();
      if (pending > 0) await push();
    } catch (err) {
      console.warn('[DrCoachSync] pull failed:', err);
      const msg = String(err?.message || err || '');
      const kind = classifyError(msg);
      // v3.0.3: tell "no internet" apart from "Supabase rejected the query".
      // v3.0.4: auth failures get their own state; transient ones retry.
      if (kind === 'network') {
        setStatus('offline', { error: 'network', lastError: msg });
        schedulePullRetry();
      } else if (kind === 'auth') {
        setStatus('auth', { error: 'auth', lastError: msg });
        schedulePullRetry(); // refresh may recover once the network settles
      } else {
        setStatus('error', { error: 'supabase', lastError: msg });
        schedulePullRetry();
      }
    } finally {
      state.running = false;
      disarmRunningWatchdog(); // v3.0.5
    }
  }

  // v3.0.3: ids with a pending local upsert/delete — those rows are NEWER
  // locally than the cloud copy by definition, so pull() must not clobber
  // them (the old `updated_at` comparison mixed device vs server clocks).
  async function dirtyRowSet() {
    const set = new Set();
    try {
      const queue = await getQueue();
      for (const e of queue) {
        if (e.op === 'upsert' || e.op === 'delete') set.add(`${e.table}:${e.payload?.id}`);
      }
    } catch (_) {}
    return set;
  }

  async function push() {
    if (!CLOUD.enabled || !navigator.onLine) { if (!navigator.onLine) setStatus('offline'); return { processed: 0, failed: 0, lastError: 'offline' }; }
    if (!(await ensureUser())) return { processed: 0, failed: 0, lastError: 'sin-usuario' }; // v3.0.5
    if (state.running) return { processed: 0, failed: 0, lastError: 'busy' };
    const queue = await getQueue();
    if (queue.length === 0) { setStatus('idle'); return { processed: 0, failed: 0, lastError: null }; }
    state.running = true;
    armRunningWatchdog(); // v3.0.5
    setStatus('syncing', { phase: 'push', pending: queue.length });
    // v3.0.4: refresh the token BEFORE draining the queue — the first
    // entry would otherwise 401 after sleep/wake and pollute the DLQ.
    try {
      await withTimeout(ensureFreshSession(), AUTH_TIMEOUT_MS, 'Renovación de sesión');
    } catch (err) {
      state.running = false;
      disarmRunningWatchdog();
      const emsg = String(err?.message || err);
      const kind0 = classifyError(emsg);
      if (kind0 === 'auth') setStatus('auth', { error: 'auth', lastError: emsg });
      else setStatus('offline', { error: 'network', lastError: emsg });
      return { processed: 0, failed: 0, lastError: emsg };
    }
    let processed = 0;
    let failed = 0;
    let lastError = null;
    let stoppedForAuth = false;
    try {
      for (const entry of queue) {
        try {
          // v3.0.5: hard cap per entry — a hung upsert can no longer freeze
          // the whole drain (state.running) forever.
          await withTimeout(applyEntry(entry), NET_TIMEOUT_MS, `Subida de ${entry.table}`);
          await dequeue(entry.id);
          processed++;
        } catch (err) {
          const msg = String(err?.message || err || 'unknown');
          console.warn('[DrCoachSync] entry failed', entry.table, entry.payload?.id, msg);
          failed++;
          lastError = msg;
          // Move to dead-letter queue after 3 failures to avoid infinite loop
          entry.failures = (entry.failures || 0) + 1;
          entry.lastError = msg.slice(0, 300); // v3.0.5: visible in the Sync Doctor
          if (entry.failures >= 3) {
            console.error('[DrCoachSync] entry moved to dead-letter after 3 failures:', entry);
            await dequeue(entry.id);
            try {
              const dlq = JSON.parse(localStorage.getItem(DLQ_KEY) || '[]');
              dlq.push({ ...entry, lastError: msg, ts: Date.now() });
              localStorage.setItem(DLQ_KEY, JSON.stringify(dlq.slice(-50)));
            } catch (_) {}
          } else {
            try { await DB.put(QUEUE_STORE, entry); } catch (_) {}
          }
          // Stop on auth errors (retrying won't help until the session recovers)
          if (classifyError(msg) === 'auth') {
            stoppedForAuth = true;
            break;
          }
        }
      }
      // Determine final status: distinguish "offline" (no internet) from "error"
      // (Supabase rejected). The user-facing message must reflect the real cause.
      if (processed > 0 && failed === 0) {
        setStatus('idle', { pushed: processed });
      } else if (stoppedForAuth) {
        // v3.0.4: "Sesión expirada" is NOT a connectivity problem — its own
        // label stops the misleading "⚠ Sin conexión".
        setStatus('auth', { error: 'auth', lastError });
      } else if (failed > 0 && processed === 0) {
        // All entries failed — could be schema error or network error.
        // We surface a NEW status "error" so the UI can distinguish it from
        // a real connectivity issue. Indicator will show "⚠ Error" instead
        // of "Sin conexión".
        const kind = classifyError(lastError);
        if (kind === 'network') {
          setStatus('offline', { error: 'network', lastError });
        } else if (kind === 'auth') {
          setStatus('auth', { error: 'auth', lastError });
        } else {
          setStatus('error', { error: 'supabase', lastError, count: failed });
        }
      } else if (failed > 0) {
        // v3.0.5: partial success — surface the failure too (the old code
        // fell through to "pending", masking rows that keep failing).
        const kind = classifyError(lastError);
        if (kind === 'network') setStatus('offline', { error: 'network', lastError });
        else if (kind === 'auth') setStatus('auth', { error: 'auth', lastError });
        else setStatus('error', { error: 'supabase', lastError, count: failed });
      } else {
        const remaining = await refreshPendingCount();
        setStatus(remaining > 0 ? 'pending' : 'idle', { count: remaining, pushed: processed });
      }
    } finally {
      state.running = false;
      disarmRunningWatchdog(); // v3.0.5
    }
    return { processed, failed, lastError };
  }

  async function applyEntry(entry) {
    const sb = CLOUD.supabase;
    const { table, op, payload } = entry;
    if (op === 'upsert') {
      // Whitelist columns + attach user_id; PostgREST can never reject an
      // unknown field again.
      const row = sanitizeRow(table, payload);
      row.user_id = CLOUD.userId;
      const { error } = await sb.from(table).upsert(row, { onConflict: 'id' });
      if (error) throw error;
    } else if (op === 'delete') {
      const { error } = await sb.from(table).delete().eq('id', payload.id);
      if (error) throw error;
    } else if (op === 'settings') {
      // Sync only white-listed settings.
      // v3.0.3: UPSERT instead of UPDATE — if the profile row does not exist
      // (accounts created before the DB trigger existed) the old code silently
      // updated 0 rows and preferences never reached the cloud. Now the row
      // self-heals on first sync (RLS insert policy allows it).
      // v3.0.4: explicit guard — a null user_id used to produce a confusing
      // RLS error instead of a clear message.
      if (!CLOUD.userId) throw new Error('Sin usuario activo: no se pueden subir preferencias.');
      const settings = (payload || {}).settings || {};
      const filtered = Object.fromEntries(Object.entries(settings).filter(([k]) => SYNCED_SETTINGS_KEYS.has(k)));
      if (Object.keys(filtered).length === 0) return;
      const profileRow = { id: CLOUD.userId, preferences: filtered };
      const dn = CLOUD.user?.user_metadata?.display_name;
      if (dn) profileRow.display_name = dn;
      const { error } = await sb.from('profiles').upsert(profileRow);
      if (error) throw error;
    }
  }

  function sanitizeRow(table, payload) {
    // v3.0.3 · Whitelist sanitizer.
    // Step 1 — deep-copy and map known legacy camelCase fields to the
    //          cloud snake_case columns (v2.6.7 compatibility).
    // Step 2 — build a FRESH object keeping only the columns that exist in
    //          the cloud table (CLOUD_COLUMNS). Anything unknown/legacy is
    //          dropped by construction, so Supabase can never answer
    //          PGRST204 "Could not find the 'X' column" again.
    const r = JSON.parse(JSON.stringify(payload || {}));
    if (table === 'attempts') {
      // v2.6.7 stored strokes inline; cloud expects them inside study_board.
      if (Array.isArray(r.strokes) && r.studyBoard && !r.studyBoard.strokes) {
        r.studyBoard.strokes = r.strokes;
      }
      if (r.sessionId != null) r.session_id = r.sessionId;
      if (r.questionId != null) r.question_id = r.questionId;
      if (r.createdAt != null) r.created_at = r.createdAt;
      // ⚠️ updatedAt (camelCase, set on every local edit) → updated_at.
      // This exact field used to slip through and break every upload.
      if (r.updatedAt != null) r.updated_at = r.updatedAt;
      if (r.concept != null) r.key_concept = r.concept;
      if (r.rule != null) r.memory_rule = r.rule;
      if (r.errorReasons != null) r.error_reasons = r.errorReasons;
      if (r.attachmentIds != null) r.attachment_ids = r.attachmentIds;
      if (r.boardAttachmentId != null) r.board_attachment_id = r.boardAttachmentId;
      if (r.studyBoardId != null) r.study_board_id = r.studyBoardId;
      // Full serialized Study Board (objects, strokes, view).
      if (r.studyBoard != null) r.study_board = r.studyBoard;
      if (r.isReview != null) r.is_review = r.isReview;
      if (r.reviewEvents != null) r.review_events = r.reviewEvents;
      // jsonb / array columns refuse non-arrays in PostgreSQL. A legacy or
      // corrupted local row carrying a string where an array belongs would
      // fail with 22P02 on EVERY retry — normalize defensively (v3.0.5).
      // (Only the upload copy is touched; IndexedDB keeps the original.)
      if (r.study_board === undefined) r.study_board = null;
      if (!Array.isArray(r.review_events)) r.review_events = [];
      if (!Array.isArray(r.error_reasons)) r.error_reasons = [];
      if (!Array.isArray(r.attachment_ids)) r.attachment_ids = [];
    }
    if (table === 'canvas_objects') {
      if (r.boardId != null) r.board_id = r.boardId;
      if (r.attemptId != null) r.attempt_id = r.attemptId;
    }
    if (table === 'sessions') {
      if (r.plannedCount != null) r.planned_count = r.plannedCount;
      if (r.completedCount != null) r.completed_count = r.completedCount;
      if (r.elapsedSec != null) r.elapsed_sec = r.elapsedSec;
      if (r.runningSince != null) r.running_since = r.runningSince;
      if (r.startedAt != null) r.started_at = r.startedAt;
      if (r.endedAt != null) r.ended_at = r.endedAt;
      if (r.createdAt != null) r.created_at = r.createdAt;
      if (r.updatedAt != null) r.updated_at = r.updatedAt;
    }
    // Step 2 — whitelist projection.
    const cols = CLOUD_COLUMNS[table];
    if (!cols) return {}; // unknown table → send nothing rather than guess
    const out = {};
    for (const col of cols) {
      if (r[col] !== undefined) out[col] = r[col];
    }
    return out;
  }

  async function mergeRowToLocal(table, row) {
    // Convert cloud schema → local v2.6.7 schema for IndexedDB
    const local = unmapRow(table, row);
    if (!local) return;
    // last-write-wins: compare updated_at
    const existing = await DB.get(table, local.id);
    if (existing?.updatedAt && local.updatedAt && new Date(local.updatedAt) <= new Date(existing.updatedAt)) {
      return; // local is newer or equal
    }
    await DB.put(table, local);
  }

  function unmapRow(table, row) {
    if (table === 'attempts') {
      return {
        id: row.id,
        sessionId: row.session_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        subject: row.subject || '',
        system: row.system || '',
        questionId: row.question_id || '',
        topic: row.topic || '',
        focus: row.focus || '',
        stem: row.stem || '',
        result: row.result || '',
        confidence: row.confidence || '',
        errorReasons: row.error_reasons || [],
        attachmentIds: row.attachment_ids || [],
        boardAttachmentId: row.board_attachment_id,
        studyBoardId: row.study_board_id,
        studyBoard: row.study_board,
        isReview: !!row.is_review,
        mastered: !!row.mastered,
        reviewEvents: row.review_events || [],
        ordinal: row.ordinal || 0,
        concept: row.key_concept || '',
        whyFailed: row.notes || '',
        rule: row.memory_rule || '',
        notes: row.notes || '',
      };
    }
    if (table === 'sessions') {
      return {
        id: row.id,
        subject: row.subject || '',
        plannedCount: row.planned_count || 0,
        completedCount: row.completed_count || 0,
        elapsedSec: row.elapsed_sec || 0,
        paused: !!row.paused,
        runningSince: row.running_since,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        status: row.status || 'active',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    if (table === 'canvas_objects') {
      // canvas_objects are stored individually; the local app.js packs
      // the entire board into a single attempt.studyBoard. For sync we
      // keep the cloud table as the source of truth, but the local app
      // still relies on the embedded JSONB inside attempts.studyBoard.
      // We do NOT restore individual canvas_objects rows into IndexedDB
      // because they are already contained in the parent attempt.
      return null;
    }
    return null;
  }

  // ---------- hooks called from app.js --------------------------------
  async function pushAttempt(attempt) {
    if (!CLOUD.enabled || !CLOUD.user) return;
    await enqueue('attempts', 'upsert', attempt);
    if (navigator.onLine) push();
  }
  async function pushSession(session) {
    if (!CLOUD.enabled || !CLOUD.user) return;
    await enqueue('sessions', 'upsert', session);
    if (navigator.onLine) push();
  }
  async function pushAttemptDelete(id) {
    if (!CLOUD.enabled || !CLOUD.user) return;
    await enqueue('attempts', 'delete', { id });
    if (navigator.onLine) push();
  }
  async function pushSettings(settingsObj) {
    if (!CLOUD.enabled || !CLOUD.user) return;
    await enqueue('profiles', 'settings', { settings: settingsObj });
    if (navigator.onLine) push();
  }
  async function pushProfile(displayName, preferences) {
    if (!CLOUD.enabled || !CLOUD.user) return;
    const sb = CLOUD.supabase;
    const { error } = await sb.from('profiles').upsert({
      id: CLOUD.userId,
      display_name: displayName,
      preferences: preferences || {},
    });
    if (error) console.warn('[DrCoachSync] profile upsert failed:', error.message);
  }

  // ---------- status indicator registration --------------------------
  function registerIndicator(indicator) { state.indicator = indicator; }

  // v3.0.5 · Controlled queue reset for the "🧹 Vaciar cola de subida"
  // button. Does NOT touch local data — only discards PENDING UPLOAD
  // operations. For rows that were already uploaded (duplicates) or that
  // the user explicitly decides to stop retrying.
  async function clearQueue() {
    const q = await getQueue();
    await ensureQueueStore();
    await DB.clear(QUEUE_STORE);
    refreshPendingCount();
    return q.length;
  }
  async function getQueueCount() {
    return (await getQueue()).length;
  }
  function getStatus() { return state.status; }
  // v3.0.4: for the Datos panel — what exactly failed last, and why.
  function getLastError() { return { message: state.lastError, kind: state.lastErrorKind }; }

  // ---------- expose -------------------------------------------------
  // v3.0.3 · Sync Doctor — checks every link of the chain and returns a
  // list of {ok, label, detail} results for the Datos panel to display.
  async function diagnose() {
    const results = [];
    const push = (ok, label, detail = '') => results.push({ ok, label, detail });
    try {
      if (!CLOUD.enabled) {
        push(false, 'Configuración', 'Supabase no configurado (falta config/supabase.config.js o contiene placeholders).');
        return results;
      }
      push(true, 'Configuración', 'Credenciales cargadas correctamente.');
      const sb = CLOUD.supabase;
      if (!sb) { push(false, 'Cliente', 'Cliente de Supabase no inicializado.'); return results; }
      const session = await CLOUD.getSession();
      if (!session?.user) { push(false, 'Sesión', 'No hay sesión activa (inicia sesión de nuevo).'); return results; }
      // v3.0.4: token freshness — show remaining validity and TRY a refresh
      // when it is already expired, reporting the outcome instead of making
      // the user guess.
      const expMs = (session.expires_at || 0) * 1000;
      if (expMs && expMs - Date.now() < TOKEN_MARGIN_MS) {
        try {
          const sb0 = CLOUD.supabase;
          const { data: r, error: rerr } = await sb0.auth.refreshSession();
          if (rerr || !r?.session) push(false, 'Sesión', `Token expirado y no se pudo renovar (${rerr?.message || 'sin detalle'}). Inicia sesión de nuevo.`);
          else push(true, 'Sesión', `Token renovado correctamente para ${CLOUD.userEmail}.`);
        } catch (e0) {
          push(false, 'Sesión', `Token expirado y falló la renovación (${e0?.message || e0}).`);
        }
      } else {
        const mins = expMs ? Math.round((expMs - Date.now()) / 60000) : null;
        push(true, 'Sesión', `Activa para ${CLOUD.userEmail}${mins != null ? ` · token válido ~${mins} min más` : ''}`);
      }
      // Tables reachable + readable with RLS
      for (const table of ['attempts', 'sessions', 'profiles']) {
        const { error } = await sb.from(table).select('*').limit(1);
        if (error) push(false, `Tabla ${table}`, error.message);
        else push(true, `Tabla ${table}`, 'Accesible con tu usuario.');
      }
      // Profile row existence (settings sync needs it; now it self-heals)
      const { data: prof, error: profErr } = await sb.from('profiles').select('id, display_name, preferences').eq('id', CLOUD.userId).limit(1);
      if (profErr) push(false, 'Perfil', profErr.message);
      else if (!prof?.length) push(false, 'Perfil', 'No existe todavía — se creará automáticamente en la próxima subida (v3.0.3).');
      else push(true, 'Perfil', `OK (${prof[0].display_name || 'sin nombre'})`);

      // v3.0.5 · WRITE TEST — reads can pass while RLS silently blocks
      // INSERT/UPDATE. That exact mismatch ("tablas ✓ / cola ✗") is the
      // signature of a database created with an older schema.sql: the doctor
      // now proves it in one step. Safe: it writes the profile row back
      // with its CURRENT content (a no-op write), so nothing changes.
      try {
        const current = prof?.[0];
        const row = current
          ? { id: current.id, display_name: current.display_name, preferences: current.preferences || {} }
          : { id: CLOUD.userId, display_name: CLOUD.user?.user_metadata?.display_name || CLOUD.userEmail || 'Coach', preferences: {} };
        const { error: wErr } = await sb.from('profiles').upsert(row);
        if (wErr) {
          push(false, 'Prueba de escritura', `Supabase RECHAZÓ una escritura de prueba: ${wErr.message}. Tus cambios locales NO están llegando a la nube → ejecuta supabase/schema.sql en el SQL Editor (es seguro) y luego "⬆ Subir todo a la nube".`);
        } else {
          push(true, 'Prueba de escritura', 'Supabase aceptó una escritura de prueba — permisos de subida OK.');
        }
      } catch (eW) {
        push(false, 'Prueba de escritura', String(eW?.message || eW));
      }

      // v3.0.5 · ENGINE row — is the motor itself healthy?
      try {
        const st = getStatus();
        const le = getLastError();
        const stLabel = { idle: 'inactivo — todo al día', syncing: 'sincronizando ahora', pending: 'con cambios pendientes', offline: 'sin conexión', error: '⚠ error', auth: '⚠ sesión expirada' }[st] || st;
        const stuckNote = state.stuckCount > 0 ? ` · ${state.stuckCount} operación(es) colgadas recuperadas automáticamente` : '';
        const errNote = le?.message ? ` · último error: ${String(le.message).slice(0, 140)}` : '';
        push(st !== 'error' && st !== 'auth', 'Motor de sync', `Estado: ${stLabel}${errNote}${stuckNote}`);
      } catch (_) {}

      // Queue + DLQ counters (v3.0.5: forensic detail — what is stuck,
      // since when, whether it failed before, duplicates and size)
      const queue = await getQueue();
      if (queue.length === 0) {
        push(true, 'Cola de subida', 'Vacía — todo está en la nube.');
      } else {
        const byTable = {};
        let withErr = 0;
        let lastQError = null;
        let oldest = null;
        const seen = new Set();
        let dups = 0;
        let maxEntry = 0;
        for (const e of queue) {
          byTable[e.table] = (byTable[e.table] || 0) + 1;
          if (e.lastError) { withErr++; lastQError = e.lastError; }
          if (!oldest || (e.ts || 0) < oldest) oldest = e.ts;
          const k = `${e.table}:${e.op}:${e.op === 'settings' ? 'settings' : e.payload?.id ?? ''}`;
          if (seen.has(k)) dups++; else seen.add(k);
          maxEntry = Math.max(maxEntry, JSON.stringify(e.payload || {}).length);
        }
        const mins = oldest ? Math.max(0, Math.round((Date.now() - oldest) / 60000)) : 0;
        const age = mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
        const det = Object.entries(byTable).map(([t, n]) => `${t} ×${n}`).join(', ');
        const kb = Math.round(JSON.stringify(queue).length / 1024);
        const bigNote = maxEntry > 400000 ? ` · ⚠ hay entradas de >400 KB (Study Board con imágenes muy grandes): pueden superar el límite de subida` : '';
        const dupNote = dups > 0 ? ` · ${dups} duplicado(s) (se deduplican solos desde v3.0.5)` : '';
        const errNote = withErr > 0 ? ` · ⚠ ${withErr} con error previo: ${String(lastQError).slice(0, 130)}` : '';
        push(false, 'Cola de subida', `${queue.length} pendiente(s) — ${det} · esperando desde hace ~${age} · ${kb} KB${errNote}${bigNote}${dupNote}`);
      }
      let dlqCount = 0;
      try { dlqCount = (JSON.parse(localStorage.getItem(DLQ_KEY) || '[]') || []).length; } catch (_) {}
      push(dlqCount === 0, 'Registros en error', dlqCount === 0 ? 'Ninguno.' : `${dlqCount} registro(s) aparcaron tras 3 fallos — usa "♻ Reintentar registros en error".`);
    } catch (err) {
      push(false, 'Diagnóstico', String(err?.message || err));
    }
    return results;
  }

  window.DrCoachSync = {
    init,
    pull,
    push,
    pushAttempt,
    pushSession,
    pushAttemptDelete,
    pushSettings,
    pushProfile,
    enqueue,
    refreshPendingCount,
    requeueDLQ,
    clearQueue,
    getQueueCount,
    diagnose,
    setStatus,
    getStatus,
    getLastError,
    registerIndicator,
    SYNCED_SETTINGS_KEYS,
    LOCAL_ONLY_SETTINGS_KEYS,
  };
})();
