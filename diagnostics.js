function runCOITests(){
 const c=[], n=(s=null,d=null)=>({sire:s,dam:d});
 const add=(name,expected,a,b,nodes)=>{const actual=window.COIEngine.offspringInbreeding(a,b,nodes);c.push({name,expected,actual,ok:Math.abs(actual-expected)<1e-9});};
 add('Nessuna parentela',0,'A','B',{A:n(),B:n()});
 add('Padre × figlia',.25,'P','C',{P:n(),M:n(),C:n('P','M')});
 add('Fratelli pieni',.25,'S1','S2',{G:n(),H:n(),S1:n('G','H'),S2:n('G','H')});
 add('Mezzi fratelli',.125,'S1','S2',{G:n(),H1:n(),H2:n(),S1:n('G','H1'),S2:n('G','H2')});
 add('Nonno × nipote',.125,'G','C',{G:n(),M:n('G','X'),X:n(),C:n('M','Y'),Y:n()});
 add('Primi cugini',.0625,'C1','C2',{G:n(),H:n(),P1:n('G','H'),P2:n('G','H'),X:n(),Y:n(),C1:n('P1','X'),C2:n('P2','Y')});
 add('Doppi primi cugini',.125,'C1','C2',{G1:n(),G2:n(),P1:n('G1','G2'),P2:n('G1','G2'),U1:n(),U2:n(),C1:n('P1','U1'),C2:n('P2','U2')});
 const ok=c.every(x=>x.ok), s=document.getElementById('testSummary');
 s.className='check '+(ok?'ok':'warn');s.textContent=ok?'✓ Tutti i test COI superati.':'⚠ Alcuni test hanno fallito.';
 document.getElementById('testResults').innerHTML=c.map(x=>'<div class="ancestor"><span>'+x.name+'</span><b>'+((x.actual*100).toFixed(3))+'% / atteso '+((x.expected*100).toFixed(3))+'%</b></div>').join('');
}