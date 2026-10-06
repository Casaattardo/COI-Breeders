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
function buildRoot(root,side,depth=5){
 const raw=collect(side),nodes={};const rid=norm(root);nodes[rid]={name:root,sire:null,dam:null,gen:0};
 for(let g=0;g<depth;g++)for(let i=0;i<2**(g+1);i++){
  const v=raw[side+g+'_'+i];if(!v)continue;const id=norm(v);
  if(!nodes[id])nodes[id]={name:v,sire:null,dam:null,gen:g+1};
  const parentIndex=Math.floor(i/2);
  if(g===0)nodes[rid][i===0?'sire':'dam']=id;
  else{const childKey=side+(g-1)+'_'+parentIndex;const child=raw[side+(g-1)+'_'+parentIndex];if(child){const cid=norm(child);if(nodes[cid])nodes[cid][i%2===0?'sire':'dam']=id;}}
 }
 return nodes;
}
function merge(a,b){const o={};for(const [id,n] of Object.entries(a))o[id]={...n};for(const [id,n] of Object.entries(b))o[id]=o[id]?{...o[id],...n}:{...n};return o}
function kin(a,b,nodes,memo,stack){
 if(!a||!b||!nodes[a]||!nodes[b])return 0;
 const k=a<b?a+'|'+b:b+'|'+a;if(memo[k]!=null)return memo[k];stack=stack||new Set();if(stack.has(k))return 0;
 const ns=new Set(stack);ns.add(k);
 if(a===b){const p=nodes[a];if(!p.sire&&!p.dam)return memo[k]=0.5;return memo[k]=(1+kin(p.sire,p.dam,nodes,memo,ns))/2}
 const x=nodes[a];return memo[k]=0.5*(kin(x.sire,b,nodes,memo,ns)+kin(x.dam,b,nodes,memo,ns));
}
function inbreed(id,nodes,memo){const n=nodes[id];return n&&n.sire&&n.dam?kin(n.sire,n.dam,nodes,memo,new Set()):0}
function ancestorMap(side){const m={};document.querySelectorAll('[data-node^="'+side+'"]').forEach(e=>{const v=e.value.trim();if(!v)return;const q=e.dataset.node.match(/^[sd](\d+)_/);const d=+q[1]+1;const id=norm(v);m[id]=m[id]?Math.min(m[id],d):d});return m}
function calculate(){
 const sire=document.getElementById('sireName').value.trim(),dam=document.getElementById('damName').value.trim();
 if(!sire||!dam){alert('Inserisci il nome del padre e della madre.');return}
 const A=buildRoot(sire,'s'),B=buildRoot(dam,'d'),nodes=merge(A,B),memo={},F=kin(norm(sire),norm(dam),nodes,memo,new Set());
 const sa=ancestorMap('s'),da=ancestorMap('d'),ids=Object.keys(sa).filter(x=>da[x]);
 const common=ids.map(id=>({id,name:nodes[id]?.name||id,n1:sa[id],n2:da[id],fa:inbreed(id,nodes,memo)})).sort((a,b)=>a.n1+a.n2-b.n1-b.n2);
 const positions=124,filled=Object.keys(collect('s')).length+Object.keys(collect('d')).length;
 const litter={id:crypto.randomUUID(),name:document.getElementById('litterName').value||'Analisi senza nome',sire,dam,coi:F,common,created:new Date().toISOString(),depth:5,complete:filled===positions};
 state.current=litter;state.litters.unshift(litter);save();renderResult(litter,filled);showView('result');
}
function renderResult(r,filled){
 const pct=(r.coi*100).toFixed(3)+'%';document.getElementById('resultTitle').textContent=r.name;document.getElementById('coiValue').textContent=pct;document.getElementById('dashCoi').textContent=pct;document.getElementById('commonCount').textContent=r.common.length;
 document.getElementById('coiNote').textContent=r.complete?'Pedigree completo a 5 generazioni.':'Calcolo sui dati disponibili: pedigree incompleto.';
 document.getElementById('ancestors').innerHTML=r.common.length?r.common.map(a=>'<div class="ancestor"><b>'+esc(a.name)+'</b><span>G'+a.n1+' / G'+a.n2+'</span></div>').join(''):'<div class="empty">Nessun antenato comune rilevato.</div>';
 const checks=document.getElementById('checks');if(checks)checks.innerHTML='<div class="check '+(r.complete?'ok':'warn')+'">'+(r.complete?'✓ Pedigree completo.':'⚠ Pedigree incompleto: '+(124-filled)+' posizioni vuote.')+'</div><div class="check ok">✓ Individui confrontati per nome normalizzato.</div><div class="check ok">✓ COI ottenuto come parentela padre–madre con ricorsione genealogica.</div>';
 const d=document.getElementById('calculationDetails');if(d)d.innerHTML=r.common.map(a=>'<div class="formula">'+esc(a.name)+': n₁='+a.n1+', n₂='+a.n2+', Fₐ='+(a.fa*100).toFixed(3)+'%</div>').join('')||'<div class="empty">Nessun contributo da antenati comuni.</div>';
}
function addDog(){const name=prompt('Nome completo del cane');if(!name)return;state.dogs.push({id:crypto.randomUUID(),name});save();renderArchive()}
function renderArchive(){document.getElementById('dogCount').textContent=state.dogs.length;document.getElementById('litterCount').textContent=state.litters.length;document.getElementById('dogs').innerHTML=state.dogs.length?state.dogs.map(d=>'<div class="ancestor"><b>'+esc(d.name)+'</b></div>').join(''):'<div class="empty">Nessun cane archiviato.</div>';document.getElementById('litters').innerHTML=state.litters.length?state.litters.map(r=>'<div class="ancestor"><div><b>'+esc(r.name)+'</b><br><small>'+esc(r.sire)+' × '+esc(r.dam)+'</small></div><b>'+((r.coi||0)*100).toFixed(3)+'%</b></div>').join(''):'<div class="empty">Nessuna analisi salvata.</div>'}
function clearPedigree(){document.querySelectorAll('[data-node]').forEach(e=>e.value='');updateCount()}
function printReport(){window.print()}
renderPedigreeInputs();renderArchive();if(state.current)renderResult(state.current,124);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();const b=document.getElementById('install');if(b){b.classList.remove('hidden');b.onclick=()=>e.prompt()}});