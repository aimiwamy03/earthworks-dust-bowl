const DB = require('../src/engine.js');
function run(kinds){
  let players = kinds.map(k=>({k, board:DB.fresh(), money:DB.START_CASH}));
  const capped=(p,plan)=>{let c=DB.planCost(p.board,plan); return c<=p.money?plan:DB.botPlan('boomer',p.board,p.money,0)};
  for(let r=0;r<3;r++){
    const plans = players.map(p=>{let pl= custom[p.k]? custom[p.k](p.board,p.money,r) : DB.botPlan(p.k,p.board,p.money,r); if(DB.planCost(p.board,pl)>p.money){p.log=(p.log||'')+' OVERBUDGET';} return pl;});
    const res = DB.resolveRound(players, plans, r);
    players = players.map((p,i)=>({k:p.k, board:res.results[i].next, money:res.results[i].money, log:(p.log||'')+` r${r}: -${res.results[i].cost} +${res.results[i].income} soil${DB.soilPct(res.results[i].after)}% `}));
  }
  players.forEach(p=>console.log(p.k.padEnd(10), 'cash',p.money,'land',DB.landValue(p.board),'SCORE',DB.finalScore(p.money,p.board),'soil',DB.soilPct(p.board)+'%', '|',p.log));
}
const custom = {
  allcover:(b,m)=>DB.encode(DB.decode(b).map(x=>({type: x.type==='T'?'T':'C', soil:x.soil}))),
  halfwheat:(b,m)=>DB.encode(DB.decode(b).map((x,i)=>({type: (i%8)<4?(x.type==='P'?'P':'Y'):'W', soil:x.soil}))),
  boomthenstop:(b,m,r)=>DB.encode(DB.decode(b).map(x=>({type: r===0?'W':(x.type==='P'?'P':'Y'), soil:x.soil}))),
};
custom.smart=(b,m,r)=>{const w=DB.ROUNDS[r].wind;return DB.encode(DB.decode(b).map((x,i)=>{const row=Math.floor(i/8),c=i%8;
 if(x.type==='T')return x; if(w==='W'&&(c===0||c===4))return {type:'S',soil:x.soil}; if(w==='N'&&(row===0||row===3))return {type:'S',soil:x.soil};
 if(r===0) return {type:'W',soil:x.soil}; return {type: x.soil>4?'C':(x.type==='P'?'P':'Y'),soil:x.soil};}))};
custom.smart2=(b,m,r)=>{const w=DB.ROUNDS[r].wind;return DB.encode(DB.decode(b).map((x,i)=>{const row=Math.floor(i/8),c=i%8;
 if(x.type==='T')return x; if(c===0||c===4)return {type:'S',soil:x.soil}; if(r>=1&&(row===0))return {type:'S',soil:x.soil};
 return {type:'W',soil:x.soil};}))};
custom.stripcrop=(b,m,r)=>DB.encode(DB.decode(b).map((x,i)=>{const c=i%8; if(x.type==='T')return x; return {type: c%2? 'W':(x.type==='P'?'P':'Y'),soil:x.soil};}));
for (const k of ['boomer','rancher','steward','allcover','halfwheat','boomthenstop','smart','smart2','stripcrop']) run([k]);
console.log('--- group');
run(['boomer','steward','rancher','boomer']);
