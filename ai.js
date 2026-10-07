(function(){
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let extracted=null,busy=false;

function status(t,kind=""){const e=document.getElementById("aiStatus");if(e)e.innerHTML='<div class="check '+kind+'">'+esc(t)+'</div>';}

async function canvasFrom(file,mode){
 return new Promise((ok,bad)=>{
  const im=new Image();
  im.onload=()=>{
   const scale=Math.min(3,2400/Math.max(im.naturalWidth,im.naturalHeight));
   const c=document.createElement("canvas");c.width=Math.round(im.naturalWidth*scale);c.height=Math.round(im.naturalHeight*scale);
   const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(im,0,0,c.width,c.height);
   const d=x.getImageData(0,0,c.width,c.height);
   for(let i=0;i<d.data.length;i+=4){
    const y=.299*d.data[i]+.587*d.data[i+1]+.114*d.data[i+2];
    let v=y;
    if(mode==="sharp")v=Math.max(0,Math.min(255,(y-128)*1.9+128));
    if(mode==="bw")v=y>155?255:0;
    d.data[i]=d.data[i+1]=d.data[i+2]=v;
   }
   x.putImageData(d,0,0);ok(c);
  };im.onerror=bad;im.src=URL.createObjectURL(file);
 });
}

function candidates(text){
 const out=[],seen=new Set();
 for(const line of String(text).split(/\r?\n/)){
  let s=line.replace(/[|¦]/g,"I").replace(/\s+/g," ").trim();
  if(!/(R[O0]I|R S R|RSR)/i.test(s))continue;
  s=s.replace(/R[O0]I/i,"ROI").replace(/R\s*S\s*R/i,"RSR");
  if(!/\b(?:ROI|RSR)\b\s*[0-9O]{1,3}\s*[\/-]\s*[0-9O]{4,7}/i.test(s))continue;
  const k=s.toUpperCase();if(!seen.has(k)){seen.add(k);out.push(s);}
 }
 return out;
}

window.runPedigreeAI=async function(){
 if(busy)return;
 const file=document.getElementById("pedPhoto")?.files?.[0];
 if(!file){alert("Carica prima una foto del pedigree.");return;}
 if(!window.Tesseract){status("Motore OCR non disponibile.","warn");return;}
 busy=true;
 try{
  status("Preparo la foto per una lettura più nitida…");
  const worker=await Tesseract.createWorker("ita",1,{logger:m=>{
   if(m.status&&typeof m.progress==="number")status("OCR gratuito: "+Math.round(m.progress*100)+"%");
  }});
  await worker.setParameters({preserve_interword_spaces:"1"});
  const results=[];
  for(const mode of ["sharp","bw","normal"]){
   const c=await canvasFrom(file,mode);
   for(const psm of [6,11]){
    await worker.setParameters({tessedit_pageseg_mode:String(psm)});
    const r=await worker.recognize(c,{}, {tsv:true});
    results.push({mode,psm,text:r.data.text||"",tsv:r.data.tsv||"",hits:candidates(r.data.text||"").length});
   }
  }
  await worker.terminate();
  results.sort((a,b)=>b.hits-a.hits||b.text.length-a.text.length);
  const best=results[0];
  const all=[...new Set(results.flatMap(r=>candidates(r.text)))];
  const parentNames=all.slice(0,2);
  extracted={
   subject:{name:"",confidence:.5},
   parents:{sire:parentNames[0]||"",dam:parentNames[1]||""},
   ancestors:all.slice(2).map((name,i)=>({side:i%2?"d":"s",generation:Math.min(5,Math.floor(i/4)+1),position:(i%4)+1,name,confidence:.65})),
   rawText:all.join("\n"),
   warnings:["OCR locale gratuito con più passaggi di contrasto.","Verifica sempre ogni nome sulla foto originale."]
  };
  window.aiExtracted=extracted;
  renderAI(extracted);
 }catch(e){
  console.error(e);status("OCR non completato: "+(e?.message||e),"warn");
 }finally{busy=false;}
};

function renderAI(x){
 const box=document.getElementById("aiFields");
 const rows=(x.ancestors||[]).map((v,i)=>'<div class="ai-row"><label>'+esc(v.side==="s"?"PADRE":"MADRE")+' · G'+v.generation+' · posizione '+v.position+'<input data-ai-index="'+i+'" value="'+esc(v.name)+'"></label></div>').join("");
 box.innerHTML='<div class="check warn">Lettura migliorata con più passaggi OCR. Controlla i nomi sulla foto prima di confermare.</div><label>Nome soggetto<input id="aiSubject" value="'+esc(x.subject?.name||"")+'"></label><label>Padre<input id="aiSire" value="'+esc(x.parents?.sire||"")+'"></label><label>Madre<input id="aiDam" value="'+esc(x.parents?.dam||"")+'"></label><div class="gen-title">ANTENATI RICONOSCIUTI</div>'+(rows||"<div class=\"empty\">Nessun nome riconosciuto.</div>")+'<details class="ocr-raw"><summary>Mostra nomi riconosciuti dall’OCR</summary><pre>'+esc(x.rawText||"")+'</pre></details><button id="confirmAI" style="margin-top:15px">Conferma dati verificati</button>';
 document.getElementById("confirmAI").onclick=confirmAI;
}
function confirmAI(){
 [...document.querySelectorAll("[data-ai-index]")].forEach(e=>{if(extracted.ancestors[+e.dataset.aiIndex])extracted.ancestors[+e.dataset.aiIndex].name=e.value.trim();});
 extracted.parents.sire=document.getElementById("aiSire").value.trim();
 extracted.parents.dam=document.getElementById("aiDam").value.trim();
 extracted.subject.name=document.getElementById("aiSubject").value.trim();
 window.aiExtracted=extracted;
 if(typeof applyAIResult==="function")applyAIResult();
}
})();