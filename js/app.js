(() => {
'use strict';

const DB = window.DrCoachDB || window.MediospiraDB;
const ZIP = window.DrCoachZip || window.MediospiraZip;
const APP_VERSION = '3.0.5';
const APP_NAME = 'Dr.Coach!';
const SCHEMA_VERSION = 2;
const TARGET_TOTAL = 4085;
const DEADLINE = '2027-05-07';
const ATTACHMENT_APP_CAP = 60 * 1024 * 1024; // 60 MB total screenshots
const ATTACHMENT_HARD_MAX = 1024 * 1024; // 1 MB each after compression
const MAX_ATTACHMENTS_PER_QUESTION = 4;

const SUBJECTS = [
  {key:'Medicine', label:'Medicine', total:1773},
  {key:'Obstetrics & Gynecology', label:'Obstetrics & Gynecology', total:523},
  {key:'Pediatrics', label:'Pediatrics', total:734},
  {key:'Psychiatry', label:'Psychiatry', total:354},
  {key:'Surgery', label:'Surgery', total:701},
];

const SYSTEMS = [
  'Allergy & Immunology','Dermatology','Cardiovascular System','Pulmonary & Critical Care',
  'Gastrointestinal & Nutrition','Hematology & Oncology','Renal, Urinary Systems & Electrolytes',
  'Nervous System','Rheumatology/Orthopedics & Sports','Infectious Diseases',
  'Endocrine, Diabetes & Metabolism','Female Reproductive System & Breast','Male Reproductive System',
  'Pregnancy, Childbirth & Puerperium','General Principles','Biostatistics & Epidemiology',
  'Ear, Nose & Throat (ENT)','Psychiatric/Behavioral & Substance Use Disorder',
  'Poisoning & Environmental Exposure','Ophthalmology','Social Sciences (Ethics/Legal/Professional)',
  'Miscellaneous (Multisystem)'
];

// Original 4,085-question matrix. Psychiatry × Psychiatric/Behavioral includes the 5 questions
// that were temporarily visible as Omitted in the source QBank capture: 315 unused + 5 omitted = 320.
const MATRIX = {
  'Medicine': {
    'Allergy & Immunology':8,'Dermatology':69,'Cardiovascular System':205,'Pulmonary & Critical Care':149,
    'Gastrointestinal & Nutrition':120,'Hematology & Oncology':97,'Renal, Urinary Systems & Electrolytes':111,
    'Nervous System':245,'Rheumatology/Orthopedics & Sports':114,'Infectious Diseases':146,
    'Endocrine, Diabetes & Metabolism':110,'Female Reproductive System & Breast':6,'Male Reproductive System':15,
    'Pregnancy, Childbirth & Puerperium':0,'General Principles':2,'Biostatistics & Epidemiology':160,
    'Ear, Nose & Throat (ENT)':18,'Psychiatric/Behavioral & Substance Use Disorder':13,
    'Poisoning & Environmental Exposure':34,'Ophthalmology':26,'Social Sciences (Ethics/Legal/Professional)':123,
    'Miscellaneous (Multisystem)':2
  },
  'Obstetrics & Gynecology': {
    'Allergy & Immunology':0,'Dermatology':1,'Cardiovascular System':5,'Pulmonary & Critical Care':2,
    'Gastrointestinal & Nutrition':13,'Hematology & Oncology':5,'Renal, Urinary Systems & Electrolytes':8,
    'Nervous System':5,'Rheumatology/Orthopedics & Sports':2,'Infectious Diseases':12,
    'Endocrine, Diabetes & Metabolism':10,'Female Reproductive System & Breast':200,'Male Reproductive System':0,
    'Pregnancy, Childbirth & Puerperium':239,'General Principles':0,'Biostatistics & Epidemiology':1,
    'Ear, Nose & Throat (ENT)':0,'Psychiatric/Behavioral & Substance Use Disorder':6,
    'Poisoning & Environmental Exposure':0,'Ophthalmology':0,'Social Sciences (Ethics/Legal/Professional)':13,
    'Miscellaneous (Multisystem)':1
  },
  'Pediatrics': {
    'Allergy & Immunology':29,'Dermatology':29,'Cardiovascular System':34,'Pulmonary & Critical Care':41,
    'Gastrointestinal & Nutrition':65,'Hematology & Oncology':61,'Renal, Urinary Systems & Electrolytes':41,
    'Nervous System':84,'Rheumatology/Orthopedics & Sports':57,'Infectious Diseases':100,
    'Endocrine, Diabetes & Metabolism':27,'Female Reproductive System & Breast':17,'Male Reproductive System':10,
    'Pregnancy, Childbirth & Puerperium':8,'General Principles':10,'Biostatistics & Epidemiology':4,
    'Ear, Nose & Throat (ENT)':28,'Psychiatric/Behavioral & Substance Use Disorder':26,
    'Poisoning & Environmental Exposure':13,'Ophthalmology':17,'Social Sciences (Ethics/Legal/Professional)':21,
    'Miscellaneous (Multisystem)':12
  },
  'Psychiatry': {
    'Allergy & Immunology':0,'Dermatology':0,'Cardiovascular System':0,'Pulmonary & Critical Care':0,
    'Gastrointestinal & Nutrition':0,'Hematology & Oncology':0,'Renal, Urinary Systems & Electrolytes':0,
    'Nervous System':12,'Rheumatology/Orthopedics & Sports':0,'Infectious Diseases':0,
    'Endocrine, Diabetes & Metabolism':2,'Female Reproductive System & Breast':0,'Male Reproductive System':1,
    'Pregnancy, Childbirth & Puerperium':1,'General Principles':0,'Biostatistics & Epidemiology':0,
    'Ear, Nose & Throat (ENT)':0,'Psychiatric/Behavioral & Substance Use Disorder':320,
    'Poisoning & Environmental Exposure':2,'Ophthalmology':0,'Social Sciences (Ethics/Legal/Professional)':16,
    'Miscellaneous (Multisystem)':0
  },
  'Surgery': {
    'Allergy & Immunology':0,'Dermatology':20,'Cardiovascular System':69,'Pulmonary & Critical Care':62,
    'Gastrointestinal & Nutrition':168,'Hematology & Oncology':21,'Renal, Urinary Systems & Electrolytes':39,
    'Nervous System':56,'Rheumatology/Orthopedics & Sports':86,'Infectious Diseases':39,
    'Endocrine, Diabetes & Metabolism':19,'Female Reproductive System & Breast':11,'Male Reproductive System':25,
    'Pregnancy, Childbirth & Puerperium':1,'General Principles':11,'Biostatistics & Epidemiology':0,
    'Ear, Nose & Throat (ENT)':32,'Psychiatric/Behavioral & Substance Use Disorder':3,
    'Poisoning & Environmental Exposure':7,'Ophthalmology':14,'Social Sciences (Ethics/Legal/Professional)':16,
    'Miscellaneous (Multisystem)':2
  }
};
const SYSTEM_TOTALS = Object.fromEntries(SYSTEMS.map(sys => [sys, SUBJECTS.reduce((s,sub)=>s+(MATRIX[sub.key][sys]||0),0)]));

const ERROR_REASONS = [
  'Knowledge gap','Recall / memoria','Confundí diagnósticos','No reconocí una pista',
  'Interpreté mal el enunciado','Manejo / tratamiento','Error de cálculo',
  'Cambié una respuesta correcta','Overthinking','Falta de tiempo','Otro'
];

const state = {
  attempts:[], sessions:[], settings:{}, baselines:[], attachments:[], activeSession:null,
  currentAttachmentId:null, currentAttachmentIds:[], currentBoardAttachmentId:null, boardBitmap:null, pendingImport:null, timerHandle:null,
  reviewVisibleIds:[], reviewDetailId:null, reviewRecallMode:false, reviewZoom:100, reviewFullZoom:100, visualFullAttemptId:null, visualFullAttachmentId:null,
  deferredInstallPrompt:null,
  cloudUser:null, cloudMode:'local',   // v3.0.0 — set by auth gate
};

const board = {tool:'pen', strokes:[], redo:[], active:null, drawing:false, recentPenAt:0};


// Fullscreen Study Board (v2.6.7 foundation). This is additive: legacy strokes/background
// remain readable, while new questions persist a richer studyBoard object.
const studyBoard = {
  version:1, id:null, tool:'pen', layer:'keep', objects:[], strokes:[],
  selectedIds:[], selectedStrokeIds:[], lasso:null, cropMode:false,
  zoom:1, panX:0, panY:0, dpr:1, width:0, height:0,
  undo:[], redo:[], active:null, recentPenAt:0, pointers:new Map(), gesture:null,
  imageCache:new Map(), removedAttachmentIds:new Set(), framePending:false, historyLocked:false
};
function sbClone(v){return JSON.parse(JSON.stringify(v))}
function sbContentSnapshot(){return {objects:sbClone(studyBoard.objects),strokes:sbClone(studyBoard.strokes)}}
function sbPushHistory(){
  if(studyBoard.historyLocked)return;
  studyBoard.undo.push(sbContentSnapshot());if(studyBoard.undo.length>60)studyBoard.undo.shift();studyBoard.redo=[];
}
function sbRestoreContent(snap){studyBoard.objects=sbClone(snap?.objects||[]);studyBoard.strokes=sbClone(snap?.strokes||[]);studyBoard.selectedIds=[];studyBoard.selectedStrokeIds=[];studyBoard.cropMode=false;sbSyncCurrentAttachmentsFromObjects();sbRequestDraw();sbUpdateContext();sbMarkDirty()}
function sbUndo(){if(!studyBoard.undo.length)return;studyBoard.redo.push(sbContentSnapshot());sbRestoreContent(studyBoard.undo.pop())}
function sbRedo(){if(!studyBoard.redo.length)return;studyBoard.undo.push(sbContentSnapshot());sbRestoreContent(studyBoard.redo.pop())}
function serializeStudyBoard(keepOnly=false){
  const keep=x=>!keepOnly||x.layer!=='scratch';
  return {version:1,id:studyBoard.id|| (studyBoard.id=uuid()),objects:sbClone(studyBoard.objects.filter(keep)),strokes:sbClone(studyBoard.strokes.filter(keep)),view:{zoom:studyBoard.zoom,panX:studyBoard.panX,panY:studyBoard.panY}};
}
function loadStudyBoardData(data){
  const d=data&&typeof data==='object'?data:null;
  studyBoard.id=d?.id||uuid();studyBoard.objects=Array.isArray(d?.objects)?sbClone(d.objects):[];
  studyBoard.strokes=Array.isArray(d?.strokes)?sbClone(d.strokes):[];
  studyBoard.zoom=clamp(Number(d?.view?.zoom)||1,.2,5);studyBoard.panX=Number(d?.view?.panX)||0;studyBoard.panY=Number(d?.view?.panY)||0;
  studyBoard.selectedIds=[];studyBoard.selectedStrokeIds=[];studyBoard.lasso=null;studyBoard.cropMode=false;studyBoard.undo=[];studyBoard.redo=[];studyBoard.active=null;studyBoard.removedAttachmentIds=new Set();
  sbRequestDraw();sbUpdateContext();sbUpdateEmptyHint();sbUpdateZoomLabel();
}
function studyBoardHasVisual(data){return !!((data?.objects||[]).length||(data?.strokes||[]).length)}
function sbMarkDirty(){
  const l=$('#studyBoardSaveLabel'),d=$('#studyBoardSaveDot');if(l)l.textContent='Pendiente local';if(d)d.classList.add('pending');
  saveDraftSoon();sbUpdateEmptyHint();
}
function sbMarkSaved(){const l=$('#studyBoardSaveLabel'),d=$('#studyBoardSaveDot');if(l)l.textContent='Guardado local';if(d)d.classList.remove('pending')}
function sbUpdateEmptyHint(){const h=$('#studyBoardEmptyHint');if(h)h.classList.toggle('hidden',studyBoard.objects.length>0||studyBoard.strokes.length>0)}
function sbUpdateZoomLabel(){const z=$('#studyBoardZoomLabel');if(z)z.textContent=`${Math.round(studyBoard.zoom*100)}%`}
function sbCanvas(){return $('#studyBoardCanvas')}
function sbStage(){return $('#studyBoardStage')}
function sbResizeCanvas(){
  const c=sbCanvas(),stage=sbStage();if(!c||!stage)return;const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;
  studyBoard.dpr=Math.min(window.devicePixelRatio||1,2);studyBoard.width=r.width;studyBoard.height=r.height;c.width=Math.max(1,Math.round(r.width*studyBoard.dpr));c.height=Math.max(1,Math.round(r.height*studyBoard.dpr));c.style.width=`${r.width}px`;c.style.height=`${r.height}px`;sbRequestDraw();
}
function sbScreenPoint(e){const r=sbCanvas().getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function sbScreenToWorld(p){return {x:(p.x-studyBoard.panX)/studyBoard.zoom,y:(p.y-studyBoard.panY)/studyBoard.zoom}}
function sbWorldToScreen(p){return {x:p.x*studyBoard.zoom+studyBoard.panX,y:p.y*studyBoard.zoom+studyBoard.panY}}
function sbSetZoom(next,screenAnchor={x:studyBoard.width/2,y:studyBoard.height/2}){
  const old=studyBoard.zoom,nz=clamp(next,.2,5);if(Math.abs(nz-old)<.0001)return;const world={x:(screenAnchor.x-studyBoard.panX)/old,y:(screenAnchor.y-studyBoard.panY)/old};studyBoard.zoom=nz;studyBoard.panX=screenAnchor.x-world.x*nz;studyBoard.panY=screenAnchor.y-world.y*nz;sbUpdateZoomLabel();sbRequestDraw();
}
function sbFit(){
  const bounds=sbContentBounds();if(!bounds){studyBoard.zoom=1;studyBoard.panX=studyBoard.width/2-300;studyBoard.panY=studyBoard.height/2-180;sbUpdateZoomLabel();sbRequestDraw();return}
  const pad=70,w=Math.max(80,bounds.maxX-bounds.minX),h=Math.max(80,bounds.maxY-bounds.minY),z=clamp(Math.min((studyBoard.width-pad*2)/w,(studyBoard.height-pad*2)/h),.2,2.5);studyBoard.zoom=z;studyBoard.panX=(studyBoard.width-w*z)/2-bounds.minX*z;studyBoard.panY=(studyBoard.height-h*z)/2-bounds.minY*z;sbUpdateZoomLabel();sbRequestDraw();
}
function sbContentBounds(){
  const xs=[],ys=[];for(const o of studyBoard.objects){xs.push(o.x-o.w/2,o.x+o.w/2);ys.push(o.y-o.h/2,o.y+o.h/2)}for(const s of studyBoard.strokes)for(const p of s.points||[]){xs.push(p.x);ys.push(p.y)}if(!xs.length)return null;return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
function sbRequestDraw(){if(studyBoard.framePending)return;studyBoard.framePending=true;requestAnimationFrame(()=>{studyBoard.framePending=false;sbDraw()})}
function sbGetAttachment(id){return attachmentById(id)}
async function sbEnsureImage(id){
  if(!id)return null;if(studyBoard.imageCache.has(id))return studyBoard.imageCache.get(id);const a=sbGetAttachment(id)||await DB.get('attachments',id);if(!a?.blob)return null;
  try{const img=await createImageBitmap(a.blob);studyBoard.imageCache.set(id,img);sbRequestDraw();return img}catch(_){return null}
}
function sbDraw(){
  const c=sbCanvas();if(!c||!studyBoard.width)return;const ctx=c.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.setTransform(studyBoard.dpr,0,0,studyBoard.dpr,0,0);ctx.save();ctx.translate(studyBoard.panX,studyBoard.panY);ctx.scale(studyBoard.zoom,studyBoard.zoom);
  for(const o of studyBoard.objects)sbDrawObject(ctx,o);
  for(const st of studyBoard.strokes)sbDrawStroke(ctx,st);
  if(studyBoard.lasso?.points?.length)sbDrawLasso(ctx,studyBoard.lasso.points);
  for(const id of studyBoard.selectedIds){const o=studyBoard.objects.find(x=>x.id===id);if(o)sbDrawSelection(ctx,o)}
  ctx.restore();
}
function sbDrawObject(ctx,o){
  ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rotation||0);
  if(o.type==='image'){
    const img=studyBoard.imageCache.get(o.attachmentId);if(!img){sbEnsureImage(o.attachmentId);ctx.fillStyle='rgba(120,132,148,.12)';ctx.fillRect(-o.w/2,-o.h/2,o.w,o.h);ctx.strokeStyle='rgba(120,132,148,.35)';ctx.strokeRect(-o.w/2,-o.h/2,o.w,o.h)}else{
      const cr=o.crop||{l:0,t:0,r:1,b:1},iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight;const sx=iw*cr.l,sy=ih*cr.t,sw=iw*Math.max(.01,cr.r-cr.l),sh=ih*Math.max(.01,cr.b-cr.t);ctx.drawImage(img,sx,sy,sw,sh,-o.w/2,-o.h/2,o.w,o.h);
    }
  }else if(o.type==='text'){
    ctx.fillStyle=o.color||'#173a5e';ctx.font=`${o.fontSize||24}px Inter, ui-sans-serif, sans-serif`;ctx.textBaseline='top';const lines=String(o.text||'').split('\n');lines.forEach((line,i)=>ctx.fillText(line,-o.w/2,-o.h/2+i*(o.fontSize||24)*1.25));
  }
  if(o.layer==='scratch'){ctx.strokeStyle='rgba(166,91,0,.38)';ctx.lineWidth=1/studyBoard.zoom;ctx.setLineDash([6/studyBoard.zoom,5/studyBoard.zoom]);ctx.strokeRect(-o.w/2,-o.h/2,o.w,o.h)}
  ctx.restore();
}
function sbDrawStroke(ctx,s){
  const pts=s.points||[];if(!pts.length)return;ctx.save();if(s.layer==='scratch')ctx.globalAlpha=.68;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=s.tool==='highlight'?'rgba(255,190,0,.30)':(s.color||'#173a5e');
  if(pts.length===1){ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(pts[0].x,pts[0].y,(s.tool==='highlight'?14:2.6)*(pts[0].p||.5),0,Math.PI*2);ctx.fill()}else{
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],pressure=((a.p||.5)+(b.p||.5))/2;ctx.lineWidth=(s.tool==='highlight'?26:5)*(s.tool==='highlight'?1:(.55+pressure*.9));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
  }
  ctx.restore();
}
function sbDrawLasso(ctx,pts){if(pts.length<2)return;ctx.save();ctx.strokeStyle='rgba(11,107,203,.75)';ctx.fillStyle='rgba(11,107,203,.07)';ctx.lineWidth=1.5/studyBoard.zoom;ctx.setLineDash([6/studyBoard.zoom,5/studyBoard.zoom]);ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore()}
function sbDrawSelection(ctx,o){
  const inv=1/studyBoard.zoom,hs=8*inv;ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rotation||0);ctx.strokeStyle='#0b6bcb';ctx.fillStyle='#fff';ctx.lineWidth=1.5*inv;ctx.setLineDash([]);ctx.strokeRect(-o.w/2,-o.h/2,o.w,o.h);
  const corners=[[-o.w/2,-o.h/2],[o.w/2,-o.h/2],[o.w/2,o.h/2],[-o.w/2,o.h/2]];for(const [x,y] of corners){ctx.fillRect(x-hs/2,y-hs/2,hs,hs);ctx.strokeRect(x-hs/2,y-hs/2,hs,hs)}
  ctx.beginPath();ctx.moveTo(0,-o.h/2);ctx.lineTo(0,-o.h/2-28*inv);ctx.stroke();ctx.beginPath();ctx.arc(0,-o.h/2-34*inv,5*inv,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(studyBoard.cropMode&&o.type==='image'){ctx.fillStyle='rgba(11,107,203,.92)';const eh=9*inv;for(const [x,y] of [[-o.w/2,0],[o.w/2,0],[0,-o.h/2],[0,o.h/2]]){ctx.fillRect(x-eh/2,y-eh/2,eh,eh)}}ctx.restore();
}
function sbObjectLocalPoint(o,p){const dx=p.x-o.x,dy=p.y-o.y,a=-(o.rotation||0),ca=Math.cos(a),sa=Math.sin(a);return {x:dx*ca-dy*sa,y:dx*sa+dy*ca}}
function sbHitObject(p){for(let i=studyBoard.objects.length-1;i>=0;i--){const o=studyBoard.objects[i],q=sbObjectLocalPoint(o,p);if(Math.abs(q.x)<=o.w/2&&Math.abs(q.y)<=o.h/2)return o}return null}
function sbHitHandle(o,p){
  const q=sbObjectLocalPoint(o,p),tol=15/studyBoard.zoom;if(Math.hypot(q.x,q.y+o.h/2+34/studyBoard.zoom)<tol)return {type:'rotate'};
  if(studyBoard.cropMode&&o.type==='image'){const edges=[['crop-left',-o.w/2,0],['crop-right',o.w/2,0],['crop-top',0,-o.h/2],['crop-bottom',0,o.h/2]];for(const [type,x,y] of edges)if(Math.hypot(q.x-x,q.y-y)<tol)return {type}}
  const cs=[[-o.w/2,-o.h/2],[o.w/2,-o.h/2],[o.w/2,o.h/2],[-o.w/2,o.h/2]];for(const [x,y] of cs)if(Math.hypot(q.x-x,q.y-y)<tol)return {type:'resize'};return null;
}
function sbStrokeDistance(st,p){let best=Infinity;for(const q of st.points||[])best=Math.min(best,Math.hypot(q.x-p.x,q.y-p.y));return best}
function sbEraseAt(p){
  const tol=24/studyBoard.zoom;let best=-1,dist=tol;studyBoard.strokes.forEach((s,i)=>{const d=sbStrokeDistance(s,p);if(d<dist){dist=d;best=i}});if(best>=0){studyBoard.strokes.splice(best,1);sbRequestDraw();sbMarkDirty();return true}return false;
}
function sbSelectedObjects(){return studyBoard.objects.filter(o=>studyBoard.selectedIds.includes(o.id))}
function sbUpdateContext(){
  const bar=$('#studyBoardContextBar'),selected=sbSelectedObjects(),one=selected.length===1?selected[0]:null;if(bar)bar.classList.toggle('hidden',!selected.length&&!studyBoard.selectedStrokeIds.length);
  const crop=$('#studyBoardContextCrop'),top=$('#studyBoardCrop');if(crop)crop.disabled=!(one?.type==='image');if(top)top.disabled=!(one?.type==='image');const lay=$('#studyBoardLayerToggle');if(lay)lay.textContent=one?.layer==='scratch'?'Scratch':'Keep';
}
function sbSelectOnly(id){studyBoard.selectedIds=id?[id]:[];studyBoard.selectedStrokeIds=[];studyBoard.cropMode=false;sbUpdateContext();sbRequestDraw()}
function sbSetTool(tool){studyBoard.tool=tool||'select';studyBoard.cropMode=false;$$('[data-sb-tool]').forEach(b=>b.classList.toggle('active',b.dataset.sbTool===studyBoard.tool));sbRequestDraw()}
function sbSetLayer(layer){studyBoard.layer=layer==='scratch'?'scratch':'keep';$$('[data-sb-layer]').forEach(b=>b.classList.toggle('active',b.dataset.sbLayer===studyBoard.layer));const hint=$('#studyBoardLayerHint');if(hint)hint.textContent=studyBoard.layer==='scratch'?'Scratch se descarta al guardar y siguiente.':'Keep se conserva en Review.'}
async function addStudyBoardImageObject(attachmentId,index=0){
  if(!attachmentId||studyBoard.objects.some(o=>o.type==='image'&&o.attachmentId===attachmentId))return;const img=await sbEnsureImage(attachmentId);const ratio=img?((img.width||1)/(img.height||1)):1.5;const center=sbScreenToWorld({x:studyBoard.width?studyBoard.width/2:600,y:studyBoard.height?studyBoard.height/2:360});let w=520,h=w/ratio;if(h>440){h=440;w=h*ratio}const offset=(index%4)*34;studyBoard.objects.push({id:uuid(),type:'image',attachmentId,x:center.x+offset,y:center.y+offset,w:Math.max(140,w),h:Math.max(100,h),rotation:0,crop:{l:0,t:0,r:1,b:1},layer:studyBoard.layer});sbRequestDraw();sbUpdateEmptyHint();sbMarkDirty();
}
async function ensureStudyBoardObjectsForAttachments(){let n=0;for(const id of state.currentAttachmentIds){if(!studyBoard.objects.some(o=>o.type==='image'&&o.attachmentId===id)){await addStudyBoardImageObject(id,n++)}}}
function sbRemoveAttachmentObject(id){studyBoard.objects=studyBoard.objects.filter(o=>!(o.type==='image'&&o.attachmentId===id));studyBoard.selectedIds=studyBoard.selectedIds.filter(x=>studyBoard.objects.some(o=>o.id===x));sbUpdateContext();sbRequestDraw();sbUpdateEmptyHint()}
function sbSyncCurrentAttachmentsFromObjects(){
  const ids=[...new Set(studyBoard.objects.filter(o=>o.type==='image'&&o.attachmentId).map(o=>o.attachmentId))];
  for(const id of state.currentAttachmentIds){if(!ids.includes(id))studyBoard.removedAttachmentIds.add(id)}
  for(const id of ids)studyBoard.removedAttachmentIds.delete(id);
  state.currentAttachmentIds=ids;if(!ids.includes(state.currentBoardAttachmentId))state.currentBoardAttachmentId=ids[0]||null;syncCurrentPrimary();updateAttachmentUI();
}
function sbToggleCrop(){const o=sbSelectedObjects()[0];if(!o||sbSelectedObjects().length!==1||o.type!=='image')return toast('Selecciona una imagen para recortarla.');const next=!studyBoard.cropMode;sbSetTool('select');studyBoard.cropMode=next;sbUpdateContext();sbRequestDraw();if(next)toast('Arrastra los controles centrales de los bordes para recortar.')}
function sbDuplicateSelection(){const objs=sbSelectedObjects(),st=studyBoard.strokes.filter(s=>studyBoard.selectedStrokeIds.includes(s.id));if(!objs.length&&!st.length)return;sbPushHistory();const newIds=[];for(const o of objs){const c=sbClone(o);c.id=uuid();c.x+=28;c.y+=28;studyBoard.objects.push(c);newIds.push(c.id)}const newSt=[];for(const s of st){const c=sbClone(s);c.id=uuid();c.points=(c.points||[]).map(p=>({...p,x:p.x+28,y:p.y+28}));studyBoard.strokes.push(c);newSt.push(c.id)}studyBoard.selectedIds=newIds;studyBoard.selectedStrokeIds=newSt;sbUpdateContext();sbRequestDraw();sbMarkDirty()}
function sbDeleteSelection(){if(!studyBoard.selectedIds.length&&!studyBoard.selectedStrokeIds.length)return;sbPushHistory();studyBoard.objects=studyBoard.objects.filter(o=>!studyBoard.selectedIds.includes(o.id));studyBoard.strokes=studyBoard.strokes.filter(s=>!studyBoard.selectedStrokeIds.includes(s.id));studyBoard.selectedIds=[];studyBoard.selectedStrokeIds=[];studyBoard.cropMode=false;sbSyncCurrentAttachmentsFromObjects();sbUpdateContext();sbRequestDraw();sbMarkDirty()}
function sbMoveZ(front=true){const ids=new Set(studyBoard.selectedIds);if(!ids.size)return;sbPushHistory();const selected=studyBoard.objects.filter(o=>ids.has(o.id)),rest=studyBoard.objects.filter(o=>!ids.has(o.id));studyBoard.objects=front?[...rest,...selected]:[...selected,...rest];sbRequestDraw();sbMarkDirty()}
function sbToggleSelectedLayer(){const objs=sbSelectedObjects(),sts=studyBoard.strokes.filter(s=>studyBoard.selectedStrokeIds.includes(s.id));if(!objs.length&&!sts.length)return;const next=(objs[0]?.layer||sts[0]?.layer)==='scratch'?'keep':'scratch';sbPushHistory();objs.forEach(o=>o.layer=next);sts.forEach(s=>s.layer=next);sbUpdateContext();updateAttachmentUI();sbRequestDraw();sbMarkDirty()}
function sbClearScratch(){const any=studyBoard.objects.some(o=>o.layer==='scratch')||studyBoard.strokes.some(s=>s.layer==='scratch');if(!any)return toast('Scratch está vacío.');if(!confirm('¿Limpiar todo el contenido Scratch de esta pregunta?'))return;sbPushHistory();studyBoard.objects=studyBoard.objects.filter(o=>o.layer!=='scratch');studyBoard.strokes=studyBoard.strokes.filter(s=>s.layer!=='scratch');studyBoard.selectedIds=[];studyBoard.selectedStrokeIds=[];sbSyncCurrentAttachmentsFromObjects();sbUpdateContext();sbRequestDraw();sbMarkDirty()}
function sbEditSelectedText(){const o=sbSelectedObjects()[0];if(!o||o.type!=='text')return;const text=prompt('Editar texto:',o.text||'');if(text==null)return;sbPushHistory();o.text=text;o.w=Math.max(120,Math.min(700,text.split('\n').reduce((m,x)=>Math.max(m,x.length),0)*(o.fontSize||24)*.58+28));o.h=Math.max(48,text.split('\n').length*(o.fontSize||24)*1.25+18);sbRequestDraw();sbMarkDirty()}
function sbAddTextAt(p){const text=prompt('Texto para el Study Board:','');if(!text)return;sbPushHistory();const fs=24,w=Math.max(120,Math.min(700,text.split('\n').reduce((m,x)=>Math.max(m,x.length),0)*fs*.58+28)),h=Math.max(48,text.split('\n').length*fs*1.25+18),o={id:uuid(),type:'text',text,x:p.x,y:p.y,w,h,rotation:0,fontSize:fs,color:'#173a5e',layer:studyBoard.layer};studyBoard.objects.push(o);sbSelectOnly(o.id);sbMarkDirty()}
function sbPointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=((a.y>p.y)!=(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside}return inside}
function sbFinishLasso(){const poly=studyBoard.lasso?.points||[];if(poly.length<3){studyBoard.lasso=null;sbRequestDraw();return}studyBoard.selectedIds=studyBoard.objects.filter(o=>sbPointInPolygon({x:o.x,y:o.y},poly)).map(o=>o.id);studyBoard.selectedStrokeIds=studyBoard.strokes.filter(s=>(s.points||[]).some(p=>sbPointInPolygon(p,poly))).map(s=>s.id);studyBoard.lasso=null;sbUpdateContext();sbRequestDraw();sbSetTool('select')}
function sbPointerDown(e){
  const c=sbCanvas();if(!c)return;if(e.pointerType==='pen')studyBoard.recentPenAt=Date.now();const sp=sbScreenPoint(e);
  if(e.pointerType==='touch'){
    if(Date.now()-studyBoard.recentPenAt<900&&Math.max(e.width||0,e.height||0)>18)return;e.preventDefault();c.setPointerCapture?.(e.pointerId);studyBoard.pointers.set(e.pointerId,sp);$('#studyBoardPointerStatus').textContent='Touch';
    if(studyBoard.pointers.size===1)studyBoard.gesture={type:'pan',id:e.pointerId,start:sp,panX:studyBoard.panX,panY:studyBoard.panY};
    else if(studyBoard.pointers.size===2){const pts=[...studyBoard.pointers.values()],dx=pts[1].x-pts[0].x,dy=pts[1].y-pts[0].y,mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};studyBoard.gesture={type:'pinch',dist:Math.hypot(dx,dy)||1,zoom:studyBoard.zoom,anchor:sbScreenToWorld(mid)};}return;
  }
  e.preventDefault();c.setPointerCapture?.(e.pointerId);$('#studyBoardPointerStatus').textContent=e.pointerType==='pen'?'Stylus':'Mouse';const p=sbScreenToWorld(sp),barrel=e.pointerType==='pen'&&((e.buttons&2)===2||e.button===2),tool=barrel?'eraser':studyBoard.tool;
  if(tool==='pen'||tool==='highlight'){sbPushHistory();const st={id:uuid(),tool,layer:studyBoard.layer,points:[{...p,p:e.pressure>0?e.pressure:.5}]};studyBoard.strokes.push(st);studyBoard.active={type:'stroke',id:st.id};sbRequestDraw();return}
  if(tool==='eraser'){sbPushHistory();sbEraseAt(p);studyBoard.active={type:'eraser'};return}
  if(tool==='lasso'){studyBoard.lasso={points:[p]};studyBoard.active={type:'lasso'};sbRequestDraw();return}
  if(tool==='text'){sbAddTextAt(p);sbSetTool('select');return}
  const selected=sbSelectedObjects();if(selected.length===1){const h=sbHitHandle(selected[0],p);if(h){sbPushHistory();studyBoard.active={type:h.type,id:selected[0].id,start:p,startObj:sbClone(selected[0])};return}}
  const selectedStrokeHit=studyBoard.strokes.some(st=>studyBoard.selectedStrokeIds.includes(st.id)&&sbStrokeDistance(st,p)<18/studyBoard.zoom);
  const hit=sbHitObject(p);if(hit||selectedStrokeHit){if(hit&&!studyBoard.selectedIds.includes(hit.id)){studyBoard.selectedIds=[hit.id];studyBoard.selectedStrokeIds=[];studyBoard.cropMode=false;sbUpdateContext();sbRequestDraw()}sbPushHistory();studyBoard.active={type:'move',start:p,objects:sbSelectedObjects().map(o=>({id:o.id,x:o.x,y:o.y})),strokes:studyBoard.strokes.filter(s=>studyBoard.selectedStrokeIds.includes(s.id)).map(s=>({id:s.id,points:sbClone(s.points)}))};}
  else{studyBoard.selectedIds=[];studyBoard.selectedStrokeIds=[];studyBoard.cropMode=false;sbUpdateContext();sbRequestDraw();studyBoard.active={type:'pan',start:sp,panX:studyBoard.panX,panY:studyBoard.panY}}
}
function sbPointerMove(e){
  const sp=sbScreenPoint(e),c=sbCanvas();if(e.pointerType==='touch'){
    if(!studyBoard.pointers.has(e.pointerId))return;e.preventDefault();studyBoard.pointers.set(e.pointerId,sp);
    if(studyBoard.pointers.size>=2&&studyBoard.gesture?.type==='pinch'){const pts=[...studyBoard.pointers.values()].slice(0,2),dx=pts[1].x-pts[0].x,dy=pts[1].y-pts[0].y,mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2},nz=clamp(studyBoard.gesture.zoom*(Math.hypot(dx,dy)||1)/studyBoard.gesture.dist,.2,5);studyBoard.zoom=nz;studyBoard.panX=mid.x-studyBoard.gesture.anchor.x*nz;studyBoard.panY=mid.y-studyBoard.gesture.anchor.y*nz;sbUpdateZoomLabel();sbRequestDraw();}
    else if(studyBoard.gesture?.type==='pan'&&studyBoard.gesture.id===e.pointerId){studyBoard.panX=studyBoard.gesture.panX+(sp.x-studyBoard.gesture.start.x);studyBoard.panY=studyBoard.gesture.panY+(sp.y-studyBoard.gesture.start.y);sbRequestDraw()}return;
  }
  const a=studyBoard.active;if(!a)return;e.preventDefault();const p=sbScreenToWorld(sp);
  if(a.type==='stroke'){
    const st=studyBoard.strokes.find(x=>x.id===a.id);if(!st)return;
    const samples=typeof e.getCoalescedEvents==='function'?(e.getCoalescedEvents().length?e.getCoalescedEvents():[e]):[e];
    for(const ev of samples){const wp=sbScreenToWorld(sbScreenPoint(ev)),last=st.points.at(-1);if(!last||Math.hypot(wp.x-last.x,wp.y-last.y)>1.2/studyBoard.zoom)st.points.push({...wp,p:ev.pressure>0?ev.pressure:.5})}
    sbRequestDraw();return
  }
  if(a.type==='eraser'){sbEraseAt(p);return}
  if(a.type==='lasso'){studyBoard.lasso.points.push(p);sbRequestDraw();return}
  if(a.type==='pan'){studyBoard.panX=a.panX+(sp.x-a.start.x);studyBoard.panY=a.panY+(sp.y-a.start.y);sbRequestDraw();return}
  const o=studyBoard.objects.find(x=>x.id===a.id);
  if(a.type==='move'){const dx=p.x-a.start.x,dy=p.y-a.start.y;for(const st of a.objects){const ob=studyBoard.objects.find(x=>x.id===st.id);if(ob){ob.x=st.x+dx;ob.y=st.y+dy}}for(const ss of a.strokes){const st=studyBoard.strokes.find(x=>x.id===ss.id);if(st)st.points=ss.points.map(q=>({...q,x:q.x+dx,y:q.y+dy}))}sbRequestDraw();return}
  if(!o)return;
  if(a.type==='resize'){const q=sbObjectLocalPoint({...a.startObj,x:o.x,y:o.y},p);o.w=Math.max(70,Math.abs(q.x)*2);o.h=Math.max(50,Math.abs(q.y)*2);sbRequestDraw();return}
  if(a.type==='rotate'){o.rotation=Math.atan2(p.y-o.y,p.x-o.x)+Math.PI/2;sbRequestDraw();return}
  if(a.type.startsWith('crop-')){const q=sbObjectLocalPoint(a.startObj,p),cr={...(a.startObj.crop||{l:0,t:0,r:1,b:1})},nx=clamp(q.x/a.startObj.w+.5,0,1),ny=clamp(q.y/a.startObj.h+.5,0,1);if(a.type==='crop-left')cr.l=clamp(cr.l+nx*(cr.r-cr.l),0,cr.r-.05);if(a.type==='crop-right')cr.r=clamp(cr.l+nx*(cr.r-cr.l),cr.l+.05,1);if(a.type==='crop-top')cr.t=clamp(cr.t+ny*(cr.b-cr.t),0,cr.b-.05);if(a.type==='crop-bottom')cr.b=clamp(cr.t+ny*(cr.b-cr.t),cr.t+.05,1);o.crop=cr;sbRequestDraw();return}
}
function sbPointerUp(e){
  if(e.pointerType==='touch'){studyBoard.pointers.delete(e.pointerId);if(studyBoard.pointers.size===1){const [id,p]=[...studyBoard.pointers.entries()][0];studyBoard.gesture={type:'pan',id,start:p,panX:studyBoard.panX,panY:studyBoard.panY}}else if(!studyBoard.pointers.size)studyBoard.gesture=null;return}
  const a=studyBoard.active;if(!a)return;studyBoard.active=null;if(a.type==='lasso'){sbFinishLasso();return}if(['stroke','eraser','move','resize','rotate'].includes(a.type)||String(a.type).startsWith('crop-'))sbMarkDirty();
}
function setupStudyBoard(){
  const c=sbCanvas();if(!c)return;c.addEventListener('pointerdown',sbPointerDown);c.addEventListener('pointermove',sbPointerMove);c.addEventListener('pointerup',sbPointerUp);c.addEventListener('pointercancel',sbPointerUp);
  c.addEventListener('dblclick',e=>{const o=sbHitObject(sbScreenToWorld(sbScreenPoint(e)));if(o?.type==='text'){sbSelectOnly(o.id);sbEditSelectedText()}});
  c.addEventListener('wheel',e=>{if($('#studyBoardOverlay')?.classList.contains('hidden'))return;e.preventDefault();const p=sbScreenPoint(e);sbSetZoom(studyBoard.zoom*Math.exp(-e.deltaY*.0012),p)},{passive:false});
  window.addEventListener('resize',()=>{if(!$('#studyBoardOverlay')?.classList.contains('hidden'))sbResizeCanvas()});
  const stage=sbStage();if(stage){stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('dragging')});stage.addEventListener('dragleave',()=>stage.classList.remove('dragging'));stage.addEventListener('drop',e=>{e.preventDefault();stage.classList.remove('dragging');processImageFiles([...(e.dataTransfer?.files||[])])})}
  document.addEventListener('keydown',e=>{if($('#studyBoardOverlay')?.classList.contains('hidden'))return;if(e.key==='Escape'){e.preventDefault();closeStudyBoard();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?sbRedo():sbUndo();return}if((e.key==='Delete'||e.key==='Backspace')&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();sbDeleteSelection()}});
}
async function openStudyBoard(selectAttachmentId=null){
  if(!state.activeSession)return toast('Inicia un bloque antes de abrir el Study Board.');await ensureStudyBoardObjectsForAttachments();const ov=$('#studyBoardOverlay');ov?.classList.remove('hidden');ov?.setAttribute('aria-hidden','false');document.body.classList.add('study-board-open');const q=$('#qQuestionId')?.value.trim();$('#studyBoardQuestionLabel').textContent=q?`Q #${q}`:`Pregunta ${state.activeSession.completedCount+1}`;$('#studyBoardSubjectLabel').textContent=state.activeSession.subject;
  requestAnimationFrame(()=>{sbResizeCanvas();if(selectAttachmentId){const o=studyBoard.objects.find(x=>x.type==='image'&&x.attachmentId===selectAttachmentId);if(o)sbSelectOnly(o.id)}if(studyBoard.objects.length&&!studyBoard.panX&&!studyBoard.panY)sbFit();sbRequestDraw()});sbMarkSaved();
}
function closeStudyBoard(){const ov=$('#studyBoardOverlay');if(!ov||ov.classList.contains('hidden'))return;saveDraft();ov.classList.add('hidden');ov.setAttribute('aria-hidden','true');document.body.classList.remove('study-board-open');sbMarkSaved();}
async function sbRenderSnapshot(data,canvas){
  if(!canvas||!data)return false;const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);const objs=data.objects||[],sts=data.strokes||[];if(!objs.length&&!sts.length)return false;const xs=[],ys=[];for(const o of objs){xs.push(o.x-o.w/2,o.x+o.w/2);ys.push(o.y-o.h/2,o.y+o.h/2)}for(const st of sts)for(const p of st.points||[]){xs.push(p.x);ys.push(p.y)}const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY),pad=45,scale=Math.min((W-pad*2)/bw,(H-pad*2)/bh);ctx.save();ctx.translate((W-bw*scale)/2-minX*scale,(H-bh*scale)/2-minY*scale);ctx.scale(scale,scale);
  for(const o of objs){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rotation||0);if(o.type==='image'){const att=attachmentById(o.attachmentId)||await DB.get('attachments',o.attachmentId);if(att?.blob){try{const img=await createImageBitmap(att.blob),cr=o.crop||{l:0,t:0,r:1,b:1};ctx.drawImage(img,img.width*cr.l,img.height*cr.t,img.width*(cr.r-cr.l),img.height*(cr.b-cr.t),-o.w/2,-o.h/2,o.w,o.h);img.close?.()}catch(_){}}}else if(o.type==='text'){ctx.fillStyle=o.color||'#173a5e';ctx.font=`${o.fontSize||24}px sans-serif`;ctx.textBaseline='top';String(o.text||'').split('\n').forEach((line,i)=>ctx.fillText(line,-o.w/2,-o.h/2+i*(o.fontSize||24)*1.25))}ctx.restore()}
  for(const st of sts)sbDrawStroke(ctx,st);ctx.restore();return true;
}
function attemptAttachmentIds(a){
  const ids=[];
  if(Array.isArray(a?.attachmentIds)) ids.push(...a.attachmentIds.filter(Boolean));
  if(a?.attachmentId) ids.push(a.attachmentId);
  return [...new Set(ids)];
}
function attemptBoardAttachmentId(a){if(a&&Object.prototype.hasOwnProperty.call(a,'boardAttachmentId'))return a.boardAttachmentId||null;return a?.attachmentId||attemptAttachmentIds(a)[0]||null}
function attachmentById(id){return id?state.attachments.find(x=>x.id===id):null}
function syncCurrentPrimary(){state.currentAttachmentId=state.currentBoardAttachmentId||state.currentAttachmentIds[0]||null}

const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const uuid=()=>crypto.randomUUID?.() || ('m_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
const nowISO=()=>new Date().toISOString();
const dayKey=(d=new Date())=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const escapeHTML=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const fmtInt=(n)=>Number(n||0).toLocaleString('en-US');
const fmtDate=(v)=>new Intl.DateTimeFormat('es-PA',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v));
const fmtDateTime=(v)=>new Intl.DateTimeFormat('es-PA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const pct=(a,b)=>b?Math.round((a/b)*1000)/10:0;
const bytesLabel=(n)=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function savePulse(msg='Guardado'){const el=$('#saveState');el.textContent=msg;setTimeout(()=>el.textContent='Guardado local',1200)}

async function setSetting(key,value){
  state.settings[key]=value; await DB.put('settings',{key,value}); savePulse();
}
function getSetting(key,fallback){return state.settings[key] ?? fallback}
function removeLegacyWorkspaceControls(){
  // v2.6.7: the old external-QBank escape hatch is intentionally retired.
  $('#workspaceOpenExternal')?.remove();
  $$('button,a').forEach(el=>{if(/\babrir\s+aparte\b/i.test(String(el.textContent||'')))el.remove()});
}

async function init(){
  await DB.openDB();

  // v3.0.0: wait for auth gate (Supabase login overlay or local-only mode)
  // before loading user-scoped data. This is non-blocking: if Supabase is
  // not configured, gate() resolves immediately with mode='local'.
  if (window.DrCoachAuth) {
    try {
      const { user, mode } = await window.DrCoachAuth.gate();
      state.cloudUser = user || null;
      state.cloudMode = mode || 'local';
    } catch (e) {
      console.warn('Auth gate failed, proceeding in local mode', e);
      state.cloudUser = null; state.cloudMode = 'local';
    }
  } else {
    state.cloudUser = null; state.cloudMode = 'local';
  }

  // Update brand footer to reflect cloud / local mode
  updateBrandFooter();

  // Pull from cloud BEFORE loading local state so any remote updates
  // are visible immediately. If cloud is disabled this is a no-op.
  if (window.DrCoachSync && state.cloudUser) {
    try { await window.DrCoachSync.init(); await window.DrCoachSync.pull(true); } catch(e){ console.warn('Initial pull failed', e); }
  }

  const [attempts,sessions,settings,baselines,attachments]=await Promise.all(['attempts','sessions','settings','baselines','attachments'].map(DB.getAll));
  state.attempts=attempts; state.sessions=sessions; state.baselines=baselines; state.attachments=attachments;
  state.settings=Object.fromEntries(settings.map(x=>[x.key,x.value]));
  if(!state.settings.dailyGoal) await setSetting('dailyGoal',16);
  if(!state.settings.deadline) await setSetting('deadline',DEADLINE);
  if(!state.settings.trackerStartDate) await setSetting('trackerStartDate',dayKey());
  if(!state.settings.schemaVersion) await setSetting('schemaVersion',SCHEMA_VERSION);
  if(state.settings.focusDockVisible===undefined) await setSetting('focusDockVisible',true);
  if(!state.settings.themeMode) await setSetting('themeMode','auto');
  populateStaticControls();
  bindEvents();
  removeLegacyWorkspaceControls();
  initThemes();
  initFocusRadio();
  updateDayGreeting();
  await restoreActiveSession();
  renderAll();
  setupBoard();
  setupStudyBoard();
  registerServiceWorker();
  updateStorageHealth();

  // Inject cloud user controls (avatar + logout) into the topbar
  if (window.DrCoachAuth && state.cloudUser) injectCloudUserChip();
}

function updateBrandFooter(){
  const foot = document.querySelector('.sidebar-foot small');
  if (!foot) return;
  const mode = state.cloudMode === 'cloud' ? 'Cloud Sync' : 'Local-only';
  foot.textContent = `v${APP_VERSION.replace('-cloud.1','')} · ${mode}`;
}

function injectCloudUserChip(){
  const topActions = document.querySelector('.top-actions');
  if (!topActions || document.getElementById('cloudUserChip')) return;
  const u = state.cloudUser;
  const initial = (u?.email || '?').charAt(0).toUpperCase();
  const chip = document.createElement('button');
  chip.id = 'cloudUserChip';
  chip.className = 'btn btn-ghost btn-small cloud-user-chip';
  chip.title = `Sesión: ${u?.email || ''}\nCerrar sesión y volver al login`;
  chip.innerHTML = `<span class="cloud-user-avatar">${escapeHTML(initial)}</span> <span class="cloud-user-name">${escapeHTML((u?.user_metadata?.display_name) || u?.email || 'Usuario')}</span>`;
  chip.addEventListener('click', async () => {
    if (!confirm('¿Cerrar sesión de Dr.Coach! Cloud?\n\nTu progreso local queda intacto. La próxima vez podrás iniciar sesión con otra cuenta o seguir en modo local.')) return;
    try { await window.DrCoachAuth.logout(); } catch(e){ console.warn(e); location.reload(); }
  });
  topActions.prepend(chip);
}

function populateStaticControls(){
  const opts=SUBJECTS.map(s=>`<option value="${escapeHTML(s.key)}">${escapeHTML(s.label)} · ${fmtInt(s.total)}</option>`).join('');
  ['sessionSubject','baselineSubject','workspaceSessionSubject'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML=opts});
  $('#historySubjectFilter').insertAdjacentHTML('beforeend',opts);
  $('#reviewSubjectFilter')?.insertAdjacentHTML('beforeend',opts);
  $('#aiExportSubject')?.insertAdjacentHTML('beforeend',opts);
  const curveOpts='<option value="ALL">Todas las materias</option>'+opts;
  $('#homeCurveSubject').innerHTML=curveOpts; $('#analyticsCurveSubject').innerHTML=curveOpts;
  $('#sessionSubject').value='Psychiatry';
  renderBaselineSystems(); renderErrorReasons(); renderEditErrorReasons(); renderReviewFilterSystems(); renderRuntimeModeInfo(); renderAIExportPreview();
}
function renderErrorReasons(){
  $('#errorReasonChips').innerHTML=ERROR_REASONS.map(r=>`<button type="button" class="reason-chip" data-reason="${escapeHTML(r)}">${escapeHTML(r)}</button>`).join('');
}
function renderEditErrorReasons(){
  const box=$('#editErrorReasonChips');if(!box)return;box.innerHTML=ERROR_REASONS.map(r=>`<button type="button" class="reason-chip" data-reason="${escapeHTML(r)}">${escapeHTML(r)}</button>`).join('');
}
function renderReviewFilterSystems(){
  const box=$('#reviewSystemFilter');if(!box)return;const subject=$('#reviewSubjectFilter')?.value||'';const systems=subject?validSystems(subject):SYSTEMS;const cur=box.value;box.innerHTML='<option value="">Todos los Systems</option>'+systems.map(sys=>`<option value="${escapeHTML(sys)}">${escapeHTML(sys)}</option>`).join('');if([...box.options].some(o=>o.value===cur))box.value=cur;
}
function validSystems(subject){return SYSTEMS.filter(sys=>(MATRIX[subject]?.[sys]||0)>0)}
function systemOptions(subject, includeUnknown=true){
  const valid=validSystems(subject).sort((a,b)=>(MATRIX[subject][b]||0)-(MATRIX[subject][a]||0));
  return (includeUnknown?'<option value="">Selecciona System</option>':'') + valid.map(sys=>`<option value="${escapeHTML(sys)}">${escapeHTML(sys)} · ${MATRIX[subject][sys]}</option>`).join('');
}
function renderBaselineSystems(){
  const subject=$('#baselineSubject').value;
  $('#baselineSystem').innerHTML='<option value="">No lo sé / no clasificado</option>'+systemOptions(subject,false);
}

function bindEvents(){
  $$('.nav-item[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  $('#focusNavBtn')?.addEventListener('click',e=>{if(e.target.closest('#focusDockSidebarSwitch'))return;setFocusPanel(true);$('#focusPanel')?.querySelector('button, input, select')?.focus({preventScroll:true})});
  $('#focusDockSidebarSwitch')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setFocusDockVisible(!getSetting('focusDockVisible',true),true)});
  $$('[data-view-target]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.viewTarget)));
  $$('[data-start-session]').forEach(btn=>btn.addEventListener('click',()=>showView('session')));
  $('#quickSessionBtn').addEventListener('click',()=>showView('session'));
  $('#workspaceStartSession')?.addEventListener('click',startSessionFromWorkspace);
  $('#workspaceNewSession')?.addEventListener('click',()=>renderIntegratedWorkspace(true));
  $('#workspaceReloadFrame')?.addEventListener('click',()=>reloadMedicospiraFrame(false));
  $('#workspaceHomeFrame')?.addEventListener('click',()=>reloadMedicospiraFrame(true));
  $('#workspaceTranslateChrome')?.addEventListener('click',toggleMedicospiraInlineTranslation);
  $('#workspaceToggleCoach')?.addEventListener('click',toggleIntegratedCoach);
  $('#workspaceFrameWide')?.addEventListener('click',toggleWorkspaceFrameWide);
  $('#workspaceSidebarToggle')?.addEventListener('click',toggleWorkspaceSidebar);
  $('#workspaceDismissHint')?.addEventListener('click',()=>{$('#workspaceFrameHint')?.classList.add('hidden');setSetting('workspaceHintDismissed',true)});
  $('#workspaceCaptureTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-capture-tab]');if(b)setWorkspaceCaptureTab(b.dataset.captureTab)});
  $('#medicospiraFrame')?.addEventListener('load',()=>{$('#workspaceFrameStatus').textContent='QBank cargado';setTimeout(pingMedicospiraCompanion,350)});
  window.addEventListener('message',handleMedicospiraCompanionMessage);
  $$('.chip-btn[data-count]').forEach(btn=>btn.addEventListener('click',()=>{$$('.chip-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#sessionCount').value=btn.dataset.count}));
  $('#sessionCount').addEventListener('input',()=>{$$('.chip-btn').forEach(x=>x.classList.toggle('active',x.dataset.count===$('#sessionCount').value))});
  $('#startSessionBtn').addEventListener('click',startSession);
  $('#pauseSessionBtn').addEventListener('click',togglePauseSession);
  $('#endSessionEarlyBtn').addEventListener('click',endSessionEarly);
  $('#saveNextBtn').addEventListener('click',saveCurrentQuestion);
  $('#sameSubjectOneBtn').addEventListener('click',()=>startSameSubject(1));
  $('#sameSubjectFiveBtn').addEventListener('click',()=>startSameSubject(5));
  $('#editTodayGoal').addEventListener('click',editDailyGoal);
  $('#baselineSubject').addEventListener('change',renderBaselineSystems);
  $('#addBaselineBtn').addEventListener('click',addBaseline);
  $('#requestPersistenceBtn').addEventListener('click',requestPersistence);
  $('#exportDataBtn').addEventListener('click',exportDataOnly);
  $('#exportFullBtn').addEventListener('click',exportFull);
  // v3.0.0 — Cloud Sync buttons in Datos view
  $('#cloudPushAllBtn')?.addEventListener('click',cloudPushAll);
  $('#cloudPullAllBtn')?.addEventListener('click',cloudPullAll);
  $('#cloudRefreshBtn')?.addEventListener('click',cloudRefreshStatus);
  $('#cloudDiagBtn')?.addEventListener('click',cloudDiagnose);
  $('#cloudRetryBtn')?.addEventListener('click',cloudRetryFailed);
  $('#cloudClearQueueBtn')?.addEventListener('click',cloudClearQueue);
  $('#copyAIReportBtn')?.addEventListener('click',()=>exportAIReport(true));
  $('#downloadAIReportBtn')?.addEventListener('click',()=>exportAIReport(false));
  $('#aiExportScope')?.addEventListener('change',renderAIExportPreview);
  $('#aiExportSubject')?.addEventListener('change',renderAIExportPreview);
  $('#aiIncludeStem')?.addEventListener('change',renderAIExportPreview);
  $('#aiIncludeCorrect')?.addEventListener('change',renderAIExportPreview);
  $('#installAppBtn')?.addEventListener('click',installPWA);
  $('#importFile').addEventListener('change',previewImport);
  $('#confirmImportBtn').addEventListener('click',confirmImport);
  $('#resetAllBtn').addEventListener('click',resetAll);
  $('#historySubjectFilter').addEventListener('change',renderHistory);
  $('#historyResultFilter').addEventListener('change',renderHistory);
  $('#historySearch').addEventListener('input',renderHistory);
  $('#reviewSubjectFilter')?.addEventListener('change',()=>{renderReviewFilterSystems();renderReview()});
  $('#reviewSystemFilter')?.addEventListener('change',renderReview);
  $('#reviewKindFilter')?.addEventListener('change',renderReview);
  $('#reviewSearch')?.addEventListener('input',renderReview);
  $('#homeCurveSubject').addEventListener('change',()=>drawProgressChart($('#homeProgressChart'),$('#homeCurveSubject').value));
  $('#analyticsCurveSubject').addEventListener('change',()=>drawProgressChart($('#analyticsProgressChart'),$('#analyticsCurveSubject').value));
  $('#saveEditAttemptBtn').addEventListener('click',saveAttemptEdit);
  $('#deleteAttemptBtn').addEventListener('click',deleteEditedAttempt);
  $('#editAttemptDialog').addEventListener('click',e=>{if(e.target===$('#editAttemptDialog')) $('#editAttemptDialog').close()});
  $('#editErrorReasonChips')?.addEventListener('click',e=>{const b=e.target.closest('.reason-chip');if(b)b.classList.toggle('active')});
  $('#editViewAttachmentBtn')?.addEventListener('click',()=>openEditedVisualFull());
  $('#editRemoveAttachmentBtn')?.addEventListener('click',removeEditedAttachment);

  $('#closeReviewDetail')?.addEventListener('click',()=>$('#reviewDetailDialog').close());
  $('#reviewDetailDialog')?.addEventListener('click',e=>{if(e.target===$('#reviewDetailDialog'))$('#reviewDetailDialog').close()});
  $('#reviewReadMode')?.addEventListener('click',()=>setReviewRecallMode(false));
  $('#reviewRecallMode')?.addEventListener('click',()=>setReviewRecallMode(true));
  $('#reviewPrevBtn')?.addEventListener('click',()=>moveReviewDetail(-1));
  $('#reviewNextBtn')?.addEventListener('click',()=>moveReviewDetail(1));
  $('#reviewEditBtn')?.addEventListener('click',()=>{const id=state.reviewDetailId;if(!id)return;$('#reviewDetailDialog').close();openAttemptEdit(id)});
  $('#reviewForgotBtn')?.addEventListener('click',()=>recordReviewAssessment('forgot'));
  $('#reviewPartialBtn')?.addEventListener('click',()=>recordReviewAssessment('partial'));
  $('#reviewMasterBtn')?.addEventListener('click',()=>recordReviewAssessment('mastered'));
  $('#reviewZoomOut')?.addEventListener('click',()=>setReviewZoom(state.reviewZoom-25,false));
  $('#reviewZoomIn')?.addEventListener('click',()=>setReviewZoom(state.reviewZoom+25,false));
  $('#reviewZoomReset')?.addEventListener('click',()=>setReviewZoom(100,false));
  $('#openReviewVisualFull')?.addEventListener('click',openReviewVisualFull);
  $('#closeReviewVisualFull')?.addEventListener('click',()=>$('#reviewVisualDialog').close());
  $('#reviewVisualDialog')?.addEventListener('click',e=>{if(e.target===$('#reviewVisualDialog'))$('#reviewVisualDialog').close()});
  $('#reviewFullZoomOut')?.addEventListener('click',()=>setReviewZoom(state.reviewFullZoom-25,true));
  $('#reviewFullZoomIn')?.addEventListener('click',()=>setReviewZoom(state.reviewFullZoom+25,true));
  $('#reviewFullZoomReset')?.addEventListener('click',()=>setReviewZoom(100,true));

  $('#resultSegment').addEventListener('click',e=>{const b=e.target.closest('[data-value]');if(!b)return;selectSegment('#resultSegment',b.dataset.value);saveDraftSoon()});
  $('#confidenceSegment').addEventListener('click',e=>{const b=e.target.closest('[data-value]');if(!b)return;const cur=getSegment('#confidenceSegment');selectSegment('#confidenceSegment',cur===b.dataset.value?'':b.dataset.value);saveDraftSoon()});
  $('#errorReasonChips').addEventListener('click',e=>{const b=e.target.closest('.reason-chip');if(!b)return;b.classList.toggle('active');saveDraftSoon()});
  ['qQuestionId','qSystem','qTopic','qFocus','qStem','qConcept','qWhyFailed','qRule','qNotes'].forEach(id=>$('#'+id)?.addEventListener('input',saveDraftSoon));
  $('#pasteStemBtn')?.addEventListener('click',pasteStemFromClipboard);
  $('#openStudyBoardBtn')?.addEventListener('click',()=>openStudyBoard());
  $('#closeStudyBoardBtn')?.addEventListener('click',closeStudyBoard);
  $$('[data-sb-tool]').forEach(btn=>btn.addEventListener('click',()=>sbSetTool(btn.dataset.sbTool)));
  $$('[data-sb-layer]').forEach(btn=>btn.addEventListener('click',()=>sbSetLayer(btn.dataset.sbLayer)));
  $('#studyBoardAddImage')?.addEventListener('click',()=>$('#studyBoardImageInput')?.click());
  $('#studyBoardImageInput')?.addEventListener('change',handleScreenshot);
  $('#studyBoardCrop')?.addEventListener('click',sbToggleCrop);
  $('#studyBoardContextCrop')?.addEventListener('click',sbToggleCrop);
  $('#studyBoardUndo')?.addEventListener('click',sbUndo);
  $('#studyBoardRedo')?.addEventListener('click',sbRedo);
  $('#studyBoardZoomOut')?.addEventListener('click',()=>sbSetZoom(studyBoard.zoom/1.2));
  $('#studyBoardZoomIn')?.addEventListener('click',()=>sbSetZoom(studyBoard.zoom*1.2));
  $('#studyBoardZoomLabel')?.addEventListener('click',sbFit);
  $('#studyBoardFit')?.addEventListener('click',sbFit);
  $('#studyBoardDuplicate')?.addEventListener('click',sbDuplicateSelection);
  $('#studyBoardDelete')?.addEventListener('click',sbDeleteSelection);
  $('#studyBoardFront')?.addEventListener('click',()=>sbMoveZ(true));
  $('#studyBoardBack')?.addEventListener('click',()=>sbMoveZ(false));
  $('#studyBoardLayerToggle')?.addEventListener('click',sbToggleSelectedLayer);
  $('#studyBoardClearScratch')?.addEventListener('click',sbClearScratch);

  $$('.tool-btn[data-tool]').forEach(btn=>btn.addEventListener('click',()=>{$$('.tool-btn[data-tool]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');board.tool=btn.dataset.tool}));
  $('#undoBoard').addEventListener('click',()=>{if(board.strokes.length){board.redo.push(board.strokes.pop());drawBoard();saveDraftSoon()}});
  $('#redoBoard').addEventListener('click',()=>{if(board.redo.length){board.strokes.push(board.redo.pop());drawBoard();saveDraftSoon()}});
  $('#clearBoard').addEventListener('click',()=>{if(!board.strokes.length)return;if(confirm('¿Limpiar todos los trazos del pizarrón?')){board.strokes=[];board.redo=[];drawBoard();saveDraftSoon()}});
  $('#screenshotInput').addEventListener('change',handleScreenshot);
  $('#removeScreenshot').addEventListener('click',removeScreenshot);
  $('#pasteImageBtn')?.addEventListener('click',pasteImageFromClipboard);
  $('#clearBoardBackground')?.addEventListener('click',()=>setBoardBackground(null));
  setupEvidenceDropzone();
}
function selectSegment(sel,value){$$(sel+' [data-value]').forEach(b=>b.classList.toggle('active',b.dataset.value===value))}
function getSegment(sel){return $(`${sel} [data-value].active`)?.dataset.value || ''}

function showView(name){
  if(!name||!$('#view-'+name))return;
  document.body.classList.toggle('workspace-view-active',name==='workspace');
  if(name!=='workspace'){restoreSessionWorkspaceHome();setWorkspaceSidebarCollapsed(false)}
  $$('.view').forEach(v=>v.classList.remove('active-view')); $('#view-'+name)?.classList.add('active-view');
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  focusState.context=name;
  if(focusState.mode==='auto'&&!focusState.playing)focusPreviewForMode('auto');
  if(name==='session') renderSessionView();
  if(name==='workspace'){setWorkspaceSidebarCollapsed(true);renderIntegratedWorkspace();}
  if(name==='qbank') renderQBank();
  if(name==='review') renderReview();
  if(name==='analytics') renderAnalytics();
  if(name==='history') renderHistory();
  if(name==='data'){renderBaselines();updateStorageHealth()}
  if(name==='themes')renderThemeUI();
  syncFocusDockPlacement();
  window.scrollTo({top:0,behavior:'smooth'});
}

function setWorkspaceSidebarCollapsed(collapsed){
  const desktop=window.matchMedia('(min-width:721px)').matches;
  const use=desktop&&collapsed===true;
  document.body.classList.toggle('workspace-sidebar-collapsed',use);
  const btn=$('#workspaceSidebarToggle');
  if(btn){btn.setAttribute('aria-expanded',use?'false':'true');btn.title=use?'Mostrar menú':'Ocultar menú';btn.textContent=use?'☰':'‹';}
}
function toggleWorkspaceSidebar(){
  if(!window.matchMedia('(min-width:721px)').matches)return;
  setWorkspaceSidebarCollapsed(!document.body.classList.contains('workspace-sidebar-collapsed'));
}

const MEDICOSPIRA_URL='https://usmle.medicospira.com/s2/auth/login';
let workspaceCaptureTab='log';
function restoreSessionWorkspaceHome(){
  const ws=$('#sessionWorkspace'),anchor=$('#sessionWorkspaceMount');
  if(ws&&anchor&&ws.parentElement!==anchor.parentElement){anchor.insertAdjacentElement('afterend',ws);ws.classList.remove('integrated-session-workspace','show-evidence');}
}
function moveSessionWorkspaceToCoach(){
  const ws=$('#sessionWorkspace'),mount=$('#workspaceCaptureMount');
  if(ws&&mount&&ws.parentElement!==mount)mount.appendChild(ws);
  if(ws){ws.classList.add('integrated-session-workspace');ws.classList.remove('hidden');setWorkspaceCaptureTab(workspaceCaptureTab)}
}
function renderIntegratedWorkspace(forceBuilder=false){
  const builder=$('#workspaceSessionBuilder'),mount=$('#workspaceCaptureMount'),complete=$('#workspaceCompleteCard'),tabs=$('#workspaceCaptureTabs');
  if(!builder||!mount)return;
  const subjectBox=$('#workspaceSessionSubject');if(subjectBox&&state.activeSession)subjectBox.value=state.activeSession.subject;
  if(state.activeSession&&!forceBuilder){
    builder.classList.add('hidden');complete?.classList.add('hidden');tabs?.classList.remove('hidden');moveSessionWorkspaceToCoach();renderSessionView();
    $('#workspaceCoachTitle').textContent=`${state.activeSession.subject} · ${state.activeSession.completedCount+1}/${state.activeSession.plannedCount}`;
    $('#workspaceCoachSub').textContent='All Systems · registro sincronizado con tu sesión activa.';
  }else{
    restoreSessionWorkspaceHome();mount.innerHTML='';tabs?.classList.add('hidden');builder.classList.remove('hidden');complete?.classList.toggle('hidden',!forceBuilder);
    $('#workspaceCoachTitle').textContent='Registro rápido';$('#workspaceCoachSub').textContent='Inicia un bloque o continúa el que ya tienes.';
    if($('#workspaceSessionSubject')&&!$('#workspaceSessionSubject').value)$('#workspaceSessionSubject').value='Medicine';
  }
}
async function startSessionFromWorkspace(){
  if(state.activeSession){renderIntegratedWorkspace();return toast('Ya tienes un bloque activo; lo abrí en el Workspace.');}
  const subject=$('#workspaceSessionSubject')?.value||'Medicine',count=Number($('#workspaceSessionCount')?.value||5);
  if($('#sessionSubject'))$('#sessionSubject').value=subject;if($('#sessionCount'))$('#sessionCount').value=count;
  await startSession();renderIntegratedWorkspace();
}
function setWorkspaceCaptureTab(tab){
  if(tab==='evidence'){
    workspaceCaptureTab='log';
    $$('#workspaceCaptureTabs [data-capture-tab]').forEach(b=>b.classList.toggle('active',b.dataset.captureTab==='log'));
    openStudyBoard();
    return;
  }
  workspaceCaptureTab='log';const ws=$('#sessionWorkspace');if(!ws)return;
  ws.classList.remove('show-evidence');
  $$('#workspaceCaptureTabs [data-capture-tab]').forEach(b=>b.classList.toggle('active',b.dataset.captureTab==='log'));
}
function reloadMedicospiraFrame(home=false){const f=$('#medicospiraFrame');if(!f)return;$('#workspaceFrameStatus').textContent='Cargando…';f.src=home?MEDICOSPIRA_URL:(f.src||MEDICOSPIRA_URL);setTimeout(()=>{$('#workspaceFrameStatus').textContent='usmle.medicospira.com';pingMedicospiraCompanion()},1200)}
const MEDICOSPIRA_ORIGIN='https://usmle.medicospira.com';
let medicospiraCompanionReady=false;
let medicospiraTranslationMode='en';
let medicospiraTranslateRequestTimer=null;
function setWorkspaceTranslatorStatus(){/* v2.6: translation progress is intentionally silent */}
function pingMedicospiraCompanion(){
  const frame=$('#medicospiraFrame');if(!frame?.contentWindow)return;
  medicospiraCompanionReady=false;
  try{frame.contentWindow.postMessage({type:'DRCOACH_COMPANION_PING'},MEDICOSPIRA_ORIGIN)}catch(_){ }
  clearTimeout(medicospiraTranslateRequestTimer);
  medicospiraTranslateRequestTimer=setTimeout(()=>{},1200);
}
function handleMedicospiraCompanionMessage(event){
  if(event.origin!==MEDICOSPIRA_ORIGIN||!event.data||typeof event.data!=='object')return;
  const d=event.data;
  if(d.type==='DRCOACH_MOBILE_SELECTION'){
    const text=String(d.text||'').trim();
    const stem=$('#qStem');
    if(!text||!stem)return;
    const current=String(stem.value||'').trim();
    stem.value=current?`${current}\n\n${text}`:text;
    stem.dispatchEvent(new Event('input',{bubbles:true}));
    toast('Selección enviada al caso clínico.');
    return;
  }
  if(d.type==='DRCOACH_COMPANION_READY'){
    medicospiraCompanionReady=true;clearTimeout(medicospiraTranslateRequestTimer);
    medicospiraTranslationMode=d.language==='es'?'es':'en';
    updateWorkspaceTranslateButtons();return;
  }
  if(d.type==='DRCOACH_TRANSLATOR_STATUS'){
    medicospiraCompanionReady=true;clearTimeout(medicospiraTranslateRequestTimer);
    if(d.language)medicospiraTranslationMode=d.language;
    const status=d.status||'ready';
    updateWorkspaceTranslateButtons();
    if(status==='needs-user-activation')toast('Activa Español una vez dentro de Medicospira para preparar el traductor local.');
    if(status==='unsupported')toast('La traducción inline requiere Chrome de escritorio compatible.');
    if(status==='error')toast(`No se pudo traducir: ${d.message||'error del traductor'}`);
  }
}
function updateWorkspaceTranslateButtons(){
  const toSpanish=medicospiraTranslationMode!=='es';
  const main=$('#workspaceTranslateChrome');
  if(main){main.textContent=toSpanish?'Español':'Original';main.setAttribute('aria-pressed',String(!toSpanish));main.classList.toggle('translation-active',!toSpanish);}
}
function toggleMedicospiraInlineTranslation(){
  const frame=$('#medicospiraFrame');if(!frame?.contentWindow)return;
  const target=medicospiraTranslationMode==='es'?'en':'es';
  try{frame.contentWindow.postMessage({type:'DRCOACH_TRANSLATE_REQUEST',targetLanguage:target},MEDICOSPIRA_ORIGIN)}catch(_){ }
  clearTimeout(medicospiraTranslateRequestTimer);
  medicospiraTranslateRequestTimer=setTimeout(()=>{
    if(!medicospiraCompanionReady)toast('Instala Dr.Coach! Companion para traducir Medicospira dentro del Workspace.');
  },1200);
}
function toggleIntegratedCoach(){const shell=$('#integratedWorkspaceShell');if(!shell)return;const collapsed=shell.classList.toggle('coach-collapsed');$('#workspaceToggleCoach').textContent=collapsed?'Mostrar Coach':'Ocultar Coach'}
function toggleWorkspaceFrameWide(){const shell=$('#integratedWorkspaceShell');if(!shell)return;const wide=shell.classList.toggle('frame-wide');$('#workspaceFrameWide').textContent=wide?'↙':'⤢'}
function eligibleCoverageAttempt(a){return !a.isReview && (a.result==='correct'||a.result==='incorrect')}
function coverageTotal(filterSubject=null){
  const attempts=state.attempts.filter(a=>eligibleCoverageAttempt(a)&&(!filterSubject||a.subject===filterSubject)).length;
  const baselines=state.baselines.filter(b=>!filterSubject||b.subject===filterSubject).reduce((s,b)=>s+Number(b.count||0),0);
  const max=filterSubject?SUBJECTS.find(s=>s.key===filterSubject)?.total:TARGET_TOTAL;
  return Math.min(max||TARGET_TOTAL,attempts+baselines);
}
function subjectCoverage(subject){return coverageTotal(subject)}
function systemCoverage(system){
  const a=state.attempts.filter(x=>eligibleCoverageAttempt(x)&&x.system===system).length;
  const b=state.baselines.filter(x=>x.system===system).reduce((s,x)=>s+Number(x.count||0),0);
  return Math.min(SYSTEM_TOTALS[system],a+b);
}
function accuracy(items=state.attempts){
  const q=items.filter(a=>!a.isReview&&(a.result==='correct'||a.result==='incorrect'));
  if(!q.length)return {value:null,correct:0,total:0}; const c=q.filter(a=>a.result==='correct').length; return {value:c/q.length*100,correct:c,total:q.length};
}
function todayCoverage(){const k=dayKey();return state.attempts.filter(a=>eligibleCoverageAttempt(a)&&dayKey(a.createdAt)===k).length}
function todayReviews(){const k=dayKey();return state.attempts.filter(a=>a.isReview&&dayKey(a.createdAt)===k).length}
function reviewMaterial(){return state.attempts.filter(a=>!a.isReview)}
function reviewQueue(){return reviewMaterial().filter(a=>!a.mastered&&(a.result==='incorrect'||a.result==='omitted'||a.confidence==='doubt'))}
function daysRemaining(){
  const today=new Date(); today.setHours(0,0,0,0); const d=new Date(getSetting('deadline',DEADLINE)+'T00:00:00'); return Math.max(0,Math.floor((d-today)/86400000)+1);
}
function requiredPace(){const days=daysRemaining();return days?Math.max(0,(TARGET_TOTAL-coverageTotal())/days):0}
function statusToDeadline(){
  const start=new Date(getSetting('trackerStartDate',dayKey())+'T00:00:00'); const deadline=new Date(getSetting('deadline',DEADLINE)+'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0);
  const totalDays=Math.max(1,Math.floor((deadline-start)/86400000)+1); const elapsed=clamp(Math.floor((today-start)/86400000)+1,0,totalDays); const ideal=TARGET_TOTAL*(elapsed/totalDays); const delta=coverageTotal()-ideal; return {ideal,delta};
}

const DAILY_QUOTES=[
  {text:'La magia que estás buscando está en el trabajo que estás evitando.',source:'Anónimo'},
  {text:'Todo lo puedo en Cristo que me fortalece.',source:'Filipenses 4:13'},
  {text:'La paciencia todo lo alcanza.',source:'Santa Teresa de Jesús'},
  {text:'El futuro comienza hoy, no mañana.',source:'San Juan Pablo II'},
  {text:'No tengáis miedo.',source:'San Juan Pablo II'},
  {text:'Ama y haz lo que quieras.',source:'San Agustín'},
  {text:'Bástate mi gracia, porque mi poder se perfecciona en la debilidad.',source:'2 Corintios 12:9'},
  {text:'Confía en el Señor con todo tu corazón.',source:'Proverbios 3:5'},
  {text:'No todos podemos hacer grandes cosas, pero sí cosas pequeñas con gran amor.',source:'Santa Teresa de Calcuta'},
  {text:'Nada te turbe, nada te espante; quien a Dios tiene nada le falta.',source:'Santa Teresa de Jesús'},
  {text:'No necesitas sentirte listo; necesitas empezar.',source:'Dr.Coach!'},
  {text:'Hazlo cansado, pero hazlo.',source:'Dr.Coach!'},
  {text:'La constancia convierte lo difícil en familiar.',source:'Dr.Coach!'},
  {text:'Una pregunta bien revisada hoy puede ser una decisión correcta mañana.',source:'Dr.Coach!'},
  {text:'Tu futuro no necesita perfección; necesita constancia.',source:'Dr.Coach!'},
  {text:'Lo que hoy exige disciplina mañana se sentirá como dominio.',source:'Dr.Coach!'},
  {text:'No se turbe vuestro corazón.',source:'Juan 14:1'},
  {text:'Todo tiene su momento, y cada cosa su tiempo bajo el cielo.',source:'Eclesiastés 3:1'},
  {text:'Mantente fiel a la obra de hoy; el resultado llegará después.',source:'Dr.Coach!'},
  {text:'El cansancio pide descanso; el propósito te recuerda por qué volver.',source:'Dr.Coach!'}
];
function getDailyQuote(){
  const start=new Date(new Date().getFullYear(),0,0),now=new Date();
  const dayOfYear=Math.floor((now-start)/86400000);
  return DAILY_QUOTES[dayOfYear%DAILY_QUOTES.length];
}
function studyActivityDays(){
  const days=new Set();
  state.attempts.forEach(a=>{if(a?.createdAt)days.add(dayKey(a.createdAt));(a.reviewEvents||[]).forEach(e=>{if(e?.createdAt)days.add(dayKey(e.createdAt))})});
  state.sessions.forEach(s=>{if(Number(s.completedCount||0)>0&&(s.endedAt||s.startedAt))days.add(dayKey(s.endedAt||s.startedAt))});
  return days;
}
function computeStudyStreak(){
  const days=studyActivityDays();if(!days.size)return {current:0,best:0,activeToday:false};
  const sorted=[...days].sort();let best=1,run=1;
  for(let i=1;i<sorted.length;i++){const a=new Date(sorted[i-1]+'T12:00:00'),b=new Date(sorted[i]+'T12:00:00');const gap=Math.round((b-a)/86400000);run=gap===1?run+1:1;best=Math.max(best,run)}
  const today=dayKey(),y=new Date();y.setDate(y.getDate()-1);const yesterday=dayKey(y);let anchor=days.has(today)?today:days.has(yesterday)?yesterday:null,current=0;
  if(anchor){let d=new Date(anchor+'T12:00:00');while(days.has(dayKey(d))){current++;d.setDate(d.getDate()-1)}}
  return {current,best,activeToday:days.has(today)};
}
function renderMotivation(){
  const streak=computeStudyStreak();
  if($('#streakCurrent'))$('#streakCurrent').textContent=streak.current;
  if($('#streakBest'))$('#streakBest').textContent=streak.best;
  const sm=$('#streakMessage');if(sm)sm.textContent=streak.current===0?'Una pregunta basta para encenderla.':streak.activeToday?`Día ${streak.current} asegurado. Sigue construyendo.`:`Haz al menos una pregunta hoy para mantener ${streak.current} día${streak.current===1?'':'s'}.`;
  const q=getDailyQuote();
  if($('#dailyQuote'))$('#dailyQuote').textContent=q.text;if($('#dailyQuoteSource'))$('#dailyQuoteSource').textContent=q.source;
  updateDayGreeting();
}
function renderAll(){renderToday();renderQBank();renderReviewBadge();renderSessionView();renderBaselines();renderAIExportPreview();}
function renderToday(){
  const done=coverageTotal(), rem=TARGET_TOTAL-done, goal=Number(getSetting('dailyGoal',16)), td=todayCoverage();
  $('#overallDone').textContent=fmtInt(done);$('#overallRemaining').textContent=`${fmtInt(rem)} restantes`;$('#overallPct').textContent=`${pct(done,TARGET_TOTAL)}%`;$('#overallProgressBar').style.width=`${pct(done,TARGET_TOTAL)}%`;
  $('#todayDone').textContent=td;$('#todayGoalLabel').textContent=`/ ${goal}`;$('#todayProgressBar').style.width=`${clamp(td/Math.max(goal,1)*100,0,100)}%`;
  const pace=requiredPace();$('#requiredPace').textContent=pace.toFixed(2);
  const sd=statusToDeadline();
  $('#paceMessage').textContent=sd.delta>=0?`Vas ${Math.round(sd.delta)} preguntas por encima de la línea ideal.`:`Vas ${Math.abs(Math.round(sd.delta))} preguntas por debajo de la línea ideal.`;
  const acc=accuracy();$('#overallAccuracy').textContent=acc.value==null?'—':acc.value.toFixed(1);$('#accuracyDenom').textContent=acc.total?`${acc.correct}/${acc.total} correctas calificables.`:'Sin respuestas calificables.';
  $('#subjectProgressList').innerHTML=SUBJECTS.map(s=>{const d=subjectCoverage(s.key),p=pct(d,s.total);return `<div class="progress-row"><div class="row-top"><b>${escapeHTML(s.label)}</b><span>${fmtInt(d)} / ${fmtInt(s.total)} · ${p}%</span></div><div class="progress"><div class="progress-fill" style="width:${p}%"></div></div></div>`}).join('');
  const completedSessions=state.sessions.filter(s=>s.status==='completed'&&dayKey(s.endedAt||s.startedAt)===dayKey());
  const mins=completedSessions.reduce((sum,s)=>sum+Number(s.durationSec||0),0)/60;
  $('#todaySummary').innerHTML=`<div class="summary-tile"><span class="muted">Bloques</span><strong>${completedSessions.length}</strong></div><div class="summary-tile"><span class="muted">Tiempo</span><strong>${mins?Math.round(mins)+' min':'—'}</strong></div><div class="summary-tile"><span class="muted">Reviews</span><strong>${todayReviews()}</strong></div><div class="summary-tile"><span class="muted">Meta</span><strong>${td>=goal?'✓':' '+Math.max(0,goal-td)+' faltan'}</strong></div>`;
  renderActiveSessionCard();
  renderMotivation();
  requestAnimationFrame(()=>drawProgressChart($('#homeProgressChart'),$('#homeCurveSubject').value||'ALL'));
}
function renderActiveSessionCard(){
  const slot=$('#activeSessionCard');
  if(!state.activeSession){slot.innerHTML='<div class="info-box">No hay un bloque activo. Puedes iniciar uno cuando abras tu QBank.</div>';return}
  const s=state.activeSession;slot.innerHTML=`<div class="active-session-banner"><div><b>${escapeHTML(s.subject)} · All Systems</b><div class="muted compact">${s.completedCount}/${s.plannedCount} registradas</div></div><button class="btn btn-primary btn-small" id="resumeFromToday">Reanudar</button></div>`;
  $('#resumeFromToday')?.addEventListener('click',()=>showView('session'));
}

async function editDailyGoal(){
  const current=Number(getSetting('dailyGoal',16)); const val=prompt('Meta diaria de preguntas:',String(current)); if(val==null)return; const n=Number(val); if(!Number.isInteger(n)||n<1||n>500)return toast('Usa un número entre 1 y 500.'); await setSetting('dailyGoal',n);renderToday();
}

async function startSession(){
  if(state.activeSession)return toast('Ya tienes un bloque activo. Reanúdalo o ciérralo.');
  const subject=$('#sessionSubject').value;const count=Number($('#sessionCount').value);
  if(!SUBJECTS.some(s=>s.key===subject)||!Number.isInteger(count)||count<1||count>100)return toast('Revisa materia y número de preguntas.');
  const s={id:uuid(),subject,plannedCount:count,completedCount:0,startedAt:nowISO(),endedAt:null,status:'active',elapsedSec:0,runningSince:nowISO(),paused:false};
  await DB.put('sessions',s);state.sessions.push(s);state.activeSession=s;
  if (window.DrCoachSync) { try { await window.DrCoachSync.pushSession(s); } catch(e){ console.warn('pushSession failed', e); } }
  resetQuestionWorkspace();renderSessionView();startTimer();renderToday();
}
async function restoreActiveSession(){
  const active=state.sessions.filter(s=>s.status==='active').sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt))[0];if(active)state.activeSession=active;
}
function renderSessionView(){
  const has=!!state.activeSession;
  $('#sessionLanding').classList.toggle('hidden',has);$('#sessionWorkspace').classList.toggle('hidden',!has);$('#sessionComplete').classList.add('hidden');
  if(!has)return;
  const s=state.activeSession;$('#workspaceSubject').textContent=s.subject;$('#workspaceQIndex').textContent=s.completedCount+1;$('#workspaceQTotal').textContent=s.plannedCount;$('#qSystem').innerHTML=systemOptions(s.subject,true);$('#pauseSessionBtn').textContent=s.paused?'Reanudar':'Pausar';loadDraft();startTimer();
}
function sessionSeconds(s=state.activeSession){if(!s)return 0;return Number(s.elapsedSec||0)+(!s.paused&&s.runningSince?Math.max(0,(Date.now()-new Date(s.runningSince).getTime())/1000):0)}
function startTimer(){clearInterval(state.timerHandle);const tick=()=>{if(state.activeSession)$('#sessionTimer').textContent=formatDuration(sessionSeconds())};tick();state.timerHandle=setInterval(tick,1000)}
function formatDuration(sec){sec=Math.floor(sec);const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
async function togglePauseSession(){
  const s=state.activeSession;if(!s)return;if(s.paused){s.paused=false;s.runningSince=nowISO()}else{s.elapsedSec=sessionSeconds(s);s.runningSince=null;s.paused=true}await DB.put('sessions',s);if(window.DrCoachSync){try{await window.DrCoachSync.pushSession(s);}catch(e){console.warn('pushSession failed',e);}}$('#pauseSessionBtn').textContent=s.paused?'Reanudar':'Pausar';renderToday();
}
async function discardCurrentDraftAssets(){
  const ids=[...new Set([...state.currentAttachmentIds,...studyBoard.removedAttachmentIds])];
  for(const id of ids){if(!state.attempts.some(a=>attemptAttachmentIds(a).includes(id))){await DB.del('attachments',id);state.attachments=state.attachments.filter(x=>x.id!==id)}}
  state.currentAttachmentIds=[];state.currentBoardAttachmentId=null;state.currentAttachmentId=null;state.boardBitmap=null;loadStudyBoardData(null);
}
async function endSessionEarly(){
  const s=state.activeSession;if(!s)return;if(!confirm(`Cerrar este bloque con ${s.completedCount}/${s.plannedCount} preguntas registradas?`))return;
  s.elapsedSec=sessionSeconds(s);s.runningSince=null;s.paused=true;s.status='incomplete';s.endedAt=nowISO();await DB.put('sessions',s);if(window.DrCoachSync){try{await window.DrCoachSync.pushSession(s);}catch(e){console.warn('pushSession failed',e);}}await discardCurrentDraftAssets();clearDraft();state.activeSession=null;clearInterval(state.timerHandle);renderAll();showView('today');toast('Bloque cerrado como incompleto.');
}

function draftKey(){return state.activeSession?`mediospira-draft-${state.activeSession.id}-${state.activeSession.completedCount+1}`:null}
let draftTimer;
function saveDraftSoon(){clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,250)}
function currentDraftData(){return {questionId:$('#qQuestionId').value.trim(),system:$('#qSystem').value,topic:$('#qTopic')?.value.trim()||'',focus:$('#qFocus')?.value.trim()||'',stem:$('#qStem')?.value||'',result:getSegment('#resultSegment'),confidence:getSegment('#confidenceSegment'),errorReasons:$$('#errorReasonChips .active').map(x=>x.dataset.reason),concept:$('#qConcept').value,whyFailed:$('#qWhyFailed').value,rule:$('#qRule').value,notes:$('#qNotes').value,strokes:board.strokes,studyBoard:serializeStudyBoard(false),attachmentIds:[...state.currentAttachmentIds],boardAttachmentId:state.currentBoardAttachmentId,currentAttachmentId:state.currentAttachmentId}}
function saveDraft(){const k=draftKey();if(!k)return;try{localStorage.setItem(k,JSON.stringify(currentDraftData()));savePulse('Borrador guardado');sbMarkSaved()}catch(e){console.warn('Draft save failed',e)}}
async function loadDraft(){
  resetQuestionWorkspace(false);const k=draftKey();if(!k)return;let d;try{d=JSON.parse(localStorage.getItem(k)||'null')}catch{}if(!d)return;
  $('#qQuestionId').value=d.questionId||'';$('#qSystem').value=d.system||'';if($('#qTopic'))$('#qTopic').value=d.topic||'';if($('#qFocus'))$('#qFocus').value=d.focus||'';if($('#qStem'))$('#qStem').value=d.stem||'';selectSegment('#resultSegment',d.result||'');selectSegment('#confidenceSegment',d.confidence||'');$$('#errorReasonChips .reason-chip').forEach(x=>x.classList.toggle('active',(d.errorReasons||[]).includes(x.dataset.reason)));$('#qConcept').value=d.concept||'';$('#qWhyFailed').value=d.whyFailed||'';$('#qRule').value=d.rule||'';$('#qNotes').value=d.notes||'';board.strokes=Array.isArray(d.strokes)?d.strokes:[];board.redo=[];state.currentAttachmentIds=Array.isArray(d.attachmentIds)?d.attachmentIds.filter(Boolean):(d.currentAttachmentId?[d.currentAttachmentId]:[]);state.currentBoardAttachmentId=d.boardAttachmentId||d.currentAttachmentId||state.currentAttachmentIds[0]||null;syncCurrentPrimary();loadStudyBoardData(d.studyBoard||null);await ensureStudyBoardObjectsForAttachments();await loadBoardAttachment();drawBoard();updateAttachmentUI();sbMarkSaved();
}
function clearDraft(){const k=draftKey();if(k)localStorage.removeItem(k)}
function resetQuestionWorkspace(clearStorage=true){
  if(clearStorage)clearDraft();['qQuestionId','qTopic','qFocus','qStem','qConcept','qWhyFailed','qRule','qNotes'].forEach(id=>{if($('#'+id))$('#'+id).value=''});if($('#qSystem'))$('#qSystem').value='';selectSegment('#resultSegment','');selectSegment('#confidenceSegment','');$$('#errorReasonChips .reason-chip').forEach(x=>x.classList.remove('active'));board.strokes=[];board.redo=[];board.active=null;state.currentAttachmentIds=[];state.currentBoardAttachmentId=null;state.currentAttachmentId=null;state.boardBitmap=null;loadStudyBoardData(null);studyBoard.layer='keep';sbSetLayer('keep');sbSetTool('pen');drawBoard();updateAttachmentUI();
}

async function saveCurrentQuestion(){
  const s=state.activeSession;if(!s)return;
  const d=currentDraftData();if(!d.system)return toast('Selecciona el System de esta pregunta.');if(!d.result)return toast('Marca si fue Correcta, Incorrecta u Omitida.');
  let isReview=false;
  if(d.questionId){
    const matches=await DB.findAttemptsByQuestionId(d.questionId);
    const first=matches.find(a=>!a.isReview);
    if(first){
      const ok=confirm(`El Question ID ${d.questionId} ya fue registrado el ${fmtDate(first.createdAt)}.\n\nAceptar = guardar esta vez como REVIEW (no suma cobertura).\nCancelar = vuelve y corrige el ID o edita el registro anterior.`);
      if(!ok)return;isReview=true;
    }
  }
  const persistedStudyBoard=serializeStudyBoard(true);
  const keepImageIds=new Set((persistedStudyBoard.objects||[]).filter(o=>o.type==='image'&&o.attachmentId).map(o=>o.attachmentId));
  const scratchAttachmentIds=new Set(studyBoard.objects.filter(o=>o.type==='image'&&o.layer==='scratch'&&o.attachmentId&&!keepImageIds.has(o.attachmentId)).map(o=>o.attachmentId));
  const attachmentIds=state.currentAttachmentIds.filter(id=>!scratchAttachmentIds.has(id));const boardAttachmentId=attachmentIds.includes(state.currentBoardAttachmentId)?state.currentBoardAttachmentId:(attachmentIds[0]||null);
  const attempt={id:uuid(),sessionId:s.id,createdAt:nowISO(),subject:s.subject,system:d.system,questionId:d.questionId||'',topic:d.topic||'',focus:d.focus||'',stem:d.stem||'',result:d.result,confidence:d.confidence||'',errorReasons:d.errorReasons||[],concept:d.concept||'',whyFailed:d.whyFailed||'',rule:d.rule||'',notes:d.notes||'',strokes:d.strokes||[],studyBoardId:persistedStudyBoard.id,studyBoard:persistedStudyBoard,attachmentIds,boardAttachmentId,attachmentId:boardAttachmentId||attachmentIds[0]||null,isReview,mastered:false,ordinal:s.completedCount+1};
  await DB.put('attempts',attempt);state.attempts.push(attempt);
  // v3.0.0: queue cloud push for this attempt + upload its attachments
  if (window.DrCoachSync) {
    try { await window.DrCoachSync.pushAttempt(attempt); } catch(e){ console.warn('pushAttempt failed', e); }
  }
  if (window.DrCoachStorage && state.cloudUser) {
    try { await uploadAttachmentsToCloud(attempt); } catch(e){ console.warn('cloud attachments upload failed', e); }
  }
  const cleanupAttachmentIds=new Set([...scratchAttachmentIds,...studyBoard.removedAttachmentIds]);
  for(const id of cleanupAttachmentIds){if(!attachmentIds.includes(id)&&!state.attempts.some(a=>attemptAttachmentIds(a).includes(id))){await DB.del('attachments',id);state.attachments=state.attachments.filter(x=>x.id!==id);const img=studyBoard.imageCache.get(id);img?.close?.();studyBoard.imageCache.delete(id)}}
  clearDraft();s.completedCount+=1;await DB.put('sessions',s);
  if(s.completedCount>=s.plannedCount){await completeSession();return}
  resetQuestionWorkspace(false);$('#workspaceQIndex').textContent=s.completedCount+1;$('#qSystem').innerHTML=systemOptions(s.subject,true);renderAll();toast(isReview?'Review guardada; no sumó cobertura.':'Pregunta guardada.');
}
async function completeSession(){
  const s=state.activeSession;s.elapsedSec=sessionSeconds(s);s.runningSince=null;s.paused=true;s.status='completed';s.endedAt=nowISO();await DB.put('sessions',s);if(window.DrCoachSync){try{await window.DrCoachSync.pushSession(s);}catch(e){console.warn('pushSession failed',e);}}state.activeSession=null;clearInterval(state.timerHandle);resetQuestionWorkspace(false);
  const items=state.attempts.filter(a=>a.sessionId===s.id);const correct=items.filter(a=>a.result==='correct').length,incorrect=items.filter(a=>a.result==='incorrect').length,omitted=items.filter(a=>a.result==='omitted').length;const denom=correct+incorrect;const acc=denom?Math.round(correct/denom*100):0;
  $('#completeTitle').textContent=`${s.subject} · ${items.length} preguntas`;
  $('#completeStats').innerHTML=`<div class="summary-tile"><span class="muted">Accuracy</span><strong>${denom?acc+'%':'—'}</strong></div><div class="summary-tile"><span class="muted">Correctas</span><strong>${correct}</strong></div><div class="summary-tile"><span class="muted">Incorrectas / omitidas</span><strong>${incorrect} / ${omitted}</strong></div><div class="summary-tile"><span class="muted">Tiempo</span><strong>${formatDuration(s.elapsedSec)}</strong></div>`;
  $('#sameSubjectOneBtn').dataset.subject=s.subject;$('#sameSubjectFiveBtn').dataset.subject=s.subject;renderAll();$('#sessionLanding').classList.add('hidden');$('#sessionWorkspace').classList.add('hidden');$('#sessionComplete').classList.remove('hidden');if($('#view-workspace')?.classList.contains('active-view')){restoreSessionWorkspaceHome();renderIntegratedWorkspace(true)}toast('Bloque completado.');
}
async function startSameSubject(n){const subject=$('#sameSubjectOneBtn').dataset.subject||'Medicine';$('#sessionSubject').value=subject;$('#sessionCount').value=n;await startSession()}

function setupBoard(){
  const c=$('#boardCanvas'); if(!c)return;
  c.addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen')board.recentPenAt=Date.now();
    if(e.pointerType==='touch'&&Date.now()-board.recentPenAt<1200)return; // basic palm suppression after pen input
    $('#pointerIndicator').textContent=e.pointerType==='pen'?'Stylus':e.pointerType==='touch'?'Touch':'Mouse';
    e.preventDefault();c.setPointerCapture?.(e.pointerId);const p=canvasPoint(e,c);
    if(board.tool==='eraser'){eraseAt(p);return}
    board.drawing=true;board.active={tool:board.tool,points:[p]};board.strokes.push(board.active);board.redo=[];drawBoard();
  });
  c.addEventListener('pointermove',e=>{if(!board.drawing||!board.active)return;e.preventDefault();const p=canvasPoint(e,c);const last=board.active.points.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>1.8){board.active.points.push(p);drawBoard()}});
  const end=e=>{if(board.drawing){board.drawing=false;board.active=null;saveDraftSoon()}};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')end(e)});
  drawBoard();
}
function canvasPoint(e,c){const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height,p:e.pressure&&e.pressure>0?e.pressure:.5}}
function eraseAt(p){
  let best=-1,bestD=32;board.strokes.forEach((s,i)=>s.points.forEach(q=>{const d=Math.hypot(p.x-q.x,p.y-q.y);if(d<bestD){bestD=d;best=i}}));if(best>=0){board.redo.push(board.strokes.splice(best,1)[0]);drawBoard();saveDraftSoon()}
}
function drawBoard(){
  const c=$('#boardCanvas');if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);
  if(state.boardBitmap){const img=state.boardBitmap;const scale=Math.min(c.width/img.width,c.height/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h)}
  for(const s of board.strokes){const pts=s.points||[];if(!pts.length)continue;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=s.tool==='highlight'?'rgba(255,198,0,.28)':'#173a5e';ctx.lineWidth=s.tool==='highlight'?28:5;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();ctx.restore()}
}
async function loadBoardAttachment(){
  state.boardBitmap=null;
  const id=state.currentBoardAttachmentId;
  if(!id)return;
  const a=attachmentById(id)||await DB.get('attachments',id);
  if(!a?.blob)return;
  try{state.boardBitmap=await createImageBitmap(a.blob)}catch(e){console.warn(e)}
}
function updateAttachmentUI(){
  syncCurrentPrimary();
  const ids=state.currentAttachmentIds.filter(id=>!!attachmentById(id));
  state.currentAttachmentIds=ids;
  const total=ids.reduce((sum,id)=>sum+(attachmentById(id)?.blob?.size||0),0);
  const status=$('#attachmentStatus');if(status)status.textContent=ids.length?`${ids.length}/${MAX_ATTACHMENTS_PER_QUESTION} capturas · ${bytesLabel(total)}`:'Sin capturas';
  renderCurrentEvidenceGallery();
}
function renderCurrentEvidenceGallery(){
  const box=$('#evidenceGallery');if(!box)return;
  const ids=state.currentAttachmentIds;
  box.classList.toggle('hidden',!ids.length);
  box.innerHTML=ids.map((id,i)=>{const a=attachmentById(id);const obj=studyBoard.objects.find(o=>o.type==='image'&&o.attachmentId===id);return `<article class="evidence-thumb" data-evidence-id="${id}"><div class="evidence-thumb-image"><img data-attachment-img="${id}" alt="Captura ${i+1}" /></div><div class="evidence-thumb-footer"><span><b>${i+1}</b> · ${a?.blob?bytesLabel(a.blob.size):'guardada'}${obj?.layer==='scratch'?' · Scratch':' · Keep'}</span><div><button type="button" class="text-btn" data-open-board="${id}">Board</button><button type="button" class="text-btn danger-text" data-remove-evidence="${id}">Quitar</button></div></div></article>`}).join('');
  $$('[data-attachment-img]',box).forEach(img=>{const a=attachmentById(img.dataset.attachmentImg);if(!a?.blob)return;const u=URL.createObjectURL(a.blob);img.onload=()=>URL.revokeObjectURL(u);img.src=u});
  $$('[data-open-board]',box).forEach(b=>b.addEventListener('click',()=>openStudyBoard(b.dataset.openBoard)));
  $$('[data-remove-evidence]',box).forEach(b=>b.addEventListener('click',()=>removeEvidence(b.dataset.removeEvidence)));
}
async function setBoardBackground(id){
  if(id===state.currentBoardAttachmentId)return;
  if(board.strokes.length&&state.currentBoardAttachmentId!==id){
    if(!confirm('Ya hay trazos en el pizarrón. Cambiar el fondo conservará los trazos y los mostrará sobre la nueva imagen. ¿Continuar?'))return;
  }
  state.currentBoardAttachmentId=id||null;syncCurrentPrimary();await loadBoardAttachment();drawBoard();updateAttachmentUI();saveDraftSoon();
}
async function handleScreenshot(e){
  const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;await processImageFiles(files);
}
async function processImageFiles(files){
  const images=files.filter(f=>f&&String(f.type||'').startsWith('image/'));
  if(!images.length)return toast('Solo se admiten imágenes como evidencia visual.');
  const available=MAX_ATTACHMENTS_PER_QUESTION-state.currentAttachmentIds.length;
  if(available<=0)return toast(`Máximo ${MAX_ATTACHMENTS_PER_QUESTION} capturas por pregunta.`);
  const selected=images.slice(0,available);
  let used=state.attachments.reduce((sum,a)=>sum+(a.blob?.size||0),0);
  if(used>=ATTACHMENT_APP_CAP)return toast('Llegaste al límite visual de 60 MB. Elimina capturas o exporta y limpia antes de añadir más.');
  let added=0;sbPushHistory();
  for(const file of selected){
    try{
      const blob=await compressScreenshot(file);if(blob.size>ATTACHMENT_HARD_MAX)throw new Error('No se pudo comprimir una imagen por debajo de 1 MB.');
      if(used+blob.size>ATTACHMENT_APP_CAP)throw new Error('La imagen excedería el límite visual total de 60 MB.');
      const id=uuid();const rec={id,blob,mime:blob.type||'image/jpeg',createdAt:nowISO(),size:blob.size,kind:'image',name:file.name||''};
      await DB.put('attachments',rec);state.attachments.push(rec);state.currentAttachmentIds.push(id);used+=blob.size;
      if(!state.currentBoardAttachmentId)state.currentBoardAttachmentId=id;
      await addStudyBoardImageObject(id,added);added++;
    }catch(err){toast(err.message||'No se pudo procesar una imagen.');}
  }
  syncCurrentPrimary();await loadBoardAttachment();drawBoard();updateAttachmentUI();saveDraft();updateStorageHealth();
  if(images.length>selected.length)toast(`Se añadieron ${added}. El máximo es ${MAX_ATTACHMENTS_PER_QUESTION} capturas por pregunta.`);else if(added)toast(`${added} captura${added===1?'':'s'} añadida${added===1?'':'s'}.`);
}
async function compressScreenshot(file){
  let bmp;try{bmp=await createImageBitmap(file)}catch{throw new Error('El navegador no pudo abrir esa imagen.');}
  let maxDim=1600,quality=.82,blob=null;
  for(let pass=0;pass<6;pass++){
    const scale=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(bmp,0,0,w,h);
    blob=await new Promise(res=>c.toBlob(res,'image/jpeg',quality));if(blob&&blob.size<=700*1024)break;quality=Math.max(.52,quality-.07);if(pass===2)maxDim=1300;if(pass===4)maxDim=1050;
  }
  bmp.close?.();if(!blob)throw new Error('No se pudo comprimir la captura.');return blob;
}
async function removeEvidence(id,confirmFirst=true){
  if(!id||!state.currentAttachmentIds.includes(id))return;
  if(confirmFirst&&!confirm('¿Quitar esta captura de la pregunta actual?'))return;
  // Quitar desde la galería es una acción explícita e irreversible para este borrador.
  // Vacía el historial del board para que Undo no pueda resucitar una imagen cuyo blob se eliminará.
  sbRemoveAttachmentObject(id);studyBoard.undo=[];studyBoard.redo=[];
  state.currentAttachmentIds=state.currentAttachmentIds.filter(x=>x!==id);
  if(state.currentBoardAttachmentId===id)state.currentBoardAttachmentId=state.currentAttachmentIds[0]||null;
  syncCurrentPrimary();
  // A draft attachment is not shared with another saved question. Avoid deleting if an old record still references it.
  const referenced=state.attempts.some(a=>attemptAttachmentIds(a).includes(id));
  if(!referenced){await DB.del('attachments',id);state.attachments=state.attachments.filter(a=>a.id!==id)}
  await loadBoardAttachment();drawBoard();updateAttachmentUI();saveDraftSoon();updateStorageHealth();
}
async function removeScreenshot(confirmFirst=true){
  const id=state.currentBoardAttachmentId||state.currentAttachmentIds.at(-1);if(id)await removeEvidence(id,confirmFirst);
}
function setupEvidenceDropzone(){
  const zone=$('#evidenceDropzone');if(!zone)return;
  ['dragenter','dragover'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.add('dragging')}));
  ['dragleave','drop'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove('dragging')}));
  zone.addEventListener('drop',e=>processImageFiles([...(e.dataTransfer?.files||[])]));
  zone.addEventListener('paste',e=>{const files=[...(e.clipboardData?.items||[])].filter(x=>x.kind==='file').map(x=>x.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();processImageFiles(files)}});
  document.addEventListener('paste',e=>{
    const boardOpen=!$('#studyBoardOverlay')?.classList.contains('hidden');
    const sessionContext=$('#view-session')?.classList.contains('active-view')||$('#view-workspace')?.classList.contains('active-view')||boardOpen;
    if(!sessionContext||!state.activeSession)return;
    if(['TEXTAREA','INPUT'].includes(document.activeElement?.tagName))return;
    const files=[...(e.clipboardData?.items||[])].filter(x=>x.kind==='file').map(x=>x.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();processImageFiles(files)}
  });
}
async function pasteImageFromClipboard(){
  try{
    if(!navigator.clipboard?.read)throw new Error('clipboard-read unavailable');
    const items=await navigator.clipboard.read();const files=[];
    for(const item of items){for(const type of item.types){if(type.startsWith('image/')){const blob=await item.getType(type);files.push(new File([blob],`clipboard-${Date.now()}.png`,{type}))}}}
    if(!files.length)return toast('El portapapeles no contiene una imagen.');await processImageFiles(files);
  }catch{toast('El navegador no permitió leer imágenes del portapapeles. Usa Ctrl/Cmd+V sobre el área de evidencias.');}
}
async function pasteStemFromClipboard(){
  try{const text=await navigator.clipboard.readText();if(!text)return toast('El portapapeles no contiene texto.');$('#qStem').value=text;saveDraftSoon();toast('Caso pegado.');}
  catch{toast('No pude leer el portapapeles. Pega manualmente con Ctrl/Cmd+V.');}
}

function renderQBank(){
  const cards=$('#qbankSubjectCards');if(!cards)return;
  cards.innerHTML=SUBJECTS.map(s=>{const d=subjectCoverage(s.key),p=pct(d,s.total);return `<div class="subject-card"><strong>${escapeHTML(s.label)}</strong><span class="big">${fmtInt(d)}</span><span class="muted"> / ${fmtInt(s.total)}</span><div class="progress" style="margin-top:9px"><div class="progress-fill" style="width:${p}%"></div></div><div class="muted compact">${p}% completado</div></div>`}).join('');
  $('#qbankMatrixContainer').innerHTML=`<table class="data-table"><thead><tr><th>System</th>${SUBJECTS.map(s=>`<th>${escapeHTML(s.label)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${SYSTEMS.map(sys=>`<tr><td><b>${escapeHTML(sys)}</b></td>${SUBJECTS.map(s=>`<td>${MATRIX[s.key][sys]}</td>`).join('')}<td><b>${SYSTEM_TOTALS[sys]}</b></td></tr>`).join('')}<tr><td><b>TOTAL</b></td>${SUBJECTS.map(s=>`<td><b>${s.total}</b></td>`).join('')}<td><b>${TARGET_TOTAL}</b></td></tr></tbody></table>`;
  $('#systemTableBody').innerHTML=SYSTEMS.map(sys=>{const d=systemCoverage(sys),total=SYSTEM_TOTALS[sys],rem=total-d;const q=state.attempts.filter(a=>!a.isReview&&a.system===sys&&(a.result==='correct'||a.result==='incorrect'));const ac=accuracy(q);return `<tr><td>${escapeHTML(sys)}</td><td>${total}</td><td>${d}</td><td>${rem}</td><td>${ac.value==null?'—':ac.value.toFixed(1)+'%'}</td><td><div class="mini-progress"><span style="width:${pct(d,total)}%"></span></div></td></tr>`}).join('');
}

function renderReviewBadge(){const n=reviewQueue().length;$('#reviewBadge').textContent=n;$('#reviewBadge').classList.toggle('hidden',n===0)}
function filteredReviewItems(){
  const subject=$('#reviewSubjectFilter')?.value||'',system=$('#reviewSystemFilter')?.value||'',kind=$('#reviewKindFilter')?.value||'',query=($('#reviewSearch')?.value||'').trim().toLowerCase();
  let items=reviewMaterial().filter(a=>(!subject||a.subject===subject)&&(!system||a.system===system));
  if(kind==='pending')items=items.filter(a=>!a.mastered&&(a.result==='incorrect'||a.result==='omitted'||a.confidence==='doubt'));
  if(kind==='correct')items=items.filter(a=>a.result==='correct');
  if(kind==='sure')items=items.filter(a=>a.result==='correct'&&a.confidence==='sure');
  if(kind==='incorrect')items=items.filter(a=>a.result==='incorrect');
  if(kind==='doubt')items=items.filter(a=>a.result==='correct'&&a.confidence==='doubt');
  if(kind==='omitted')items=items.filter(a=>a.result==='omitted');
  if(kind==='mastered')items=items.filter(a=>a.mastered);
  if(query)items=items.filter(a=>[a.questionId,a.subject,a.system,a.topic,a.focus,a.stem,a.concept,a.whyFailed,a.rule,a.notes,...(a.errorReasons||[])].join(' ').toLowerCase().includes(query));
  return items.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}
function shortText(s,max=190){const t=String(s||'').replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max-1).trimEnd()+'…':t}
function hasAttemptVisual(a){return !!(attemptAttachmentIds(a).length||(Array.isArray(a?.strokes)&&a.strokes.length)||studyBoardHasVisual(a?.studyBoard))}
function renderReview(){
  const list=$('#reviewList');if(!list)return;const all=reviewMaterial(),items=filteredReviewItems(),pending=reviewQueue();state.reviewVisibleIds=items.map(a=>a.id);
  const stats=$('#reviewStats');if(stats){const correct=all.filter(a=>a.result==='correct').length,wrong=all.filter(a=>a.result==='incorrect').length,doubt=all.filter(a=>a.result==='correct'&&a.confidence==='doubt').length,visual=all.filter(hasAttemptVisual).length,mastered=all.filter(a=>a.mastered).length;stats.innerHTML=`<span class="review-stat-pill"><b>${all.length}</b> registradas</span><span class="review-stat-pill"><b>${correct}</b> correctas</span><span class="review-stat-pill"><b>${wrong}</b> incorrectas</span><span class="review-stat-pill"><b>${doubt}</b> con duda</span><span class="review-stat-pill"><b>${pending.length}</b> por reforzar</span>${mastered?`<span class="review-stat-pill"><b>${mastered}</b> dominadas</span>`:''}<span class="review-stat-pill">📷 <b>${visual}</b> con material visual</span>${items.length!==all.length?`<span class="review-stat-pill"><b>${items.length}</b> visibles con filtros</span>`:''}`}
  if(!items.length){list.innerHTML=`<div class="card review-empty"><h2>${all.length?'No hay coincidencias':'Aún no hay material'}</h2><p class="muted">${all.length?'Cambia los filtros o la búsqueda para ver otras preguntas.':'Cuando registres preguntas, todas aparecerán aquí, incluso las correctas y seguras.'}</p></div>`;return}
  list.innerHTML=items.map(a=>{
    const visual=hasAttemptVisual(a),reasons=(a.errorReasons||[]).slice(0,2),brief=shortText(a.concept||a.rule||a.whyFailed||a.notes||a.stem||'Sin nota breve.'),evidenceCount=attemptAttachmentIds(a).length;
    return `<article class="review-item ${visual?'has-visual':''}"><div class="review-item-main"><div class="review-item-kicker"><b>${escapeHTML(a.subject)}</b><span class="pill">${escapeHTML(a.system)}</span>${a.topic?`<span class="pill topic-pill">${escapeHTML(a.topic)}</span>`:''}${a.focus?`<span class="pill focus-pill">${escapeHTML(a.focus)}</span>`:''}${a.questionId?`<span class="pill">#${escapeHTML(a.questionId)}</span>`:''}<span class="pill ${a.result==='incorrect'?'bad':a.result==='correct'?'good':'warn'}">${resultLabel(a.result)}</span>${a.confidence==='doubt'?'<span class="pill warn">Con duda</span>':a.confidence==='sure'?'<span class="pill">Segura</span>':''}${a.mastered?'<span class="pill good">Dominada</span>':''}${visual?`<span class="visual-indicator">📷 ${evidenceCount||'Pizarrón'}</span>`:''}</div><div class="review-item-concept">${escapeHTML(brief)}</div>${reasons.length?`<div class="study-tags">${reasons.map(r=>`<span class="error-tag">${escapeHTML(r)}</span>`).join('')}</div>`:''}<div class="review-item-submeta"><span>${fmtDateTime(a.createdAt)}</span>${Array.isArray(a.reviewEvents)&&a.reviewEvents.length?`<span>↻ ${a.reviewEvents.length} revisión${a.reviewEvents.length===1?'':'es'}</span>`:''}</div></div><div class="item-actions"><button class="btn btn-primary btn-small" data-review-open="${a.id}">Repasar →</button><button class="btn btn-secondary btn-small" data-edit-attempt="${a.id}">Editar</button></div></article>`
  }).join('');
  $$('[data-review-open]').forEach(b=>b.addEventListener('click',()=>openReviewDetail(b.dataset.reviewOpen)));
  $$('[data-edit-attempt]').forEach(b=>b.addEventListener('click',()=>openAttemptEdit(b.dataset.editAttempt)));
}
function resultLabel(r){return r==='correct'?'Correcta':r==='incorrect'?'Incorrecta':'Omitida'}
function confidenceLabel(c){return c==='sure'?'Segura':c==='doubt'?'Con duda':''}
function studySectionHTML(title,text,type='',recall=false,tags=[]){
  if(!text&&!tags.length)return '';
  const content=text?`<div class="study-text ${recall?'recall-target':''} ${recall&&state.reviewRecallMode?'masked':''}" ${recall?'data-recall-target':''}><div class="recall-value">${escapeHTML(text)}</div>${recall?'<button type="button" class="recall-reveal">Mostrar</button>':''}</div>`:'';
  return `<section class="study-section ${type}"><h3>${escapeHTML(title)}</h3>${content}${tags.length?`<div class="study-tags">${tags.map(t=>`<span class="error-tag">${escapeHTML(t)}</span>`).join('')}</div>`:''}</section>`;
}
async function openReviewDetail(id){
  const a=state.attempts.find(x=>x.id===id);if(!a)return;
  if(!state.reviewVisibleIds.includes(id))state.reviewVisibleIds=filteredReviewItems().map(x=>x.id);
  state.reviewDetailId=id;state.reviewRecallMode=false;state.reviewZoom=100;await renderReviewDetail();
  if(!$('#reviewDetailDialog').open)$('#reviewDetailDialog').showModal();
}
async function renderReviewDetail(){
  const a=state.attempts.find(x=>x.id===state.reviewDetailId);if(!a)return;
  let idx=state.reviewVisibleIds.indexOf(a.id);if(idx<0){state.reviewVisibleIds=filteredReviewItems().map(x=>x.id);idx=state.reviewVisibleIds.indexOf(a.id)}
  $('#reviewDetailPosition').textContent=idx>=0?`${idx+1} de ${state.reviewVisibleIds.length}`:'Pregunta de revisión';
  const ids=attemptAttachmentIds(a);
  $('#reviewDetailBadges').innerHTML=`<span>${escapeHTML(a.subject)}</span><span class="pill">${escapeHTML(a.system)}</span>${a.topic?`<span class="pill topic-pill">${escapeHTML(a.topic)}</span>`:''}${a.focus?`<span class="pill focus-pill">${escapeHTML(a.focus)}</span>`:''}<span class="pill ${a.result==='incorrect'?'bad':a.result==='correct'?'good':'warn'}">${resultLabel(a.result)}</span>${a.confidence?`<span class="pill ${a.confidence==='doubt'?'warn':''}">${confidenceLabel(a.confidence)}</span>`:''}${a.mastered?'<span class="pill good">Dominada</span>':''}${hasAttemptVisual(a)?`<span class="pill">📷 ${ids.length||'Pizarrón'}</span>`:''}`;
  $('#reviewDetailTitle').textContent=a.questionId?`Pregunta #${a.questionId}`:(a.topic?`${a.topic}${a.focus?' · '+a.focus:''}`:(shortText(a.concept,70)||'Pregunta sin ID'));
  $('#reviewDetailMeta').textContent=`Primera exposición · ${fmtDateTime(a.createdAt)}${a.isReview?' · intento de revisión':''}`;
  $('#reviewReadMode').classList.toggle('active',!state.reviewRecallMode);$('#reviewRecallMode').classList.toggle('active',state.reviewRecallMode);
  const tags=a.errorReasons||[];let html='';
  html+=studySectionHTML('Caso clínico / stem',a.stem,'stem');
  html+=studySectionHTML('Concepto clave',a.concept,'concept',true);
  html+=studySectionHTML('¿Por qué fallé?',a.whyFailed,'failure',false,tags);
  html+=studySectionHTML('Regla que debo recordar',a.rule,'rule',true);
  html+=studySectionHTML('Notas',a.notes,'notes');
  if(!html)html='<div class="info-box">Este registro no tiene texto guardado. Usa las evidencias visuales o edítalo para añadir contexto.</div>';
  $('#reviewStudyContent').innerHTML=html;
  $$('#reviewStudyContent .recall-reveal').forEach(b=>b.addEventListener('click',()=>b.closest('.recall-target')?.classList.remove('masked')));
  const visual=hasAttemptVisual(a);$('#reviewVisualPanel').classList.toggle('hidden',!visual);$('#reviewDetailGrid').classList.toggle('no-visual',!visual);
  if(visual)await renderReviewEvidenceGallery(a);
  renderReviewTimeline(a);
  $('#reviewPrevBtn').disabled=idx<=0;$('#reviewNextBtn').disabled=idx<0||idx>=state.reviewVisibleIds.length-1;
}
async function renderReviewEvidenceGallery(a){
  const box=$('#reviewEvidenceGallery');const ids=attemptAttachmentIds(a);if(!box)return;
  const boardId=attemptBoardAttachmentId(a);const hasLegacyStrokes=Array.isArray(a.strokes)&&a.strokes.length>0;const hasStudyBoard=studyBoardHasVisual(a.studyBoard);const hasBoard=hasStudyBoard||hasLegacyStrokes;
  box.innerHTML=ids.map((id,i)=>`<button type="button" class="review-evidence-card" data-review-evidence="${id}"><img data-review-evidence-img="${id}" alt="Evidencia ${i+1}" /><span><b>Captura ${i+1}</b>${hasStudyBoard?' · Study Board':boardId===id&&hasLegacyStrokes?' · anotada':''}</span></button>`).join('');
  for(const img of $$('[data-review-evidence-img]',box)){const att=attachmentById(img.dataset.reviewEvidenceImg)||await DB.get('attachments',img.dataset.reviewEvidenceImg);if(!att?.blob)continue;const u=URL.createObjectURL(att.blob);img.onload=()=>URL.revokeObjectURL(u);img.src=u}
  $$('[data-review-evidence]',box).forEach(b=>b.addEventListener('click',()=>openAttachmentFull(a,b.dataset.reviewEvidence)));
  const boardBox=$('#reviewBoardComposite');boardBox.classList.toggle('hidden',!hasBoard);
  if(hasBoard){await drawAttemptVisual(a,$('#reviewVisualCanvas'));setReviewZoom(100,false)}
  const pieces=[];if(ids.length)pieces.push(`${ids.length} captura${ids.length===1?'':'s'}`);if(hasStudyBoard){const n=(a.studyBoard.objects||[]).length+(a.studyBoard.strokes||[]).length;pieces.push(`Study Board · ${n} elemento${n===1?'':'s'}`)}else if(hasLegacyStrokes)pieces.push(`${a.strokes.length} trazo${a.strokes.length===1?'':'s'}`);$('#reviewVisualMeta').textContent=pieces.join(' · ')||'Material visual';
}
function renderReviewTimeline(a){
  const events=[{createdAt:a.createdAt,level:'first',label:`${resultLabel(a.result)}${a.confidence?` · ${confidenceLabel(a.confidence)}`:''}`},...(Array.isArray(a.reviewEvents)?a.reviewEvents:[])];
  const sec=$('#reviewTimelineSection');sec.classList.remove('hidden');$('#reviewTimeline').innerHTML=events.map((e,i)=>{const label=e.label||(e.level==='forgot'?'No lo recuerdo':e.level==='partial'?'Parcial':'Dominado');return `<div class="timeline-event ${escapeHTML(e.level||'')}"><b>${i===0?'Primera exposición':'Review '+i} · ${escapeHTML(label)}</b><span>${fmtDateTime(e.createdAt)}</span></div>`}).join('');
}
function setReviewRecallMode(on){state.reviewRecallMode=!!on;renderReviewDetail()}
function moveReviewDetail(delta){const idx=state.reviewVisibleIds.indexOf(state.reviewDetailId),next=state.reviewVisibleIds[idx+delta];if(next){state.reviewDetailId=next;state.reviewRecallMode=false;renderReviewDetail()}}
async function recordReviewAssessment(level){
  const a=state.attempts.find(x=>x.id===state.reviewDetailId);if(!a)return;const oldIdx=state.reviewVisibleIds.indexOf(a.id);a.reviewEvents=Array.isArray(a.reviewEvents)?a.reviewEvents:[];a.reviewEvents.push({id:uuid(),createdAt:nowISO(),level});if(level==='mastered')a.mastered=true;await DB.put('attempts',a);renderReviewBadge();renderReview();
  if(!state.reviewVisibleIds.includes(a.id)){
    const fresh=state.reviewVisibleIds;if(!fresh.length){$('#reviewDetailDialog').close();toast(level==='mastered'?'Marcada como dominada.':'Revisión registrada.');return}const next=fresh[Math.min(Math.max(oldIdx,0),fresh.length-1)];state.reviewDetailId=next;state.reviewRecallMode=false;await renderReviewDetail();
  }else{await renderReviewDetail()}
  toast(level==='mastered'?'Marcada como dominada.':level==='forgot'?'Registrado: todavía no lo recuerdas.':'Registrado: dominio parcial.');
}
async function drawAttemptVisual(a,canvas){
  if(!canvas||!a)return false;if(studyBoardHasVisual(a.studyBoard))return sbRenderSnapshot(a.studyBoard,canvas);
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);let has=false;
  const bid=attemptBoardAttachmentId(a);const att=bid?(attachmentById(bid)||await DB.get('attachments',bid)):null;
  if(att?.blob){has=true;await drawBlobFitted(ctx,att.blob,canvas.width,canvas.height)}
  const strokes=Array.isArray(a.strokes)?a.strokes:[];if(strokes.length){has=true;drawStrokes(ctx,strokes)}
  return has;
}
async function drawBlobFitted(ctx,blob,w,h){
  if('createImageBitmap'in window){try{const img=await createImageBitmap(blob);const scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);img.close?.();return}catch(e){console.warn('createImageBitmap fallback',e)}}
  await new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);URL.revokeObjectURL(u);resolve()};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('No se pudo mostrar la captura.'))};img.src=u});
}
function drawStrokes(ctx,strokes){for(const s of strokes){const pts=s.points||[];if(!pts.length)continue;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=s.tool==='highlight'?'rgba(255,198,0,.28)':'#173a5e';ctx.lineWidth=s.tool==='highlight'?28:5;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();ctx.restore()}}
function setReviewZoom(value,full=false){const z=clamp(value,75,300);if(full)state.reviewFullZoom=z;else state.reviewZoom=z;const canvas=$(full?'#reviewVisualCanvasFull':'#reviewVisualCanvas'),label=$(full?'#reviewFullZoomLabel':'#reviewZoomLabel');if(canvas)canvas.style.width=`${z}%`;if(label)label.textContent=`${z}%`}
async function drawAttachmentOnly(id,canvas){if(!id||!canvas)return false;const att=attachmentById(id)||await DB.get('attachments',id);if(!att?.blob)return false;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);await drawBlobFitted(ctx,att.blob,canvas.width,canvas.height);return true}
async function openAttachmentFull(a,id){
  if(!a||!id)return;state.visualFullAttemptId=a.id;state.visualFullAttachmentId=id;state.reviewFullZoom=100;await drawAttachmentOnly(id,$('#reviewVisualCanvasFull'));$('#reviewVisualDialogTitle').textContent=`Evidencia visual${a.topic?' · '+a.topic:''}`;setReviewZoom(100,true);if(!$('#reviewVisualDialog').open)$('#reviewVisualDialog').showModal();
}
async function openVisualFullForAttempt(a){if(!a||!hasAttemptVisual(a))return toast('Este registro no tiene material visual.');state.visualFullAttemptId=a.id;state.visualFullAttachmentId=null;state.reviewFullZoom=100;await drawAttemptVisual(a,$('#reviewVisualCanvasFull'));$('#reviewVisualDialogTitle').textContent='Pizarrón / anotación';setReviewZoom(100,true);if(!$('#reviewVisualDialog').open)$('#reviewVisualDialog').showModal()}
function openReviewVisualFull(){const a=state.attempts.find(x=>x.id===state.reviewDetailId);openVisualFullForAttempt(a)}
function openEditedVisualFull(){const a=state.attempts.find(x=>x.id===$('#editAttemptId').value);openVisualFullForAttempt(a)}

function renderAnalytics(){
  const acc=accuracy();$('#aAccuracy').textContent=acc.value==null?'—':acc.value.toFixed(1);$('#aDoubtCorrect').textContent=state.attempts.filter(a=>!a.isReview&&a.result==='correct'&&a.confidence==='doubt').length;$('#aConfidentWrong').textContent=state.attempts.filter(a=>!a.isReview&&a.result==='incorrect'&&a.confidence==='sure').length;
  const completedSessions=state.sessions.filter(s=>s.status==='completed'&&s.durationSec>0);const q=completedSessions.reduce((sum,s)=>sum+state.attempts.filter(a=>a.sessionId===s.id).length,0),hours=completedSessions.reduce((sum,s)=>sum+s.durationSec,0)/3600;$('#aPace').textContent=hours?(q/hours).toFixed(1):'—';
  const counts=Object.fromEntries(ERROR_REASONS.map(r=>[r,0]));state.attempts.filter(a=>!a.isReview).forEach(a=>(a.errorReasons||[]).forEach(r=>counts[r]=(counts[r]||0)+1));const max=Math.max(1,...Object.values(counts));$('#errorReasonBars').innerHTML=Object.entries(counts).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).map(([r,n])=>barRow(r,n/max*100,String(n))).join('')||'<p class="muted">Aún no hay causas de fallo clasificadas.</p>';
  const sysStats=SYSTEMS.map(sys=>{const ar=accuracy(state.attempts.filter(a=>a.system===sys));return {sys,...ar}}).filter(x=>x.total).sort((a,b)=>a.value-b.value);$('#accuracySystemBars').innerHTML=sysStats.map(x=>barRow(x.sys,x.value,`${x.value.toFixed(1)}% · n=${x.total}`)).join('')||'<p class="muted">Aún no hay datos suficientes.</p>';
  requestAnimationFrame(()=>drawProgressChart($('#analyticsProgressChart'),$('#analyticsCurveSubject').value||'ALL'));
}
function barRow(label,width,right){return `<div class="bar-row"><span title="${escapeHTML(label)}">${escapeHTML(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${clamp(width,0,100)}%"></div></div><b>${escapeHTML(right)}</b></div>`}

function drawProgressChart(canvas,subject='ALL'){
  if(!canvas)return;const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;const cs=getComputedStyle(document.documentElement),chartBg=cs.getPropertyValue('--chart-bg').trim()||cs.getPropertyValue('--surface').trim()||'#fff',chartGrid=cs.getPropertyValue('--chart-grid').trim()||'#dfe5ed',chartMuted=cs.getPropertyValue('--chart-muted').trim()||'#7a8596',chartAccent=cs.getPropertyValue('--chart-accent').trim()||cs.getPropertyValue('--primary').trim()||'#0b6bcb',chartIdeal=cs.getPropertyValue('--chart-ideal').trim()||'#b2bac6';ctx.clearRect(0,0,W,H);ctx.fillStyle=chartBg;ctx.fillRect(0,0,W,H);
  const pad={l:64,r:28,t:24,b:46};const target=subject==='ALL'?TARGET_TOTAL:SUBJECTS.find(s=>s.key===subject)?.total||TARGET_TOTAL;
  const start=new Date(getSetting('trackerStartDate',dayKey())+'T00:00:00');const deadline=new Date(getSetting('deadline',DEADLINE)+'T00:00:00');const today=new Date();today.setHours(0,0,0,0);const end=today>deadline?today:deadline;const totalSpan=Math.max(1,(end-start)/86400000);
  const activity=[];
  state.attempts.filter(a=>eligibleCoverageAttempt(a)&&(subject==='ALL'||a.subject===subject)).forEach(a=>activity.push({d:new Date(dayKey(a.createdAt)+'T00:00:00'),n:1}));
  state.baselines.filter(b=>subject==='ALL'||b.subject===subject).forEach(b=>activity.push({d:new Date(dayKey(b.createdAt)+'T00:00:00'),n:Number(b.count||0)}));
  activity.sort((a,b)=>a.d-b.d);let cum=0;const points=[{d:start,n:0}];for(const x of activity){cum+=x.n;const last=points.at(-1);if(last&&dayKey(last.d)===dayKey(x.d))last.n=cum;else points.push({d:x.d,n:cum})}if(points.at(-1).d<today)points.push({d:today,n:cum});
  const x=d=>pad.l+clamp((d-start)/86400000/totalSpan,0,1)*(W-pad.l-pad.r);const y=n=>H-pad.b-clamp(n/target,0,1)*(H-pad.t-pad.b);
  ctx.strokeStyle=chartGrid;ctx.lineWidth=1;ctx.font='12px sans-serif';ctx.fillStyle=chartMuted;ctx.textAlign='right';
  for(let i=0;i<=4;i++){const val=target*i/4,yy=y(val);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();ctx.fillText(Math.round(val).toLocaleString('en-US'),pad.l-8,yy+4)}
  ctx.textAlign='center';ctx.fillText(dayKey(start),pad.l,H-16);ctx.fillText(dayKey(deadline),x(deadline),H-16);
  // ideal line
  ctx.setLineDash([7,6]);ctx.strokeStyle=chartIdeal;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(start),y(0));ctx.lineTo(x(deadline),y(target));ctx.stroke();ctx.setLineDash([]);
  // actual line
  ctx.strokeStyle=chartAccent;ctx.lineWidth=3;ctx.beginPath();points.forEach((p,i)=>{const xx=x(p.d),yy=y(p.n);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
  const last=points.at(-1);ctx.fillStyle=chartAccent;ctx.beginPath();ctx.arc(x(last.d),y(last.n),5,0,Math.PI*2);ctx.fill();
  ctx.textAlign='left';ctx.fillStyle=chartAccent;ctx.font='bold 12px sans-serif';ctx.fillText(`Real: ${fmtInt(Math.min(last.n,target))}`,pad.l+8,pad.t+15);ctx.fillStyle=chartMuted;ctx.fillText('··· Ideal',pad.l+110,pad.t+15);
}

function renderHistory(){
  const subject=$('#historySubjectFilter')?.value||'',result=$('#historyResultFilter')?.value||'',query=($('#historySearch')?.value||'').trim().toLowerCase();
  let items=state.attempts.filter(a=>(!subject||a.subject===subject)&&(!result||a.result===result));if(query)items=items.filter(a=>[a.questionId,a.system,a.topic,a.focus,a.stem,a.concept,a.whyFailed,a.rule,a.notes].join(' ').toLowerCase().includes(query));items.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const list=$('#historyList');if(!list)return;if(!items.length){list.innerHTML='<div class="card"><p class="muted">No hay registros que coincidan.</p></div>';return}
  list.innerHTML=items.map(a=>`<article class="history-item"><div><div class="item-title"><span>${escapeHTML(a.subject)}</span><span class="pill">${escapeHTML(a.system)}</span>${a.topic?`<span class="pill topic-pill">${escapeHTML(a.topic)}</span>`:''}${a.focus?`<span class="pill focus-pill">${escapeHTML(a.focus)}</span>`:''}${a.questionId?`<span class="pill">ID ${escapeHTML(a.questionId)}</span>`:''}<span class="pill ${a.result==='incorrect'?'bad':a.result==='correct'?'good':'warn'}">${resultLabel(a.result)}</span>${a.isReview?'<span class="pill">Review</span>':''}${attemptAttachmentIds(a).length?`<span class="pill">📷 ${attemptAttachmentIds(a).length}</span>`:''}</div><div class="item-notes">${escapeHTML(a.concept||a.notes||a.stem||'Sin notas.')}</div><div class="muted compact">${fmtDateTime(a.createdAt)}</div></div><div class="item-actions"><button class="btn btn-secondary btn-small" data-history-edit="${a.id}">Editar</button></div></article>`).join('');
  $$('[data-history-edit]').forEach(b=>b.addEventListener('click',()=>openAttemptEdit(b.dataset.historyEdit)));
}
async function openAttemptEdit(id){
  const a=state.attempts.find(x=>x.id===id);if(!a)return;$('#editAttemptId').value=id;$('#editQuestionId').value=a.questionId||'';$('#editSystem').innerHTML=systemOptions(a.subject,false);$('#editSystem').value=a.system;$('#editTopic').value=a.topic||'';$('#editFocus').value=a.focus||'';$('#editStem').value=a.stem||'';$('#editResult').value=a.result;$('#editConfidence').value=a.confidence||'';$('#editConcept').value=a.concept||'';$('#editWhyFailed').value=a.whyFailed||'';$('#editRule').value=a.rule||'';$('#editNotes').value=a.notes||'';$$('#editErrorReasonChips .reason-chip').forEach(x=>x.classList.toggle('active',(a.errorReasons||[]).includes(x.dataset.reason)));await renderEditVisual(a);if(!$('#editAttemptDialog').open)$('#editAttemptDialog').showModal();
}
async function renderEditVisual(a){
  const ids=attemptAttachmentIds(a),has=hasAttemptVisual(a),gallery=$('#editEvidenceGallery'),stage=$('#editVisualStage'),actions=$('#editAttachmentActions'),status=$('#editAttachmentStatus'),remove=$('#editRemoveAttachmentBtn');
  gallery.classList.toggle('hidden',!ids.length);stage.classList.toggle('hidden',!(Array.isArray(a.strokes)&&a.strokes.length));actions.classList.toggle('hidden',!has);
  if(!has){status.textContent='Sin material visual.';gallery.innerHTML='';return}
  if(ids.length){
    gallery.innerHTML=ids.map((id,i)=>`<article class="evidence-thumb"><div class="evidence-thumb-image"><img data-edit-evidence-img="${id}" alt="Captura ${i+1}" /></div><div class="evidence-thumb-footer"><span>Captura ${i+1}</span><button type="button" class="text-btn danger-text" data-edit-remove-evidence="${id}">Quitar</button></div></article>`).join('');
    for(const img of $$('[data-edit-evidence-img]',gallery)){const att=attachmentById(img.dataset.editEvidenceImg)||await DB.get('attachments',img.dataset.editEvidenceImg);if(!att?.blob)continue;const u=URL.createObjectURL(att.blob);img.onload=()=>URL.revokeObjectURL(u);img.src=u}
    $$('[data-edit-remove-evidence]',gallery).forEach(b=>b.addEventListener('click',()=>removeEditedEvidence(b.dataset.editRemoveEvidence)));
  }
  if(Array.isArray(a.strokes)&&a.strokes.length)await drawAttemptVisual(a,$('#editVisualCanvas'));
  const total=ids.reduce((sum,id)=>sum+(attachmentById(id)?.blob?.size||0),0);const pieces=[];if(ids.length)pieces.push(`${ids.length} captura${ids.length===1?'':'s'} · ${bytesLabel(total)}`);if(a.strokes?.length)pieces.push(`${a.strokes.length} trazo${a.strokes.length===1?'':'s'}`);status.textContent=pieces.join(' · ')||'Pizarrón';remove.classList.add('hidden');
}
async function saveAttemptEdit(){
  const a=state.attempts.find(x=>x.id===$('#editAttemptId').value);if(!a)return;a.questionId=$('#editQuestionId').value.trim();a.system=$('#editSystem').value;a.topic=$('#editTopic').value.trim();a.focus=$('#editFocus').value.trim();a.stem=$('#editStem').value;a.result=$('#editResult').value;a.confidence=$('#editConfidence').value;a.errorReasons=$$('#editErrorReasonChips .reason-chip.active').map(x=>x.dataset.reason);a.concept=$('#editConcept').value;a.whyFailed=$('#editWhyFailed').value;a.rule=$('#editRule').value;a.notes=$('#editNotes').value;a.updatedAt=nowISO();await DB.put('attempts',a);if(window.DrCoachSync){try{await window.DrCoachSync.pushAttempt(a);}catch(e){console.warn('pushAttempt failed',e);}}$('#editAttemptDialog').close();renderAll();renderHistory();if($('#view-review')?.classList.contains('active-view'))renderReview();toast('Registro actualizado.');
}
async function removeEditedAttachment(){
  const a=state.attempts.find(x=>x.id===$('#editAttemptId').value);if(!a)return;
  const id=attemptBoardAttachmentId(a);if(!id)return;
  if(!confirm('¿Dejar el pizarrón sin imagen de fondo? Las capturas seguirán en la galería.'))return;
  a.boardAttachmentId=null;a.updatedAt=nowISO();await DB.put('attempts',a);await renderEditVisual(a);toast('Fondo del pizarrón retirado.');
}
async function removeEditedEvidence(id){
  const a=state.attempts.find(x=>x.id===$('#editAttemptId').value);if(!a||!id)return;if(!confirm('¿Quitar esta captura de este registro?'))return;
  let ids=attemptAttachmentIds(a).filter(x=>x!==id);a.attachmentIds=ids;
  // Mantener el Study Board nuevo coherente con la galería: una captura eliminada no debe
  // quedar referenciada como objeto invisible/roto dentro del composite de Review.
  if(a.studyBoard?.objects){a.studyBoard.objects=a.studyBoard.objects.filter(o=>!(o?.type==='image'&&o.attachmentId===id))}
  if(a.boardAttachmentId===id)a.boardAttachmentId=ids[0]||null;if(a.attachmentId===id)a.attachmentId=a.boardAttachmentId||ids[0]||null;a.updatedAt=nowISO();await DB.put('attempts',a);
  const stillReferenced=state.attempts.some(x=>x.id!==a.id&&attemptAttachmentIds(x).includes(id));if(!stillReferenced){await DB.del('attachments',id);state.attachments=state.attachments.filter(x=>x.id!==id)}
  await renderEditVisual(a);renderReviewBadge();if($('#view-review')?.classList.contains('active-view'))renderReview();updateStorageHealth();toast('Captura eliminada.');
}
async function deleteEditedAttempt(){
  const id=$('#editAttemptId').value;const a=state.attempts.find(x=>x.id===id);if(!a||!confirm('¿Eliminar este registro? Las estadísticas se recalcularán.'))return;const attIds=attemptAttachmentIds(a);await DB.del('attempts',id);state.attempts=state.attempts.filter(x=>x.id!==id);for(const aid of attIds){if(!state.attempts.some(x=>attemptAttachmentIds(x).includes(aid))){await DB.del('attachments',aid);state.attachments=state.attachments.filter(x=>x.id!==aid)}}$('#editAttemptDialog').close();renderAll();renderHistory();if($('#reviewDetailDialog')?.open&&state.reviewDetailId===id)$('#reviewDetailDialog').close();updateStorageHealth();toast('Registro eliminado.');
}

async function addBaseline(){
  const subject=$('#baselineSubject').value,system=$('#baselineSystem').value,count=Number($('#baselineCount').value),correctRaw=$('#baselineCorrect').value.trim();const correct=correctRaw===''?null:Number(correctRaw);
  if(!Number.isInteger(count)||count<1)return toast('Cantidad inválida.');if(correct!=null&&(!Number.isInteger(correct)||correct<0||correct>count))return toast('Correctas conocidas debe estar entre 0 y el total.');
  const subjectTotal=SUBJECTS.find(s=>s.key===subject).total;if(subjectCoverage(subject)+count>subjectTotal)return toast(`Ese baseline haría que ${subject} supere su total de ${subjectTotal}.`);
  if(system&&systemCoverage(system)+count>SYSTEM_TOTALS[system])return toast('Ese baseline superaría el total conocido del System.');
  const b={id:uuid(),subject,system:system||'',count,correct,createdAt:nowISO()};await DB.put('baselines',b);state.baselines.push(b);renderAll();renderBaselines();toast('Baseline añadido.');
}
function renderBaselines(){
  const box=$('#baselineList');if(!box)return;if(!state.baselines.length){box.innerHTML='<p class="muted compact">Sin baseline manual.</p>';return}box.innerHTML=state.baselines.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(b=>`<div class="mini-row"><span><b>${escapeHTML(b.subject)}</b> · ${b.count} ${b.system?'· '+escapeHTML(b.system):'· System no clasificado'}</span><button class="text-btn danger-text" data-del-baseline="${b.id}">Eliminar</button></div>`).join('');$$('[data-del-baseline]').forEach(x=>x.addEventListener('click',async()=>{const b=state.baselines.find(y=>y.id===x.dataset.delBaseline);if(!b||!confirm('¿Eliminar este baseline?'))return;await DB.del('baselines',b.id);state.baselines=state.baselines.filter(y=>y.id!==b.id);renderAll();renderBaselines()}));
}

async function requestPersistence(){
  if(!navigator.storage?.persist)return toast('Este navegador no expone Storage Persistence.');try{const ok=await navigator.storage.persist();toast(ok?'Almacenamiento persistente concedido.':'El navegador no lo concedió; mantén backups regulares.');updateStorageHealth()}catch{toast('No se pudo solicitar persistencia.')}
}
async function updateStorageHealth(){
  const box=$('#dataHealth');if(!box)return;let est={},persisted=null;try{est=await navigator.storage?.estimate?.()||{};persisted=await navigator.storage?.persisted?.()}catch{}
  const visual=state.attachments.reduce((s,a)=>s+(a.blob?.size||0),0);const last=getSetting('lastBackupAt',null);box.innerHTML=`<div class="health-item"><b>Base local</b><span>✓ IndexedDB</span></div><div class="health-item"><b>Persistencia</b><span>${persisted===true?'✓ Concedida':persisted===false?'No concedida':'No disponible'}</span></div><div class="health-item"><b>Uso navegador</b><span>${est.usage!=null?bytesLabel(est.usage):'—'}</span></div><div class="health-item"><b>Capturas Dr.Coach!</b><span>${bytesLabel(visual)} / 60 MB</span></div><div class="health-item"><b>Registros</b><span>${state.attempts.length} preguntas · ${state.sessions.length} bloques</span></div><div class="health-item"><b>Último backup</b><span>${last?fmtDateTime(last):'Nunca ⚠️'}</span></div>`;
}

function aiExportItems(){
  const scope=$('#aiExportScope')?.value||'all',subject=$('#aiExportSubject')?.value||'',includeCorrect=$('#aiIncludeCorrect')?.checked!==false;
  let items=state.attempts.filter(a=>!a.isReview&&(!subject||a.subject===subject));
  if(scope==='weak')items=items.filter(a=>a.result==='incorrect'||a.result==='omitted'||a.confidence==='doubt');
  if(scope==='incorrect')items=items.filter(a=>a.result==='incorrect');
  if(scope==='all'&&!includeCorrect)items=items.filter(a=>a.result!=='correct'||a.confidence==='doubt');
  return items.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
}
function renderAIExportPreview(){
  const box=$('#aiExportPreview');if(!box)return;const subject=$('#aiExportSubject')?.value||'',scope=$('#aiExportScope')?.value||'all';const all=state.attempts.filter(a=>!a.isReview&&(!subject||a.subject===subject));const weak=all.filter(a=>a.result==='incorrect'||a.result==='omitted'||a.confidence==='doubt'),incorrect=all.filter(a=>a.result==='incorrect'),secure=all.filter(a=>a.result==='correct'&&a.confidence!=='doubt'),withTopic=all.filter(a=>a.topic).length,withStem=weak.filter(a=>a.stem).length;const detailed=scope==='incorrect'?incorrect:weak;
  box.innerHTML=`<b>${fmtInt(all.length)} registros first-pass</b> en el módulo · ${fmtInt(detailed.length)} irán con detalle clínico · ${fmtInt(secure.length)} correctas seguras se comprimirán como cobertura · ${fmtInt(withTopic)} con tema · ${fmtInt(withStem)} stems débiles/dudosos disponibles.`;
}
function groupStudyPatterns(items){
  const map=new Map();
  for(const a of items){const topic=(a.topic||'Sin tema').trim(),focus=(a.focus||'General').trim(),key=`${a.subject}|||${a.system}|||${topic}|||${focus}`;if(!map.has(key))map.set(key,{subject:a.subject,system:a.system,topic,focus,total:0,correct:0,incorrect:0,omitted:0,doubt:0,reasons:{}});const g=map.get(key);g.total++;if(a.result==='correct')g.correct++;if(a.result==='incorrect')g.incorrect++;if(a.result==='omitted')g.omitted++;if(a.confidence==='doubt')g.doubt++;for(const r of a.errorReasons||[])g.reasons[r]=(g.reasons[r]||0)+1}
  return [...map.values()].map(g=>({...g,weak:g.incorrect+g.omitted+g.doubt,accuracy:(g.correct+g.incorrect)?g.correct/(g.correct+g.incorrect)*100:null})).sort((a,b)=>b.weak-a.weak||b.total-a.total);
}
function buildAIReport(){
  const subjectFilter=$('#aiExportSubject')?.value||'';
  const scope=$('#aiExportScope')?.value||'all';
  const scopeLabel=$('#aiExportScope')?.selectedOptions?.[0]?.textContent||'Dossier completo';
  const includeStem=$('#aiIncludeStem')?.checked!==false;
  const includeCorrect=$('#aiIncludeCorrect')?.checked!==false;
  const allFirst=state.attempts.filter(a=>!a.isReview&&(!subjectFilter||a.subject===subjectFilter));
  const weak=allFirst.filter(a=>a.result==='incorrect'||a.result==='omitted'||a.confidence==='doubt');
  const incorrect=allFirst.filter(a=>a.result==='incorrect');
  const secureCorrect=includeCorrect?allFirst.filter(a=>a.result==='correct'&&a.confidence!=='doubt'):[];
  const detailed=scope==='incorrect'?incorrect:weak;
  const patternBase=includeCorrect?allFirst:weak;
  const patterns=groupStudyPatterns(patternBase);
  const acc=accuracy(allFirst);
  const reasonCounts={};for(const a of allFirst)for(const r of a.errorReasons||[])reasonCounts[r]=(reasonCounts[r]||0)+1;
  const lines=[];

  lines.push('# DR.COACH! — AI STUDY DOSSIER','');
  lines.push('> Dossier de aprendizaje generado localmente. Los registros del estudiante son datos pedagógicos; **NO son fuentes de autoridad médica**.');
  lines.push('');
  lines.push('## Metadatos del dossier','');
  lines.push(`- Exportado: ${new Date().toLocaleString('es-PA')}`);
  lines.push(`- Módulo: ${subjectFilter||'Global · separar por Subject'}`);
  lines.push(`- Tipo: ${scopeLabel}`);
  lines.push(`- Cobertura global registrada en Dr.Coach!: ${coverageTotal()} / ${TARGET_TOTAL}`);
  lines.push(`- Registros first-pass dentro de este dossier: ${allFirst.length}`);
  lines.push(`- First-pass accuracy del filtro: ${acc.value==null?'N/A':acc.value.toFixed(1)+'%'} (n=${acc.total})`);
  lines.push(`- Señales de debilidad: ${weak.length} · incorrectas: ${incorrect.length} · correctas seguras para cobertura: ${secureCorrect.length}`);
  lines.push('');

  lines.push('## INSTRUCCIONES MAESTRAS PARA LA IA','');
  lines.push('Actúa como un **tutor médico basado en evidencia y diseñador de evaluación clínica**. Usa los datos de Dr.Coach! para personalizar el aprendizaje, pero verifica de manera independiente toda teoría médica antes de enseñarla. El objetivo final es producir un manual adaptativo de alto rendimiento y un QBank de consolidación estilo IFOM, no imitar a UWorld.');
  lines.push('');
  lines.push('### A. Reglas de medicina basada en evidencia — obligatorias','');
  lines.push('1. **Mis apuntes, reglas, stems y comentarios son señales pedagógicas, no fuentes médicas.** Pueden contener errores. Úsalos para saber qué investigar y qué reforzar, nunca como autoridad.');
  lines.push('2. Verifica diagnóstico, criterios, tratamiento, prevención, dosis, contraindicaciones y recomendaciones con fuentes actuales y de alta calidad. Prioriza, según corresponda: guías clínicas vigentes de organismos/sociedades relevantes; revisiones sistemáticas y metaanálisis; y estudios primarios importantes cuando la guía sea insuficiente, antigua o exista evidencia nueva que cambie práctica.');
  lines.push('3. Para cada recomendación clínica importante, especialmente tratamiento inicial, escalamiento y dosis, identifica la fuente y el año. **No inventes referencias.**');
  lines.push('4. Si dispones de navegación web, comprueba que la guía/fuente continúe vigente y usa la versión más reciente pertinente. Si NO puedes navegar o verificar actualidad, dilo explícitamente y **no afirmes que la información está actualizada**.');
  lines.push('5. Si una nota del estudiante contradice la evidencia, corrígela de forma explícita con un bloque: `⚠ Corrección de apunte: escribiste X; la evidencia actual indica Y`, citando la fuente.');
  lines.push('6. Base principal: práctica internacional y razonamiento tipo IFOM/NBME. Añade contexto de Panamá/Latinoamérica solo cuando disponibilidad, epidemiología, guías o práctica regional cambien de forma relevante la interpretación.');
  lines.push('7. Incluye dosis solo cuando sean clínicamente o educativamente relevantes; especifica población/contexto y evita dosis sin fuente verificable.');
  lines.push('');
  lines.push('### B. Cómo interpretar mi rendimiento','');
  lines.push('1. Distingue **cobertura**, **precisión** y **dominio**. No son equivalentes.');
  lines.push('2. Una correcta segura es evidencia de fortaleza relativa, no de dominio absoluto. Una correcta con duda es conocimiento frágil. Una incorrecta segura puede sugerir un modelo mental erróneo y merece especial atención.');
  lines.push('3. **No visto / no evaluado ≠ debilidad.** Nunca llames debilidad a un contenido ausente del dataset.');
  lines.push('4. Ajusta la confianza de tus conclusiones al tamaño de muestra. Con n pequeño, habla de tendencias tempranas; con n mayor, busca patrones reproducibles.');
  lines.push('5. Busca patrones transversales, no solo enfermedades: temporalidad, diferenciales, farmacología, next best step, interpretación de estudios, prevención, errores cognitivos, etc.');
  lines.push('');
  lines.push('### C. Producto final obligatorio','');
  lines.push('Genera el resultado en este orden:');
  lines.push('**PARTE I — Auditoría de rendimiento.** Resume fortalezas, debilidades y patrones cognitivos; cuantifica usando solo los datos disponibles.');
  lines.push('**PARTE II — Coverage Map.** Organiza `Subject → System → Tema → Enfoque`. Marca `visto`, `frágil/débil`, `fortaleza relativa` o `no evaluado` cuando un blueprint externo permita identificar huecos. No inventes cobertura.');
  lines.push('**PARTE III — Weakness Map.** Prioriza patrones accionables y explica por qué cada uno importa.');
  lines.push('**PARTE IV — Manual personalizado basado en evidencia.** Incluye **todas las patologías/condiciones claramente identificables en lo visto**. Para temas contestados correctamente y con seguridad, usa una versión **corta/high-yield**. Para incorrectas, omitidas o correctas con duda, usa una versión **profunda**.');
  lines.push('**PARTE V — Rapid Review.** Crea tablas/listas ultra condensadas de key points, temporalidades, diferenciales, fármacos, red flags y next steps relevantes.');
  lines.push('**PARTE VI — Patrones transversales.** Integra errores que crucen patologías (ej. criterios de duración, confusión diagnóstica, farmacología, manejo).');
  lines.push('**PARTE VII — QBank de consolidación estilo IFOM.** Genera un número de preguntas proporcional al tamaño y diversidad del dataset; no rellenes por llegar a una cifra. Usa aproximadamente 50% sobre debilidades, 30% sobre el resto de contenidos vistos y 20% de integración/transferencia cuando haya suficiente material.');
  lines.push('**PARTE VIII — Respuestas y explicaciones.** Colócalas completamente al final para evitar spoilers. Cada pregunta debe tener una sola mejor respuesta, explicación breve de la correcta, por qué los distractores principales no aplican y un learning objective.');
  lines.push('**PARTE IX — Fuentes.** Lista guías, revisiones y estudios realmente utilizados, con organización/título, año y enlace o identificador verificable cuando sea posible.');
  lines.push('');
  lines.push('### D. Plantilla del manual por patología','');
  lines.push('- **Si es debilidad/frágil:** reconocimiento rápido; criterios/diagnóstico; temporalidad; clínica; diferenciales; evaluación/estudios; tratamiento inicial; qué hacer si no responde; farmacología y dosis high-yield cuando proceda; situaciones especiales; red flags; trampas de examen; `Lo que mis registros revelaron`; key points; evidencia utilizada.');
  lines.push('- **Si fue correcta y segura:** reconocimiento rápido; anclas diagnósticas; tratamiento/next step de primera línea; 5–8 key points; una nota de diferencial si es de alto rendimiento; evidencia utilizada. Evita expandir innecesariamente fortalezas.');
  lines.push('');
  lines.push('### E. Estilo del QBank','');
  lines.push('- Viñetas clínicas relativamente condensadas, estilo IFOM/NBME: información suficiente para aplicar conocimiento, sin decoración innecesaria.');
  lines.push('- Preferir diagnóstico, siguiente paso, manejo, farmacoterapia, prevención e interpretación clínica sobre recuerdo trivial aislado.');
  lines.push('- 5 opciones plausibles cuando sea razonable y una sola mejor respuesta.');
  lines.push('- No señales en el enunciado qué debilidad personal estás evaluando. Mezcla contenidos para evitar que el estudiante anticipe la respuesta.');
  lines.push('');

  lines.push('## MAPA DE DATOS OBSERVADOS','');
  const bySubject={};for(const a of allFirst){bySubject[a.subject]??={total:0,correct:0,incorrect:0,omitted:0,doubt:0};const g=bySubject[a.subject];g.total++;if(a.result==='correct')g.correct++;if(a.result==='incorrect')g.incorrect++;if(a.result==='omitted')g.omitted++;if(a.confidence==='doubt')g.doubt++;}
  if(!Object.keys(bySubject).length)lines.push('_No hay registros first-pass en este filtro._');
  else for(const [sub,g] of Object.entries(bySubject)){const denom=g.correct+g.incorrect;lines.push(`- **${sub}** · n=${g.total} · ${denom?`accuracy ${(g.correct/denom*100).toFixed(1)}%`:'accuracy N/A'} · incorrectas=${g.incorrect} · omitidas=${g.omitted} · con duda=${g.doubt}`)}

  lines.push('','## COBERTURA POR TEMA + ENFOQUE','');
  const useful=patterns.filter(g=>g.topic!=='Sin tema'||g.weak>0).slice(0,120);
  if(!useful.length)lines.push('_Aún no hay suficientes temas/enfoques clasificados._');
  else for(const g of useful){const reasons=Object.entries(g.reasons).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([r,n])=>`${r} (${n})`).join(', ');const status=g.weak>0?'FRÁGIL/DEBILIDAD':(g.total>0?'FORTALEZA RELATIVA':'NO EVALUADO');lines.push(`- **${g.topic} → ${g.focus}** · ${g.subject} / ${g.system} · n=${g.total} · ${g.accuracy==null?'accuracy N/A':g.accuracy.toFixed(1)+'%'} · señales débiles=${g.weak} · ${status}${reasons?` · motivos: ${reasons}`:''}`)}

  lines.push('','## MOTIVOS DE ERROR ACUMULADOS','');
  const reasonsSorted=Object.entries(reasonCounts).sort((a,b)=>b[1]-a[1]);
  if(!reasonsSorted.length)lines.push('_Sin causas de error clasificadas._');else reasonsSorted.forEach(([r,n])=>lines.push(`- ${r}: ${n}`));

  lines.push('','## REGISTROS DETALLADOS DE DEBILIDAD / DUDA','');
  if(!detailed.length)lines.push('_No hay registros detallados que coincidan con el filtro. Usa el mapa de cobertura para construir el repaso corto de fortalezas._','');
  for(const [i,a] of detailed.entries()){
    lines.push(`### ${i+1}. ${a.topic||a.system}${a.focus?` — ${a.focus}`:''}`);
    lines.push(`- Subject: ${a.subject}`);lines.push(`- System: ${a.system}`);if(a.questionId)lines.push(`- Question ID: ${a.questionId}`);lines.push(`- Resultado: ${resultLabel(a.result)}${a.confidence?` · ${confidenceLabel(a.confidence)}`:''}`);if(a.topic)lines.push(`- Tema clínico: ${a.topic}`);if(a.focus)lines.push(`- Enfoque: ${a.focus}`);if(a.errorReasons?.length)lines.push(`- Motivos marcados: ${a.errorReasons.join(', ')}`);const evid=attemptAttachmentIds(a).length;if(evid||a.strokes?.length)lines.push(`- Evidencias visuales guardadas en la app: ${evid} captura(s)${a.strokes?.length?` + pizarrón (${a.strokes.length} trazos)`:''}`);
    if(includeStem&&a.stem)lines.push(`\n**Caso clínico / stem**\n\n${a.stem.trim()}`);if(a.concept)lines.push(`\n**Concepto clave escrito por el estudiante (verificar)**\n\n${a.concept.trim()}`);if(a.whyFailed)lines.push(`\n**Por qué fallé / dudé**\n\n${a.whyFailed.trim()}`);if(a.rule)lines.push(`\n**Regla escrita por el estudiante (verificar)**\n\n${a.rule.trim()}`);if(a.notes)lines.push(`\n**Notas del estudiante (verificar cuando contengan afirmaciones médicas)**\n\n${a.notes.trim()}`);lines.push('');
  }

  if(includeCorrect&&secureCorrect.length){
    lines.push('## ANCLAS DE PREGUNTAS CORRECTAS SEGURAS — USAR PARA REPASO CORTO','');
    const anchors=new Map();
    for(const a of secureCorrect){const key=`${a.subject}|||${a.system}|||${(a.topic||'Sin tema').trim()}|||${(a.focus||'General').trim()}`;if(!anchors.has(key))anchors.set(key,{subject:a.subject,system:a.system,topic:(a.topic||'Sin tema').trim(),focus:(a.focus||'General').trim(),n:0,notes:[]});const g=anchors.get(key);g.n++;for(const t of [a.concept,a.rule].filter(Boolean)){const clean=t.trim();if(clean&&!g.notes.includes(clean)&&g.notes.length<2)g.notes.push(clean)}}
    for(const g of [...anchors.values()].sort((a,b)=>b.n-a.n).slice(0,100)){lines.push(`- **${g.topic} → ${g.focus}** · ${g.subject} / ${g.system} · n=${g.n}`);for(const note of g.notes)lines.push(`  - Apunte del estudiante para verificar: ${note.replace(/\s+/g,' ')}`)}
    lines.push('');
  }

  lines.push('## RESTRICCIONES FINALES','');
  lines.push('- No diagnostiques debilidad donde no hay datos.');
  lines.push('- No conviertas mis notas en “verdad” sin verificación.');
  lines.push('- No inventes fuentes, guías, DOI, dosis ni recomendaciones.');
  lines.push('- Mantén claramente separado lo observado en mis datos de la teoría médica añadida por ti.');
  lines.push('- Si hay incertidumbre, controversia o diferencias entre guías, decláralo y explica el motivo de forma breve.');
  return lines.join('\n');
}
async function exportAIReport(copyOnly=false){
  const report=buildAIReport();if(!report.trim())return toast('No hay datos para exportar con esos filtros.');
  if(copyOnly){try{await navigator.clipboard.writeText(report);toast('Informe para IA copiado al portapapeles.');return}catch{const ta=document.createElement('textarea');ta.value=report;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Informe copiado.')}}
  else downloadBlob(new Blob([report],{type:'text/markdown;charset=utf-8'}),`drcoach-ai-study-dossier-${dayKey()}.md`);
}
function renderRuntimeModeInfo(){
  const box=$('#runtimeModeInfo');if(!box)return;const p=location.protocol;
  box.innerHTML=p==='file:'?'<b>Modo portable</b><br>Funciona como un archivo único. La instalación PWA y la sincronización de assets no están disponibles; exporta backups con frecuencia.':'<b>Modo web/PWA</b><br>Esta instalación puede trabajar offline después de cargar los assets. Los datos siguen siendo locales a este dispositivo.';
}
async function installPWA(){
  const evt=state.deferredInstallPrompt;if(!evt)return toast('La instalación directa no está disponible ahora. Usa el menú del navegador → Instalar / Añadir a pantalla de inicio.');evt.prompt();try{await evt.userChoice}catch{}state.deferredInstallPrompt=null;$('#installAppBtn')?.classList.add('hidden');
}

function buildDataPackage(includeAttachmentMeta=true){
  return {app:APP_NAME,legacyApp:'Mediospira',appVersion:APP_VERSION,schemaVersion:SCHEMA_VERSION,exportedAt:nowISO(),target:TARGET_TOTAL,deadline:getSetting('deadline',DEADLINE),attempts:state.attempts.map(a=>includeAttachmentMeta?{...a}:{...a,attachmentId:null,attachmentIds:[],boardAttachmentId:null,attachmentExcluded:attemptAttachmentIds(a).length>0}),sessions:state.sessions,settings:Object.entries(state.settings).map(([key,value])=>({key,value})),baselines:state.baselines,attachments:includeAttachmentMeta?state.attachments.map(a=>({id:a.id,mime:a.mime||a.blob?.type||'image/jpeg',size:a.blob?.size||a.size||0,createdAt:a.createdAt,name:a.name||'',kind:a.kind||'image'})) : []};
}
async function exportDataOnly(){
  const data=buildDataPackage(false);downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`drcoach-data-${dayKey()}.json`);await setSetting('lastBackupAt',nowISO());updateStorageHealth();toast('Backup de datos exportado.');
}
async function exportFull(){
  try{
    toast('Preparando backup completo...');const data=buildDataPackage(true);const entries=[{name:'data.json',data:JSON.stringify(data)}];for(const a of state.attachments){if(a.blob)entries.push({name:`attachments/${a.id}.bin`,data:a.blob})}
    const manifest={format:'Dr.Coach! Backup',schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,exportedAt:data.exportedAt,attempts:data.attempts.length,sessions:data.sessions.length,baselines:data.baselines.length,attachments:data.attachments.length,totalAttachmentBytes:data.attachments.reduce((s,a)=>s+a.size,0)};entries.unshift({name:'manifest.json',data:JSON.stringify(manifest,null,2)});const blob=await ZIP.createZip(entries);downloadBlob(blob,`drcoach-full-${dayKey()}.zip`);await setSetting('lastBackupAt',nowISO());updateStorageHealth();toast(`Backup completo listo (${bytesLabel(blob.size)}).`);
  }catch(e){console.error(e);toast('No se pudo crear el backup completo.')}
}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000)}

async function previewImport(e){
  const file=e.target.files?.[0];state.pendingImport=null;$('#confirmImportBtn').classList.add('hidden');if(!file)return;
  try{
    let data,attachments=[];
    if(file.name.toLowerCase().endsWith('.zip')){
      const entries=await ZIP.readZip(file);if(!entries['data.json'])throw new Error('El ZIP no contiene data.json.');data=JSON.parse(ZIP.decodeText(entries['data.json']));
      for(const meta of data.attachments||[]){const bytes=entries[`attachments/${meta.id}.bin`];if(bytes)attachments.push({...meta,blob:new Blob([bytes],{type:meta.mime||'image/jpeg'})})}
    }else data=JSON.parse(await file.text());
    validateImport(data);state.pendingImport={data,attachments,fileName:file.name};$('#importPreview').classList.remove('hidden');$('#importPreview').innerHTML=`<b>${escapeHTML(file.name)}</b><br>${fmtInt(data.attempts?.length||0)} registros · ${fmtInt(data.sessions?.length||0)} bloques · ${fmtInt(data.baselines?.length||0)} baselines · ${fmtInt(attachments.length)} capturas<br><span class="muted">Exportado: ${data.exportedAt?fmtDateTime(data.exportedAt):'sin fecha'} · schema v${data.schemaVersion}</span>`;$('#confirmImportBtn').classList.remove('hidden');
  }catch(err){console.error(err);toast(err.message||'Backup inválido.');$('#importPreview').classList.add('hidden')}
}
function validateImport(d){const validApp=d&&(d.app===APP_NAME||d.app==='Mediospira'||d.legacyApp==='Mediospira');if(!validApp||!Array.isArray(d.attempts)||!Array.isArray(d.sessions)||!Array.isArray(d.baselines))throw new Error('Este archivo no parece un backup válido de Dr.Coach! o de una versión anterior compatible.');if(Number(d.schemaVersion)!==SCHEMA_VERSION)throw new Error(`Schema ${d.schemaVersion} no compatible con esta versión.`)}
async function confirmImport(){
  const p=state.pendingImport;if(!p)return;const mode=$('#importMode').value;if(!confirm(`${mode==='replace'?'REPLACE borrará lo local antes de restaurar.':'MERGE conservará lo local y añadirá IDs nuevos.'}\n\n¿Continuar?`))return;
  try{
    const d=p.data;
    if(mode==='replace'){
      await DB.clearAll();await Promise.all([DB.bulkPut('attempts',d.attempts||[]),DB.bulkPut('sessions',d.sessions||[]),DB.bulkPut('baselines',d.baselines||[]),DB.bulkPut('settings',d.settings||[]),DB.bulkPut('attachments',p.attachments||[])]);
    }else{
      const localIds={attempts:new Set(state.attempts.map(x=>x.id)),sessions:new Set(state.sessions.map(x=>x.id)),baselines:new Set(state.baselines.map(x=>x.id)),attachments:new Set(state.attachments.map(x=>x.id))};
      await DB.bulkPut('attempts',(d.attempts||[]).filter(x=>!localIds.attempts.has(x.id)));await DB.bulkPut('sessions',(d.sessions||[]).filter(x=>!localIds.sessions.has(x.id)));await DB.bulkPut('baselines',(d.baselines||[]).filter(x=>!localIds.baselines.has(x.id)));await DB.bulkPut('attachments',(p.attachments||[]).filter(x=>!localIds.attachments.has(x.id)));
      const existingSettings=new Set(Object.keys(state.settings));await DB.bulkPut('settings',(d.settings||[]).filter(x=>!existingSettings.has(x.key)));
    }
    await reloadState();state.pendingImport=null;$('#importPreview').classList.add('hidden');$('#confirmImportBtn').classList.add('hidden');$('#importFile').value='';renderAll();showView('today');toast('Importación completada.');
    // v3.0.0: push imported data to cloud so the backup also reaches the user's other devices
    if (window.DrCoachSync && state.cloudUser) {
      try {
        for (const a of state.attempts) await window.DrCoachSync.pushAttempt(a);
        for (const s of state.sessions) await window.DrCoachSync.pushSession(s);
        await window.DrCoachSync.pushSettings(state.settings);
        toast('Sincronizando con la nube…');
      } catch(e){ console.warn('post-import sync failed', e); }
    }
  }catch(e){console.error(e);toast('La importación falló; no cierres la app y revisa el archivo.')}
}
async function reloadState(){const [attempts,sessions,settings,baselines,attachments]=await Promise.all(['attempts','sessions','settings','baselines','attachments'].map(DB.getAll));state.attempts=attempts;state.sessions=sessions;state.baselines=baselines;state.attachments=attachments;state.settings=Object.fromEntries(settings.map(x=>[x.key,x.value]));state.activeSession=state.sessions.find(s=>s.status==='active')||null}
async function resetAll(){if(!confirm('Esto borrará TODO el progreso local, notas, pizarrones y capturas de este dispositivo. ¿Continuar?'))return;if(!confirm('Última confirmación: ¿borrar definitivamente?'))return;await DB.clearAll();for(const k of Object.keys(localStorage))if(k.startsWith('mediospira-draft-')||k.startsWith('drcoach-draft-'))localStorage.removeItem(k);location.reload()}

function registerServiceWorker(){if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('SW',e))}

window.addEventListener('beforeunload',()=>{if(state.activeSession)saveDraft()});
window.addEventListener('resize',()=>{if($('#view-today')?.classList.contains('active-view'))drawProgressChart($('#homeProgressChart'),$('#homeCurveSubject').value||'ALL')});

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstallPrompt=e;const b=$('#installAppBtn');if(b)b.classList.remove('hidden')});
window.addEventListener('appinstalled',()=>{state.deferredInstallPrompt=null;$('#installAppBtn')?.classList.add('hidden');toast('Dr.Coach! instalado en este dispositivo.')});



/* =========================================================
   Themes — local date/time aware, no external dependency
   Auto priority: Christmas > Fiestas Patrias > Halloween > Night > Classic.
   Girl / Pink Rose is intentionally manual.
   ========================================================= */
const THEME_LABELS={default:'Dr.Coach! Classic',girl:'Girl · Pink Rose',night:'Noche',halloween:'Halloween',patrias:'Fiestas Patrias · Panamá',christmas:'Navidad'};
let themeTimer=null;
function resolveAutomaticTheme(d=new Date()){
  const m=d.getMonth()+1,day=d.getDate(),h=d.getHours();
  const halloween=m===10&&day>=15;
  const patrias=m===11&&day>=1&&day<=28;
  const christmas=(m===11&&day>=29)||m===12||(m===1&&day<=6);
  if(christmas)return 'christmas';
  if(patrias)return 'patrias';
  if(halloween)return 'halloween';
  if(h>=19||h<7)return 'night';
  return 'default';
}
function themeScheduleText(d=new Date()){
  const auto=resolveAutomaticTheme(d),date=new Intl.DateTimeFormat('es-PA',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(d);
  const reason=auto==='christmas'?'temporada navideña':auto==='patrias'?'Fiestas Patrias de Panamá':auto==='halloween'?'temporada de Halloween':auto==='night'?'horario nocturno':'horario diurno';
  return `${date} · Auto elegiría ${THEME_LABELS[auto]} por ${reason}.`;
}
function applyTheme(theme,{persist=false}={}){
  if(!THEME_LABELS[theme])theme='default';
  document.documentElement.dataset.theme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');
  const colors={default:'#f8f6f1',girl:'#fff3f7',night:'#111827',halloween:'#171318',patrias:'#f7f8fb',christmas:'#f4f0e7'};
  if(meta)meta.setAttribute('content',colors[theme]||colors.default);
  if(persist)setSetting('themeMode',theme);
  renderThemeUI();
  requestAnimationFrame(()=>{if($('#view-today')?.classList.contains('active-view'))drawProgressChart($('#homeProgressChart'),$('#homeCurveSubject')?.value||'ALL');if($('#view-analytics')?.classList.contains('active-view'))drawProgressChart($('#analyticsProgressChart'),$('#analyticsCurveSubject')?.value||'ALL')});
}
async function setThemeMode(mode){
  if(!['auto','default','girl','night','halloween','patrias','christmas'].includes(mode))mode='auto';
  await setSetting('themeMode',mode);
  applyTheme(mode==='auto'?resolveAutomaticTheme():mode);
  toast(mode==='auto'?`Tema automático activado · ${THEME_LABELS[resolveAutomaticTheme()]}`:`Tema ${THEME_LABELS[mode]} activado.`);
}
function renderThemeUI(){
  const mode=getSetting('themeMode','auto'),active=mode==='auto'?resolveAutomaticTheme():mode;
  const label=$('#themeActiveLabel');if(label)label.textContent=THEME_LABELS[active]||THEME_LABELS.default;
  const status=$('#themeAutoStatus');if(status)status.textContent=themeScheduleText();
  $$('.theme-card').forEach(card=>card.classList.toggle('selected',mode===card.dataset.themeMode));
  const autoBtn=$('[data-theme-mode="auto"]');if(autoBtn)autoBtn.classList.toggle('is-current',mode==='auto');
  const toggle=$('#focusDockVisibleToggle');if(toggle)toggle.checked=getSetting('focusDockVisible',true)!==false;
  const navSwitch=$('#focusDockSidebarSwitch');if(navSwitch){const on=getSetting('focusDockVisible',true)!==false;navSwitch.classList.toggle('on',on);navSwitch.setAttribute('aria-checked',on?'true':'false')}
  const dot=$('#themeLiveDot');if(dot)dot.dataset.theme=active;
}
function initThemes(){
  const mode=getSetting('themeMode','auto');
  applyTheme(mode==='auto'?resolveAutomaticTheme():mode);
  $$('[data-theme-mode]').forEach(btn=>btn.addEventListener('click',()=>setThemeMode(btn.dataset.themeMode)));
  $('#focusDockVisibleToggle')?.addEventListener('change',e=>setFocusDockVisible(e.target.checked,true));
  clearInterval(themeTimer);themeTimer=setInterval(()=>{
    if(getSetting('themeMode','auto')==='auto')applyTheme(resolveAutomaticTheme());
    else renderThemeUI();
  },60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&getSetting('themeMode','auto')==='auto')applyTheme(resolveAutomaticTheme())});
}
function setFocusDockVisible(visible,persist=false){
  visible=visible!==false;
  document.body.classList.toggle('focus-dock-hidden',!visible);
  $('#focusDock')?.classList.toggle('dock-hidden',!visible);
  if(!visible&&persist)setFocusPanel(false);
  if(persist)setSetting('focusDockVisible',visible);
  syncFocusDockPlacement();
  renderThemeUI();
}

function syncFocusDockPlacement(){
  const dock=$('#focusDock'),bar=dock?.querySelector('.focus-dock-bar'),mount=$('#workspaceFocusTopMount');
  if(!dock||!bar||!mount)return;
  const visible=getSetting('focusDockVisible',true)!==false;
  const workspace=document.body.classList.contains('workspace-view-active');
  const topEligible=workspace&&visible&&window.matchMedia('(min-width:721px)').matches;
  if(topEligible){
    if(bar.parentElement!==mount)mount.appendChild(bar);
    document.body.classList.add('workspace-radio-top');
  }else{
    if(bar.parentElement!==dock)dock.appendChild(bar);
    document.body.classList.remove('workspace-radio-top');
  }
}

/* =========================================================
   Focus Radio — Smart Shuffle + curated YouTube + Search + personal links
   Curated radio and on-demand Search need no user key. Search uses public Piped/Invidious endpoints with failover and local cache.
   Smart Shuffle uses a shuffle-bag, playlist shuffling and automatic
   failover when YouTube reports a blocked/unavailable source.
   ========================================================= */
const FOCUS_STATIONS = [
  // Lofi / jazz-hop: several independent sources so the radio does not feel repetitive.
  {id:'lofi-girl-live-2026',mode:'lofi',kind:'youtube',title:'Lofi Girl · Study Radio',meta:'Lofi · live / long mix',videoId:'EWrX250Zhko'},
  {id:'lofi-girl-classic',mode:'lofi',kind:'youtube',title:'Lofi Girl · Classic Radio',meta:'Lofi · live / long mix',videoId:'jfKfPfyJRdk'},
  {id:'jazzhop-study-session',mode:'lofi',kind:'youtube',title:'Jazz Hop Café · Study Session',meta:'Jazz-hop · long mix',videoId:'VI5F7IxUw2o'},
  {id:'jazzhop-midnight',mode:'lofi',kind:'youtube',title:'Jazz Hop Café · Midnight',meta:'Lofi / jazz-hop · long mix',videoId:'1tUPFQ54gqc'},
  {id:'tokyo-night-funk',mode:'lofi',kind:'youtube',title:'Tokyo Night Funk',meta:'Lofi funk / city-pop · long mix',videoId:'_4Wm03gO554'},
  {id:'capybara-jazz-lofi',mode:'lofi',kind:'youtube',title:'Cozy Jazz Lofi',meta:'Jazz lofi · long mix',videoId:'IQDfx7QVOwA'},

  // Boom bap: playlists are especially useful here. YouTube shuffles the tracks internally.
  {id:'boom-bap-crate',mode:'boombap',kind:'youtube',title:'Boom Bap Crate',meta:'Old-school instrumentals · large playlist',playlistId:'PLctX_OJVTLua5245Tzl2ecXK1ryljnt0d',shufflePlaylist:true},
  {id:'boom-bap-pocket',mode:'boombap',kind:'youtube',title:'Pocket Boom Bap',meta:'Jazz / boom bap · mix',videoId:'Fmy-t4Rhy80'},
  {id:'boom-bap-graffiti',mode:'boombap',kind:'youtube',title:'Graffiti Boom Bap',meta:'Boom bap / rap instrumentals · playlist',playlistId:'OLAK5uy_kQAfyRo3fnl_ndJSaRKLV08stw-WZHSQA',shufflePlaylist:true},

  // Orchestral / academia. The error engine will skip anything YouTube refuses to embed.
  {id:'dark-academia',mode:'orchestral',kind:'youtube',title:'Dark Academia',meta:'Atmospheric classical · playlist',playlistId:'OLAK5uy_nxgXdmL7SdyEkU8p-ubIjj3Hn-9mcFop8',shufflePlaylist:true},
  {id:'dark-academia-single',mode:'orchestral',kind:'youtube',title:'Old Academia',meta:'Atmospheric instrumental',videoId:'fNjDr1S7VPw'},
  {id:'quiet-classical',mode:'orchestral',kind:'youtube',title:'Quiet Classical',meta:'Classical focus · long mix',videoId:'Fxa2jawiKdE'},
  {id:'orchestral-study',mode:'orchestral',kind:'youtube',title:'Orchestral Study',meta:'Instrumental focus',videoId:'h17OhSPD6Nw'},

  // Fully local sources.
  {id:'white-noise',mode:'noise',kind:'noise',noiseType:'white',title:'White Noise',meta:'Offline · generated locally'},
  {id:'pink-noise',mode:'noise',kind:'noise',noiseType:'pink',title:'Pink Noise',meta:'Offline · generated locally'},
  {id:'brown-noise',mode:'noise',kind:'noise',noiseType:'brown',title:'Brown Noise',meta:'Offline · generated locally'},
  {id:'binaural-10',mode:'binaural',kind:'binaural',beatHz:10,title:'Binaural 10 Hz',meta:'Offline ambience · headphones'},
  {id:'binaural-6',mode:'binaural',kind:'binaural',beatHz:6,title:'Binaural 6 Hz',meta:'Offline ambience · headphones'}
];
const focusState={
  mode:'auto',context:'today',current:null,playing:false,muted:false,volume:55,previousVolume:55,
  audioCtx:null,audioNodes:[],masterGain:null,custom:[],cursor:0,
  shuffle:true,bags:{},recent:[],history:[],historyIndex:-1,failed:new Set(),errorCounts:{},
  ytPlayer:null,ytReady:false,ytLoading:null,ytStationId:null,pendingAutoplay:false,playlistTrackHops:0,
  searchResults:[],searchQuery:'',searchLoading:false
};
let focusYTApiPromise=null;

function updateDayGreeting(){
  const el=$('#dayGreeting');if(!el)return;
  const q=getDailyQuote();
  el.textContent=`“${q.text}”`;
  const source=$('#dayGreetingSource');if(source)source.textContent=q.source;
}
function initFocusRadio(){
  if(!$('#focusDock'))return;
  focusState.mode=getSetting('focusMode','auto');
  focusState.volume=clamp(Number(getSetting('focusVolume',55)),0,100);focusState.previousVolume=focusState.volume||55;
  focusState.shuffle=getSetting('focusSmartShuffle',true)!==false;
  const saved=getSetting('focusCustomLinks',[]);focusState.custom=Array.isArray(saved)?saved:[];
  const recent=getSetting('focusRecentStations',[]);focusState.recent=Array.isArray(recent)?recent.slice(-12):[];focusState.searchQuery=getSetting('focusLastSearchQuery','')||'';if($('#focusSearchQuery'))$('#focusSearchQuery').value=focusState.searchQuery;
  $('#focusVolume').value=focusState.volume;$('#focusVolumeLabel').textContent=`${focusState.volume}%`;
  if($('#focusShuffleToggle'))$('#focusShuffleToggle').checked=focusState.shuffle;
  setFocusDockVisible(getSetting('focusDockVisible',true),false);
  bindFocusEvents();focusSetTabVisual(focusState.mode);focusPreviewForMode(focusState.mode);renderFocusCustomList();focusRenderSearchUI();
  syncFocusDockPlacement();
  window.addEventListener('online',()=>{focusState.failed.clear();renderFocusCurrent()});window.addEventListener('offline',renderFocusCurrent);
}
function bindFocusEvents(){
  window.addEventListener('resize',syncFocusDockPlacement);
  $('#focusExpandBtn')?.addEventListener('click',toggleFocusPanel);$('#focusPanelClose')?.addEventListener('click',()=>setFocusPanel(false));$('#focusQuickMode')?.addEventListener('click',toggleFocusPanel);
  $('#focusPlayBtn')?.addEventListener('click',focusTogglePlay);$('#focusNextBtn')?.addEventListener('click',()=>focusStep(1));$('#focusPrevBtn')?.addEventListener('click',()=>focusStep(-1));$('#focusMuteBtn')?.addEventListener('click',focusToggleMute);
  $('#focusModeTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-focus-mode]');if(b)focusSelectMode(b.dataset.focusMode)});
  $('#focusShuffleToggle')?.addEventListener('change',e=>focusSetShuffle(e.target.checked,true));
  $('#focusVolume')?.addEventListener('input',e=>focusSetVolume(Number(e.target.value),false));$('#focusVolume')?.addEventListener('change',e=>focusSetVolume(Number(e.target.value),true));
  $('#focusAddLinkToggle')?.addEventListener('click',()=>$('#focusCustomEditor')?.classList.toggle('hidden'));$('#focusCustomSave')?.addEventListener('click',saveFocusCustomLink);
  $('#focusOpenYoutubeBtn')?.addEventListener('click',focusOpenYoutubeExternal);$('#focusUseBrownBtn')?.addEventListener('click',()=>{focusState.mode='noise';focusSetTabVisual('noise');focusSelectStation(FOCUS_STATIONS.find(x=>x.id==='brown-noise'),true)});
  $('#focusCustomList')?.addEventListener('click',e=>{const play=e.target.closest('[data-focus-custom-play]'),remove=e.target.closest('[data-focus-custom-remove]');if(play){const st=focusState.custom.find(x=>x.id===play.dataset.focusCustomPlay);if(st){focusState.mode='custom';setSetting('focusMode','custom');focusSetTabVisual('custom');focusSelectStation(st,true)}}if(remove)removeFocusCustomLink(remove.dataset.focusCustomRemove)});
  $('#focusSearchBtn')?.addEventListener('click',focusSearchYouTube);$('#focusSearchQuery')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();focusSearchYouTube()}});$('#focusPlayTopResult')?.addEventListener('click',()=>focusPlaySearchTop());$('#focusStartSearchRadio')?.addEventListener('click',()=>focusStartSearchRadio());$('#focusSearchResults')?.addEventListener('click',e=>{const b=e.target.closest('[data-focus-search-play]');if(!b)return;const st=focusState.searchResults.find(x=>x.id===b.dataset.focusSearchPlay);if(st)focusSelectStation(st,true)});
}
function toggleFocusPanel(){setFocusPanel(!$('#focusDock').classList.contains('open'))}
function setFocusPanel(open){$('#focusDock')?.classList.toggle('open',!!open);$('#focusPanel')?.setAttribute('aria-hidden',open?'false':'true');$('#focusExpandBtn')?.setAttribute('aria-expanded',open?'true':'false');$('#focusNavBtn')?.classList.toggle('utility-active',!!open)}
function focusSetTabVisual(mode){
  $$('#focusModeTabs [data-focus-mode]').forEach(b=>b.classList.toggle('active',b.dataset.focusMode===mode));
  const labels={auto:'Auto',lofi:'Lofi',boombap:'Boom bap',orchestral:'Orquestal',noise:'Noise',binaural:'Binaural',search:'Buscar',custom:'Mis links'};
  $('#focusModeLabel').textContent=labels[mode]||'Auto';$('#focusQuickMode').textContent=(labels[mode]||'Auto').toUpperCase()+'⌄';
  $('#focusSearchPanel')?.classList.toggle('hidden',mode!=='search');
  if(mode==='search')focusRenderSearchUI();
}
async function focusSetShuffle(enabled,persist=false){
  focusState.shuffle=enabled!==false;focusState.bags={};if($('#focusShuffleToggle'))$('#focusShuffleToggle').checked=focusState.shuffle;
  if(persist)await setSetting('focusSmartShuffle',focusState.shuffle);
  const p=focusState.ytPlayer;if(p&&focusState.current?.playlistId){try{p.setShuffle(focusState.shuffle)}catch{}}
  renderFocusCurrent();
}
async function focusSelectMode(mode){
  if(!['auto','lofi','boombap','orchestral','noise','binaural','search','custom'].includes(mode))mode='auto';
  const wasPlaying=focusState.playing;focusStopPlayback(false);focusState.mode=mode;focusState.cursor=0;focusSetTabVisual(mode);await setSetting('focusMode',mode);focusPreviewForMode(mode);renderFocusCustomList();if(wasPlaying&&mode!=='search')focusStartPlayback();
}
function canEmbedYoutube(){return location.protocol==='http:'||location.protocol==='https:'}
function youtubeExternalUrl(st){if(!st)return 'https://www.youtube.com/';if(st.videoId&&st.playlistId)return `https://www.youtube.com/watch?v=${encodeURIComponent(st.videoId)}&list=${encodeURIComponent(st.playlistId)}`;if(st.videoId)return `https://www.youtube.com/watch?v=${encodeURIComponent(st.videoId)}`;if(st.playlistId)return `https://www.youtube.com/playlist?list=${encodeURIComponent(st.playlistId)}`;return st.url||'https://www.youtube.com/'}
function focusOpenYoutubeExternal(){const st=focusState.current;if(!st||st.kind!=='youtube')return;window.open(youtubeExternalUrl(st),'_blank','noopener')}
function fisherYates(items){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function focusStationId(st){return st?.id||''}
function focusAvailablePool(pool){
  let out=pool.filter(Boolean).filter(st=>!focusState.failed.has(focusStationId(st)));
  if(!out.length&&pool.length){focusState.failed.clear();out=pool.filter(Boolean)}
  return out;
}
function autoPool(){
  if(!navigator.onLine||!canEmbedYoutube())return ['brown-noise','pink-noise','binaural-10'].map(id=>FOCUS_STATIONS.find(s=>s.id===id)).filter(Boolean);
  const h=new Date().getHours(),ctx=focusState.context;
  let ids;
  if(ctx==='review')ids=['jazzhop-midnight','dark-academia','jazzhop-study-session','lofi-girl-live-2026','pink-noise'];
  else if(ctx==='session')ids=['lofi-girl-live-2026','jazzhop-study-session','boom-bap-crate','boom-bap-pocket','tokyo-night-funk','brown-noise'];
  else ids=['lofi-girl-live-2026','jazzhop-study-session','boom-bap-crate','dark-academia','tokyo-night-funk','pink-noise'];
  if(h>=21||h<7)ids=['jazzhop-midnight','tokyo-night-funk','dark-academia','lofi-girl-live-2026','brown-noise'];
  let pool=ids.map(id=>FOCUS_STATIONS.find(s=>s.id===id)).filter(Boolean);
  // Personal links become part of Auto once the user has intentionally saved them.
  if(focusState.custom.length)pool=pool.concat(focusState.custom);
  return pool;
}
function focusPoolForMode(mode){
  let pool=mode==='auto'?autoPool():mode==='custom'?focusState.custom:mode==='search'?focusState.searchResults:FOCUS_STATIONS.filter(s=>s.mode===mode);
  return focusAvailablePool(pool);
}
function focusBagKey(mode){return `${mode}|${focusState.context}|${navigator.onLine?'on':'off'}`}
function focusBuildBag(mode,pool){
  let candidates=pool.slice();
  // Prefer not to replay anything from the recent cross-session history when there are alternatives.
  const fresh=candidates.filter(st=>!focusState.recent.includes(focusStationId(st)));
  if(fresh.length>=Math.min(2,candidates.length))candidates=fresh;
  let bag=focusState.shuffle?fisherYates(candidates):candidates;
  const currentId=focusStationId(focusState.current);
  if(bag.length>1&&focusStationId(bag[bag.length-1])===currentId){const first=bag.shift();bag.unshift(bag.pop());bag.push(first)}
  focusState.bags[focusBagKey(mode)]=bag.map(focusStationId);
}
function focusDrawStation(mode,excludeId=''){
  const pool=focusPoolForMode(mode);if(!pool.length)return null;
  if(!focusState.shuffle){focusState.cursor=(focusState.cursor+1)%pool.length;return pool[focusState.cursor]}
  const key=focusBagKey(mode);let bag=focusState.bags[key]||[];
  const valid=new Set(pool.map(focusStationId));bag=bag.filter(id=>valid.has(id)&&id!==excludeId&&!focusState.failed.has(id));
  if(!bag.length){focusBuildBag(mode,pool);bag=(focusState.bags[key]||[]).filter(id=>id!==excludeId)}
  let id=bag.pop();focusState.bags[key]=bag;
  if(!id&&pool.length)id=focusStationId(pool.find(st=>focusStationId(st)!==excludeId)||pool[0]);
  return pool.find(st=>focusStationId(st)===id)||pool[0];
}
function focusPreviewForMode(mode){
  const pool=focusPoolForMode(mode);if(!pool.length){focusState.current=null;return renderFocusCurrent()}
  let st;
  if(focusState.shuffle){st=focusDrawStation(mode,focusStationId(focusState.current))||pool[0]}
  else{focusState.cursor=Math.min(focusState.cursor,pool.length-1);st=pool[focusState.cursor]}
  focusState.current=st;renderFocusCurrent();
}
function focusRemember(st){
  const id=focusStationId(st);if(!id)return;
  if(focusState.history[focusState.history.length-1]!==id){focusState.history=focusState.history.slice(0,focusState.historyIndex+1);focusState.history.push(id);focusState.historyIndex=focusState.history.length-1}
  focusState.recent=focusState.recent.filter(x=>x!==id);focusState.recent.push(id);focusState.recent=focusState.recent.slice(-12);setSetting('focusRecentStations',focusState.recent);
}
function focusStationById(id){return FOCUS_STATIONS.concat(focusState.custom,focusState.searchResults).find(st=>focusStationId(st)===id)}
function focusSelectStation(st,play=false){focusStopPlayback(false);focusState.current=st;renderFocusCurrent();if(play)focusStartPlayback()}
function renderFocusCurrent(){
  const st=focusState.current;const shuffleNote=focusState.shuffle?' · Shuffle':'';const emptyTitle=focusState.mode==='custom'?'Añade tu primer link':focusState.mode==='search'?'Busca algo para escuchar':'Listo para estudiar';const title=st?.title||emptyTitle;const meta=(st?.meta||(navigator.onLine?'Auto · online/offline':'Sin conexión · usa Noise o Binaural'))+shuffleNote;
  $('#focusTrackTitle').textContent=title;$('#focusTrackMeta').textContent=meta;$('#focusPanelTitle').textContent=title;$('#focusPanelSubtitle').textContent=st?focusDescription(st):(focusState.mode==='search'?'Escribe un artista, canción, álbum o mood. Puedes reproducir la mejor coincidencia o convertir los resultados en una radio aleatoria.':'Dr.Coach! puede elegir el ambiente por ti o usar tus propios videos y playlists.');
  $('#focusSourceBadge').textContent=st?.kind==='youtube'?'YOUTUBE':st?.kind==='noise'||st?.kind==='binaural'?'OFFLINE':focusState.mode.toUpperCase();
  const cover=$('#focusMiniCover');if(cover){cover.style.backgroundImage='';cover.innerHTML=`<span>${st?.kind==='youtube'?'YT':st?.kind==='binaural'?'Hz':st?.kind==='noise'?'N':'DC'}</span>`}
  const offline=st&&(st.kind==='noise'||st.kind==='binaural'),youtubeBlocked=st?.kind==='youtube'&&!canEmbedYoutube(),youtubeVisible=st?.kind==='youtube'&&focusState.playing&&canEmbedYoutube();$('#focusOfflineVisual')?.classList.toggle('hidden',!offline);$('#focusYoutubeShell')?.classList.toggle('hidden',!youtubeVisible);$('#focusYoutubeLocalNotice')?.classList.toggle('hidden',!youtubeBlocked);$('#focusPoster')?.classList.toggle('hidden',offline||youtubeVisible||youtubeBlocked);
  $('#focusPlayBtn').textContent=focusState.playing?'Ⅱ':'▶';$('#focusPlayBtn').setAttribute('aria-label',focusState.playing?'Pausar':'Reproducir');
}
function focusDescription(st){
  if(st.kind==='youtube'){
    if(!canEmbedYoutube())return 'YouTube integrado necesita HTTP/HTTPS. Noise y Binaural siguen disponibles sin conexión.';
    if(!navigator.onLine)return 'Necesitas conexión para esta fuente. Dr.Coach! puede cambiar automáticamente a audio local.';
    if(st.playlistId)return `Playlist de YouTube con ${focusState.shuffle?'shuffle activo':'orden original'}. Si una pista está bloqueada o no disponible, Dr.Coach! la salta automáticamente.`;
    return `Fuente de YouTube. Smart Shuffle evita repetir la misma fuente y salta automáticamente los embeds bloqueados.`;
  }
  if(st.kind==='noise')return `${st.title} generado por el navegador: no requiere internet ni archivos de audio.`;
  if(st.kind==='binaural')return `${st.title}, generado localmente. Úsalo solo como ambiente opcional; se recomienda audífonos.`;
  return 'Ambiente de estudio.';
}
function focusTogglePlay(){if(focusState.playing)focusPausePlayback();else focusStartPlayback()}
async function focusStartPlayback(){
  let st=focusState.current;if(!st){focusPreviewForMode(focusState.mode);st=focusState.current}if(!st)return toast(focusState.mode==='custom'?'Añade un link o playlist primero.':'No hay una fuente disponible en este modo.');
  if(st.kind==='youtube'){
    if(!navigator.onLine){const fallback=FOCUS_STATIONS.find(x=>x.id==='brown-noise');focusState.current=fallback;renderFocusCurrent();return focusStartPlayback()}
    if(!canEmbedYoutube()){focusState.playing=false;renderFocusCurrent();setFocusPanel(true);return toast('YouTube integrado necesita HTTP/HTTPS. En GitHub Pages funciona; desde file:// usa Noise o Binaural.')}
    focusStopAudio();focusState.playing=true;renderFocusCurrent();focusRemember(st);
    try{await focusLoadYoutubeStation(st,true)}catch{focusAutoSkipYoutube('No se pudo iniciar esta fuente.')}
    return;
  }
  if(st.kind==='noise')await startNoise(st.noiseType);else if(st.kind==='binaural')await startBinaural(st.beatHz||10);
  focusState.playing=true;focusRemember(st);renderFocusCurrent();
}
function focusPausePlayback(){const st=focusState.current;if(st?.kind==='youtube'){try{focusState.ytPlayer?.pauseVideo()}catch{}}else focusStopAudio();focusState.playing=false;renderFocusCurrent()}
function focusStopPlayback(clear=true){const st=focusState.current;if(st?.kind==='youtube'){try{focusState.ytPlayer?.pauseVideo()}catch{}}focusStopAudio();focusState.playing=false;if(clear)focusState.current=null}
function focusStep(dir){
  const st=focusState.current,player=focusState.ytPlayer;
  // For a playlist, transport buttons move through the shuffled tracks first — real radio variety.
  if(st?.kind==='youtube'&&st.playlistId&&player&&focusState.ytReady){try{dir>0?player.nextVideo():player.previousVideo();focusState.playing=true;renderFocusCurrent();return}catch{}}
  if(dir<0&&focusState.historyIndex>0){focusState.historyIndex--;const prev=focusStationById(focusState.history[focusState.historyIndex]);if(prev){const was=focusState.playing;focusStopPlayback(false);focusState.current=prev;renderFocusCurrent();if(was)focusStartPlayback();return}}
  const was=focusState.playing,currentId=focusStationId(st);focusStopPlayback(false);const next=focusDrawStation(focusState.mode,currentId);if(!next)return toast(focusState.mode==='custom'?'Añade más links o playlists.':'No hay otra fuente disponible.');focusState.current=next;renderFocusCurrent();if(was)focusStartPlayback();
}

function focusLoadYoutubeAPI(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(focusYTApiPromise)return focusYTApiPromise;
  focusYTApiPromise=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{try{previous?.()}catch{}resolve(window.YT)};
    if(!document.querySelector('script[data-drcoach-yt-api]')){const sc=document.createElement('script');sc.src='https://www.youtube.com/iframe_api';sc.async=true;sc.dataset.drcoachYtApi='1';sc.onerror=()=>reject(new Error('YouTube API unavailable'));document.head.appendChild(sc)}
    const started=Date.now(),timer=setInterval(()=>{if(window.YT?.Player){clearInterval(timer);resolve(window.YT)}else if(Date.now()-started>12000){clearInterval(timer);reject(new Error('YouTube API timeout'))}},100);
  });
  return focusYTApiPromise;
}
async function focusEnsureYouTubePlayer(){
  if(focusState.ytPlayer&&focusState.ytReady)return focusState.ytPlayer;
  if(focusState.ytLoading)return focusState.ytLoading;
  focusState.ytLoading=(async()=>{
    await focusLoadYoutubeAPI();
    if(focusState.ytPlayer)return focusState.ytPlayer;
    const target=$('#focusYoutubeFrame');if(!target)throw new Error('Player target missing');
    return await new Promise((resolve,reject)=>{
      let done=false;
      try{
        focusState.ytPlayer=new YT.Player('focusYoutubeFrame',{
          width:'100%',height:'100%',
          playerVars:{playsinline:1,rel:0,controls:1,enablejsapi:1,origin:location.origin},
          events:{
            onReady:e=>{focusState.ytReady=true;try{e.target.setVolume(focusState.muted?0:focusState.volume)}catch{}if(!done){done=true;resolve(e.target)}},
            onStateChange:focusHandleYTState,
            onError:focusHandleYTError
          }
        });
        setTimeout(()=>{if(!done&&!focusState.ytReady){done=true;reject(new Error('YouTube player timeout'))}},12000);
      }catch(err){reject(err)}
    });
  })().finally(()=>{focusState.ytLoading=null});
  return focusState.ytLoading;
}
async function focusLoadYoutubeStation(st,autoplay=true){
  const p=await focusEnsureYouTubePlayer();focusState.ytStationId=st.id;focusState.errorCounts[st.id]=0;focusState.playlistTrackHops=0;
  try{p.setVolume(focusState.muted?0:focusState.volume)}catch{}
  if(st.playlistId){
    p.loadPlaylist({listType:'playlist',list:st.playlistId,index:0,startSeconds:0});
    setTimeout(()=>{
      if(focusState.ytStationId!==st.id)return;
      try{
        p.setLoop(true);p.setShuffle(!!focusState.shuffle);
        const list=p.getPlaylist?.()||[];
        if(focusState.shuffle&&list.length>2){const idx=Math.floor(Math.random()*list.length);p.playVideoAt(idx)}
        else if(autoplay)p.playVideo();
      }catch{}
    },850);
  }else if(st.videoId){autoplay?p.loadVideoById(st.videoId):p.cueVideoById(st.videoId)}
  else throw new Error('Invalid YouTube source');
}
function focusHandleYTState(event){
  const state=event.data;
  if(state===YT.PlayerState.PLAYING){focusState.playing=true;focusState.errorCounts[focusStationId(focusState.current)]=0;renderFocusCurrent()}
  else if(state===YT.PlayerState.PAUSED){focusState.playing=false;renderFocusCurrent()}
  else if(state===YT.PlayerState.ENDED){
    const st=focusState.current;
    if(st?.playlistId){try{focusState.ytPlayer?.nextVideo();return}catch{}}
    focusAutoSkipYoutube('Fin de la pista · buscando otra.');
  }
}
function focusHandleYTError(event){
  const code=Number(event.data),st=focusState.current;if(!st||st.kind!=='youtube')return;
  const id=focusStationId(st);focusState.errorCounts[id]=(focusState.errorCounts[id]||0)+1;
  // 5 = HTML5; 100 = removed/private; 101/150 = embed blocked; 153 = missing client identity.
  if(st.playlistId&&focusState.errorCounts[id]<=3){
    try{focusState.ytPlayer?.nextVideo();toast('Pista no disponible · saltando automáticamente.');return}catch{}
  }
  if([5,100,101,150,153].includes(code)||focusState.errorCounts[id]>2)focusState.failed.add(id);
  focusAutoSkipYoutube('Fuente bloqueada o no disponible · buscando otra.');
}
function focusAutoSkipYoutube(message='Buscando otra fuente…'){
  const currentId=focusStationId(focusState.current);focusState.bags={};focusState.playing=true;toast(message);
  setTimeout(()=>{
    const next=focusDrawStation(focusState.mode,currentId);
    if(next){focusState.current=next;renderFocusCurrent();focusStartPlayback()}
    else{const fallback=FOCUS_STATIONS.find(x=>x.id==='brown-noise');focusState.current=fallback;renderFocusCurrent();focusStartPlayback()}
  },450);
}

async function ensureAudioContext(){if(!focusState.audioCtx)focusState.audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(focusState.audioCtx.state==='suspended')await focusState.audioCtx.resume();return focusState.audioCtx}
function focusStopAudio(){for(const n of focusState.audioNodes){try{n.stop?.()}catch{}try{n.disconnect?.()}catch{}}focusState.audioNodes=[];focusState.masterGain=null}
async function startNoise(type='brown'){
  focusStopAudio();const ctx=await ensureAudioContext(),seconds=3,len=ctx.sampleRate*seconds,buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;if(type==='white')data[i]=w*.52;else if(type==='pink'){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;data[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}else{last=(last+.02*w)/1.02;data[i]=last*3.2}}
  const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buf;src.loop=true;gain.gain.value=(focusState.muted?0:focusState.volume/100)*.22;src.connect(gain).connect(ctx.destination);src.start();focusState.audioNodes=[src,gain];focusState.masterGain=gain;
}
async function startBinaural(beatHz=10){
  focusStopAudio();const ctx=await ensureAudioContext(),gain=ctx.createGain(),merge=ctx.createChannelMerger(2),left=ctx.createOscillator(),right=ctx.createOscillator(),lg=ctx.createGain(),rg=ctx.createGain();left.type=right.type='sine';left.frequency.value=200-beatHz/2;right.frequency.value=200+beatHz/2;gain.gain.value=(focusState.muted?0:focusState.volume/100)*.10;left.connect(lg).connect(merge,0,0);right.connect(rg).connect(merge,0,1);merge.connect(gain).connect(ctx.destination);left.start();right.start();focusState.audioNodes=[left,right,lg,rg,merge,gain];focusState.masterGain=gain;
}
function focusSetVolume(v,persist=true){v=clamp(v,0,100);focusState.volume=v;if(v>0){focusState.previousVolume=v;focusState.muted=false}$('#focusVolumeLabel').textContent=`${v}%`;$('#focusVolume').value=v;const st=focusState.current;if(st?.kind==='youtube'){try{focusState.ytPlayer?.setVolume(focusState.muted?0:v)}catch{}}const gain=focusState.masterGain;if(gain)gain.gain.value=(focusState.muted?0:v/100)*(st?.kind==='binaural'?.10:.22);if(persist)setSetting('focusVolume',v)}
function focusToggleMute(){if(focusState.muted){focusState.muted=false;focusSetVolume(focusState.previousVolume||55,false)}else{focusState.previousVolume=focusState.volume||55;focusState.muted=true;const st=focusState.current;if(st?.kind==='youtube'){try{focusState.ytPlayer?.setVolume(0)}catch{}}const gain=focusState.masterGain;if(gain)gain.gain.value=0}$('#focusMuteBtn').textContent=focusState.muted?'×':'⌁'}
function focusDecodeHTML(text=''){const el=document.createElement('textarea');el.innerHTML=String(text);return el.value}
const FOCUS_SEARCH_CACHE_TTL=1000*60*60*24*30;
/* Public search endpoints change often. Keep a current seed list, then refresh Piped instances from its official documentation. */
const FOCUS_PIPED_FALLBACKS=[
  'https://pipedapi.leptons.xyz','https://pipedapi.nosebs.ru','https://piped-api.privacy.com.de',
  'https://pipedapi.adminforge.de','https://api.piped.yt','https://pipedapi.drgns.space',
  'https://pipedapi.owo.si','https://pipedapi.ducks.party','https://piped-api.codespace.cz',
  'https://pipedapi.reallyaweso.me','https://api.piped.private.coffee','https://pipedapi.darkness.services',
  'https://pipedapi.orangenet.cc','https://pipedapi.kavin.rocks','https://pipedapi-libre.kavin.rocks'
];
const FOCUS_INVIDIOUS_FALLBACKS=['https://inv.nadeko.net','https://invidious.nerdvpn.de','https://yt.chocolatemoo53.com','https://invidious.tiekoetter.com'];
const FOCUS_PIPED_INSTANCE_DOC='https://raw.githubusercontent.com/TeamPiped/documentation/refs/heads/main/content/docs/public-instances/index.md';
function focusNormalizeQuery(q=''){return String(q).trim().toLowerCase().replace(/\s+/g,' ')}
function focusSearchCache(){const c=getSetting('focusSearchCache',{});return c&&typeof c==='object'&&!Array.isArray(c)?c:{}}
async function focusCacheResults(query,results,provider='public'){
  const cache=focusSearchCache(),key=focusNormalizeQuery(query);cache[key]={ts:Date.now(),query,provider,results:results.slice(0,30)};
  const keys=Object.keys(cache).sort((a,b)=>(cache[b]?.ts||0)-(cache[a]?.ts||0));for(const k of keys.slice(24))delete cache[k];
  await setSetting('focusSearchCache',cache);
}
function focusCachedResults(query){const row=focusSearchCache()[focusNormalizeQuery(query)];if(!row||!Array.isArray(row.results)||!row.results.length)return null;return {...row,stale:Date.now()-(row.ts||0)>FOCUS_SEARCH_CACHE_TTL}}
function focusWithTimeout(ms=7000){const c=new AbortController();const id=setTimeout(()=>c.abort(),ms);return {signal:c.signal,done:()=>clearTimeout(id)}}
async function focusFetchJSON(url,ms=7000){const t=focusWithTimeout(ms);try{const r=await fetch(url,{signal:t.signal,headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{t.done()}}
async function focusFetchText(url,ms=7000){const t=focusWithTimeout(ms);try{const r=await fetch(url,{signal:t.signal,headers:{Accept:'text/plain,*/*'},cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{t.done()}}
function focusShuffleArray(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function focusVideoIdFromUrl(raw=''){const m=String(raw).match(/[?&]v=([A-Za-z0-9_-]{6,})/);return m?m[1]:''}
function focusMapPiped(data,query){
  const items=Array.isArray(data?.items)?data.items:[];return items.filter(x=>x?.type==='stream'||/\/watch\?v=/.test(x?.url||'')).map(x=>{const videoId=focusVideoIdFromUrl(x.url||'');if(!videoId)return null;return {id:`search:${videoId}`,mode:'search',kind:'youtube',videoId,title:focusDecodeHTML(x.title||query),meta:focusDecodeHTML(x.uploaderName||x.uploader||'YouTube'),searchQuery:query,thumbnail:x.thumbnail||''}}).filter(Boolean)
}
function focusMapInvidious(data,query){
  const items=Array.isArray(data)?data:[];return items.filter(x=>x?.videoId&&(x.type==='video'||!x.type)).map(x=>({id:`search:${x.videoId}`,mode:'search',kind:'youtube',videoId:x.videoId,title:focusDecodeHTML(x.title||query),meta:focusDecodeHTML(x.author||'YouTube'),searchQuery:query,thumbnail:x.videoThumbnails?.find?.(t=>t.quality==='medium')?.url||x.videoThumbnails?.[0]?.url||''}))
}
function focusDedupeResults(items){const seen=new Set();return items.filter(x=>x?.videoId&&!seen.has(x.videoId)&&seen.add(x.videoId)).slice(0,30)}
async function focusGetPipedBases(){
  const cached=getSetting('focusPipedInstances',null);
  if(cached?.ts&&Date.now()-cached.ts<1000*60*60*12&&Array.isArray(cached.bases)&&cached.bases.length)return focusDedupeStrings([...cached.bases,...FOCUS_PIPED_FALLBACKS]);
  let bases=[];
  try{
    const md=await focusFetchText(FOCUS_PIPED_INSTANCE_DOC,5500);
    const matches=md.match(/https:\/\/[A-Za-z0-9._-]+/g)||[];
    bases=matches.filter(u=>/piped|watchapi|pdapi|piapi|api\.watch/i.test(u));
  }catch{}
  bases=focusDedupeStrings([...bases,...FOCUS_PIPED_FALLBACKS]);
  await setSetting('focusPipedInstances',{ts:Date.now(),bases});
  return bases;
}
async function focusSearchBatch(bases,query,provider,mapFn,urlFn){
  let lastErr=null;
  for(let i=0;i<bases.length;i+=4){
    const batch=bases.slice(i,i+4).map(base=>(async()=>{
      const data=await focusFetchJSON(urlFn(base,query),4800);
      const rows=focusDedupeResults(mapFn(data,query));
      if(!rows.length)throw new Error('Sin resultados');
      return {base,results:rows};
    })());
    try{
      const hit=await Promise.any(batch);
      return {results:hit.results,provider,base:hit.base};
    }catch(e){lastErr=e}
  }
  throw lastErr||new Error(`${provider} no disponible`);
}
async function focusSearchViaPiped(query){
  const preferred=String(getSetting('focusSearchPreferredPiped','')||'');
  let bases=focusShuffleArray(await focusGetPipedBases());
  if(preferred){const i=bases.indexOf(preferred);if(i>=0)bases.splice(i,1);bases.unshift(preferred)}
  const hit=await focusSearchBatch(bases.slice(0,20),query,'Piped',focusMapPiped,(base,q)=>`${base}/search?q=${encodeURIComponent(q)}&filter=videos`);
  if(hit.base)await setSetting('focusSearchPreferredPiped',hit.base);
  return {results:hit.results,provider:hit.provider};
}
async function focusGetInvidiousBases(){
  const cached=getSetting('focusInvidiousInstances',null);if(cached?.ts&&Date.now()-cached.ts<1000*60*60*24&&Array.isArray(cached.bases)&&cached.bases.length)return cached.bases;
  let bases=[];try{const data=await focusFetchJSON('https://api.invidious.io/instances.json?sort_by=health',5500);if(Array.isArray(data))bases=data.filter(row=>Array.isArray(row)&&row[1]?.type==='https').map(row=>`https://${row[0]}`).slice(0,18)}catch{}
  bases=focusDedupeStrings([...bases,...FOCUS_INVIDIOUS_FALLBACKS]);await setSetting('focusInvidiousInstances',{ts:Date.now(),bases});return bases;
}
function focusDedupeStrings(items){return [...new Set(items.filter(Boolean))]}
async function focusSearchViaInvidious(query){
  const preferred=String(getSetting('focusSearchPreferredInvidious','')||'');let bases=focusShuffleArray(await focusGetInvidiousBases());if(preferred){const i=bases.indexOf(preferred);if(i>=0)bases.splice(i,1);bases.unshift(preferred)}
  const hit=await focusSearchBatch(bases.slice(0,12),query,'Invidious',focusMapInvidious,(base,q)=>`${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&sort_by=relevance`);
  if(hit.base)await setSetting('focusSearchPreferredInvidious',hit.base);
  return {results:hit.results,provider:hit.provider};
}
function focusMapJinaMarkdown(markdown,query){
  const text=String(markdown||'');
  const rows=[];
  const seen=new Set();
  const push=(videoId,title='')=>{
    if(!videoId||seen.has(videoId))return;
    seen.add(videoId);
    const cleanTitle=focusDecodeHTML(String(title||query).replace(/\s+/g,' ').trim()).replace(/^[-–—|]+|[-–—|]+$/g,'').trim()||query;
    rows.push({id:`search:${videoId}`,mode:'search',kind:'youtube',videoId,title:cleanTitle,meta:'YouTube',searchQuery:query,thumbnail:`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`});
  };
  // Markdown links emitted by Jina Reader from the YouTube results page.
  const md=/\[([^\]\n]{1,220})\]\((?:https?:\/\/(?:www\.)?youtube\.com)?\/watch\?[^)]*?v=([A-Za-z0-9_-]{11})[^)]*\)/g;
  let m;while((m=md.exec(text)))push(m[2],m[1]);
  // Fallback for raw YouTube watch URLs that are not wrapped in Markdown.
  const raw=/(?:https?:\/\/(?:www\.)?youtube\.com)?\/watch\?[^\s)\]>]*?v=([A-Za-z0-9_-]{11})/g;
  while((m=raw.exec(text)))push(m[1],query);
  // Shorts occasionally surface in search results.
  const shorts=/(?:https?:\/\/(?:www\.)?youtube\.com)?\/shorts\/([A-Za-z0-9_-]{11})/g;
  while((m=shorts.exec(text)))push(m[1],query);
  return rows.slice(0,30);
}
async function focusSearchViaJina(query){
  // Reader acts as a server-side fetcher, which avoids the CORS failures that
  // public Piped/Invidious instances often trigger in static GitHub Pages builds.
  const target=`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const url=`https://r.jina.ai/${target}`;
  const text=await focusFetchText(url,12000);
  const results=focusMapJinaMarkdown(text,query);
  if(!results.length)throw new Error('Jina sin resultados');
  return {results,provider:'Jina Reader'};
}
async function focusSearchPublic(query){
  let lastErr=null;
  // Prefer Jina Reader: it works from a static/Portable GitHub Pages build
  // without a user API key. Keep Piped/Invidious only as fallbacks.
  try{const r=await focusSearchViaJina(query);if(r?.results?.length)return r}catch(e){lastErr=e}
  const order=Math.random()<.5?[focusSearchViaPiped,focusSearchViaInvidious]:[focusSearchViaInvidious,focusSearchViaPiped];
  for(const fn of order){try{const r=await fn(query);if(r?.results?.length)return r}catch(e){lastErr=e}}
  throw lastErr||new Error('Fuentes de búsqueda no disponibles');
}
function focusRenderSearchUI(){
  if(focusState.mode!=='search')return;
  const actions=$('#focusSearchActions'),status=$('#focusSearchStatus'),list=$('#focusSearchResults');actions?.classList.toggle('hidden',!focusState.searchResults.length);
  if(status){if(focusState.searchLoading)status.textContent=focusState.searchResults.length?'Resultados guardados · buscando opciones nuevas…':'Buscando…';else if(focusState.searchResults.length)status.textContent=`${focusState.searchResults.length} resultados para “${focusState.searchQuery}”.`;else status.textContent='Busca por artista, canción, álbum o mood.'}
  if(list)list.innerHTML=focusState.searchResults.slice(0,9).map((st,i)=>`<button class="focus-search-result" type="button" data-focus-search-play="${escapeHTML(st.id)}"><span class="focus-search-rank">${i+1}</span><span><b>${escapeHTML(st.title)}</b><small>${escapeHTML(st.meta||'YouTube')}</small></span><i>▶</i></button>`).join('');
}
async function focusSearchYouTube(){
  if(focusState.searchLoading)return;
  const query=$('#focusSearchQuery')?.value.trim()||'';if(!query)return toast('Escribe qué quieres escuchar.');
  focusState.searchLoading=true;focusState.searchQuery=query;await setSetting('focusLastSearchQuery',query);
  const cached=focusCachedResults(query);if(cached?.results?.length){focusState.searchResults=cached.results;focusState.bags={};focusRenderSearchUI()}
  if(!navigator.onLine){focusState.searchLoading=false;focusRenderSearchUI();return cached?toast('Sin conexión · usando resultados guardados.'):toast('Necesitas conexión para una búsqueda nueva.')}
  try{
    const found=await focusSearchPublic(query);focusState.searchResults=found.results;focusState.failed.clear();focusState.bags={};focusState.current=null;await focusCacheResults(query,found.results,found.provider);if(!found.results.length)toast('No encontré resultados para esa búsqueda.');
  }catch(err){if(!cached)toast('La búsqueda pública no respondió. Intenta nuevamente en unos segundos.');else toast('No pude actualizar la búsqueda · mantengo los resultados guardados.');}
  finally{focusState.searchLoading=false;focusRenderSearchUI();renderFocusCurrent()}
}
function focusPlaySearchTop(){const st=focusState.searchResults[0];if(!st)return toast('Haz una búsqueda primero.');focusState.mode='search';focusSetTabVisual('search');focusSelectStation(st,true)}
function focusStartSearchRadio(){if(!focusState.searchResults.length)return toast('Haz una búsqueda primero.');focusState.mode='search';focusState.bags={};focusSetTabVisual('search');const st=focusDrawStation('search',focusStationId(focusState.current));if(st)focusSelectStation(st,true)}
function parseYoutubeUrl(raw){
  try{const u=new URL(raw.trim());const host=u.hostname.replace(/^www\./,'');let videoId='',playlistId=u.searchParams.get('list')||'';if(host==='youtu.be')videoId=u.pathname.split('/').filter(Boolean)[0]||'';else if(host.endsWith('youtube.com')){if(u.pathname==='/watch')videoId=u.searchParams.get('v')||'';else if(u.pathname.startsWith('/shorts/')||u.pathname.startsWith('/live/')||u.pathname.startsWith('/embed/'))videoId=u.pathname.split('/')[2]||''}if(!videoId&&!playlistId)return null;return {videoId,playlistId}}
  catch{return null}
}
async function saveFocusCustomLink(){const raw=$('#focusCustomUrl').value.trim(),parsed=parseYoutubeUrl(raw);if(!parsed)return toast('Pega un link válido de YouTube o de una playlist.');const name=$('#focusCustomName').value.trim()||`Mi Focus ${focusState.custom.length+1}`,id=uuid();focusState.custom.push({id,mode:'custom',kind:'youtube',title:name,meta:parsed.playlistId?'Mi playlist · YouTube':'Mi video · YouTube',shufflePlaylist:!!parsed.playlistId,...parsed,url:raw});focusState.bags={};await setSetting('focusCustomLinks',focusState.custom);$('#focusCustomName').value='';$('#focusCustomUrl').value='';$('#focusCustomEditor').classList.add('hidden');renderFocusCustomList();toast('Guardado en Mis links.');if(focusState.mode==='custom'&&!focusState.current)focusPreviewForMode('custom')}
async function removeFocusCustomLink(id){focusState.custom=focusState.custom.filter(x=>x.id!==id);focusState.bags={};await setSetting('focusCustomLinks',focusState.custom);if(focusState.current?.id===id){focusStopPlayback();focusPreviewForMode('custom')}renderFocusCustomList();toast('Link eliminado.')}
function renderFocusCustomList(){const box=$('#focusCustomList');if(!box)return;if(focusState.mode!=='custom'){box.innerHTML='';return}box.innerHTML=focusState.custom.length?focusState.custom.map(st=>`<div class="focus-custom-item"><span>${escapeHTML(st.title)}</span><span><button type="button" data-focus-custom-play="${escapeHTML(st.id)}">Reproducir</button><button class="remove" type="button" data-focus-custom-remove="${escapeHTML(st.id)}">×</button></span></div>`).join(''):'<div class="muted microcopy">Aún no has guardado videos o playlists.</div>'}

// =====================================================================
// v3.0.0 — Cloud sync helpers
// =====================================================================
// Upload all attachments of a freshly-saved attempt to Supabase
// Storage. Best-effort: failures log a warning but never block the
// local save, which already completed by this point.
async function uploadAttachmentsToCloud(attempt){
  if (!window.DrCoachStorage || !state.cloudUser) return;
  const ids = attemptAttachmentIds(attempt);
  if (!ids || ids.length === 0) return;
  for (const id of ids) {
    try {
      const att = attachmentById(id) || await DB.get('attachments', id);
      if (!att?.blob) continue;
      await window.DrCoachStorage.uploadAttachment({
        attemptId: attempt.id,
        attachmentId: id,
        blob: att.blob,
      });
    } catch (e) {
      console.warn('[cloud] attachment upload failed', id, e);
    }
  }
}

// Hooked into the existing edit-attachment-remove flow so that deletes
// also propagate to the cloud.
async function deleteAttachmentFromCloud(attempt, attachmentId){
  if (!window.DrCoachStorage || !state.cloudUser) return;
  try {
    await window.DrCoachStorage.deleteAttachment({
      attemptId: attempt.id,
      attachmentId,
    });
  } catch(e){ console.warn('[cloud] attachment delete failed', e); }
}

// =====================================================================
// v3.0.0 — Cloud Sync UI (Datos view)
// ---------------------------------------------------------------------
// Botones explícitos en la vista Datos para que el usuario pueda:
//   • Subir TODO su progreso local a la nube (incluso datos preexistentes
//     de v2.6.7 que nunca se habían sincronizado).
//   • Descargar todo lo de la nube a este dispositivo (reemplaza lo local).
//   • Ver el estado actual de la sincronización.
// =====================================================================

function cloudLog(message, kind='info') {
  const log = document.getElementById('cloudSyncLog');
  if (!log) return;
  const time = new Intl.DateTimeFormat('es-PA', {hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
  const line = document.createElement('div');
  line.className = kind;
  line.textContent = `[${time}] ${message}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  // Mantener máximo 50 líneas
  while (log.children.length > 50) log.removeChild(log.firstChild);
}

function cloudSetBadge(text, kind='idle') {
  const badge = document.getElementById('cloudSyncBadge');
  if (!badge) return;
  badge.textContent = text;
  badge.style.background = kind === 'ok' ? 'var(--primary)' : kind === 'warn' ? 'var(--warn)' : 'var(--surface-2)';
  badge.style.color = kind === 'ok' ? '#fff' : 'var(--text)';
}

function cloudRefreshStatus() {
  const stateEl = document.getElementById('cloudSyncState');
  const userEl = document.getElementById('cloudSyncUser');
  const pendingEl = document.getElementById('cloudSyncPending');
  const dlqEl = document.getElementById('cloudSyncDlq');
  const retryBtn = document.getElementById('cloudRetryBtn');
  const lastEl = document.getElementById('cloudSyncLast');
  const verEl = document.getElementById('cloudSyncVersion');
  const badge = document.getElementById('cloudSyncBadge');
  if (!stateEl) return;

  // v3.0.4: make the app version visible in Datos — when the sync error
  // comes from a device still running 3.0.2/3.0.3, this row proves it.
  if (verEl) verEl.textContent = `v${APP_VERSION}`;

  const hasUser = !!(state.cloudUser);
  if (!hasUser) {
    stateEl.textContent = 'Sin sesión (modo local)';
    userEl.textContent = '—';
    pendingEl.textContent = '—';
    if (dlqEl) dlqEl.textContent = '—';
    if (retryBtn) retryBtn.hidden = true;
    lastEl.textContent = '—';
    if (badge) { badge.textContent = 'Local-only'; badge.style.background = 'var(--surface-2)'; badge.style.color = 'var(--muted)'; }
    return;
  }
  userEl.textContent = state.cloudUser?.email || '—';
  // v3.0.4: the Estado row mirrors the live indicator — including WHY it
  // failed (auth / supabase) instead of a flat "Conectado".
  const st = window.DrCoachSync?.getStatus?.() || 'idle';
  const err = window.DrCoachSync?.getLastError?.();
  const stLabel = { idle: 'Conectado — todo sincronizado', syncing: 'Sincronizando…', pending: 'Cambios pendientes de subir', offline: 'Sin conexión', error: '⚠ Error de sync', auth: '⚠ Sesión expirada' }[st] || st;
  stateEl.textContent = (st === 'error' || st === 'auth') && err?.message ? `${stLabel} — ${String(err.message).slice(0, 120)}` : stLabel;
  stateEl.style.color = (st === 'error' || st === 'auth') ? 'var(--bad)' : '';
  if (badge) {
    const ok = st === 'idle' || st === 'pending';
    badge.textContent = ok ? 'Cloud Sync' : st === 'syncing' ? 'Cloud Sync' : '⚠ Revisar';
    badge.style.background = ok || st === 'syncing' ? 'var(--primary)' : 'var(--bad)';
    badge.style.color = '#fff';
  }

  // Pending count
  if (window.DrCoachSync) {
    window.DrCoachSync.refreshPendingCount().then(n => {
      pendingEl.textContent = String(n);
    }).catch(() => { pendingEl.textContent = '—'; });
  } else {
    pendingEl.textContent = '0';
  }

  // v3.0.3 · Registros en error (dead-letter queue) + botón de reintento
  let dlqCount = 0;
  try { dlqCount = (JSON.parse(localStorage.getItem('drcoach.sync.dlq') || '[]') || []).length; } catch (_) {}
  if (dlqEl) dlqEl.textContent = String(dlqCount);
  if (retryBtn) retryBtn.hidden = dlqCount === 0;

  // Last sync time
  const lastTs = Number(localStorage.getItem('drcoach.lastSyncAt') || 0);
  if (lastTs > 0) {
    try {
      lastEl.textContent = new Intl.DateTimeFormat('es-PA', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(lastTs));
    } catch { lastEl.textContent = '—'; }
  } else {
    lastEl.textContent = 'Nunca';
  }
}

// v3.0.3 · Sync Doctor: recorre cada eslabón de la cadena (config →
// cliente → sesión → tablas → perfil → cola/DLQ) y muestra el resultado
// en un panel legible. Pensado para responder "¿por qué me da error de
// sync?" sin abrir la consola.
async function cloudDiagnose() {
  const out = document.getElementById('cloudDiagOutput');
  const btn = document.getElementById('cloudDiagBtn');
  if (!out) return;
  if (!window.DrCoachSync?.diagnose) {
    cloudLog('Módulo de sincronización no disponible.', 'err');
    return;
  }
  if (btn) btn.disabled = true;
  out.hidden = false;
  out.innerHTML = '<div class="cloud-diag-item">Comprobando…</div>';
  cloudLog('Ejecutando diagnóstico de Cloud Sync…');
  try {
    const results = await window.DrCoachSync.diagnose();
    out.innerHTML = results.map(r =>
      `<div class="cloud-diag-item ${r.ok ? 'diag-ok' : 'diag-fail'}"><span class="diag-icon" aria-hidden="true">${r.ok ? '✓' : '✗'}</span><div><b>${escapeHTML(r.label)}</b><span>${escapeHTML(r.detail)}</span></div></div>`
    ).join('');
    const bad = results.filter(r => !r.ok).length;
    cloudLog(bad === 0
      ? '✓ Diagnóstico completo: todo correcto.'
      : `⚠ Diagnóstico completo: ${bad} punto(s) con problema. Revisa el detalle de arriba.`, bad === 0 ? 'ok' : 'warn');
  } catch (e) {
    out.innerHTML = `<div class="cloud-diag-item diag-fail"><span class="diag-icon" aria-hidden="true">✗</span><div><b>Diagnóstico</b><span>${escapeHTML(String(e?.message || e))}</span></div></div>`;
    cloudLog(`Error en diagnóstico: ${e?.message || e}`, 'err');
  } finally {
    if (btn) btn.disabled = false;
    cloudRefreshStatus();
  }
}

// v3.0.3 · Reincorpora los registros que quedaron aparcados en la
// dead-letter (tras 3 fallos del bug anterior) y fuerza la subida ahora.
async function cloudRetryFailed() {
  if (!state.cloudUser) { toast('Inicia sesión en Dr.Coach! Cloud primero.'); return; }
  if (!window.DrCoachSync?.requeueDLQ) return;
  const btn = document.getElementById('cloudRetryBtn');
  if (btn) btn.disabled = true;
  try {
    const n = await window.DrCoachSync.requeueDLQ();
    if (n === 0) {
      cloudLog('No hay registros en error que reintentar.', 'ok');
      return;
    }
    cloudLog(`♻ ${n} registro(s) reincorporados a la cola. Subiendo…`);
    const result = await window.DrCoachSync.push();
    if (result.failed === 0 && result.processed > 0) {
      localStorage.setItem('drcoach.lastSyncAt', String(Date.now()));
      cloudLog(`✓ ${result.processed} registro(s) recuperados y subidos a la nube.`, 'ok');
      toast('Registros recuperados y subidos.');
    } else if (result.failed > 0) {
      cloudLog(`⚠ ${result.processed} subidos, ${result.failed} siguen fallando. Detalle: ${result.lastError || 'desconocido'}`, 'warn');
      toast('Algunos registros siguen fallando. Revisa el log.');
    } else {
      cloudLog('Sin cambios pendientes por subir.', 'ok');
    }
  } catch (e) {
    cloudLog(`Error al reintentar: ${e?.message || e}`, 'err');
  } finally {
    if (btn) btn.disabled = false;
    cloudRefreshStatus();
  }
}

// v3.0.5 · Vacía la cola de subida de forma controlada. Responde a la
// pregunta "¿hacemos un clear cola o buscamos el verdadero problema?":
// el diagnóstico (🩺) ahora dice cuál es el problema real; este botón solo
// descarta SUBIDAS pendientes — los datos locales NUNCA se tocan.
async function cloudClearQueue() {
  if (!window.DrCoachSync?.clearQueue) return;
  let n = 0;
  try { n = await window.DrCoachSync.getQueueCount(); } catch (_) {}
  const ok = confirm(
    `¿Vaciar la cola de subida (${n} cambio(s) pendientes)?\n\n` +
    '· Tus datos LOCALES no se tocan: nada se borra de la app.\n' +
    '· Solo se descartan las subidas pendientes; lo que no haya llegado a la nube NO se subirá desde aquí.\n\n' +
    'Antes de vaciar, mira el 🩺 Diagnóstico:\n' +
    '· Si "Prueba de escritura" está en ✗, ejecuta primero supabase/schema.sql en el SQL Editor de Supabase y usa "⬆ Subir todo a la nube" — vaciar ahora descartaría progreso real.\n' +
    '· Si está en ✓ y la cola es vieja o duplicada, vaciar es seguro.'
  );
  if (!ok) return;
  const btn = document.getElementById('cloudClearQueueBtn');
  if (btn) btn.disabled = true;
  try {
    const cleared = await window.DrCoachSync.clearQueue();
    cloudLog(`🧹 Cola vaciada: ${cleared} cambio(s) descartado(s). Tus datos locales siguen intactos.`, 'ok');
    toast('Cola de subida vaciada.');
  } catch (e) {
    cloudLog(`Error al vaciar la cola: ${e?.message || e}`, 'err');
  } finally {
    if (btn) btn.disabled = false;
    cloudRefreshStatus();
  }
}

async function cloudPushAll() {
  if (!state.cloudUser) {
    cloudLog('No hay sesión de Supabase activa. Inicia sesión primero.', 'err');
    toast('Inicia sesión en Dr.Coach! Cloud primero.');
    return;
  }
  if (!window.DrCoachSync) {
    cloudLog('Módulo de sincronización no disponible.', 'err');
    return;
  }
  const btn = document.getElementById('cloudPushAllBtn');
  if (btn) btn.disabled = true;
  cloudLog(`Iniciando subida a la nube… (${state.attempts.length} intentos, ${state.sessions.length} sesiones)`);
  try {
    let pushed = 0;
    for (const a of state.attempts) {
      await window.DrCoachSync.pushAttempt(a);
      pushed++;
    }
    cloudLog(`✓ ${pushed} intentos en cola de subida.`, 'ok');

    let sCount = 0;
    for (const s of state.sessions) {
      await window.DrCoachSync.pushSession(s);
      sCount++;
    }
    cloudLog(`✓ ${sCount} sesiones en cola de subida.`, 'ok');

    // Settings (solo las sincronizables)
    await window.DrCoachSync.pushSettings(state.settings);
    cloudLog(`✓ Preferencias sincronizables en cola.`, 'ok');

    // Imágenes del Study Board
    if (window.DrCoachStorage) {
      let imgCount = 0;
      for (const a of state.attempts) {
        const ids = attemptAttachmentIds(a);
        for (const id of ids) {
          try {
            const att = attachmentById(id) || await DB.get('attachments', id);
            if (!att?.blob) continue;
            await window.DrCoachStorage.uploadAttachment({
              attemptId: a.id,
              attachmentId: id,
              blob: att.blob,
            });
            imgCount++;
          } catch (e) {
            console.warn('[cloud] attachment upload failed', id, e);
          }
        }
      }
      if (imgCount > 0) cloudLog(`✓ ${imgCount} imágenes subidas a Storage.`, 'ok');
    }

    // Forzar el drenado de la cola ahora
    cloudLog('Procesando cola de subida…');
    const result = await window.DrCoachSync.push();
    if (result.processed > 0 && result.failed === 0) {
      localStorage.setItem('drcoach.lastSyncAt', String(Date.now()));
      cloudLog(`✓ Subida completada. ${result.processed} registros subidos.`, 'ok');
      toast('Progreso subido a la nube.');
    } else if (result.failed > 0 && result.processed === 0) {
      cloudLog(`❌ Error: no se pudo subir ningún registro.`, 'err');
      cloudLog(`   Detalle: ${result.lastError || 'desconocido'}`, 'err');
      cloudLog(`   Revisa la consola (F12) para ver el error completo de Supabase.`, 'warn');
      toast('Error al subir. Revisa el log.');
    } else if (result.failed > 0) {
      cloudLog(`⚠ Subida parcial: ${result.processed} OK, ${result.failed} fallaron.`, 'warn');
      cloudLog(`   Último error: ${result.lastError || 'desconocido'}`, 'warn');
      toast('Subida parcial. Revisa el log.');
    } else {
      cloudLog('✓ Subida completada.', 'ok');
      toast('Progreso subido a la nube.');
    }
    cloudRefreshStatus();
  } catch (e) {
    console.error('[cloud] pushAll failed', e);
    cloudLog(`Error: ${e.message || e}`, 'err');
    toast('Error al subir. Revisa el log.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function cloudPullAll() {
  if (!state.cloudUser) {
    cloudLog('No hay sesión de Supabase activa. Inicia sesión primero.', 'err');
    toast('Inicia sesión en Dr.Coach! Cloud primero.');
    return;
  }
  if (!window.DrCoachSync) {
    cloudLog('Módulo de sincronización no disponible.', 'err');
    return;
  }
  const btn = document.getElementById('cloudPullAllBtn');
  if (btn) btn.disabled = true;
  cloudLog('Iniciando descarga desde la nube…');
  try {
    // Pull fuerza total (sin filtro de timestamp)
    await window.DrCoachSync.pull(true);
    // Recargar estado local desde IndexedDB
    await reloadState();
    renderAll();
    cloudLog('✓ Descarga completada. Estado local actualizado.', 'ok');
    toast('Progreso descargado a este dispositivo.');
    cloudRefreshStatus();
  } catch (e) {
    console.error('[cloud] pullAll failed', e);
    cloudLog(`Error: ${e.message || e}`, 'err');
    toast('Error al descargar. Revisa el log.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Hook: cuando el usuario entra a la vista Datos, refrescar el estado cloud
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view="data"]');
  if (btn) setTimeout(cloudRefreshStatus, 50);
});
// También al iniciar la app
const _originalInit = init;
// (init se llama onDOMContentLoaded; refrescar el estado 1s después)
setTimeout(() => { try { cloudRefreshStatus(); } catch(_) {} }, 1500);

// =====================================================================
// End v3.0.0 cloud helpers
// =====================================================================

document.addEventListener('DOMContentLoaded',init);
})();

