/* ===================================================================
 * Dr.Coach! v3.0.0 — Supabase Storage helpers
 * -------------------------------------------------------------------
 * Upload / fetch evidence images for the Study Board. Stored in a
 * private bucket with path-based isolation:
 *   study-evidence/{user_id}/{question_id}/{image_id}.webp
 *
 * The app keeps using the existing IndexedDB `attachments` store as
 * the local cache. When cloud is enabled and the user saves a
 * question with images, each new attachment is also uploaded. On
 * Pull, missing images are downloaded lazily.
 * =================================================================== */

(() => {
  'use strict';

  const CLOUD = window.DrCoachCloud;
  if (!CLOUD) { console.error('DrCoachStorage requires DrCoachCloud.'); return; }

  const BUCKET = 'study-evidence';
  const DB = window.DrCoachDB || window.MediospiraDB;

  function objectPath(user, attemptId, attachmentId, ext = 'webp') {
    return `${user.id}/${attemptId || 'unsorted'}/${attachmentId}.${ext}`;
  }

  // Detect extension from blob mime
  function pickExt(blob) {
    const t = (blob?.type || '').toLowerCase();
    if (t.includes('webp')) return 'webp';
    if (t.includes('png')) return 'png';
    if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
    return 'webp';
  }

  async function uploadAttachment({ attemptId, attachmentId, blob }) {
    if (!CLOUD.enabled || !CLOUD.user) return null;
    if (!blob) return null;
    const ext = pickExt(blob);
    const path = objectPath(CLOUD.user, attemptId, attachmentId, ext);
    const sb = CLOUD.supabase;
    const { data, error } = await sb.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type || 'image/webp' });
    if (error) {
      console.warn('[DrCoachStorage] upload failed:', error.message);
      return null;
    }
    return { path, ext };
  }

  async function getPublicUrlForAttachment({ attemptId, attachmentId, ext = 'webp' }) {
    if (!CLOUD.enabled || !CLOUD.user) return null;
    const path = objectPath(CLOUD.user, attemptId, attachmentId, ext);
    const sb = CLOUD.supabase;
    // Bucket is private; we use a signed URL so images can be embedded in canvas.
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error) { console.warn('[DrCoachStorage] signed URL failed:', error.message); return null; }
    return data?.signedUrl || null;
  }

  async function downloadAttachment({ attemptId, attachmentId, ext = 'webp' }) {
    if (!CLOUD.enabled || !CLOUD.user) return null;
    const path = objectPath(CLOUD.user, attemptId, attachmentId, ext);
    const sb = CLOUD.supabase;
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error) { console.warn('[DrCoachStorage] download failed:', error.message); return null; }
    return data?.blob || null;
  }

  async function deleteAttachment({ attemptId, attachmentId, ext = 'webp' }) {
    if (!CLOUD.enabled || !CLOUD.user) return;
    const path = objectPath(CLOUD.user, attemptId, attachmentId, ext);
    const sb = CLOUD.supabase;
    await sb.storage.from(BUCKET).remove([path]);
  }

  async function listForAttempt(attemptId) {
    if (!CLOUD.enabled || !CLOUD.user) return [];
    const prefix = `${CLOUD.user.id}/${attemptId || 'unsorted'}/`;
    const sb = CLOUD.supabase;
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error) return [];
    return (data || []).map(f => `${prefix}${f.name}`);
  }

  // Helper: ensure an attachment is present locally. If it's missing in
  // IndexedDB but exists in cloud, download and persist it.
  async function ensureLocalCopy({ attemptId, attachmentId, ext = 'webp' }) {
    const local = await DB.get('attachments', attachmentId);
    if (local?.blob) return local;
    const blob = await downloadAttachment({ attemptId, attachmentId, ext });
    if (!blob) return null;
    const rec = { id: attachmentId, blob, ext, createdAt: new Date().toISOString() };
    await DB.put('attachments', rec);
    return rec;
  }

  window.DrCoachStorage = {
    BUCKET,
    uploadAttachment,
    downloadAttachment,
    deleteAttachment,
    listForAttempt,
    getPublicUrlForAttachment,
    ensureLocalCopy,
  };
})();
