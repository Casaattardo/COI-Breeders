(function(root,factory){
 if(typeof module==="object"&&module.exports)module.exports=factory();
 else root.COIEngine=factory();
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 function kin(a,b,nodes,memo={},active=new Set()){
  if(!a||!b||!nodes[a]||!nodes[b])return 0;
  const key=a<b?a+"|"+b:b+"|"+a;
  if(Object.prototype.hasOwnProperty.call(memo,key))return memo[key];
  if(active.has(key))return 0;
  const next=new Set(active);next.add(key);
  let value=0;
  if(a===b){
   const p=nodes[a]||{};
   value=0.5*(1+kin(p.sire,p.dam,nodes,memo,next));
  }else{
   const x=nodes[a]||{},y=nodes[b]||{};
   // Expand one individual with known parents; missing parents contribute zero.
   if(x.sire||x.dam)value=0.5*(kin(x.sire,b,nodes,memo,next)+kin(x.dam,b,nodes,memo,next));
   else if(y.sire||y.dam)value=0.5*(kin(a,y.sire,nodes,memo,next)+kin(a,y.dam,nodes,memo,next));
  }
  memo[key]=value;
  return value;
 }
 function offspringInbreeding(sire,dam,nodes){return Math.max(0,kin(sire,dam,nodes,{},new Set()));}
 function ancestorInbreeding(id,nodes){return Math.max(0,kin(id,id,nodes,{},new Set())-0.5);}
 return Object.freeze({kin,offspringInbreeding,ancestorInbreeding});
});
