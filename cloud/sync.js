/* ===================================================================
 * Dr.Coach! v3.0.0 — Sync Engine
 * -------------------------------------------------------------------
 * Pull / Push / Background sync between IndexedDB (local) and
 * Supabase (cloud). Designed for two users, no realtime collab.
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

  const state = {
    status: 'idle',
    running: false,
    online: navigator.onLine,
    pullAt: 0,
    lastError: null,
    indicator: null, // updated via setStatus
  };

  // ---------- indicator plumbing -------------------------------------
  function setStatus(s, meta = {}) {
    state.status = s;
    state.lastError = meta?.error || null;
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
    if (queue.length > 0) {
      setStatus('pending', { count: queue.length });
    } else if (state.status === 'pending') {
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
      const { lastError, failures, ...clean } = entry;
      try { await DB.put(QUEUE_STORE, { ...clean, failures: 0 }); n++; } catch (_) {}
    }
    try { localStorage.setItem(DLQ_KEY, '[]'); } catch (_) {}
    if (n > 0) console.info(`[DrCoachSync] ${n} registro(s) en error reincorporados a la cola de subida.`);
    refreshPendingCount();
    return n;
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
      if (!CLOUD.user) return;
      const pending = await refreshPendingCount();
      if (state.online && pending > 0) await push();
    }, POLL_INTERVAL_MS);
  }
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function pull(force = false) {
    if (!CLOUD.enabled || !CLOUD.user) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    if (state.running) return;
    state.running = true;
    setStatus('syncing', { phase: 'pull' });
    try {
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
        const { data, error } = await sb.from(table).select('*').eq('user_id', CLOUD.userId);
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
      setStatus('idle', { merged: totalMerged });
      // Push anything queued while we were pulling
      const pending = await refreshPendingCount();
      if (pending > 0) await push();
    } catch (err) {
      console.warn('[DrCoachSync] pull failed:', err);
      const msg = String(err?.message || err || '');
      // v3.0.3: tell "no internet" apart from "Supabase rejected the query"
      // so the indicator shows ⚠ Error de sync instead of ⚠ Sin conexión.
      if (/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED|ERR_INTERNET/i.test(msg)) {
        setStatus('offline', { error: 'network', lastError: msg });
      } else {
        setStatus('error', { error: 'supabase', lastError: msg });
      }
    } finally {
      state.running = false;
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
    if (!CLOUD.enabled || !CLOUD.user) return { processed: 0, failed: 0, lastError: null };
    if (!navigator.onLine) { setStatus('offline'); return { processed: 0, failed: 0, lastError: 'offline' }; }
    if (state.running) return { processed: 0, failed: 0, lastError: 'busy' };
    const queue = await getQueue();
    if (queue.length === 0) { setStatus('idle'); return { processed: 0, failed: 0, lastError: null }; }
    state.running = true;
    setStatus('syncing', { phase: 'push', pending: queue.length });
    let processed = 0;
    let failed = 0;
    let lastError = null;
    let stoppedForAuth = false;
    try {
      for (const entry of queue) {
        try {
          await applyEntry(entry);
          await dequeue(entry.id);
          processed++;
        } catch (err) {
          const msg = String(err?.message || err || 'unknown');
          console.warn('[DrCoachSync] entry failed', entry, msg);
          failed++;
          lastError = msg;
          // Move to dead-letter queue after 3 failures to avoid infinite loop
          entry.failures = (entry.failures || 0) + 1;
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
          // Stop on auth errors (retrying won't help until user re-logs in)
          if (/JWT|auth|permission|denied|signature|expired/i.test(msg)) {
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
        setStatus('offline', { error: 'auth', lastError });
      } else if (failed > 0 && processed === 0) {
        // All entries failed — could be schema error or network error.
        // We surface a NEW status "error" so the UI can distinguish it from
        // a real connectivity issue. Indicator will show "⚠ Error" instead
        // of "Sin conexión".
        if (/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED|ERR_INTERNET/i.test(lastError || '')) {
          setStatus('offline', { error: 'network', lastError });
        } else {
          setStatus('error', { error: 'supabase', lastError, count: failed });
        }
      } else {
        const remaining = await refreshPendingCount();
        setStatus(remaining > 0 ? 'pending' : 'idle', { count: remaining, pushed: processed });
      }
    } finally {
      state.running = false;
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
      // jsonb / array columns refuse empty strings in PostgreSQL
      if (r.study_board === undefined) r.study_board = null;
      if (r.review_events === undefined) r.review_events = [];
      if (r.error_reasons === undefined) r.error_reasons = [];
      if (r.attachment_ids === undefined) r.attachment_ids = [];
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

  function getStatus() { return state.status; }

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
      push(true, 'Sesión', `Activa para ${CLOUD.userEmail}`);
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
      // Queue + DLQ counters
      const queue = await getQueue();
      push(queue.length === 0, 'Cola de subida', queue.length === 0 ? 'Vacía — todo está en la nube.' : `${queue.length} cambio(s) pendientes de subir.`);
      let dlqCount = 0;
      try { dlqCount = (JSON.parse(localStorage.getItem(DLQ_KEY) || '[]') || []).length; } catch (_) {}
      push(dlqCount === 0, 'Registros en error', dlqCount === 0 ? 'Ninguno.' : `${dlqCount} registro(s) aparcaron tras 3 fallos — usa "Reintentar registros en error".`);
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
    diagnose,
    setStatus,
    getStatus,
    registerIndicator,
    SYNCED_SETTINGS_KEYS,
    LOCAL_ONLY_SETTINGS_KEYS,
  };
})();
