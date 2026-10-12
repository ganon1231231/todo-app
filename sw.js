/* Dr.Coach! Service Worker — v3.4.6 (Coach compacto + Prompt Maestro Unificado)
 * Vive en la raíz para conservar el scope './'. Las rutas cacheadas
 * apuntan a la estructura nueva: css/, js/, assets/img/, assets/icons/.
 * Al cambiar CACHE se fuerza la renovación en todos los dispositivos.
 * v3.4.6: las NAVEGACIONES pasan a network-first — el HTML siempre fresco
 * cuando hay red (la caché queda solo como respaldo offline). Esto evita
 * para siempre el bug de versiones viejas atrapadas en el dispositivo. */
const CACHE='drcoach-3.4.6-release';
const ASSETS=['./index.html','./css/styles.css','./js/db.js','./js/zip.js','./js/learning-engine.js','./js/learning-store.js','./js/learning.js','./js/prompt-maestro.js','./js/app.js','./cloud/supabase-client.js','./cloud/auth.js','./cloud/storage.js','./cloud/sync.js','./cloud/sync-indicator.js','./manifest.webmanifest','./assets/img/drcoach-logo.webp','./assets/img/drcoach-emblem.webp','./assets/icons/icon-192.png','./assets/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  let url;
  try{ url=new URL(event.request.url); }catch(_){ return; }
  // v3.0.2: solo interceptamos peticiones de la propia app (mismo origen).
  // Las APIs externas (Supabase REST/Auth/Storage, Piped/Invidious, Jina…)
  // pasan directas a la red: la nube devuelve siempre datos frescos (sin
  // sincronizaciones obsoletas entre dispositivos) y las búsquedas de música
  // usan su propio cache en localStorage, como está documentado.
  if(url.origin!==self.location.origin)return;
  // v3.4.6: navegación network-first (respaldo offline = index cacheado).
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(resp=>{
      if(resp.ok){const copy=resp.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put('./index.html',copy)));}
      return resp;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{
    if(resp.ok){const copy=resp.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}
    return resp;
  }).catch(()=>Response.error())));
});
