// Multiplayer Firebase Realtime Database (sem servidor Node).
// Configure firebase-config.js e regras do Realtime Database antes de usar online.
const MP = {
  db:null, auth:null, ref:null, code:null, seat:0, token:null, handler:null, listener:null, ticker:null,
  async connect(h) {
    this.handler=h;
    if(this.db) return;
    if(!window.firebase || !window.FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes('COLE_')) throw Error('Firebase não configurado. Veja FIREBASE_SETUP.md');
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this.db=firebase.database(); this.auth=firebase.auth();
    await this.auth.signInAnonymously();
  },
  async create(cb) {
    try {
      const code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
      const uid=this.auth.currentUser.uid, now=Date.now()+ (this.db.ref('.info/serverTimeOffset')?0:0);
      const ref=this.db.ref('rooms/'+code);
      const data={phase:'waiting',board:Array(9).fill(-1),turn:0,wins:[0,0],winner:-1,reason:'',line:[],deadline:0,revision:0,round:0,rematch:[false,false],players:{p0:uid},createdAt:firebase.database.ServerValue.TIMESTAMP};
      const tx=await ref.transaction(v=>v===null?data:undefined);
      if(!tx.committed) return cb({ok:false,error:'Código ocupado. Tente novamente.'});
      this.bind(code,0); cb({ok:true,code,seat:0});
    } catch(e){cb({ok:false,error:e.message});}
  },
  async join(code,cb) {
    try {
      const uid=this.auth.currentUser.uid, ref=this.db.ref('rooms/'+code);
      const tx=await ref.transaction(v=>{
        if(!v || v.phase!=='waiting' || !v.players || v.players.p1 || v.players.p0===uid)return;
        v.players.p1=uid;v.phase='turn';v.deadline=Date.now()+10000;v.revision=(v.revision||0)+1;return v;
      });
      if(!tx.committed)return cb({ok:false,error:'Sala não encontrada ou já está cheia'});
      this.bind(code,1);cb({ok:true,code,seat:1});
    }catch(e){cb({ok:false,error:e.message});}
  },
  bind(code,seat){
    this.leave(false);this.code=code;this.seat=seat;this.ref=this.db.ref('rooms/'+code);
    this.listener=this.ref.on('value',snap=>{
      const d=snap.val();if(!d){this.handler.closed({reason:'Sala encerrada'});return;}
      const board=(d.board||Array(9).fill(-1)).map(v=>v===-1?null:v);
      const s={phase:d.phase,board,turn:d.turn,wins:d.wins||[0,0],winner:d.winner===-1?null:d.winner,line:d.line||null,reason:d.reason,remain:Math.max(0,(d.deadline||0)-Date.now())};
      if(d.lastShot && d.lastShot.revision!==this.lastShotRevision){
        this.lastShotRevision=d.lastShot.revision;
        if(this.seenInitial) this.handler.shot(d.lastShot.data);
      }
      this.seenInitial=true;
      if(d.phase==='flight')return;
      this.handler.state(s);
    });
    this.ticker=setInterval(()=>this.expire(),600);
  },
  async expire(){
    if(!this.ref)return;
    try{await this.ref.transaction(d=>{
      if(!d || d.phase!=='turn' || Date.now()<(d.deadline||0)+500)return;
      d.timeouts=(d.timeouts||0)+1;
      if(d.timeouts>=2){d.phase='over';d.reason='timeout';d.winner=-1;}
      else{d.turn=1-d.turn;d.deadline=Date.now()+10000;}
      d.revision=(d.revision||0)+1;return d;
    },undefined,false);}catch(e){}
  },
  async shoot(yaw,pitch,cb){
    if(!this.ref)return cb(false);
    let accepted=false;
    try{
      const tx=await this.ref.transaction(d=>{
        if(!d||d.phase!=='turn'||d.turn!==this.seat||Date.now()>d.deadline+500)return;
        const m=new Match();m.board=(d.board||[]).map(x=>x===-1?null:x);m.turn=d.turn;m.timeouts=d.timeouts||0;
        const shot=m.shoot(this.seat,yaw,pitch);if(!shot)return;
        accepted=true;d.board=m.board.map(x=>x===null?-1:x);d.turn=m.turn;d.timeouts=m.timeouts;d.winner=m.winner===null?-1:m.winner;d.line=m.line||[];d.reason=m.reason||'';
        d.revision=(d.revision||0)+1;d.lastShot={revision:d.revision,data:shot};
        d.phase='flight';d.flightUntil=Date.now()+Math.ceil(shot.flight*1000)+900;
        return d;
      },undefined,false);
      if(!tx.committed)return cb(false);
      cb(true);
      const shot=tx.snapshot.val().lastShot.data;
      setTimeout(()=>this.advance(),Math.ceil(shot.flight*1000)+950);
    }catch(e){cb(false);}
  },
  async advance(){
    if(!this.ref)return;
    await this.ref.transaction(d=>{
      if(!d||d.phase!=='flight'||Date.now()<(d.flightUntil||0))return;
      if(d.reason){d.phase='over';if(d.winner!==-1){d.wins=d.wins||[0,0];d.wins[d.winner]++;}}
      else{d.phase='turn';d.deadline=Date.now()+10000;}
      d.revision=(d.revision||0)+1;return d;
    },undefined,false);
  },
  async rematch(){
    if(!this.ref)return;
    await this.ref.transaction(d=>{
      if(!d||d.phase!=='over')return;
      d.rematch=d.rematch||[false,false];d.rematch[this.seat]=true;
      if(d.rematch[0]&&d.rematch[1]){
        d.board=Array(9).fill(-1);d.round=(d.round||0)+1;d.turn=d.round%2;d.phase='turn';d.deadline=Date.now()+10000;d.winner=-1;d.reason='';d.line=[];d.timeouts=0;d.rematch=[false,false];delete d.lastShot;
      }return d;
    },undefined,false);
  },
  leave(remove=true){
    if(this.ticker)clearInterval(this.ticker);this.ticker=null;
    if(this.ref&&this.listener)this.ref.off('value',this.listener);
    if(remove&&this.ref)this.ref.remove().catch(()=>{});
    this.ref=null;this.listener=null;this.code=null;this.seenInitial=false;this.lastShotRevision=null;
  }
};