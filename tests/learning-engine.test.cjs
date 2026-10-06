const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/learning-engine.js');
const time=Date.parse('2026-10-06T12:00:00Z');
function profile(fields={}){const p=E.empty();p.units.push(E.makeUnit({title:'Objetivo',topic:'Tema',prompt:'Explica',answer:'Referencia',...fields},time));return p;}
function respond(p,rating,{hint=false,time:at=time}={}){p=E.start(p,{mode:'recall',time:at});p.active.phase='revealed';p.active.response='Mi explicación';p.active.hint=hint;return E.grade(p,rating,at);}

test('leer o iniciar una sesión no acredita recuerdo',()=>{const p=E.start(profile(),{time});assert.equal(E.memory(p,p.units[0].id).recalls,0);assert.throws(()=>E.grade(p,'good',time),/Primero intenta/);});
test('una pista o saltar fuerza refuerzo, incluso si se solicita Good',()=>{let p=respond(profile(),'good',{hint:true});assert.equal(p.events[0].rating,'again');assert.equal(E.memory(p,p.units[0].id).recalls,0);assert.equal(Date.parse(E.memory(p,p.units[0].id).due),time+600000);p=E.start(profile(),{time});p.active.phase='revealed';p.active.skipped=true;p=E.grade(p,'good',time);assert.equal(p.events[0].rating,'again');});
test('un intento solo se evalúa una vez',()=>{const p=respond(profile(),'good');assert.throws(()=>E.grade(p,'good',time),/Primero intenta/);assert.equal(p.events.length,1);});
test('recordar temprano no amplía el intervalo; un olvido posterior vuelve a refuerzo',()=>{
  let p=respond(profile(),'good'),unit=p.units[0].id;const due=E.memory(p,unit).due;
  p=E.advance(p,time);p=respond({...p,active:null},'good',{time:time+E.DAY*3});
  assert.equal(E.memory(p,unit).interval,6);
  p=E.advance(p,time+E.DAY*3);
  // Simulate an explicit early practice without claiming it is due.
  p.active=E.start(profile(),{time}).active;p.active.items[0].unitId=unit;p.active.phase='revealed';
  p=E.grade(p,'good',time+E.DAY*3+60000);assert.equal(E.memory(p,unit).interval,6);
  p=E.advance(p,time+E.DAY*3+60000);
  p.active=E.start(profile(),{time}).active;p.active.items[0].unitId=unit;p.active.phase='revealed';
  p=E.grade(p,'again',time+E.DAY*4);assert.equal(E.memory(p,unit).status,'reinforce');assert.equal(E.memory(p,unit).interval,0);assert.ok(due);
});
test('reconstruir una secuencia no acredita recuperación abierta',()=>{
  let p=E.start(profile({sequence:['A','B','C']}),{time});assert.equal(p.active.items[0].mode,'sequence');p.active.phase='revealed';p.active.order=[0,1,2];p=E.grade(p,'good',time);
  assert.equal(E.memory(p,p.units[0].id).recalls,0);assert.equal(E.memory(p,p.units[0].id).recognitions,1);
  p=E.advance(p,time);p=E.start(p,{time:time+E.DAY});assert.equal(p.active.items[0].mode,'recall');
});
test('una secuencia incorrecta no puede registrarse como correcta',()=>{let p=E.start(profile({sequence:['A','B']}),{time});p.active.phase='revealed';p.active.order=[1,0];p=E.grade(p,'good',time);assert.equal(p.events[0].rating,'again');});
test('la sesión y sus respuestas sobreviven a un backup completo',()=>{let p=respond(profile(),'hard');const restored=E.validate(JSON.parse(JSON.stringify(p)));assert.equal(restored.active.response,'Mi explicación');p=E.advance(restored,time);assert.equal(p.active,null);assert.equal(p.sessions[0].eventIds.length,1);});
test('editar la referencia invalida la evidencia de la versión anterior',()=>{const p=respond(profile(),'good');p.units[0].contentVersion++;assert.equal(E.memory(p,p.units[0].id).status,'new');assert.throws(()=>{p.active.phase='revealed';E.grade(p,'good',time);},/objetivo cambió/);});
test('merge es idempotente y mantiene historial local',()=>{const p=respond(profile(),'good');const merged=E.merge(p,JSON.parse(JSON.stringify(p)));assert.equal(merged.units.length,1);assert.equal(merged.events.length,1);assert.equal(merged.active.id,p.active.id);});
test('rechaza formatos inválidos antes de importar',()=>{const bad=profile();bad.units[0].sequence=['A','A'];assert.throws(()=>E.validate(bad),/pasos diferentes/);const invalid=profile();invalid.events.push({id:'x'});assert.throws(()=>E.validate(invalid),/Evento/);});
test('la capacidad diaria limita nuevas actividades y respeta temas',()=>{const p=E.empty();for(let i=0;i<12;i++)p.units.push(E.makeUnit({title:String(i),topic:i<8?'A':'B',prompt:'P',answer:'R'},time));const a=E.start(p,{minutes:5,topic:'A',time});assert.equal(a.active.items.length,2);assert.ok(a.active.items.every(item=>p.units.find(u=>u.id===item.unitId).topic==='A'));assert.equal(p.events.length,0);});
