(function(root,factory){
 if(typeof module==="object"&&module.exports)module.exports=factory();
 else root.COIEngine=factory();
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 // Coefficiente di kinship phi(A,B), equivalente al COI della prole dei due soggetti.
 // I fondatori non collegati sono considerati non imparentati; i genitori mancanti
 // contribuiscono zero alla kinship, senza interrompere il ramo noto.
 function kin(a,b,nodes,memo={},stack=new Set()){
  if(!a||!b||!nodes[a]||!nodes[b])return 0;
  const k=a<b?a+"|"+b:b+"|"+a;
  if(memo[k]!==undefined)return memo[k];
  if(stack.has(k))return 0; // protegge da pedigree circolari inseriti per errore
  const next=new Set(stack);next.add(k);
  if(a===b){
   const p=nodes[a];
   const value=0.5*(1+kin(p.sire,p.dam,nodes,memo,next));
   memo[k]=value;
   return value;
  }
  const x=nodes[a],y=nodes[b];
  // Espandi il soggetto con genitori noti. Il coefficiente è simmetrico.
  if(x.sire||x.dam){
   const value=0.5*(kin(x.sire,b,nodes,memo,next)+kin(x.dam,b,nodes,memo,next));
   memo[k]=value;return value;
  }
  if(y.sire||y.dam){
   const value=0.5*(kin(a,y.sire,nodes,memo,next)+kin(a,y.dam,nodes,memo,next));
   memo[k]=value;return value;
  }
  memo[k]=0;return 0;
 }
 function offspringInbreeding(sire,dam,nodes){return Math.max(0,kin(sire,dam,nodes,{},new Set()));}
 function ancestorInbreeding(id,nodes){return Math.max(0,kin(id,id,nodes,{},new Set())-0.5);}
 return Object.freeze({kin,offspringInbreeding,ancestorInbreeding});
});
