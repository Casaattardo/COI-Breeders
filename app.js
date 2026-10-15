const KEY='coi-breeders-v2';
let state=JSON.parse(localStorage.getItem(KEY)||'null')||{dogs:[],litters:[],current:null};
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
// Normalizza punteggiatura e prefissi dei numeri di registro senza unire nomi soltanto simili.
const pedigreeIdentity=s=>norm(String(s||''))
 .replace(/\b(?:l|ro1|roi|loi)\s*\d[\d/.-]*\b/gi,' ')
 .replace(/[.,;:()[\]{}]/g,' ')
 .replace(/\s+/g,' ').trim();

function showView(id){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');if(id==='new')renderPedigreeInputs();if(id==='archive')renderArchive();window.scrollTo(0,0)}
function renderPedigreeInputs(){
 const levels=['Padri','Nonni','Bisnonni','Trisnonni','Quadrisnonni'];
 for(const side of ['s','d']){
  let h='';
  levels.forEach((label,g)=>{h+='<div class="gen-title">'+label+' — generazione '+(g+1)+'</div>';for(let i=0;i<2**(g+1);i++)h+='<div class="tree-node"><input data-node="'+side+g+'_'+i+'" placeholder="Nome antenato '+(i+1)+'"></div>';});
  document.getElementById(side==='s'?'sireTree':'damTree').innerHTML=h;
 }
 updateCount();
}
function updateCount(){const all=document.querySelectorAll('[data-node]');let filled=0;all.forEach(x=>{if(x.value.trim())filled++});const el=document.getElementById('filled');if(el)el.textContent=filled+' / '+all.length+' posizioni';}
document.addEventListener('input',e=>{if(e.target.matches('[data-node]'))updateCount()});
function collect(side){const r={};document.querySelectorAll('[data-node^="'+side+'"]').forEach(e=>{if(e.value.trim())r[e.dataset.node]=e.value.trim()});return r}
function canonicalKey(name){
 // Chiave coerente per ogni occorrenza, anche tra archivio e campi manuali.
 return 'pedigree:'+pedigreeIdentity(name);
}
function buildRoot(root,side,depth=5){
 const raw=collect(side),nodes={};
 const rid=canonicalKey(root);
 nodes[rid]={id:rid,name:root,sire:null,dam:null,gen:0,source:side};
 // Collega ogni antenato alla coppia di genitori in base alla posizione nel pedigree.
 // Non creare collegamenti quando manca il nome del figlio nel livello precedente.
 for(let g=0;g<depth;g++){
  for(let i=0;i<2**(g+1);i++){
   const v=raw[side+g+'_'+i];
   if(!v)continue;
   const id=canonicalKey(v);
   if(!nodes[id])nodes[id]={id,name:v,sire:null,dam:null,gen:g+1,source:side};
   if(g===0){
    nodes[rid][i===0?'sire':'dam']=id;
   }else{
    const parentIndex=Math.floor(i/2);
    const childVal=raw[side+(g-1)+'_'+parentIndex];
    if(!childVal)continue;
    const cid=canonicalKey(childVal);
    if(!nodes[cid])nodes[cid]={id:cid,name:childVal,sire:null,dam:null,gen:g,source:side};
    const field=i%2===0?'sire':'dam';
    if(!nodes[cid][field])nodes[cid][field]=id;
    else if(nodes[cid][field]!==id){
      // Mantieni il primo collegamento e lascia che merge segnali conflitti quando possibile.
    }
   }
  }
 }
 return nodes;
}
function merge(a,b){
 const o={}; const conflicts=[];
 for(const [id,n] of Object.entries(a))o[id]={...n};
 for(const [id,n] of Object.entries(b)){
  if(!o[id])o[id]={...n};
  else{
   const old=o[id];
   o[id]={...old,name:old.name||n.name,sire:old.sire||n.sire,dam:old.dam||n.dam,gen:Math.min(old.gen??99,n.gen??99),sources:[...(old.sources||[old.source]),n.source]};
   if(old.sire&&n.sire&&old.sire!==n.sire)conflicts.push(id);
   if(old.dam&&n.dam&&old.dam!==n.dam)conflicts.push(id);
  }
 }
 return {nodes:o,conflicts:[...new Set(conflicts)]};
}
function kin(a,b,nodes,memo,stack){return window.COIEngine.kin(a,b,nodes,memo,stack)}
function inbreed(id,nodes,memo){return window.COIEngine.ancestorInbreeding(id,nodes)}
function ancestorMap(side){
 const m={};
 document.querySelectorAll('[data-node^="'+side+'"]').forEach(e=>{
   const v=e.value.trim();if(!v)return;
   const q=e.dataset.node.match(/^[sd](\d+)_/);const d=+q[1]+1;
   const id=canonicalKey(v);
   if(!m[id]||d<m[id])m[id]=d;
 });
 return m;
}
function calculate(){
 const sire=document.getElementById('sireName').value.trim(),dam=document.getElementById('damName').value.trim();
 if(!sire||!dam){alert('Inserisci il nome del padre e della madre.');return}
 const A=buildRoot(sire,'s'),B=buildRoot(dam,'d'),merged=merge(A,B),nodes=merged.nodes,memo={};
 const sireId=canonicalKey(sire),damId=canonicalKey(dam);
 const F=Math.max(0,kin(sireId,damId,nodes,memo,new Set()));
 const sa=ancestorMap('s'),da=ancestorMap('d'),ids=Object.keys(sa).filter(x=>da[x]&&x!==sireId&&x!==damId);
 const rawS=collect('s'),rawD=collect('d');
 const commonByName=[...new Set(Object.values(rawS).map(pedigreeIdentity).filter(Boolean))].filter(n=>Object.values(rawD).some(v=>pedigreeIdentity(v)===n));
 const commonByTree=ids.map(id=>({id,name:nodes[id]?.name||id,n1:sa[id],n2:da[id]}));
 const common=ids.map(id=>({id,name:nodes[id]?.name||id,n1:sa[id],n2:da[id],fa:Math.max(0,inbreed(id,nodes,memo))})).sort((a,b)=>a.n1+a.n2-b.n1-b.n2);
 const positions=124,filled=Object.keys(collect('s')).length+Object.keys(collect('d')).length;
 const warnings=[];
 if(merged.conflicts.length)warnings.push('Sono stati rilevati antenati con genitori discordanti tra i due pedigree: verifica i dati.');
 const duplicateNames=state.dogs.filter((d,i)=>state.dogs.some((x,j)=>j!==i&&pedigreeIdentity(x.name||'')===pedigreeIdentity(d.name||'')));
 if(duplicateNames.length)warnings.push('Esistono omonimie nell’archivio: gli individui non identificati tramite ID sono stati confrontati per nome.');
 if(F===0&&common.length)warnings.push('Sono stati rilevati antenati comuni nei campi, ma il COI risulta 0: controlla i collegamenti genealogici o eventuali dati incoerenti.');
 if(F===0&&!common.length&&filled>0)warnings.push(commonByName.length
  ? 'Diagnostica: antenati comuni riconosciuti per nome ma non collegati al calcolo: '+commonByName.join(', ')+'.'
  : 'Nessun antenato comune riconosciuto: verifica che nomi e numeri di registro degli stessi cani siano coerenti nei due rami.');
 if(F===0&&commonByTree.length)warnings.push('Diagnostica: i rami contengono antenati con la stessa identità, ma la relazione padre-madre risulta non consanguinea.');
 const litter={id:crypto.randomUUID(),name:document.getElementById('litterName').value||'Analisi senza nome',sire,dam,coi:F,common,created:new Date().toISOString(),depth:5,complete:filled===positions,warnings};
 state.current=litter;state.litters.unshift(litter);save();renderResult(litter,filled);showView('result');
}
function renderResult(r,filled){
 const pct=(r.coi*100).toFixed(3)+'%';document.getElementById('resultTitle').textContent=r.name;document.getElementById('coiValue').textContent=pct;document.getElementById('dashCoi').textContent=pct;document.getElementById('commonCount').textContent=r.common.length;
 document.getElementById('coiNote').textContent=r.complete?'Pedigree completo a 5 generazioni.':'Calcolo sui dati disponibili: pedigree incompleto.';
 if(r.warnings?.length)document.getElementById('coiNote').textContent+=' '+r.warnings.join(' ');
 document.getElementById('ancestors').innerHTML=r.common.length?r.common.map(a=>'<div class="ancestor"><b>'+esc(a.name)+'</b><span>G'+a.n1+' / G'+a.n2+'</span></div>').join(''):'<div class="empty">Nessun antenato comune rilevato.</div>';
 const checks=document.getElementById('checks');if(checks)checks.innerHTML='<div class="check '+(r.complete?'ok':'warn')+'">'+(r.complete?'✓ Pedigree completo.':'⚠ Pedigree incompleto: '+(124-filled)+' posizioni vuote.')+'</div><div class="check ok">✓ Identità archiviate tramite ID quando disponibili; gli omonimi non vengono automaticamente unificati.</div><div class="check ok">✓ COI calcolato dalla relazione genealogica padre–madre con ricorsione sui genitori.</div>';
 const d=document.getElementById('calculationDetails');if(d)d.innerHTML=r.common.map(a=>'<div class="formula">'+esc(a.name)+': n₁='+a.n1+', n₂='+a.n2+', Fₐ='+(a.fa*100).toFixed(3)+'%</div>').join('')||'<div class="empty">Nessun contributo da antenati comuni.</div>';
}
function renderDogPedigreeInputs(pedigree={}){const host=document.getElementById('dogPedigreeEditor');if(!host)return;const levels=['Padri','Nonni','Bisnonni','Trisnonni','Quadrisnonni'];let h='';levels.forEach((label,g)=>{h+='<div class="gen-title">'+label+' — generazione '+(g+1)+'</div><div class="two">';for(let i=0;i<2**(g+1);i++){const key='s'+g+'_'+i;h+='<label>'+((g===0)?(i===0?'Padre':'Madre'):'Antenato '+(i+1))+'<input data-dog-node="'+key+'" value="'+esc(pedigree[key]||'')+'" placeholder="Nome antenato"></label>';}h+='</div>';});host.innerHTML=h;}
function collectDogPedigree(){const map={};document.querySelectorAll('[data-dog-node]').forEach(el=>{if(el.value.trim())map[el.dataset.dogNode]=el.value.trim()});return map;}
function openDogForm(id=''){state.editDogId=id;state.pendingDogPedigree=null;const d=state.dogs.find(x=>x.id===id)||{};document.getElementById('dogTitle').textContent=id?'Modifica cane':'Nuovo cane';document.getElementById('dogName').value=d.name||'';document.getElementById('dogSex').value=d.sex||'';document.getElementById('dogBreed').value=d.breed||'';document.getElementById('dogAffix').value=d.affix||'';document.getElementById('dogDob').value=d.dob||'';document.getElementById('dogLoi').value=d.loi||'';document.getElementById('dogChip').value=d.chip||'';document.getElementById('dogColor').value=d.color||'';document.getElementById('dogNotes').value=d.notes||'';state.pendingDogPedigree=d.pedigree||{};fillParentSelects(d.sireId,d.damId);showView('dog');renderDogPedigreeInputs(state.pendingDogPedigree)}
function fillParentSelects(sireId='',damId=''){for(const id of ['dogSire','dogDam']){const el=document.getElementById(id);el.innerHTML='<option value="">— Non specificato —</option>'+state.dogs.filter(d=>d.id!==state.editDogId).map(d=>'<option value="'+d.id+'">'+esc(d.name)+'</option>').join('')}document.getElementById('dogSire').value=sireId||'';document.getElementById('dogDam').value=damId||''}
function saveDog(){const name=document.getElementById('dogName').value.trim();if(!name){alert('Inserisci il nome del cane.');return}const data={name,sex:document.getElementById('dogSex').value,breed:document.getElementById('dogBreed').value.trim(),affix:document.getElementById('dogAffix').value.trim(),dob:document.getElementById('dogDob').value,loi:document.getElementById('dogLoi').value.trim(),chip:document.getElementById('dogChip').value.trim(),color:document.getElementById('dogColor').value.trim(),notes:document.getElementById('dogNotes').value.trim(),sireId:document.getElementById('dogSire').value,damId:document.getElementById('dogDam').value,pedigree:collectDogPedigree()};if(state.editDogId){const i=state.dogs.findIndex(d=>d.id===state.editDogId);state.dogs[i]={...state.dogs[i],...data}}else state.dogs.push({id:crypto.randomUUID(),...data});save();showView('archive')}
function deleteCurrentDog(){if(!state.editDogId)return;if(!confirm('Eliminare questo cane dall’archivio?'))return;state.dogs=state.dogs.filter(d=>d.id!==state.editDogId);state.dogs.forEach(d=>{if(d.sireId===state.editDogId)d.sireId='';if(d.damId===state.editDogId)d.damId=''});save();showView('archive')}
function selectDog(side){const id=document.getElementById(side==='sire'?'sireSelect':'damSelect').value;const d=state.dogs.find(x=>x.id===id);if(!d)return;document.getElementById(side==='sire'?'sireName':'damName').value=d.name;loadDogPedigree(d,side)}
function loadDogPedigree(d,side){
 const target=side==='sire'?'s':'d';
 if(d.pedigree&&Object.keys(d.pedigree).length){document.querySelectorAll('[data-node^="'+target+'"]').forEach(el=>el.value='');Object.entries(d.pedigree).forEach(([k,v])=>{const m=k.match(/^s(\d+_\d+)$/);if(m){const el=document.querySelector('[data-node="'+target+m[1]+'"]');if(el)el.value=v}});updateCount();return}
 const chain=(id,depth=0)=>{if(!id||depth>=5)return;const x=state.dogs.find(z=>z.id===id);if(!x)return;const fields=document.querySelectorAll('[data-node^="'+side+depth+'"]');if(fields[0])fields[0].value=x.sireId?(state.dogs.find(z=>z.id===x.sireId)?.name||''):'';if(fields[1])fields[1].value=x.damId?(state.dogs.find(z=>z.id===x.damId)?.name||''):'';if(x.sireId)chain(x.sireId,depth+1);if(x.damId)chain(x.damId,depth+1)};chain(d.id,0);updateCount()}
function populateBreederSelectors(){const opts='<option value="">— Seleziona —</option>'+state.dogs.map(d=>'<option value="'+d.id+'">'+esc(d.name)+(d.sex?' · '+d.sex:'')+'</option>').join('');document.getElementById('sireSelect').innerHTML=opts;document.getElementById('damSelect').innerHTML=opts}
function renderDogs(){const q=(document.getElementById('dogSearch')?.value||'').toLowerCase();document.getElementById('dogCount').textContent=state.dogs.length;const rows=state.dogs.filter(d=>[d.name,d.breed,d.chip,d.loi,d.affix].join(' ').toLowerCase().includes(q));document.getElementById('dogs').innerHTML=rows.length?rows.map(d=>'<div class="ancestor"><div><b>'+esc(d.name)+'</b><br><small>'+[d.sex,d.breed,d.loi].filter(Boolean).join(' · ')+'</small></div><button onclick="openDogForm(\''+d.id+'\')">Apri</button></div>').join(''):'<div class="empty">Nessun cane trovato.</div>'}
function renderArchive(){document.getElementById('litterCount').textContent=state.litters.length;renderDogs();document.getElementById('litters').innerHTML=state.litters.length?state.litters.map(r=>'<div class="ancestor"><div><b>'+esc(r.name)+'</b><br><small>'+esc(r.sire)+' × '+esc(r.dam)+'</small></div><b>'+((r.coi||0)*100).toFixed(3)+'%</b></div>').join(''):'<div class="empty">Nessuna analisi salvata.</div>'}
function clearPedigree(){document.querySelectorAll('[data-node]').forEach(e=>e.value='');updateCount()}function printReport(){window.print()}
renderPedigreeInputs();populateBreederSelectors();renderArchive();if(state.current)renderResult(state.current,124);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();const b=document.getElementById('install');if(b){b.classList.remove('hidden');b.onclick=()=>e.prompt()}});
let aiImageData='',aiExtracted={};
function previewPedigree(e){const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{aiImageData=rd.result;document.getElementById('pedImage').src=aiImageData;document.getElementById('aiStatus').textContent='Foto caricata. Premi “AI Analizza” per avviare l’estrazione.'};rd.readAsDataURL(f)}
function aiSideIsDam(side){return /^(dam|mother|female|madre|materno|maternal)$/i.test(String(side||''));}
function aiPedigreeMap(x,treeSide='s'){
 const map={};
 (x.ancestors||[]).forEach(v=>{
  const gen=Number(v.generation),pos=Number(v.position)-1;
  if(!v.name||!Number.isInteger(gen)||gen<1||gen>5||!Number.isInteger(pos)||pos<0)return;
  const level=gen-1, offset=aiSideIsDam(v.side)?2**level:0, index=offset+pos;
  if(index<2**(level+1))map[treeSide+level+'_'+index]=String(v.name).trim();
 });
 [x.parents?.sire,x.parents?.dam].forEach((name,i)=>{const key=treeSide+'0_'+i;if(name&&!map[key])map[key]=String(name).trim()});
 return map;
}
function applyAIResult(){
 const x=window.aiExtracted;
 if(!x||!x.subject||!Array.isArray(x.ancestors)){alert('Non ci sono dati AI verificati da applicare.');return}
 const side=document.getElementById('aiTargetSide')?.value||'sire', treeSide=side==='sire'?'s':'d';
 showView('new');
 const rootInput=document.getElementById(side==='sire'?'sireName':'damName');if(rootInput)rootInput.value=(x.subject.name||'').trim();
 document.querySelectorAll('[data-node^="'+treeSide+'"]').forEach(el=>el.value='');
 const map=aiPedigreeMap(x,treeSide);
 Object.entries(map).forEach(([key,name])=>{const el=document.querySelector('[data-node="'+key+'"]');if(el)el.value=name});
 updateCount();window.aiPedigreeConfirmed=true;
 const note=document.getElementById('aiStatus');if(note)note.textContent='✓ Pedigree applicato al ramo '+(side==='sire'?'paterno':'materno')+'. Antenati trasferiti: '+Object.keys(map).length+'. Verifica i dati e poi calcola il COI.';
}
function applyArchivePedigree(x){
 const map=aiPedigreeMap(x,'s');
 state.pendingDogPedigree=map;
 renderDogPedigreeInputs(map);
 document.getElementById('dogName').value=x.subject?.name||document.getElementById('dogName').value;
 document.getElementById('dogBreed').value=x.subject?.breed||document.getElementById('dogBreed').value;
 const sex=(x.subject?.sex||'').toUpperCase();if(sex.startsWith('M'))document.getElementById('dogSex').value='M';else if(sex.startsWith('F'))document.getElementById('dogSex').value='F';
 if(/^\\d{4}-\\d{2}-\\d{2}$/.test(x.subject?.dob||''))document.getElementById('dogDob').value=x.subject.dob;
 const target=document.getElementById('dogAiStatus');if(target)target.innerHTML='<div class="check ok">Pedigree importato: '+Object.values(map).filter(Boolean).length+' antenati. I dati sono pronti per essere salvati con “Salva cane”.</div>';
}

function saveAIAsDog(){
 const x=window.aiExtracted;
 if(!x||!x.subject){alert('Conferma prima i dati del pedigree.');return}
 openDogForm();
 applyArchivePedigree(x);
 showView('dog');
 const target=document.getElementById('dogAiStatus');
 if(target)target.innerHTML='<div class="check ok">Pedigree trasferito nella scheda del cane. Controlla i dati e premi “Salva cane” per conservarlo nell’archivio.</div>';
}
