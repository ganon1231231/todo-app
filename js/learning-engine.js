/* Local learning rules. Pure functions, shared by the UI and regression tests.
 * This first scheduler is a transparent heuristic, not FSRS or a clinical score. */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DrCoachLearningEngine=api;
})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const DAY=86400000, VERSION=1;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const id=()=>globalThis.crypto.randomUUID();
  const iso=time=>new Date(time).toISOString();
  const text=(value,max=5000)=>typeof value==='string'&&value.length<=max;
  const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
  function empty(){return {version:VERSION,units:[],events:[],sessions:[],active:null,preferences:{name:'',minutes:10,mode:'mixed'}};}
  function validateUnit(unit){
    if(!unit||!text(unit.id,120)||!unit.id||!text(unit.title,160)||!unit.title.trim()||!text(unit.topic,160)||!unit.topic.trim()||!text(unit.prompt)||!unit.prompt.trim()||!text(unit.answer)||!unit.answer.trim())throw new Error('Cada objetivo necesita ID, tema, título, pregunta y respuesta válidos.');
    for(const key of ['hint','contrast','source','subject','system','originId'])if(unit[key]!==undefined&&!text(unit[key]))throw new Error('Campo de objetivo inválido: '+key);
    if(!Number.isInteger(unit.contentVersion)||unit.contentVersion<1)throw new Error('Versión de objetivo inválida.');
    if(!Array.isArray(unit.sequence)||unit.sequence.length>8||unit.sequence.some(x=>!text(x,300)||!x.trim())||new Set(unit.sequence).size!==unit.sequence.length||unit.sequence.length===1)throw new Error('La secuencia necesita entre 2 y 8 pasos diferentes.');
    if(!date(unit.createdAt)||!date(unit.updatedAt))throw new Error('Fecha de objetivo inválida.');
    return unit;
  }
  function makeUnit(fields,time=Date.now()){
    const clean={id:fields.id||id(),contentVersion:fields.contentVersion||1,title:String(fields.title||'').trim(),topic:String(fields.topic||'').trim(),prompt:String(fields.prompt||'').trim(),answer:String(fields.answer||'').trim(),hint:String(fields.hint||'').trim(),contrast:String(fields.contrast||'').trim(),source:String(fields.source||'').trim(),subject:String(fields.subject||''),system:String(fields.system||''),originId:String(fields.originId||''),sequence:fields.sequence||[],example:fields.example===true,createdAt:iso(time),updatedAt:iso(time)};
    return validateUnit(clean);
  }
  function validate(data){
    if(!data||data.version!==VERSION||!Array.isArray(data.units)||!Array.isArray(data.events)||!Array.isArray(data.sessions))throw new Error('Backup de entrenamiento incompatible.');
    if(data.units.length>5000||data.events.length>20000||data.sessions.length>5000||JSON.stringify(data).length>8*1024*1024)throw new Error('El backup de entrenamiento supera los límites de esta versión.');
    const unitIds=new Set();
    data.units.forEach(unit=>{validateUnit(unit);if(unitIds.has(unit.id))throw new Error('Objetivo duplicado.');unitIds.add(unit.id);});
    const eventIds=new Set();
    data.events.forEach(event=>{
      if(!event||!text(event.id,120)||!event.id||eventIds.has(event.id)||!unitIds.has(event.unitId)||!Number.isInteger(event.unitVersion)||event.unitVersion<1||!date(event.at)||!['again','hard','good'].includes(event.rating)||!['recall','contrast','sequence'].includes(event.mode)||typeof event.hint!=='boolean'||!text(event.response)||!text(event.sessionId,120))throw new Error('Evento de aprendizaje inválido.');
      eventIds.add(event.id);
    });
    if(!data.preferences||!text(data.preferences.name,60)||![5,10,20].includes(data.preferences.minutes)||!['mixed','recall'].includes(data.preferences.mode))throw new Error('Preferencias de entrenamiento inválidas.');
    const sessionIds=new Set();
    data.sessions.forEach(session=>{
      if(!session||!text(session.id,120)||!session.id||sessionIds.has(session.id)||!date(session.startedAt)||!date(session.endedAt)||!Array.isArray(session.eventIds)||session.eventIds.some(x=>!eventIds.has(x)))throw new Error('Resumen de sesión inválido.');
      sessionIds.add(session.id);
    });
    if(data.active){
      const session=data.active;
      if(!text(session.id,120)||!session.id||!date(session.startedAt)||![5,10,20].includes(session.minutes)||!Array.isArray(session.items)||!session.items.length||session.items.length>10||!Number.isInteger(session.index)||session.index<0||session.index>=session.items.length||!['answer','revealed','rated'].includes(session.phase)||!text(session.response)||typeof session.hint!=='boolean'||typeof session.skipped!=='boolean'||!Array.isArray(session.order)||!Array.isArray(session.eventIds))throw new Error('Sesión pendiente inválida.');
      session.items.forEach(item=>{if(!unitIds.has(item.unitId)||!Number.isInteger(item.unitVersion)||item.unitVersion<1||!['recall','contrast','sequence'].includes(item.mode))throw new Error('Objetivo de sesión inválido.');const unit=data.units.find(x=>x.id===item.unitId);if(item.mode==='sequence'&&unit.sequence.length<2||item.mode==='contrast'&&!unit.contrast)throw new Error('Formato no disponible para ese objetivo.');});
      const unit=data.units.find(x=>x.id===session.items[session.index].unitId);
      if(session.order.some(n=>!Number.isInteger(n)||n<0||n>=unit.sequence.length)||new Set(session.order).size!==session.order.length||session.eventIds.some(x=>!eventIds.has(x)))throw new Error('Progreso de sesión inválido.');
      if(session.lastEventId!==undefined&&!eventIds.has(session.lastEventId))throw new Error('Última evaluación inválida.');
    }
    return data;
  }
  function memory(profile,unitId){
    const version=profile.units.find(u=>u.id===unitId)?.contentVersion;
    const events=profile.events.filter(e=>e.unitId===unitId&&e.unitVersion===version).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id));
    const result={due:null,interval:0,recalls:0,recognitions:0,lastRecall:null,status:'new',lapses:0};
    for(const event of events){
      const time=Date.parse(event.at);
      if(event.mode==='sequence'){
        result.recognitions++;
        const candidate=time+(event.rating==='again'?600000:DAY);
        if(!result.due||candidate<Date.parse(result.due))result.due=iso(candidate);
        continue;
      }
      const rating=event.hint?'again':event.rating;
      const separated=result.lastRecall===null||time-Date.parse(result.lastRecall)>=DAY;
      if(rating==='again'){result.interval=0;result.due=iso(time+600000);result.status='reinforce';result.lapses++;}
      else if(rating==='hard'){result.interval=1;result.due=iso(time+DAY);result.status='effort';result.recalls++;}
      else {
        result.recalls++;
        if(separated){result.interval=result.interval?Math.min(30,Math.max(3,result.interval*2)):3;result.due=iso(time+result.interval*DAY);}
        else if(!result.due||Date.parse(result.due)<time)result.due=iso(time+DAY);
        result.status='remembered';
      }
      result.lastRecall=event.at;
    }
    return result;
  }
  function queue(profile,{time=Date.now(),topic=''}={}){
    return profile.units.filter(u=>!topic||u.topic===topic).map(unit=>({unit,memory:memory(profile,unit.id)})).filter(x=>!x.memory.due||Date.parse(x.memory.due)<=time).sort((a,b)=>{
      const priority=x=>x.memory.status==='reinforce'?0:x.memory.due?1:2;
      return priority(a)-priority(b)||(Date.parse(a.memory.due||a.unit.createdAt)-Date.parse(b.memory.due||b.unit.createdAt))||a.unit.id.localeCompare(b.unit.id);
    });
  }
  function start(profile,{minutes=10,mode='mixed',topic='',time=Date.now()}={}){
    if(profile.active)return profile;
    if(![5,10,20].includes(minutes)||!['mixed','recall'].includes(mode))throw new Error('Configuración de sesión inválida.');
    const selected=queue(profile,{time,topic}).slice(0,Math.floor(minutes/2));
    if(!selected.length)throw new Error('No hay objetivos pendientes en este tema. Puedes añadir uno o explorar tu biblioteca.');
    const next=clone(profile);
    const items=selected.map(({unit,memory:state})=>({unitId:unit.id,unitVersion:unit.contentVersion,mode:mode==='recall'||state.recognitions&&!state.recalls?'recall':unit.sequence.length>=2&&!state.recognitions?'sequence':unit.contrast?'contrast':'recall'}));
    next.preferences={...next.preferences,minutes,mode};
    next.active={id:id(),startedAt:iso(time),minutes,items,index:0,phase:'answer',response:'',hint:false,skipped:false,order:[],eventIds:[]};
    return next;
  }
  function grade(profile,rating,time=Date.now()){
    if(!['again','hard','good'].includes(rating))throw new Error('Evaluación inválida.');
    const session=profile.active;
    if(!session||session.phase!=='revealed')throw new Error('Primero intenta responder y compara con la referencia.');
    const item=session.items[session.index];
    const next=clone(profile);
    if(profile.units.find(u=>u.id===item.unitId)?.contentVersion!==item.unitVersion)throw new Error('El objetivo cambió. Termina esta sesión y comienza una nueva.');
    const unit=profile.units.find(u=>u.id===item.unitId);
    const wrongSequence=item.mode==='sequence'&&(session.order.length!==unit.sequence.length||session.order.some((n,i)=>n!==i));
    const event={id:id(),sessionId:session.id,unitId:item.unitId,unitVersion:item.unitVersion,mode:item.mode,rating:session.hint||session.skipped||wrongSequence?'again':rating,hint:session.hint,at:iso(time),response:session.response};
    next.events.push(event);next.active.phase='rated';next.active.lastEventId=event.id;next.active.eventIds.push(event.id);
    return next;
  }
  function advance(profile,time=Date.now()){
    const session=profile.active;
    if(!session||session.phase!=='rated')throw new Error('Evalúa el ejercicio antes de continuar.');
    const next=clone(profile);
    if(session.index+1===session.items.length){
      next.sessions.push({id:session.id,startedAt:session.startedAt,endedAt:iso(time),eventIds:[...session.eventIds]});next.active=null;
    }else Object.assign(next.active,{index:session.index+1,phase:'answer',response:'',hint:false,skipped:false,order:[],lastEventId:undefined});
    return next;
  }
  function merge(local,incoming){
    validate(incoming);
    const next=clone(local);
    for(const key of ['units','events','sessions']){const ids=new Set(next[key].map(x=>x.id));next[key].push(...clone(incoming[key]).filter(x=>!ids.has(x.id)));}
    if(!next.active&&incoming.active)next.active=clone(incoming.active);
    return validate(next);
  }
  return {VERSION,DAY,empty,validate,makeUnit,memory,queue,start,grade,advance,merge,clone};
});
