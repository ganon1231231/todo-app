/* Dr.Coach! Service Worker — v3.0.1 (reorganización de carpetas)
 * Vive en la raíz para conservar el scope './'. Las rutas cacheadas
 * apuntan a la estructura nueva: css/, js/, assets/img/, assets/icons/.
 * Al cambiar CACHE se fuerza la renovación en todos los dispositivos. */
const CACHE='drcoach-v3.0.1-reorg';
const ASSETS=['./index.html','./css/styles.css','./js/db.js','./js/zip.js','./js/app.js','./manifest.webmanifest','./assets/img/drcoach-logo.webp','./assets/img/drcoach-emblem.webp','./assets/icons/icon-192.png','./assets/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return resp}).catch(()=>caches.match('./index.html'))));
});
