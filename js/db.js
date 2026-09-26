(() => {
  // Legacy storage identifier kept intentionally so existing v1.x progress opens seamlessly after the Dr.Coach! rebrand.
  const DB_NAME = 'mediospira-db';
  // v2.6.7 used DB_VERSION = 1. v3.0.0 bumps to 2 to add the `pending_syncs`
  // store used by the cloud sync queue. All existing stores and indexes
  // are preserved verbatim.
  const DB_VERSION = 2;
  const STORES = ['attempts','sessions','settings','attachments','baselines','pending_syncs'];
  let dbPromise;

  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        if(!db.objectStoreNames.contains('attempts')){
          const s = db.createObjectStore('attempts',{keyPath:'id'});
          s.createIndex('sessionId','sessionId',{unique:false});
          s.createIndex('questionId','questionId',{unique:false});
          s.createIndex('createdAt','createdAt',{unique:false});
          s.createIndex('subject','subject',{unique:false});
          s.createIndex('system','system',{unique:false});
        }
        if(!db.objectStoreNames.contains('sessions')){
          const s = db.createObjectStore('sessions',{keyPath:'id'});
          s.createIndex('status','status',{unique:false});
          s.createIndex('startedAt','startedAt',{unique:false});
        }
        if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
        if(!db.objectStoreNames.contains('attachments')) db.createObjectStore('attachments',{keyPath:'id'});
        if(!db.objectStoreNames.contains('baselines')){
          const s = db.createObjectStore('baselines',{keyPath:'id'});
          s.createIndex('subject','subject',{unique:false});
        }
        // v3.0.0: pending_syncs store for the cloud sync queue. Each
        // entry: { id, table, op:'upsert'|'delete'|'settings', payload, ts }
        if(!db.objectStoreNames.contains('pending_syncs')){
          db.createObjectStore('pending_syncs',{keyPath:'id'});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }

  // Lazily ensure a store exists for older DB_VERSION=1 databases that
  // were opened before v3.0.0. The upgrade above only runs the first
  // time; if the user previously opened v1 we'd already be at v2 by
  // now. We keep this helper in case sync needs to add more stores.
  async function ensureStore(name, opts) {
    const db = await openDB();
    if (db.objectStoreNames.contains(name)) return;
    // We can't add a store on an existing DB version without bumping.
    // The above upgrade handler covers it. This is a no-op fallback.
    return null;
  }

  async function tx(storeNames, mode='readonly'){
    const db=await openDB();
    return db.transaction(storeNames,mode);
  }
  async function get(store,key){
    const t=await tx([store]);
    return new Promise((resolve,reject)=>{const r=t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  }
  async function getAll(store){
    const t=await tx([store]);
    return new Promise((resolve,reject)=>{const r=t.objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
  }
  async function put(store,value){
    const t=await tx([store],'readwrite');
    return new Promise((resolve,reject)=>{const r=t.objectStore(store).put(value);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error)});
  }
  async function bulkPut(store, values){
    if(!values?.length) return;
    const t=await tx([store],'readwrite');
    const os=t.objectStore(store);
    values.forEach(v=>os.put(v));
    return new Promise((resolve,reject)=>{t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)});
  }
  async function del(store,key){
    const t=await tx([store],'readwrite');
    return new Promise((resolve,reject)=>{const r=t.objectStore(store).delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)});
  }
  async function clear(store){
    const t=await tx([store],'readwrite');
    return new Promise((resolve,reject)=>{const r=t.objectStore(store).clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)});
  }
  async function clearAll(){
    const db=await openDB();
    const t=db.transaction(STORES,'readwrite');
    STORES.forEach(s=>t.objectStore(s).clear());
    return new Promise((resolve,reject)=>{t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)});
  }
  async function findAttemptsByQuestionId(questionId){
    if(!questionId) return [];
    const db=await openDB();
    const t=db.transaction(['attempts'],'readonly');
    const idx=t.objectStore('attempts').index('questionId');
    return new Promise((resolve,reject)=>{const r=idx.getAll(questionId);r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
  }
  async function exportRaw(){
    const [attempts,sessions,settings,baselines]=await Promise.all(['attempts','sessions','settings','baselines'].map(getAll));
    const attachments=await getAll('attachments');
    return {attempts,sessions,settings,baselines,attachments};
  }
  const api={openDB,get,getAll,put,bulkPut,del,clear,clearAll,findAttemptsByQuestionId,exportRaw,ensureStore,STORES};
  window.DrCoachDB=api;
  window.MediospiraDB=api; // legacy alias for portable/backward compatibility
})();
