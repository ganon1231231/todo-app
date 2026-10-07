/* New training data is scoped to the authenticated account or local mode.
 * It does not migrate, publish or overwrite the existing QBank database. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.DrCoachLearningStore=factory(root.indexedDB);
})(typeof window==='undefined'?globalThis:window,(indexedDB)=>{
  'use strict';
  let opened;
  function open(){
    if(opened)return opened;
    opened=new Promise((resolve,reject)=>{
      const request=indexedDB.open('drcoach-learning',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('profiles',{keyPath:'scope'});
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opened=null;};resolve(db);};
      request.onerror=()=>{opened=null;reject(request.error);};
      request.onblocked=()=>{opened=null;reject(new Error('Cierra otras pestañas antiguas para abrir el repaso.'));};
    });
    return opened;
  }
  function validScope(scope){if(typeof scope!=='string'||!scope||scope.length>150)throw new Error('Cuenta de entrenamiento inválida.');}
  async function read(scope){
    validScope(scope);const db=await open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('profiles','readonly');let value;
      const request=transaction.objectStore('profiles').get(scope);
      request.onsuccess=()=>{value=request.result?.data||null;};
      transaction.oncomplete=()=>resolve(value);
      transaction.onabort=transaction.onerror=()=>reject(transaction.error||new Error('No se pudo leer el entrenamiento.'));
    });
  }
  async function update(scope,mutator){
    validScope(scope);const db=await open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('profiles','readwrite'),store=transaction.objectStore('profiles');let value,error;
      const request=store.get(scope);
      request.onsuccess=()=>{
        try{value=mutator(request.result?.data||null);if(!value||typeof value.then==='function')throw new Error('La actualización debe ser síncrona.');store.put({scope,data:value});}
        catch(e){error=e;transaction.abort();}
      };
      transaction.oncomplete=()=>resolve(value);
      transaction.onabort=transaction.onerror=()=>reject(error||transaction.error||new Error('No se pudo guardar; tu sesión anterior sigue disponible.'));
    });
  }
  return {read,update};
});
