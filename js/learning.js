/* Additive training UI. Uses the host app's cards, buttons and theme tokens. */
(()=>{
  'use strict';
  const E=window.DrCoachLearningEngine,Store=window.DrCoachLearningStore;
  const $=id=>document.getElementById(id),$$=selector=>[...document.querySelectorAll(selector)];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={new:'Por descubrir',reinforce:'Reforzar',effort:'Recordado con esfuerzo',remembered:'Recordado · prueba diferida pendiente'};
  const modes={recall:'Recuerdo libre',contrast:'Contraste de conceptos',sequence:'Reconstruir una secuencia'};
  let scope,profile,options={},chain=Promise.resolve(),draftTimer,draft=null,busy=false,editorContext={},selectedPath='today',coachSyncKey='',coachSyncBusy=false;
  const sameSession=(data,id,index)=>{if(!data.active||data.active.id!==id||data.active.index!==index)throw new Error('La sesión cambió en otra pestaña. Cierra y vuelve a abrir el repaso.');return data.active;};
  function message(error){options.toast?.(error?.message||'No se pudo guardar el entrenamiento.');}
  function mutate(fn){
    const operation=chain.then(async()=>{
      const data=await Store.update(scope,current=>E.validate(fn(current||E.empty())));
      profile=data;options.onChange?.();return data;
    });
    chain=operation.catch(()=>{});return operation;
  }
  async function action(fn){
    if(busy)return;
    busy=true;
    try{await fn();render();}catch(error){message(error);}finally{busy=false;}
  }
  async function flush(){
    clearTimeout(draftTimer);
    const pending=draft;draft=null;
    if(pending)await mutate(data=>{
      const s=data.active;
      if(s?.id===pending.id&&s.index===pending.index&&s.phase==='answer')s.response=pending.response;
      return data;
    });
    await chain;
  }
  function pendingInput(){
    if(!profile?.active)return;
    draft={id:profile.active.id,index:profile.active.index,response:$('learningResponse').value};
    $('learningCompare').disabled=!draft.response.trim();
    clearTimeout(draftTimer);draftTimer=setTimeout(()=>flush().catch(message),400);
  }
  function stats(){
    const now=Date.now(),day=new Date().toDateString();
    const today=profile.events.filter(e=>new Date(e.at).toDateString()===day);
    return {due:E.queue(profile,{time:now}).length,recalls:today.filter(e=>e.mode!=='sequence'&&!e.hint&&e.rating!=='again').length,practice:today.length};
  }
  function reviewSummary(){
    try{const value=options.reviewProvider?.()||{};return {pending:Number(value.pending)||0,total:Number(value.total)||0,attempts:Array.isArray(value.attempts)?value.attempts:[]};}catch(_){return {pending:0,total:0,attempts:[]};}
  }
  function coachSnapshot(review){
    const attempts=review.attempts||[],weak=attempts.filter(a=>a.result==='incorrect'||a.result==='omitted'||a.confidence==='doubt');
    const groups=new Map();
    for(const attempt of attempts){
      const topic=(attempt.topic||attempt.focus||attempt.system||attempt.subject||'Sin clasificar').trim()||'Sin clasificar',key=`${attempt.subject||''}|||${attempt.system||''}|||${topic}`;
      if(!groups.has(key))groups.set(key,{key,topic,subject:attempt.subject||'Sin materia',system:attempt.system||'Sin sistema',items:[],weak:0,correct:0,doubt:0,reasons:{},last:attempt.createdAt});
      const group=groups.get(key);group.items.push(attempt);if(attempt.result==='incorrect'||attempt.result==='omitted')group.weak++;if(attempt.result==='correct')group.correct++;if(attempt.confidence==='doubt')group.doubt++;if(attempt.createdAt&&(!group.last||Date.parse(attempt.createdAt)>Date.parse(group.last)))group.last=attempt.createdAt;for(const reason of attempt.errorReasons||[])group.reasons[reason]=(group.reasons[reason]||0)+1;
    }
    const ordered=[...groups.values()].map(group=>({...group,signal:group.weak+group.doubt,firstId:(group.items.find(a=>a.result!=='correct'||a.confidence==='doubt')||group.items[0])?.id})).sort((a,b)=>b.signal-a.signal||b.items.length-a.items.length||Date.parse(b.last||0)-Date.parse(a.last||0));
    const recent=attempts.slice().sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
    return {attempts,weak,groups:ordered,recent};
  }
  function coachDate(value){if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return '—';return date.toLocaleDateString('es-PA',{day:'numeric',month:'short'}).replace('.','');}
  function coachReason(group){const top=Object.entries(group.reasons).sort((a,b)=>b[1]-a[1])[0];return top?`Pista recurrente: ${top[0]}.`:group.signal?`${group.signal} señal${group.signal===1?'':'es'} para volver a explicar.`:'Base sólida; conviene comprobarla con recuperación activa.';}
  function renderCoach(review){
    const snap=coachSnapshot(review),weak=snap.weak,groups=snap.groups,recent=snap.recent;
    const set=(id,value)=>{const node=$(id);if(node)node.textContent=value};
    set('coachWeakCount',weak.length);set('coachTopicCount',groups.length);set('coachLastPractice',recent.length?coachDate(recent[0].createdAt):'—');set('coachLastPracticeMeta',recent.length?`${recent[0].subject||'Pregunta'} · ${recent[0].result==='correct'?'correcta':'para revisar'}`:'Aún no hay preguntas registradas');
    set('coachNextLabel',weak.length?'Entrenar':'Empezar');set('coachNextMeta',weak.length?`${weak.length} señal${weak.length===1?'':'es'} pendiente${weak.length===1?'':'s'}`:'Responde preguntas para activar tu dossier');
    set('coachHeadline',weak.length?'Ya encontré por dónde empezar.':'Tu aprendizaje no se queda en una pregunta.');set('coachSubheadline',weak.length?`Dr.Coach detectó ${weak.length} señal${weak.length===1?'':'es'} de conocimiento frágil y las está convirtiendo en práctica recuperable.`:'Cada respuesta, duda y explicación alimenta un dossier personal para decidir qué consolidar después.');
    set('coachDossierStatus',groups.length?`${groups.length} ruta${groups.length===1?'':'s'} formándose · ${weak.length} señal${weak.length===1?'':'es'} requieren una segunda mirada.`:'Todavía no hay suficiente práctica para formar un patrón.');
    const dossier=$('coachDossierList');
    if(dossier)dossier.innerHTML=groups.length?groups.slice(0,6).map(group=>{const ratio=Math.min(100,Math.round(group.signal/Math.max(1,group.items.length)*100));return `<article class="coach-dossier-item ${group.signal?'needs-attention':''}"><div class="coach-dossier-item-head"><div><span class="coach-topic-kicker">${escape(group.subject)} · ${escape(group.system)}</span><h3>${escape(group.topic)}</h3></div><span class="coach-signal-count">${group.signal?`${group.signal} señal${group.signal===1?'':'es'}`:'En construcción'}</span></div><div class="coach-dossier-meter"><span style="width:${ratio}%"></span></div><p>${escape(coachReason(group))} · ${group.items.length} pregunta${group.items.length===1?'':'s'} conectada${group.items.length===1?'':'s'}.</p><button type="button" class="text-btn" data-coach-open="${escape(group.firstId||'')}">Abrir evidencia →</button></article>`}).join(''):'<div class="coach-empty"><span class="learning-empty-icon">✦</span><strong>Tu dossier empieza con la primera pregunta</strong><p>Cuando registres una respuesta, Dr.Coach separará lo visto, lo frágil y lo que merece una sesión larga.</p></div>';
    const next=$('coachNextList');
    if(next)next.innerHTML=weak.length?weak.slice(0,3).map(attempt=>`<div class="coach-next-item"><div><strong>${escape(attempt.topic||attempt.focus||attempt.system||'Pregunta para revisar')}</strong><small>${escape(attempt.subject||'')} · ${attempt.result==='incorrect'?'Incorrecta':attempt.result==='omitted'?'Omitida':'Correcta con duda'}</small></div><button type="button" class="text-btn" data-coach-open="${escape(attempt.id)}">Ver →</button></div>`).join(''):'<div class="coach-next-empty"><strong>El Coach está listo.</strong><p>Haz una pregunta, registra por qué te costó y aquí aparecerá el siguiente paso.</p></div>';
    syncCoachUnits(weak);
  }
  function coachUnitFields(attempt){
    const label=(attempt.topic||attempt.focus||attempt.system||attempt.subject||'esta pregunta').trim(),material=[attempt.concept,attempt.whyFailed,attempt.rule,attempt.notes].filter(Boolean).map(String).map(x=>x.trim()).filter(Boolean).join('\n\n');
    return {id:`coach-${attempt.id}`,title:`Recuperar: ${label.slice(0,130)}`,topic:label.slice(0,160),prompt:`Antes de volver a mirar la respuesta: ¿qué pista te debía orientar en ${label} y cuál era el siguiente paso?`,answer:(material||`Vuelve a abrir la pregunta ${attempt.questionId||''} en Preguntas y escribe aquí la explicación correcta con tus propias palabras.`).slice(0,5000),hint:attempt.errorReasons?.length?`Revisa: ${attempt.errorReasons.join(', ')}.`:'Comienza por la pista clínica principal.',source:`Dr.Coach · pregunta ${attempt.questionId||'registrada'} · ${attempt.subject||''}`,subject:attempt.subject||'',system:attempt.system||'',originId:attempt.id,coachGenerated:true};
  }
  function syncCoachUnits(weak){
    if(!profile||coachSyncBusy)return;
    const candidates=weak.slice().sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0)).slice(0,250),key=candidates.map(a=>`${a.id}:${a.updatedAt||a.createdAt||''}`).join('|');
    if(key===coachSyncKey)return;coachSyncKey=key;
    const existing=new Set(profile.units.filter(unit=>unit.originId).map(unit=>unit.originId)),missing=candidates.filter(attempt=>attempt.id&&!existing.has(attempt.id));
    if(!missing.length)return;
    coachSyncBusy=true;
    mutate(data=>{for(const attempt of missing){if(data.units.some(unit=>unit.originId===attempt.id))continue;data.units.push(E.makeUnit(coachUnitFields(attempt)))}return data;}).then(()=>{coachSyncBusy=false;render()}).catch(()=>{coachSyncBusy=false});
  }
  function pathText(path,due,difficulties,routes){
    if(path==='difficulties')return difficulties?`Tienes ${difficulties} pregunta${difficulties===1?'':'s'} que merece una segunda mirada. Abre una y pulsa «Entrenar dificultad» para convertirla en una práctica tuya.`:'Todavía no hay dificultades registradas. Cuando dudes en una pregunta, aparecerá aquí.';
    if(path==='routes')return routes?`Tienes ${routes} tema${routes===1?'':'s'} creado${routes===1?'':'s'}. Puedes practicarlo por partes y subir de nivel con el tiempo.`:'Crea un tema con tus propias palabras. No hay contenido impuesto ni ejemplos precargados.';
    return due?`${due} idea${due===1?'':'s'} lista${due===1?'':'s'} para recordar hoy. Empieza por una y deja que el repaso haga el resto.`:'No tienes ideas pendientes. Puedes crear un tema nuevo o volver a tus preguntas difíciles.';
  }
  function renderUnitCards(units,mode){
    if(!units.length)return '<div class="learning-empty"><span class="learning-empty-icon">✦</span><strong>'+escape(mode==='routes'?'Todavía no tienes temas propios':'No hay ideas para este momento')+'</strong><p>'+escape(mode==='routes'?'Escribe un tema que quieras poder explicar y conviértelo en una ruta de recuerdo.':'Cuando tengas una dificultad o un tema pendiente, aparecerá aquí.')+'</p></div>';
    const groups=new Map();units.forEach(unit=>{const key=unit.topic||'Sin tema';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(unit);});
    return [...groups.entries()].map(([topic,items])=>`<section class="learning-route"><div class="learning-route-head"><div><span class="learning-route-dot"></span><strong>${escape(topic)}</strong></div><span class="muted compact">${items.length} idea${items.length===1?'':'s'}</span></div><div class="learning-route-items">${items.map(unit=>{const memory=E.memory(profile,unit.id),status=labels[memory.status]||'Por descubrir';return `<article class="learning-unit"><div><h3>${escape(unit.title)}${unit.coachGenerated?'<span class="coach-generated-tag">Coach</span>':''}</h3><p class="muted compact">${escape(status)}${memory.due?` · ${escape(new Date(memory.due).toLocaleDateString('es-PA',{day:'numeric',month:'short'}))}`:''}</p></div><button type="button" class="btn btn-secondary btn-small" data-learning-edit="${escape(unit.id)}">Editar</button></article>`}).join('')}</div></section>`).join('');
  }
  function render(){
    if(!profile)return;
    const {due,recalls,practice}=stats(),name=profile.preferences.name.trim(),review=reviewSummary(),routes=new Set(profile.units.map(u=>u.topic).filter(Boolean)).size;
    renderCoach(review);
    $('learningGreeting').textContent=name?`${name}, ¿qué quieres recordar hoy?`:'¿Qué quieres recordar hoy?';
    $('learningHomeStatus').textContent=profile.active?'Tienes un repaso guardado. Puedes continuar cuando quieras.':!profile.units.length?'Elige un tema propio y conviértelo en una ruta de recuerdo.':due?`${due} idea${due===1?'':'s'} lista${due===1?'':'s'} para practicar hoy.`:'Por hoy estás al día. Puedes explorar tus temas o volver a tus dificultades.';
    $('learningHomeStart').textContent=profile.active?'Continuar repaso':'Empezar repaso';
    $('learningHomeStart').disabled=!profile.active&&!due;
    $('learningTodayEvidence').textContent=practice?`${practice} práctica${practice===1?'':'s'} hoy · ${recalls} recuerdo${recalls===1?'':'s'} sin pistas`:'Tu progreso de recuerdo se guarda separado del QBank.';
    $('learningPersonalizedStatus').textContent=profile.active?'Repaso en pausa':routes?`${routes} tema${routes===1?'':'s'} tuyos`:'Sin contenido impuesto';
    $('learningDueCount').textContent=`${due} idea${due===1?'':'s'}`;
    $('learningDifficultyCount').textContent=`${review.pending||0} pregunta${review.pending===1?'':'s'}`;
    $('learningRouteCount').textContent=`${routes} tema${routes===1?'':'s'}`;
    $$('[data-learning-path]').forEach(button=>{const active=button.dataset.learningPath===selectedPath;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
    $('learningPathHint').textContent=pathText(selectedPath,due,review.pending||0,routes);
    $('learningName').value=profile.preferences.name;
    $('learningMinutes').value=String(profile.preferences.minutes);
    $('learningMode').value=profile.preferences.mode;
    const topic=$('learningTopic').value;
    $('learningTopic').innerHTML='<option value="">Todos mis temas</option>'+[...new Set(profile.units.map(u=>u.topic))].sort().map(t=>`<option value="${escape(t)}">${escape(t)}</option>`).join('');
    if([...$('learningTopic').options].some(o=>o.value===topic))$('learningTopic').value=topic;
    $('learningStart').textContent=profile.active?'Continuar repaso':selectedPath==='today'?'Empezar repaso':'Practicar mis temas';
    $('learningStart').disabled=!profile.active&&!E.queue(profile,{topic:$('learningTopic').value}).length;
    $('learningStorageNote').textContent=scope==='local'?'Se guarda en este dispositivo y se incluye en tus backups.':'Se guarda en tu perfil y en tus backups.';
    let units=profile.units.filter(u=>!$('learningTopic').value||u.topic===$('learningTopic').value);
    if(selectedPath==='today'){const dueIds=new Set(E.queue(profile,{topic:$('learningTopic').value}).map(x=>x.unit.id));units=units.filter(u=>dueIds.has(u.id));}
    $('learningUnits').innerHTML=selectedPath==='difficulties'&&!review.pending?'<div class="learning-empty"><span class="learning-empty-icon">✓</span><strong>Aún no hay dificultades registradas</strong><p>Cuando marques una duda o falles una pregunta del QBank, podrás traerla aquí y entrenarla con tus propias palabras.</p></div>':renderUnitCards(units,selectedPath);
    if($('learningDialog').open)renderSession();
  }
  async function openSession(fromHome=false){
    await flush();profile=E.validate(await Store.read(scope)||E.empty());
    if(!profile.active)await mutate(data=>E.start(data,{minutes:fromHome?data.preferences.minutes:Number($('learningMinutes').value),mode:fromHome?data.preferences.mode:$('learningMode').value,topic:fromHome?'':$('learningTopic').value}));
    renderSession();if(!$('learningDialog').open)$('learningDialog').showModal();
  }
  function referenceSource(unit){
    if(!unit.source)return '<p class="muted compact">Referencia propia · revisa su exactitud antes de estudiar contenido clínico.</p>';
    let url;try{const parsed=new URL(unit.source);if(parsed.protocol==='https:')url=parsed.href;}catch(_){}
    return `<p class="muted compact">Fuente: ${url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(unit.source)}</a>`:escape(unit.source)}</p>`;
  }
  function renderSession(){
    const session=profile.active;
    if(!session){renderSummary();return;}
    const item=session.items[session.index],unit=profile.units.find(u=>u.id===item.unitId),sequence=item.mode==='sequence';
    $('learningExercise').hidden=false;$('learningSummary').hidden=true;
    $('learningSessionPosition').textContent=`${session.index+1} de ${session.items.length} · ${modes[item.mode]}`;
    $('learningSessionTopic').textContent=unit.topic;
    $('learningSessionTitle').textContent=unit.title;
    $('learningQuestion').textContent=item.mode==='contrast'?unit.contrast:sequence?'Ordena los pasos y piensa cómo se relacionan.':unit.prompt;
    $('learningSessionProgress').max=session.items.length;$('learningSessionProgress').value=session.index;
    $('learningTextExercise').hidden=sequence;$('learningSequenceExercise').hidden=!sequence;
    $('learningResponse').value=session.response;$('learningResponse').disabled=session.phase!=='answer';
    $('learningHint').hidden=!session.hint;$('learningHint').textContent=unit.hint||'Empieza por lo más básico y explica después la relación entre las ideas.';
    $('learningShowHint').hidden=sequence||!unit.hint;$('learningShowHint').disabled=session.phase!=='answer'||session.hint;
    $('learningAttemptActions').hidden=session.phase!=='answer';
    $('learningCompare').disabled=sequence?session.order.length!==unit.sequence.length:!session.response.trim();
    $('learningCompare').textContent=sequence?'Comprobar secuencia':'Comparar con mi referencia';
    $('learningReference').hidden=session.phase==='answer';
    $('learningReferenceText').textContent=sequence?unit.sequence.join(' → '):unit.answer;
    $('learningSource').innerHTML=referenceSource(unit);
    $('learningRubric').textContent=sequence?'Las piezas visibles ayudan a reconocer. Después practicaremos la explicación sin piezas.':'Compara las ideas esenciales de tu respuesta. Esta evaluación es tuya; no hay un corrector de IA activo.';
    $('learningRating').hidden=session.phase!=='revealed';
    const wrongSequence=sequence&&session.phase!=='answer'&&(session.order.length!==unit.sequence.length||session.order.some((n,i)=>n!==i));
    const forceAgain=session.hint||session.skipped||wrongSequence;
    $('learningAgain').textContent=sequence?'Necesito reconstruirla':'No lo recordé';
    $('learningHard').textContent=sequence?'La ordené con esfuerzo':'Lo recordé con esfuerzo';
    $('learningGood').textContent=sequence?'La ordené correctamente':'Lo recordé sin ayuda';
    $('learningHard').disabled=forceAgain;$('learningGood').disabled=forceAgain;
    $('learningHintNotice').hidden=!forceAgain;$('learningHintNotice').textContent=wrongSequence?'La secuencia necesita otro intento. Compararla ahora te ayudará a reconstruirla.':'Se utilizó ayuda o se mostró la respuesta sin intentar: volveremos a practicar sin pistas.';
    $('learningNext').hidden=session.phase!=='rated';$('learningNext').textContent=session.index+1===session.items.length?'Terminar mi sesión':'Siguiente idea';
    $('learningResult').hidden=session.phase!=='rated';
    if(session.phase==='rated'){
      const event=profile.events.find(e=>e.id===session.lastEventId),memory=E.memory(profile,unit.id);
      $('learningResult').textContent=sequence?'Secuencia practicada. La recuperación sin piezas sigue pendiente.':event.rating==='again'?'Ya sabemos qué reforzar. Un intento difícil también ayuda a orientar el repaso.':event.rating==='hard'?'La idea volvió con esfuerzo. Le daremos otra oportunidad mañana.':'Has recuperado esta idea hoy. El próximo intento comprobará qué permanece.';
      $('learningNextDue').textContent=memory.due?`Próximo repaso: ${new Date(memory.due).toLocaleString('es-PA')}`:'Recuperación abierta pendiente';
    }else $('learningNextDue').textContent='A tu ritmo · puedes pausar en cualquier momento';
    if(sequence)renderSequence(session,unit);
  }
  function renderSequence(session,unit){
    const remaining=unit.sequence.map((_,i)=>i).reverse().filter(i=>!session.order.includes(i));
    $('learningSequencePool').innerHTML=remaining.map(i=>`<button type="button" class="btn btn-secondary" data-learning-step="${i}"${session.phase!=='answer'?' disabled':''}>${escape(unit.sequence[i])}</button>`).join('');
    $('learningSequenceBuilt').innerHTML=session.order.length?session.order.map((i,n)=>`<li>${escape(unit.sequence[i])}</li>`).join(''):'<li class="muted">Tu secuencia aparecerá aquí.</li>';
    $('learningResetSequence').disabled=session.phase!=='answer'||!session.order.length;
  }
  function renderSummary(){
    const last=profile.sessions.at(-1);$('learningExercise').hidden=true;$('learningSummary').hidden=false;
    const events=last?profile.events.filter(e=>last.eventIds.includes(e.id)):[];
    const recalled=events.filter(e=>e.mode!=='sequence'&&!e.hint&&e.rating!=='again'),reinforce=events.filter(e=>e.rating==='again');
    $('learningSessionPosition').textContent='Sesión terminada';
    $('learningSummaryTitle').textContent=profile.preferences.name?`Buen trabajo, ${profile.preferences.name}`:'Una sesión que suma';
    $('learningSummaryText').textContent=events.length?`${events.length} actividades practicadas · ${recalled.length} recuerdos sin pistas · ${reinforce.length} ideas para reforzar.`:'Tu sesión terminó. Puedes retomar el estudio cuando te venga bien.';
    $('learningSummaryList').innerHTML=events.map(event=>`<li>${escape(profile.units.find(u=>u.id===event.unitId)?.title||'Objetivo')}<span class="muted">${event.mode==='sequence'?'Secuencia · recuerdo abierto pendiente':event.rating==='again'?'Reforzar':event.rating==='hard'?'Recuperado con esfuerzo':'Recuperado hoy'}</span></li>`).join('');
  }
  async function reveal(skip=false){
    const id=profile.active.id,index=profile.active.index;await flush();
    await mutate(data=>{
      const s=sameSession(data,id,index);if(s.phase!=='answer')return data;
      const item=s.items[s.index],unit=data.units.find(u=>u.id===item.unitId);
      if(!skip&&(item.mode==='sequence'?s.order.length!==unit.sequence.length:!s.response.trim()))throw new Error('Intenta responder o elige «Aún no lo sé».');
      s.skipped=skip;s.phase='revealed';
      if(item.mode==='sequence')s.response=s.order.map(i=>unit.sequence[i]).join(' → ');
      return data;
    });
  }
  function openEditor(origin={},unit=null){
    editorContext={...origin,id:unit?.id||null};$('learningUnitForm').reset();$('learningEditorTitle').textContent=unit?'Editar tarjeta':'Crear una tarjeta de estudio';
    const fields={learningUnitTitle:unit?.title||origin.focus||'',learningUnitTopic:unit?.topic||origin.topic||'',learningUnitPrompt:unit?.prompt||'',learningUnitAnswer:unit?.answer||'',learningUnitHint:unit?.hint||'',learningUnitContrast:unit?.contrast||'',learningUnitSequence:(unit?.sequence||[]).join('\n'),learningUnitSource:unit?.source||''};
    Object.entries(fields).forEach(([key,value])=>$(key).value=value);
    $('learningEditorError').hidden=true;$('learningUnitDialog').showModal();
  }
  async function saveUnit(){
    if(!$('learningUnitForm').reportValidity())return;
    const fields={title:$('learningUnitTitle').value,topic:$('learningUnitTopic').value,prompt:$('learningUnitPrompt').value,answer:$('learningUnitAnswer').value,hint:$('learningUnitHint').value,contrast:$('learningUnitContrast').value,source:$('learningUnitSource').value,sequence:$('learningUnitSequence').value.split('\n').map(x=>x.trim()).filter(Boolean),subject:editorContext.subject||'',system:editorContext.system||'',originId:editorContext.originId||''};
    await mutate(data=>{
      const previous=data.units.find(u=>u.id===editorContext.id);
      if(previous&&data.active?.items.some(item=>item.unitId===previous.id))throw new Error('Termina la sesión que incluye esta tarjeta antes de editarla.');
      const unit=E.makeUnit({...previous,...fields,id:previous?.id,example:false,coachGenerated:false,contentVersion:previous?previous.contentVersion+1:1});
      if(previous){unit.createdAt=previous.createdAt;data.units[data.units.findIndex(u=>u.id===previous.id)]=unit;}else data.units.push(unit);
      return data;
    });
    $('learningUnitDialog').close();selectedPath='routes';options.toast?.('Tema guardado. Ya puedes practicarlo.');
  }
  function bind(){
    const on=(id,event,handler)=>$(id)?.addEventListener(event,handler);
    on('learningHomeStart','click',()=>action(()=>openSession(true)));
    on('learningHomeSetup','click',()=>{document.querySelector('[data-view="review"]')?.click();$('learningPanel')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
    on('coachStartBtn','click',()=>action(()=>openSession()));
    on('coachDeepBtn','click',()=>action(async()=>{await mutate(data=>{data.preferences={...data.preferences,minutes:20};return data});await openSession();}));
    on('learningStart','click',()=>action(()=>openSession()));
    on('learningCreate','click',()=>openEditor());
    $$('[data-learning-path]').forEach(button=>button.addEventListener('click',()=>{selectedPath=button.dataset.learningPath;render();}));
    on('learningTopic','change',render);
    ['learningName','learningMinutes','learningMode'].forEach(key=>on(key,'change',()=>action(()=>mutate(data=>{data.preferences={name:$('learningName').value.trim(),minutes:Number($('learningMinutes').value),mode:$('learningMode').value};return data;}))));
    on('learningResponse','input',pendingInput);
    on('learningResponse','blur',()=>flush().catch(message));
    on('learningCompare','click',()=>action(()=>reveal()));
    on('learningSkip','click',()=>action(()=>reveal(true)));
    on('learningShowHint','click',()=>action(async()=>{const {id,index}=profile.active;await flush();await mutate(data=>{const s=sameSession(data,id,index);if(s.phase==='answer')s.hint=true;return data;});}));
    [['learningAgain','again'],['learningHard','hard'],['learningGood','good']].forEach(([key,rating])=>on(key,'click',()=>action(()=>{const {id,index}=profile.active;return mutate(data=>{sameSession(data,id,index);return E.grade(data,rating);});})));
    on('learningNext','click',()=>action(()=>{const {id,index}=profile.active;return mutate(data=>{sameSession(data,id,index);return E.advance(data);});}));
    on('learningResetSequence','click',()=>action(()=>{const {id,index}=profile.active;return mutate(data=>{const s=sameSession(data,id,index);if(s.phase==='answer')s.order=[];return data;});}));
    on('learningSequencePool','click',event=>{const button=event.target.closest('[data-learning-step]');if(!button||button.disabled)return;action(()=>{const {id,index}=profile.active;return mutate(data=>{const s=sameSession(data,id,index),step=Number(button.dataset.learningStep);if(s.phase==='answer'&&!s.order.includes(step))s.order.push(step);return data;});});});
    on('learningUnits','click',event=>{const button=event.target.closest('[data-learning-edit]');if(button)openEditor({},profile.units.find(u=>u.id===button.dataset.learningEdit));});
    const pause=()=>action(async()=>{draft={id:profile.active?.id,index:profile.active?.index,response:$('learningResponse')?.value||draft?.response||''};await flush();$('learningDialog').close();});
    on('learningPause','click',pause);on('learningSummaryClose','click',pause);
    on('learningDialog','cancel',event=>{event.preventDefault();pause();});
    on('learningFinishEarly','click',()=>action(async()=>{
      await flush();await mutate(data=>{if(data.active){data.sessions.push({id:data.active.id,startedAt:data.active.startedAt,endedAt:new Date().toISOString(),eventIds:[...data.active.eventIds]});data.active=null;}return data;});
    }));
    on('learningCloseEditor','click',()=>$('learningUnitDialog')?.close());
    on('learningUnitForm','submit',event=>{event.preventDefault();action(async()=>{try{await saveUnit();}catch(error){$('learningEditorError').hidden=false;$('learningEditorError').textContent=error.message;throw error;}});});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)flush().catch(message);});
  }
  async function init(settings){
    options=settings;scope=settings.userId?'user:'+settings.userId:'local';
    try{profile=E.validate(await Store.read(scope)||E.empty());bind();render();}
    catch(error){$('learningHomeStatus').textContent='No se pudo abrir el entrenamiento. Tu biblioteca sigue disponible.';$('learningHomeStart').disabled=true;$('learningPanel').hidden=true;message(error);}
  }
  function exportData(){return profile?E.clone(profile):undefined;}
  async function importData(data,mode){
    await flush();if(data)E.validate(data);
    await mutate(current=>mode==='replace'?E.clone(data||E.empty()):data?E.merge(current,data):current);render();
  }
  window.DrCoachLearning={init,render,flush,exportData,validateImport:data=>E.validate(data),importData,reset:()=>mutate(()=>E.empty()),createFromAttempt:origin=>openEditor(origin)};
})();
