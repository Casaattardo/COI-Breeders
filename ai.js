(function(){
let extracted=null,busy=false;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function status(t,k=""){const e=document.getElementById("aiStatus");if(e)e.innerHTML='<div class="check '+k+'">'+esc(t)+'</div>';}

function loadImage(file){return new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=bad;im.src=URL.createObjectURL(file);});}
function makeTile(im,x,y,w,h){
 const scale=Math.min(3,1500/Math.max(w,h));
 const c=document.createElement("canvas");c.width=Math.round(w*scale);c.height=Math.round(h*scale);
 const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(im,x,y,w,h,0,0,c.width,c.height);
 const d=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<d.data.length;i+=4){
  const yv=.299*d.data[i]+.587*d.data[i+1]+.114*d.data[i+2];
  const v=Math.max(0,Math.min(255,(yv-125)*1.8+125));
  d.data[i]=d.data[i+1]=d.data[i+2]=v;
 }
 ctx.putImageData(d,0,0);return c;
}
function isName(s){
 const n=String(s).toUpperCase().replace(/[|¦]/g,"I").replace(/\s+/g," ").trim();
 return /\b(?:ROI|RSR)\s*[0-9O]{1,3}\s*[\/-]\s*[0-9O]{4,7}\b/.test(n);
}
function clean(s){
 return String(s||"").replace(/[|¦]/g,"I").replace(/\s+/g," ").trim().replace(/\bR\s*S\s*R\b/ig,"RSR").replace(/\bR[O0]I\b/ig,"ROI");
}
function uniqueNames(texts){
 const out=[],seen=new Set();
 for(const t of texts){
  for(const line of String(t).split(/\r?\n/)){
   const s=clean(line);
   if(!isName(s))continue;
   const key=s.toUpperCase().replace(/[^A-Z0-9]/g,"");
   if(!seen.has(key)){seen.add(key);out.push(s);}
  }
 }
 return out;
}
function classify(names){
 return names.map((name,i)=>{
  const gen=Math.min(5,Math.floor(i/2)+1);
  return {side:i%2===0?"s":"d",generation:gen,position:(i%2)+1,name,confidence:.65};
 });
}

window.runPedigreeAI=async function(){
 if(busy)return;
 const file=document.getElementById("pedPhoto")?.files?.[0];
 if(!file){alert("Carica prima una foto del pedigree.");return;}
 if(!window.Tesseract){status("Motore OCR non disponibile.","warn");return;}
 busy=true;
 try{
  status("Analizzo il pedigree a riquadri, con ingrandimento automatico…");
  const im=await loadImage(file);
  const y0=Math.round(im.naturalHeight*.34);
  const h=im.naturalHeight-y0;
  const cols=5,rows=2,overlap=.08;
  const worker=await Tesseract.createWorker("ita",1,{logger:m=>{
   if(m.status&&typeof m.progress==="number")status("OCR gratuito: "+m.status+" "+Math.round(m.progress*100)+"%");
  }});
  await worker.setParameters({preserve_interword_spaces:"1",tessedit_pageseg_mode:"6"});
  const texts=[];
  for(let row=0;row<rows;row++){
   for(let col=0;col<cols;col++){
    const baseW=im.naturalWidth/cols,baseH=h/rows;
    const x=Math.max(0,Math.round(col*baseW-baseW*overlap/2));
    const y=Math.max(y0,Math.round(y0+row*baseH-baseH*overlap/2));
    const x2=Math.min(im.naturalWidth,Math.round((col+1)*baseW+baseW*overlap/2));
    const y2=Math.min(im.naturalHeight,Math.round(y0+(row+1)*baseH+baseH*overlap/2));
    const tile=makeTile(im,x,y,x2-x,y2-y);
    const r=await worker.recognize(tile);
    texts.push(r.data.text||"");
   }
  }
  await worker.terminate();
  const names=uniqueNames(texts);
  extracted={
   subject:{name:"",confidence:.5},
   parents:{sire:names[0]||"",dam:names[1]||""},
   ancestors:classify(names.slice(2)),
   rawText:names.join("\n"),
   warnings:["Lettura a riquadri con ingrandimento e contrasto automatici.","La posizione genealogica è proposta automaticamente: verifica ogni nome sulla foto."]
  };
  window.aiExtracted=extracted;renderAI(extracted);
 }catch(e){console.error(e);status("OCR non completato: "+(e?.message||e),"warn");}
 finally{busy=false;}
};

function renderAI(x){
 const box=document.getElementById("aiFields");
 const rows=(x.ancestors||[]).map((v,i)=>'<div class="ai-row"><label>'+esc(v.side==="s"?"PADRE":"MADRE")+' · G'+v.generation+' · posizione '+v.position+'<input data-ai-index="'+i+'" value="'+esc(v.name)+'"></label></div>').join("");
 box.innerHTML='<div class="check warn">⚠️ Ho analizzato separatamente le colonne del pedigree. Verifica sempre l’assegnazione generazione/ramo prima di confermare.</div><label>Nome soggetto<input id="aiSubject" value="'+esc(x.subject?.name||"")+'"></label><label>Padre<input id="aiSire" value="'+esc(x.parents?.sire||"")+'"></label><label>Madre<input id="aiDam" value="'+esc(x.parents?.dam||"")+'"></label><div class="gen-title">ANTENATI RICONOSCIUTI</div>'+(rows||'<div class="empty">Nessun nome riconosciuto.</div>')+'<details class="ocr-raw"><summary>Mostra nomi riconosciuti</summary><pre>'+esc(x.rawText||"")+'</pre></details><button id="confirmAI" style="margin-top:15px">Conferma dati verificati</button>';
 document.getElementById("confirmAI").onclick=confirmAI;
 status("✓ Lettura a riquadri completata. Controlla i dati prima di applicarli.");
}
function confirmAI(){
 [...document.querySelectorAll("[data-ai-index]")].forEach(e=>{if(extracted.ancestors[+e.dataset.aiIndex])extracted.ancestors[+e.dataset.aiIndex].name=e.value.trim();});
 extracted.parents.sire=document.getElementById("aiSire").value.trim();
 extracted.parents.dam=document.getElementById("aiDam").value.trim();
 extracted.subject.name=document.getElementById("aiSubject").value.trim();
 window.aiExtracted=extracted;if(typeof applyAIResult==="function")applyAIResult();
}
})();