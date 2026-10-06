(function(root,factory){
 if(typeof module==="object"&&module.exports)module.exports=factory();
 else root.COIEngine=factory();
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 function kin(a,b,nodes,memo,stack){
  if(!a||!b||!nodes[a]||!nodes[b])return 0;
  const k=a<b?a+"|"+b:b+"|"+a;
  if(memo[k]!==undefined)return memo[k];
  stack=stack||new Set();
  if(stack.has(k))return 0;
  const ns=new Set(stack);ns.add(k);
  if(a===b){
   const p=nodes[a];
   if(!p.sire||!p.dam)return memo[k]=0.5;
   return memo[k]=(1+kin(p.sire,p.dam,nodes,memo,ns))/2;
  }
  const x=nodes[a];
  return memo[k]=0.5*(kin(x.sire,b,nodes,memo,ns)+kin(x.dam,b,nodes,memo,ns));
 }
 function offspringInbreeding(sire,dam,nodes){return Math.max(0,kin(sire,dam,nodes,{},new Set()));}
 function ancestorInbreeding(id,nodes){return Math.max(0,kin(id,id,nodes,{},new Set())-0.5);}
 return Object.freeze({kin,offspringInbreeding,ancestorInbreeding});
});