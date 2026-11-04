// Stand-in for the platform's room capability, using BroadcastChannel between tabs.
(function(){
  const peerId = 'p' + Math.random().toString(36).slice(2,8);
  function makeRoom(name){
    const bc = new BroadcastChannel('mock-'+name);
    const peers = new Map(); const handlers = {}; const peerFns = [];
    const self = { peer: peerId, by:null, isMe:true, sameTab:true, kind:'viewer', guest:false, presence:{}, updatedAt:Date.now() };
    peers.set(peerId, self);
    function notify(j=[],l=[]){ const arr=[...peers.values()].map(p=>({...p})); peerFns.forEach(f=>f({peers:arr,joined:j,left:l,updated:[]})); }
    bc.onmessage = (ev)=>{ const m = ev.data;
      if (m.t==='hello'||m.t==='pres'){ const ex=peers.has(m.peer); peers.set(m.peer,{peer:m.peer,by:null,isMe:false,sameTab:false,kind:'viewer',guest:false,presence:m.presence||{},updatedAt:Date.now()}); if(m.t==='hello') bc.postMessage({t:'pres',peer:peerId,presence:self.presence}); notify(ex?[]:[peers.get(m.peer)]); }
      if (m.t==='emit'){ (handlers[m.topic]||[]).forEach(h=>h({topic:m.topic,data:m.data,peer:m.peer,by:null,isMe:false,sameTab:false,kind:'viewer',guest:false})); }
      if (m.t==='bye'){ const p=peers.get(m.peer); peers.delete(m.peer); notify([], p?[p]:[]); }
    };
    window.addEventListener('beforeunload',()=>bc.postMessage({t:'bye',peer:peerId}));
    setTimeout(()=>{ bc.postMessage({t:'hello',peer:peerId,presence:self.presence}); notify([self]); },10);
    return {
      name, emit:async(topic,data)=>{ bc.postMessage({t:'emit',topic,data:JSON.parse(JSON.stringify(data)),peer:peerId}); },
      on:(topic,h)=>{ (handlers[topic]=handlers[topic]||[]).push(h); return ()=>{}; },
      presence:async(patch)=>{ Object.assign(self.presence,patch); self.presence={...self.presence}; bc.postMessage({t:'pres',peer:peerId,presence:self.presence}); notify(); },
      peers:()=>[...peers.values()], onPeers:(f)=>{ peerFns.push(f); return ()=>{}; },
      connected:()=>true, onConnection:(f)=>{ setTimeout(()=>f(true),5); return ()=>{}; }, leave:async()=>{}
    };
  }
  const ns = { join: async (n)=>makeRoom(n) };
  window.claude = { use: async (name)=> name==='room' ? ns : null };
})();
