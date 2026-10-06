(function(){
let extracted=null;
window.runPedigreeAI=async function(){
 if(!window.aiImageData && typeof aiImageData!=="undefined") window.aiImageData=aiImageData;
 const img=window.aiImageData||aiImageData;
 if(!img){alert("Carica prima una foto del pedigree.");return;}
 const status=document.getElementById("aiStatus"), box=document.getElementById("aiFields");
 status.textContent="Analisi AI in corso…";
 box.innerHTML="<div class='check'>⏳ Lettura del pedigree e ricostruzione delle 5 generazioni…</div>";
 try{
  const {data:{session}}=await window.COI_SUPABASE.auth.getSession();
  if(!session) throw new Error("Accedi prima di usare l’analisi AI.");
  const r=await fetch(window.SUPABASE_CONFIG.url+"/functions/v1/parse-pedigree",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({image_base64:img})});
  const j=await r.json();
  if(!r.ok) throw new Error(j.message||j.error||"Errore del servizio AI");
  extracted=j.result||j;
  renderAI(extracted);
 }catch(e){status.textContent="Analisi non completata.";box.innerHTML="<div class='check warn'>⚠️ "+esc(e.message)+"</div>";}
};
function renderAI(x){
 const box=document.getElementById("aiFields"),status=document.getElementById("aiStatus");
 status.textContent="Estrazione completata: verifica attentamente ogni nome prima di applicare il pedigree.";
 const low=(x.ancestors||[]).filter(v=>(v.confidence||0)<0.8).length;
 if(low) status.textContent+=" ⚠️ "+low+" dati hanno confidenza inferiore all'80%.";
 const a=(x.ancestors||[]).map((v,i)=>"<div class='ai-row'><label>"+esc(v.side)+" · G"+v.generation+" · posizione "+v.position+"<input data-ai-index='"+i+"' value='"+esc(v.name)+"'></label><small>Confidenza: "+Math.round((v.confidence||0)*100)+"%</small></div>").join("");
 box.innerHTML="<div class='check warn'>⚠️ L’AI non è una certificazione: confronta sempre i dati con la foto originale.</div><label>Nome soggetto<input id='aiSubject' value='"+esc(x.subject?.name||"")+"'></label><label>Padre<input id='aiSire' value='"+esc(x.parents?.sire||"")+"'></label><label>Madre<input id='aiDam' value='"+esc(x.parents?.dam||"")+"'></label><div class='gen-title'>ANTENATI ESTRATTI</div>"+(a||"<div class='empty'>Nessun antenato riconosciuto.</div>")+"<button id='confirmAI' style='margin-top:15px'>Conferma dati verificati</button>";
 document.getElementById("confirmAI").onclick=confirmAI;
}
function confirmAI(){
 if(!extracted)return;
 const inputs=[...document.querySelectorAll("[data-ai-index]")];
 inputs.forEach(i=>{extracted.ancestors[+i.dataset.aiIndex].name=i.value.trim()});
 extracted.subject.name=document.getElementById("aiSubject").value.trim();
 extracted.parents.sire=document.getElementById("aiSire").value.trim();
 extracted.parents.dam=document.getElementById("aiDam").value.trim();
 window.aiExtracted=extracted;
 if(typeof applyAIResult==="function") window.applyAIResult();
 alert("Pedigree AI confermato. Ora controlla i dati nella schermata di calcolo.");
}
})();