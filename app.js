const KEY='coi-breeders-v2';
let state=JSON.parse(localStorage.getItem(KEY)||'null')||{dogs:[],litters:[],current:null};
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
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
 const n=norm(name);
 const matches=state.dogs.filter(d=>norm(d.name||'')===n);
 if(matches.length===1)return 'dog:'+matches[0].id;
 return 'name:'+n;
}
function buildRoot(root,side,depth=5){
 const raw=collect(side),nodes={};
 const rid=canonicalKey(root);
 nodes[rid]={id:rid,name:root,sire:null,dam:null,gen:0,source:side};
 for(let g=0;g<depth;g++){
  for(let i=0;i<2**(g+1);i++){
   const v=raw[side+g+'_'+i]; if(!v)continue;
   const id=canonicalKey(v);
   if(!nodes[id])nodes[id]={id,name:v,sire:null,dam:null,gen:g+1,source:side};
   const parentIndex=Math.floor(i/2);
   if(g===0) nodes[rid][i===0?'sire':'dam']=id;
   else{
    const childVal=raw[side+(g-1)+'_'+parentIndex];
    if(childVal){
      const cid=canonicalKey(childVal);
      if(nodes[cid]) nodes[cid][i%2===0?'sire':'dam']=id;
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
function kin(a,b,nodes,memo,stack){
 if(!a||!b||!nodes[a]||!nodes[b])return 0;
 const k=a<b?a+'|'+b:b+'|'+a;
 if(memo[k]!==undefined)return memo[k];
 stack=stack||new Set();
 if(stack.has(k))return 0;
 const ns=new Set(stack);ns.add(k);
 if(a===b){
   const p=nodes[a];
   if(!p.sire&&!p.dam)return memo[k]=0.5;
   if(!p.sire||!p.dam)return memo[k]=0.5;
   return memo[k]=(1+kin(p.sire,p.dam,nodes,memo,ns))/2;
 }
 const x=nodes[a];
 return memo[k]=0.5*(kin(x.sire,b,nodes,memo,ns)+kin(x.dam,b,nodes,memo,ns));
}
function inbreed(id,nodes,memo){return kin(id,id,nodes,memo,new Set())*1-0.5}
function ancestorMap(side){
 const m={};
 document.querySelectorAll('[data-node^="'+side+'"]').forEach(e=>{
   const v=e.value.trim();if(!v)return;
   const q=e.dataset.node.match(/^[sd](\\d+)_/);const d=+q[1]+1;
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
 const common=ids.map(id=>({id,name:nodes[id]?.name||id,n1:sa[id],n2:da[id],fa:Math.max(0,inbreed(id,nodes,memo))})).sort((a,b)=>a.n1+a.n2-b.n1-b.n2);
 const positions=124,filled=Object.keys(collect('s')).length+Object.keys(collect('d')).length;
 const warnings=[];
 if(merged.conflicts.length)warnings.push('Sono stati rilevati antenati con genitori discordanti tra i due pedigree: verifica i dati.');
 const duplicateNames=state.dogs.filter((d,i)=>state.dogs.some((x,j)=>j!==i&&norm(x.name||'')===norm(d.name||'')));
 if(duplicateNames.length)warnings.push('Esistono omonimie nell’archivio: gli individui non identificati tramite ID sono stati confrontati per nome.');
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
function openDogForm(id=''){state.editDogId=id;const d=state.dogs.find(x=>x.id===id)||{};document.getElementById('dogTitle').textContent=id?'Modifica cane':'Nuovo cane';document.getElementById('dogName').value=d.name||'';document.getElementById('dogSex').value=d.sex||'';document.getElementById('dogBreed').value=d.breed||'';document.getElementById('dogAffix').value=d.affix||'';document.getElementById('dogDob').value=d.dob||'';document.getElementById('dogLoi').value=d.loi||'';document.getElementById('dogChip').value=d.chip||'';document.getElementById('dogColor').value=d.color||'';document.getElementById('dogNotes').value=d.notes||'';fillParentSelects(d.sireId,d.damId);showView('dog')}
function fillParentSelects(sireId='',damId=''){for(const id of ['dogSire','dogDam']){const el=document.getElementById(id);el.innerHTML='<option value="">— Non specificato —</option>'+state.dogs.filter(d=>d.id!==state.editDogId).map(d=>'<option value="'+d.id+'">'+esc(d.name)+'</option>').join('')}document.getElementById('dogSire').value=sireId||'';document.getElementById('dogDam').value=damId||''}
function saveDog(){const name=document.getElementById('dogName').value.trim();if(!name){alert('Inserisci il nome del cane.');return}const data={name,sex:document.getElementById('dogSex').value,breed:document.getElementById('dogBreed').value.trim(),affix:document.getElementById('dogAffix').value.trim(),dob:document.getElementById('dogDob').value,loi:document.getElementById('dogLoi').value.trim(),chip:document.getElementById('dogChip').value.trim(),color:document.getElementById('dogColor').value.trim(),notes:document.getElementById('dogNotes').value.trim(),sireId:document.getElementById('dogSire').value,damId:document.getElementById('dogDam').value};if(state.editDogId){const i=state.dogs.findIndex(d=>d.id===state.editDogId);state.dogs[i]={...state.dogs[i],...data}}else state.dogs.push({id:crypto.randomUUID(),...data});save();showView('archive')}
function deleteCurrentDog(){if(!state.editDogId)return;if(!confirm('Eliminare questo cane dall’archivio?'))return;state.dogs=state.dogs.filter(d=>d.id!==state.editDogId);state.dogs.forEach(d=>{if(d.sireId===state.editDogId)d.sireId='';if(d.damId===state.editDogId)d.damId=''});save();showView('archive')}
function selectDog(side){const id=document.getElementById(side==='sire'?'sireSelect':'damSelect').value;const d=state.dogs.find(x=>x.id===id);if(!d)return;document.getElementById(side==='sire'?'sireName':'damName').value=d.name;loadDogPedigree(d,side)}
function loadDogPedigree(d,side){const chain=(id,depth=0)=>{if(!id||depth>=5)return;const x=state.dogs.find(z=>z.id===id);if(!x)return;const fields=document.querySelectorAll('[data-node^="'+side+depth+'"]');if(fields[0])fields[0].value=x.sireId?(state.dogs.find(z=>z.id===x.sireId)?.name||''):'';if(fields[1])fields[1].value=x.damId?(state.dogs.find(z=>z.id===x.damId)?.name||''):'';if(x.sireId)chain(x.sireId,depth+1);if(x.damId)chain(x.damId,depth+1)};chain(d.id,0);updateCount()}
function populateBreederSelectors(){const opts='<option value="">— Seleziona —</option>'+state.dogs.map(d=>'<option value="'+d.id+'">'+esc(d.name)+(d.sex?' · '+d.sex:'')+'</option>').join('');document.getElementById('sireSelect').innerHTML=opts;document.getElementById('damSelect').innerHTML=opts}
function renderDogs(){const q=(document.getElementById('dogSearch')?.value||'').toLowerCase();document.getElementById('dogCount').textContent=state.dogs.length;const rows=state.dogs.filter(d=>[d.name,d.breed,d.chip,d.loi,d.affix].join(' ').toLowerCase().includes(q));document.getElementById('dogs').innerHTML=rows.length?rows.map(d=>'<div class="ancestor"><div><b>'+esc(d.name)+'</b><br><small>'+[d.sex,d.breed,d.loi].filter(Boolean).join(' · ')+'</small></div><button onclick="openDogForm(\''+d.id+'\')">Apri</button></div>').join(''):'<div class="empty">Nessun cane trovato.</div>'}
function renderArchive(){document.getElementById('litterCount').textContent=state.litters.length;renderDogs();document.getElementById('litters').innerHTML=state.litters.length?state.litters.map(r=>'<div class="ancestor"><div><b>'+esc(r.name)+'</b><br><small>'+esc(r.sire)+' × '+esc(r.dam)+'</small></div><b>'+((r.coi||0)*100).toFixed(3)+'%</b></div>').join(''):'<div class="empty">Nessuna analisi salvata.</div>'}
function clearPedigree(){document.querySelectorAll('[data-node]').forEach(e=>e.value='');updateCount()}function printReport(){window.print()}
renderPedigreeInputs();populateBreederSelectors();renderArchive();if(state.current)renderResult(state.current,124);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();const b=document.getElementById('install');if(b){b.classList.remove('hidden');b.onclick=()=>e.prompt()}});
let aiImageData='',aiExtracted={};
function previewPedigree(e){const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{aiImageData=rd.result;document.getElementById('pedImage').src=aiImageData;document.getElementById('aiStatus').textContent='Foto caricata. Premi “AI Analizza” per avviare l’estrazione.'};rd.readAsDataURL(f)}
function runPedigreeAI(){if(!aiImageData){alert('Carica prima una foto del pedigree.');return}document.getElementById('aiStatus').textContent='Modalità demo: il collegamento sicuro al servizio AI sarà configurato nella V3.1.';document.getElementById('aiFields').innerHTML='<div class="check warn">⚠️ Nessuna estrazione automatica è stata eseguita: manca il servizio AI configurato. Questo evita di inventare nomi genealogici.</div><p class="hint">La schermata è già pronta para receber o resultado estruturado da IA. A chave API deve ficar no backend, nunca no browser.</p>';}
function applyAIResult(){if(!aiExtracted||!Object.keys(aiExtracted).length){alert('Non ci sono dati AI verificati da applicare.');return}showView('new')}
