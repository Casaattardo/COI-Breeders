const assert=require('node:assert/strict');

function kin(a,b,nodes,memo={},stack=new Set()){
  if(!a||!b||!nodes[a]||!nodes[b]) return 0;
  const k=a<b?a+'|'+b:b+'|'+a;
  if(memo[k]!==undefined) return memo[k];
  if(stack.has(k)) return 0;
  const ns=new Set(stack); ns.add(k);
  if(a===b){
    const p=nodes[a];
    if(!p.sire||!p.dam) return memo[k]=0.5;
    return memo[k]=(1+kin(p.sire,p.dam,nodes,memo,ns))/2;
  }
  const x=nodes[a];
  return memo[k]=0.5*(kin(x.sire,b,nodes,memo,ns)+kin(x.dam,b,nodes,memo,ns));
}
const F=(a,b,n)=>kin(a,b,n)-0.0;

function node(id,sire=null,dam=null){return {sire,dam};}
function check(name,expected,a,b,n,tol=1e-9){
  const actual=F(a,b,n);
  assert(Math.abs(actual-expected)<=tol, name+': expected '+expected+', got '+actual);
  console.log('✓ '+name+' = '+(actual*100).toFixed(4)+'%');
}

// 1) unrelated
check('Unrelated',0,'A','B',{A:node(),B:node()});

// 2) parent / offspring: kin(parent, child)=0.25
check('Parent-child',0.25,'P','C',{P:node(),C:node('P','M'),M:node()});

// 3) full siblings: kin=0.25
check('Full siblings',0.25,'S1','S2',{
 G:node(),H:node(),S1:node('G','H'),S2:node('G','H')
});

// 4) half siblings: kin=0.125
check('Half siblings',0.125,'S1','S2',{
 G:node(),H1:node(),H2:node(),S1:node('G','H1'),S2:node('G','H2')
});

// 5) grandparent / grandchild: kin=0.125
check('Grandparent-grandchild',0.125,'G','C',{
 G:node(),M:node('G','X'),X:node(),C:node('M','Y'),Y:node()
});

// 6) first cousins: kin=0.0625
check('First cousins',0.0625,'C1','C2',{
 G:node(),H:node(),P1:node('G','H'),P2:node('G','H'),
 X:node(),Y:node(),C1:node('P1','X'),C2:node('P2','Y')
});

// 7) double first cousins: kin=0.125
check('Double first cousins',0.125,'C1','C2',{
 G:node(),H:node(),P1:node('G','H'),P2:node('G','H'),
 C1:node('P1','P2'), C2:node('P1','P2')
});

// 8) inbred common ancestor: common ancestor A is itself inbred through P/Q
// kin(P,Q)=0.25 -> F_A=0.0? Here P and Q are parent/offspring, so A has F=0.25.
// X and Y are both children of A through unrelated mates: kin(X,Y)=0.125.
check('Offspring of an inbred ancestor',0.125,'X','Y',{
 P:node(),Q:node(),A:node('P','Q'),M:node(),N:node(),X:node('A','M'),Y:node('A','N')
});

console.log('\nAll COI regression tests passed.');
