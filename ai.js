(function(){
let extracted=null,busy=false;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function status(t,k=""){const e=document.getElementById("aiStatus");if(e)e.innerHTML='<div class="check '+k+'">'+esc(t)+'</div>';}
function loadImage(file){return new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=bad;im.src=URL.createObjectURL(file);});}
function tile(im,x,y,w,h){
 const scale=Math.min(4.5,1800/Math.max(w,h));
 const c=document.createElement("canvas");c.width=Math.round(w*scale);c.height=Math.round(h*scale);
 const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(im,x,y,w,h,0,0,c.width,c.height);
 const d=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<d.data.length;i+=4){const yv=.299*d.data[i]+.587*d.data[i+1]+.114*d.data[i+2];const v=Math.max(0,Math.min(255,(yv-128)*2+128));d.data[i]=d.data[i+1]=d.data[i+2]=v;}
 ctx.putImageData(d,0,0);return c;
}
function clean(s){return String(s||"").replace(/[|¦]/g,"I").replace(/\s+/g," ").trim().replace(/R\s*S\s*R/ig,"RSR").replace(/R[O0]I/ig,"ROI");}
function useful(s){
 const x=clean(s),u=x.toUpperCase();
 if(x.length<7||x.length>90)return false;
 if(/^(GENEALOGIA|GENITORI|NONNI|BISNONNI|TRISNONNI|PADRE|MADRE|MANTELLO|ALLEVATORE|DI RAZZA)/i.test(x))return false;
 return /\d{2,}/.test(x)||/\b(ROI|RSR|LOI|RSR)\b/i.test(u);
}
function collect(texts){
 const out=[],seen=new Set();
 for(const t of texts)for(const line of String(t).split(/\r?\n/)){
  const s=clean(line);
  if(!useful(s))continue;
  const key=s.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(key.length<8||seen.has(key))continue;
  seen.add(key);out.push(s);
 }
 return out;
}
window.runPedigreeAI=async function(){
 if(busy)return;busy=true;
 const file=document.getElementById("pedPhoto")?.files?.[0];
 if(!file){alert("Carica prima una foto del pedigree.");busy=false;return;}
 if(!window.Tesseract){status("Motore OCR non disponibile.","warn");busy=false;return;}
 try{
  status("Lettura avanzata: ingrandisco e analizzo 16 zone del pedigree…");
  const im=await loadImage(file), y0=Math.round(im.naturalHeight*.25), h=im.naturalHeight-y0;
  const worker=await Tesseract.createWorker("ita",1,{logger:m=>{if(m.status&&typeof m.progress==="number")status("OCR gratuito: "+m.status+" "+Math.round(m.progress*100)+"%");}});
  await worker.setParameters({preserve_interword_spaces:"1"});
  const texts=[];
  const cols=4,rows=4,ox=.12,oy=.12;
  for(let r0=0;r0<rows;r0++)for(let c0=0;c0<cols;c0++){
   const bw=im.naturalWidth/cols,bh=h/rows;
   const x=Math.max(0,c0*bw-bw*ox/2), y=Math.max(y0,y0+r0*bh-bh*oy/2);
   const x2=Math.min(im.naturalWidth,(c0+1)*bw+bw*ox/2),y2=Math.min(im.naturalHeight,y0+(r0+1)*bh+bh*oy/2);
   for(const psm of [6,11]){
    const res=await worker.recognize(tile(im,x,y,x2-x,y2-y),{}, {tsv:false});
    texts.push(res.data.text||"");
   }
  }
  await worker.terminate();
  const names=collect(texts);
  const roi=names.filter(x=>/\b(ROI|RSR)\b/i.test(x));
  const ordered=[...roi,...names.filter(x=>!roi.includes(x))];
  extracted={
   subject:{name:"",confidence:.2},
   parents:{sire:ordered[0]||"",dam:ordered[1]||""},
   ancestors:ordered.slice(2,34).map((name,i)=>({side:i%2?"d":"s",generation:Math.min(5,Math.floor(i/2)+1),position:(i%2)+1,name,confidence:/\b(ROI|RSR)\b/i.test(name)?.75:.5})),
   rawText:ordered.join("\n"),
   warnings:["Lettura OCR locale multi-riquadro.","I nomi sono estratti dal testo e la posizione genealogica è solo una proposta: verifica sulla foto."]
  };
  window.aiExtracted=extracted;renderAI(extracted);
 }catch(e){console.error(e);status("OCR non completato: "+(e?.message||e),"warn");}
 finally{busy=false;}
};
function renderAI(x){
 const box=document.getElementById("aiFields");
 const rows=(x.ancestors||[]).map((v,i)=>'<div class="ai-row"><label>'+esc(v.side==="s"?"PADRE":"MADRE")+' · G'+v.generation+' · '+v.position+'<input data-ai-index="'+i+'" value="'+esc(v.name)+'"></label></div>').join("");
 box.innerHTML='<div class="check warn">⚠️ Questa versione privilegia il recupero dei nomi anche quando l’OCR non riconosce perfettamente “ROI/RSR”. Verifica sempre i dati.</div><label>Nome soggetto<input id="aiSubject" value="'+esc(x.subject?.name||"")+'"></label><label>Padre<input id="aiSire" value="'+esc(x.parents?.sire||"")+'"></label><label>Madre<input id="aiDam" value="'+esc(x.parents?.dam||"")+'"></label><div class="gen-title">ANTENATI RICONOSCIUTI</div>'+(rows||'<div class="empty">Nessun nome riconosciuto automaticamente.</div>')+'<details class="ocr-raw"><summary>Mostra testo OCR</summary><pre>'+esc(x.rawText||"")+'</pre></details><button id="confirmAI" style="margin-top:15px">Conferma dati verificati</button>';
 document.getElementById("confirmAI").onclick=confirmAI;
 status((x.parents.sire||x.parents.dam||x.ancestors.length)?"✓ Lettura completata: controlla i nomi prima di applicare.":"Nessun dato utile riconosciuto.","warn");
}
function confirmAI(){
 [...document.querySelectorAll("[data-ai-index]")].forEach(e=>{if(extracted.ancestors[+e.dataset.aiIndex])extracted.ancestors[+e.dataset.aiIndex].name=e.value.trim();});
 extracted.parents.sire=document.getElementById("aiSire").value.trim();
 extracted.parents.dam=document.getElementById("aiDam").value.trim();
 extracted.subject.name=document.getElementById("aiSubject").value.trim();
 window.aiExtracted=extracted;if(typeof applyAIResult==="function")applyAIResult();
}
})();