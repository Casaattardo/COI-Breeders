(function(){
let extracted=null,busy=false;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function status(t,k=""){const e=document.getElementById("aiStatus");if(e)e.innerHTML='<div class="check '+k+'">'+esc(t)+'</div>';}
function fileData(file){return new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=bad;r.readAsDataURL(file);});}

window.runPedigreeAI=async function(){
 if(busy)return;busy=true;
 const file=document.getElementById("pedPhoto")?.files?.[0];
 if(!file){alert("Carica prima una foto del pedigree.");busy=false;return;}
 try{
  status("Analisi del pedigree con riconoscimento immagini…");
  const session=window.supabaseClient?await window.supabaseClient.auth.getSession():null;
  const token=session?.data?.session?.access_token;
  if(!token){status("Accedi all'app prima di usare il riconoscimento immagini.","warn");return;}
  const image=await fileData(file);
  const url=window.SUPABASE_CONFIG.url+"/functions/v1/parse-pedigree-gemini";
  const resp=await fetch(url,{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":window.SUPABASE_CONFIG.anonKey,"Content-Type":"application/json"},body:JSON.stringify({image_base64:image,mime_type:file.type||"image/jpeg"})});
  const data=await resp.json();
  if(!resp.ok||data.error)throw new Error(data.error||"Errore del servizio di riconoscimento");
  extracted=data.result;window.aiExtracted=extracted;renderAI(extracted);
 }catch(e){console.error(e);status("Riconoscimento non completato: "+(e?.message||e),"warn");}
 finally{busy=false;}
};

function renderAI(x){
 const box=document.getElementById("aiFields");
 const rows=(x.ancestors||[]).map((v,i)=>'<div class="ai-row"><label>'+esc(v.side==="sire"?"PADRE":"MADRE")+' · G'+v.generation+' · posizione '+v.position+'<input data-ai-index="'+i+'" value="'+esc(v.name||"")+'"></label><small>Confidenza: '+Math.round((v.confidence||0)*100)+'%</small></div>').join("");
 box.innerHTML='<div class="check ok">✓ Riconoscimento immagini completato. Verifica i dati sulla foto originale.</div><label>Nome soggetto<input id="aiSubject" value="'+esc(x.subject?.name||"")+'"></label><label>Padre<input id="aiSire" value="'+esc(x.parents?.sire||"")+'"></label><label>Madre<input id="aiDam" value="'+esc(x.parents?.dam||"")+'"></label><div class="gen-title">ANTENATI RICONOSCIUTI</div>'+(rows||'<div class="empty">Nessun antenato riconosciuto.</div>')+'<div class="ocr-raw"><details><summary>Avvertenze</summary><pre>'+esc((x.warnings||[]).join("\n"))+'</pre></details></div><button id="confirmAI" style="margin-top:15px">Conferma dati verificati</button>';
 document.getElementById("confirmAI").onclick=confirmAI;
 status("✓ Analisi completata. Controlla i nomi prima di applicarli.");
}
function confirmAI(){
 [...document.querySelectorAll("[data-ai-index]")].forEach(e=>{if(extracted.ancestors[+e.dataset.aiIndex])extracted.ancestors[+e.dataset.aiIndex].name=e.value.trim();});
 extracted.parents.sire=document.getElementById("aiSire").value.trim();
 extracted.parents.dam=document.getElementById("aiDam").value.trim();
 extracted.subject.name=document.getElementById("aiSubject").value.trim();
 window.aiExtracted=extracted;if(typeof applyAIResult==="function")applyAIResult();
}
})();