/* Additive training UI. Uses the host app's cards, buttons and theme tokens. */
(()=>{
  'use strict';
  const E=window.DrCoachLearningEngine,Store=window.DrCoachLearningStore;
  const $=id=>document.getElementById(id),$$=selector=>[...document.querySelectorAll(selector)];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={new:'Por descubrir',reinforce:'Reforzar',effort:'Recordado con esfuerzo',remembered:'Recordado · prueba diferida pendiente'};
  const modes={recall:'Recuerdo libre',contrast:'Contraste de conceptos',sequence:'Reconstruir una secuencia'};
  let scope,profile,options={},chain=Promise.resolve(),draftTimer,draft=null,busy=false,editorContext={},selectedPath='today';
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
    try{return options.reviewProvider?.()||{pending:0,total:0};}catch(_){return {pending:0,total:0};}
  }
  function pathText(path,due,difficulties,routes){
    if(path==='difficulties')return difficulties?`Tienes ${difficulties} pregunta${difficulties===1?'':'s'} que merece una segunda mirada. Abre una y pulsa «Entrenar dificultad» para convertirla en una práctica tuya.`:'Todavía no hay dificultades registradas. Cuando dudes en una pregunta, aparecerá aquí.';
    if(path==='routes')return routes?`Tienes ${routes} tema${routes===1?'':'s'} creado${routes===1?'':'s'}. Puedes practicarlo por partes y subir de nivel con el tiempo.`:'Crea un tema con tus propias palabras. No hay contenido impuesto ni ejemplos precargados.';
    return due?`${due} idea${due===1?'':'s'} lista${due===1?'':'s'} para recordar hoy. Empieza por una y deja que el repaso haga el resto.`:'No tienes ideas pendientes. Puedes crear un tema nuevo o volver a tus preguntas difíciles.';
  }
  function renderUnitCards(units,mode){
    if(!units.length)return '<div class="learning-empty"><span class="learning-empty-icon">✦</span><strong>'+escape(mode==='routes'?'Todavía no tienes temas propios':'No hay ideas para este momento')+'</strong><p>'+escape(mode==='routes'?'Escribe un tema que quieras poder explicar y conviértelo en una ruta de recuerdo.':'Cuando tengas una dificultad o un tema pendiente, aparecerá aquí.')+'</p></div>';
    const groups=new Map();units.forEach(unit=>{const key=unit.topic||'Sin tema';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(unit);});
    return [...groups.entries()].map(([topic,items])=>`<section class="learning-route"><div class="learning-route-head"><div><span class="learning-route-dot"></span><strong>${escape(topic)}</strong></div><span class="muted compact">${items.length} idea${items.length===1?'':'s'}</span></div><div class="learning-route-items">${items.map(unit=>{const memory=E.memory(profile,unit.id),status=labels[memory.status]||'Por descubrir';return `<article class="learning-unit"><div><h3>${escape(unit.title)}</h3><p class="muted compact">${escape(status)}${memory.due?` · ${escape(new Date(memory.due).toLocaleDateString('es-PA',{day:'numeric',month:'short'}))}`:''}</p></div><button type="button" class="btn btn-secondary btn-small" data-learning-edit="${escape(unit.id)}">Editar</button></article>`}).join('')}</div></section>`).join('');
  }
  function render(){
    if(!profile)return;
    const {due,recalls,practice}=stats(),name=profile.preferences.name.trim(),review=reviewSummary(),routes=new Set(profile.units.map(u=>u.topic).filter(Boolean)).size;
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
      const unit=E.makeUnit({...previous,...fields,id:previous?.id,example:false,contentVersion:previous?previous.contentVersion+1:1});
      if(previous){unit.createdAt=previous.createdAt;data.units[data.units.findIndex(u=>u.id===previous.id)]=unit;}else data.units.push(unit);
      return data;
    });
    $('learningUnitDialog').close();selectedPath='routes';options.toast?.('Tema guardado. Ya puedes practicarlo.');
  }
  function bind(){
    const on=(id,event,handler)=>$(id)?.addEventListener(event,handler);
    on('learningHomeStart','click',()=>action(()=>openSession(true)));
    on('learningHomeSetup','click',()=>{document.querySelector('[data-view="review"]')?.click();$('learningPanel')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
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
