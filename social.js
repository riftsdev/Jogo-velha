/* PAINT TAC 3D — ranking e amigos (protótipo Firebase) */
const Social={
 db:null,uid:null,profile:null,roomSeen:new Set(),
 async ready(){
  if(this.uid)return;
  if(!window.firebase||!window.FIREBASE_CONFIG)throw Error('Firebase indisponível');
  if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
  const auth=firebase.auth();if(!auth.currentUser)await auth.signInAnonymously();
  this.uid=auth.currentUser.uid;this.db=firebase.database();
  const ref=this.db.ref('profiles/'+this.uid);
  const snap=await ref.once('value');
  if(!snap.exists())await ref.set({name:'Jogador '+this.uid.slice(0,5).toUpperCase(),wins:0,losses:0,draws:0,points:0,createdAt:firebase.database.ServerValue.TIMESTAMP});
  this.profile=(await ref.once('value')).val();
 },
 code(){return this.uid?this.uid.slice(0,8).toUpperCase():'—'},
 async saveName(name){
  await this.ready();name=String(name||'').trim().slice(0,20);
  if(name.length<3)throw Error('Escolha um nome com 3 a 20 caracteres.');
  if(!/^[\p{L}\p{N} _.-]+$/u.test(name))throw Error('Use letras, números, espaços, ponto ou hífen.');
  await this.db.ref('profiles/'+this.uid+'/name').set(name);this.profile.name=name;
 },
 async leaderboard(){
  await this.ready();
  const snap=await this.db.ref('profiles').orderByChild('points').limitToLast(30).once('value');
  return Object.entries(snap.val()||{}).map(([uid,p])=>({uid,...p})).sort((a,b)=>(b.points||0)-(a.points||0));
 },
 async sendRequest(code){
  await this.ready();code=String(code||'').trim().toUpperCase();
  if(!/^[A-F0-9]{8}$/.test(code))throw Error('Código inválido. Use 8 caracteres.');
  const snap=await this.db.ref('profiles').once('value');
  const ids=Object.keys(snap.val()||{}).filter(uid=>uid.slice(0,8).toUpperCase()===code);
  if(ids.length!==1)throw Error(ids.length?'Código ambíguo.':'Jogador não encontrado.');
  const to=ids[0];if(to===this.uid)throw Error('Esse é seu próprio código.');
  await this.db.ref('friendRequests/'+to+'/'+this.uid).set({fromName:this.profile.name,createdAt:firebase.database.ServerValue.TIMESTAMP});
 },
 async requests(){
  await this.ready();const s=await this.db.ref('friendRequests/'+this.uid).once('value');return Object.entries(s.val()||{}).map(([uid,p])=>({uid,...p}));
 },
 async accept(uid){
  await this.ready();const r=this.db.ref('friendRequests/'+this.uid+'/'+uid);
  if(!(await r.once('value')).exists())throw Error('Pedido não encontrado.');
  await this.db.ref('friends/'+this.uid+'/'+uid).set(true);
  await this.db.ref('friends/'+uid+'/'+this.uid).set(true);
  await r.remove();
 },
 async friends(){
  await this.ready();const s=await this.db.ref('friends/'+this.uid).once('value');
  const ids=Object.keys(s.val()||{});return Promise.all(ids.map(async uid=>({uid,profile:(await this.db.ref('profiles/'+uid).once('value')).val()})));
 },
 async recordMatch(room,seat,winner){
  // Protótipo: registros de resultados no cliente NÃO são antitrapaça.
  await this.ready();if(!room||this.roomSeen.has(room))return;
  const key=room.replace(/[^A-HJ-NP-Z2-9]/g,'');
  if(!key)return;
  const once=this.db.ref('matchResults/'+key+'/'+this.uid);
  const tx=await once.transaction(v=>v===null?{seat,winner,at:firebase.database.ServerValue.TIMESTAMP}:undefined);
  if(!tx.committed)return;
  this.roomSeen.add(room);
  const stat=winner===null?'draws':winner===seat?'wins':'losses';
  const score=winner===null?1:winner===seat?3:0;
  const ref=this.db.ref('profiles/'+this.uid);
  await ref.transaction(p=>{if(!p)return;p[stat]=(p[stat]||0)+1;p.points=(p.points||0)+score;return p;});
 }
};
const se=id=>document.getElementById(id);
function socialMsg(t){se('socialMsg').textContent=t||'';}
function socialList(id,items){const root=se(id);root.replaceChildren();for(const item of items)root.appendChild(item);}
function socialRow(title,detail,action,label){
 const row=document.createElement('div');row.className='social-row';
 const info=document.createElement('div');const b=document.createElement('b');b.textContent=title;const sm=document.createElement('small');sm.textContent=detail;info.append(b,sm);row.append(info);
 if(action){const btn=document.createElement('button');btn.className='social-action';btn.textContent=label;btn.onclick=action;row.append(btn);}return row;
}
async function openSocial(tab){
 se('social').classList.remove('hidden');socialMsg('Carregando…');
 try{
  await Social.ready();se('profileName').value=Social.profile.name||'';
  se('myFriendCode').textContent=Social.code();
  await refreshSocial(tab);socialMsg('');
 }catch(e){socialMsg('Erro: '+e.message);}
}
async function refreshSocial(tab='ranking'){
 for(const id of ['rankingPanel','friendsPanel'])se(id).classList.toggle('hidden',id!==(tab==='ranking'?'rankingPanel':'friendsPanel'));
 try{
  if(tab==='ranking'){
   const people=await Social.leaderboard();
   socialList('rankingList',people.map((p,i)=>socialRow((i+1)+'º '+(p.name||'Jogador')+(p.uid===Social.uid?' (você)':''),(p.points||0)+' pts · '+(p.wins||0)+' vitórias · '+(p.draws||0)+' empates')));
  }else{
   const [friends,requests]=await Promise.all([Social.friends(),Social.requests()]);
   socialList('friendsList',friends.map(f=>socialRow(f.profile?.name||'Jogador',(f.profile?.points||0)+' pontos')));
   socialList('requestsList',requests.map(r=>socialRow(r.fromName||'Jogador','Pedido recebido',async()=>{try{await Social.accept(r.uid);await refreshSocial('friends');}catch(e){socialMsg(e.message);}},'Aceitar')));
  }
 }catch(e){socialMsg('Erro: '+e.message);}
}
se('bRanking').onclick=()=>openSocial('ranking');
se('bFriends').onclick=()=>openSocial('friends');
se('bSocialBack').onclick=()=>{se('social').classList.add('hidden');socialMsg('');};
se('bSocialRank').onclick=()=>refreshSocial('ranking');
se('bSocialFriends').onclick=()=>refreshSocial('friends');
se('bSaveName').onclick=async()=>{try{await Social.saveName(se('profileName').value);socialMsg('Nome atualizado!');}catch(e){socialMsg(e.message);}};
se('bAddFriend').onclick=async()=>{try{await Social.sendRequest(se('friendCode').value);socialMsg('Pedido enviado!');}catch(e){socialMsg(e.message);}};
