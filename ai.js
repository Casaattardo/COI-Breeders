(function(){
let extracted=null;
window.runPedigreeAI=async function(){
 const file=document.getElementById("pedPhoto")?.files?.[0];
 const status=document.getElementById("aiStatus"),box=document.getElementById("aiFields");
 if(!file){alert("Carica prima una foto del pedigree.");return;}
 if(!window.Tesseract){status.textContent="Motore OCR non disponibile.";return;}
 status.innerHTML='<div class="check">OCR gratuito in esecuzione sul dispositivo…</div>';
 try{
  const worker=await Tesseract.createWorker("ita",1,{logger:m=>{
   if(m.status&&typeof m.progress==="number")status.innerHTML='<div class="check">OCR gratuito: '+Math.round(m.progress*100)+'%</div>';
  }});
  const ret=await worker.recognize(file);
  await worker.terminate();
  const text=ret.data.text||"";
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const names=lines.filter(x=>/\b(ROI|RSR)\b/i.test(x));
  extracted={subject:{name:"",confidence:.5},parents:{sire:names[0]||"",dam:names[1]||""},ancestors:names.slice(2).map((name,i)=>({side:i%2?"d":"s",generation:Math.min(5,Math.floor(i/4)+1),position:(i%4)+1,name,confidence:.65})),rawText:text,warnings:["OCR eseguito localmente: nessun credito API OpenAI utilizzato.","Controlla sempre i nomi sulla foto originale."]};
  window.aiExtracted=extracted;
  renderAI(extracted);
 }catch(e){status.innerHTML='<div class="check warn">OCR non completato: '+esc(String(e.message||e))+'</div>';}
};
function renderAI(x){
 const box=document.getElementById("aiFields"),status=document.getElementById("aiStatus");
 status.innerHTML='<div class="check ok">✓ OCR gratuito completato sul dispositivo.</div>';
 const rows=(x.ancestors||[]).map((v,i)=>'<div class="ai-row"><label>'+esc(v.side==="s"?"PADRE":"MADRE")+' · G'+v.generation+' · posizione '+v.position+'<input data-ai-index="'+i+'" value="'+esc(v.name)+'"></label><small>Confidenza indicativa: '+Math.round(v.confidence*100)+'%</small></div>').join("");
 box.innerHTML='<div class="check warn">⚠️ L’OCR legge il testo ma non interpreta in modo affidabile tutta la struttura genealogica. Verifica ogni dato.</div><label>Nome soggetto<input id="aiSubject" value="'+esc(x.subject?.name||"")+'"></label><label>Padre<input id="aiSire" value="'+esc(x.parents?.sire||"")+'"></label><label>Madre<input id="aiDam" value="'+esc(x.parents?.dam||"")+'"></label><div class="gen-title">TESTO RICONOSCIUTO</div>'+rows+'<details class="ocr-raw"><summary>Mostra OCR grezzo</summary><pre>'+esc(x.rawText||"")+'</pre></details><button id="confirmAI" style="margin-top:15px">Conferma dati verificati</button>';
 document.getElementById("confirmAI").onclick=confirmAI;
}
function confirmAI(){
 const inputs=[...document.querySelectorAll("[data-ai-index]")];
 inputs.forEach(i=>{if(extracted.ancestors[+i.dataset.aiIndex])extracted.ancestors[+i.dataset.aiIndex].name=i.value.trim();});
 extracted.parents.sire=document.getElementById("aiSire").value.trim();
 extracted.parents.dam=document.getElementById("aiDam").value.trim();
 extracted.subject.name=document.getElementById("aiSubject").value.trim();
 window.aiExtracted=extracted;
 if(typeof applyAIResult==="function")applyAIResult();
}
})();