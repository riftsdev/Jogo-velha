/* PAINT TAC 3D v0.3 — Conta Ghost, fila 1v1 e convites */
const Ghost={
 auth:null,db:null,queueRef:null,queueHandler:null,inviteRef:null,inviteHandler:null,activeInvite:null,busy:false,
 async ready(){
  if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
  this.auth=firebase.auth();this.db=firebase.database();
  if(!this.auth.currentUser)await this.auth.signInAnonymously();
  await Social.ready();
  return this.auth.currentUser;
 },
 isGuest(){return !!this.auth?.currentUser?.isAnonymous;},
 async syncProfile(){
  if(this.inviteRef&&this.inviteHandler)this.inviteRef.off('value',this.inviteHandler);
  this.inviteRef=null;this.inviteHandler=null;this.activeInvite=null;
  Social.uid=null;Social.profile=null;await Social.ready();this.updateUI();await this.listenInvites();
 },
 updateUI(){
  const u=this.auth?.currentUser;
  document.getElementById('ghostStatus').textContent=u?(u.isAnonymous?'👻 Convidado — vincule um e-mail para proteger sua conta':'🔐 Conta protegida · '+(u.email||'')):'Conectando…';
  document.getElementById('ghostLinkBox').classList.toggle('hidden',!u||!u.isAnonymous);
  document.getElementById('ghostLoginBox').classList.toggle('hidden',!u||!u.isAnonymous);
 },
 async link(email,password){
  await this.ready();
  if(!this.isGuest())throw Error('Esta conta já está vinculada.');
  if(password.length<6)throw Error('A senha precisa ter ao menos 6 caracteres.');
  const credential=firebase.auth.EmailAuthProvider.credential(email.trim(),password);
  await this.auth.currentUser.linkWithCredential(credential);
  await this.syncProfile();
 },
 async login(email,password){
  if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
  this.auth=firebase.auth();this.db=firebase.database();
  await this.auth.signInWithEmailAndPassword(email.trim(),password);
  await this.syncProfile();
 },
 async reset(email){
  if(!email.trim())throw Error('Informe o e-mail.');
  await this.auth.sendPasswordResetEmail(email.trim());
 },
 async logout(){
  await this.cancelQueue();
  if(MP.ref)MP.leave();
  await this.auth.signOut();
  Social.uid=null;Social.profile=null;MP.db=null;MP.auth=null;
  await this.auth.signInAnonymously();
  await this.syncProfile();
 },
 async makeRoom(){
  await this.ready();await MP.connect(H);
  return new Promise((resolve,reject)=>MP.create(r=>r.ok?resolve(r.code):reject(Error(r.error))));
 },
 async joinRoom(code){
  await this.ready();await MP.connect(H);
  return new Promise((resolve,reject)=>MP.join(code,r=>r.ok?resolve(r):reject(Error(r.error))));
 },
 async queue(){
  if(this.busy)return;this.busy=true;
  const msg=t=>document.getElementById('lobMsg').textContent=t;
  try{
   await this.ready();await MP.connect(H);
   msg('Procurando adversário…');
   const q=this.db.ref('matchmaking/slot'),uid=this.auth.currentUser.uid;
   const snap=await q.once('value'),v=snap.val(),now=Date.now();
   if(v&&v.uid!==uid&&v.createdAt>now-90000){
    await this.joinRoom(v.code);
    await q.transaction(x=>x&&x.uid===v.uid&&x.code===v.code?null:undefined,undefined,false);
    msg('Adversário encontrado!');this.busy=false;return;
   }
   const code=await this.makeRoom();
   const tx=await q.transaction(x=>{const current=x===null?v:x;return (!current||current.createdAt<Date.now()-90000||current.uid===uid)?{uid,code,createdAt:Date.now()}:undefined;},undefined,false);
   if(!tx.committed){
    MP.leave();this.busy=false;return this.queue();
   }
   this.queueRef=q;
   this.queueHandler=s=>{
    const value=s.val();
    if(value&&value.uid===uid&&value.code===code)return;
    this.stopQueueListener();
   };
   q.on('value',this.queueHandler);
   document.getElementById('code').textContent=code;
   document.getElementById('qr').src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(location.origin+location.pathname+'?room='+code);
   document.getElementById('roomBox').classList.remove('hidden');
   msg('Na fila! Aguardando outro jogador. Você também pode compartilhar o código.');
   this.busy=false;
  }catch(e){this.busy=false;msg('Erro na busca: '+e.message);}
 },
 stopQueueListener(){
  if(this.queueRef&&this.queueHandler)this.queueRef.off('value',this.queueHandler);
  this.queueRef=null;this.queueHandler=null;
 },
 async cancelQueue(){
  if(!this.queueRef)return;
  const ref=this.queueRef,uid=this.auth?.currentUser?.uid;
  this.stopQueueListener();
  try{await ref.transaction(x=>x&&x.uid===uid?null:undefined,undefined,false);}catch(e){console.warn('Fila:',e.message);}
 },
 async invite(uid){
  await this.ready();
  if(uid===this.auth.currentUser.uid)throw Error('Não é possível convidar você mesmo.');
  S.mode='online';
  const code=await this.makeRoom();
  const ref=this.db.ref('gameInvites/'+uid+'/'+this.auth.currentUser.uid);
  await ref.set({code,fromName:Social.profile?.name||'Jogador',createdAt:firebase.database.ServerValue.TIMESTAMP,status:'pending'});
  document.getElementById('code').textContent=code;
  document.getElementById('qr').src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(location.origin+location.pathname+'?room='+code);
  document.getElementById('roomBox').classList.remove('hidden');
  document.getElementById('lobMsg').textContent='Convite enviado! Aguardando seu amigo…';
  document.getElementById('social').classList.add('hidden');
  go('lobby');
 },
 async listenInvites(){
  await this.ready();
  if(this.inviteRef)return;
  this.inviteRef=this.db.ref('gameInvites/'+this.auth.currentUser.uid);
  this.inviteHandler=s=>{
   const items=Object.entries(s.val()||{}).filter(([uid,v])=>v.status==='pending'&&v.createdAt>Date.now()-120000);
   const box=document.getElementById('inviteBanner');
   if(!items.length){box.classList.add('hidden');this.activeInvite=null;return;}
   const [uid,v]=items[0];this.activeInvite={uid,...v};
   document.getElementById('inviteText').textContent=(v.fromName||'Jogador')+' convidou você para um duelo!';
   box.classList.remove('hidden');
  };
  this.inviteRef.on('value',this.inviteHandler,err=>console.warn('Convites:',err.message));
 },
 async acceptInvite(){
  const inv=this.activeInvite;if(!inv)return;
  await this.ready();
  try{
   S.mode='online';
   await this.joinRoom(inv.code);
   await this.db.ref('gameInvites/'+this.auth.currentUser.uid+'/'+inv.uid).remove();
   S.me=1;S.wins=[0,0];
   document.getElementById('inviteBanner').classList.add('hidden');
  }catch(e){S.mode=null;alert('Convite indisponível: '+e.message);}
 },
 async declineInvite(){
  if(!this.activeInvite)return;
  await this.db.ref('gameInvites/'+this.auth.currentUser.uid+'/'+this.activeInvite.uid).remove();
 }
};
const ghostEl=id=>document.getElementById(id);
const ghostMessage=t=>ghostEl('ghostMsg').textContent=t||'';
ghostEl('bGhost').onclick=async()=>{ghostEl('ghost').classList.remove('hidden');ghostMessage('Carregando…');try{await Ghost.ready();Ghost.updateUI();ghostMessage('');}catch(e){ghostMessage(e.message);}};
ghostEl('bGhostBack').onclick=()=>ghostEl('ghost').classList.add('hidden');
ghostEl('bGhostLink').onclick=async()=>{try{ghostMessage('Vinculando…');await Ghost.link(ghostEl('ghostEmail').value,ghostEl('ghostPassword').value);ghostMessage('Conta Ghost protegida com sucesso!');}catch(e){ghostMessage('Erro: '+e.message);}};
ghostEl('bGhostLogin').onclick=async()=>{try{ghostMessage('Entrando…');await Ghost.login(ghostEl('loginEmail').value,ghostEl('loginPassword').value);ghostMessage('Login realizado!');}catch(e){ghostMessage('Erro: '+e.message);}};
ghostEl('bGhostReset').onclick=async()=>{try{await Ghost.reset(ghostEl('loginEmail').value);ghostMessage('Se o e-mail estiver cadastrado, você receberá instruções de recuperação.');}catch(e){ghostMessage('Erro: '+e.message);}};
ghostEl('bGhostLogout').onclick=async()=>{try{await Ghost.logout();ghostMessage('Nova conta de convidado criada.');}catch(e){ghostMessage(e.message);}};
ghostEl('bQuick').onclick=async()=>{S.mode='online';await Ghost.queue();};
ghostEl('bCancelQueue').onclick=async()=>{await Ghost.cancelQueue();if(S.mode==='online')leave();ghostEl('lobMsg').textContent='Busca cancelada.';};
ghostEl('bInviteAccept').onclick=()=>Ghost.acceptInvite();
ghostEl('bInviteDecline').onclick=()=>Ghost.declineInvite();
(async()=>{try{await Ghost.ready();Ghost.updateUI();await Ghost.listenInvites();}catch(e){console.warn('Ghost:',e.message);}})();
