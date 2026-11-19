'use strict';
const Ph = Physics, $ = i => document.getElementById(i), COL = [0x2f7bff, 0xff8a1f], CSSC = ['#2f7bff', '#ff8a1f'], SYM = ['X', 'O'], Z0 = Ph.BZ, STEP = 1 / 120;
const cfg = Object.assign({ sound: true, vib: true, pass: true, low: false }, JSON.parse(localStorage.getItem('ptac3d') || '{}'));
const S = { mode: null, phase: 'menu', turn: 0, me: 0, board: Array(9).fill(null), wins: [0, 0], match: null, end: 0, last: 99, sent: false, fl: null, pend: null, pauseLeft: 0, paused: false, winLine: null, shake: 0, recoil: 0, round: 0 };
const aim = { yaw: 0, pitch: .25 };
const show = i => $(i).classList.remove('hidden'), hide = i => $(i).classList.add('hidden');
const vib = n => { if (cfg.vib && navigator.vibrate) navigator.vibrate(n); };
let tt; function toast(m, ms = 1800) { const e = $('toast'); e.textContent = m; show('toast'); clearTimeout(tt); tt = setTimeout(() => hide('toast'), ms); }
const canAim = () => S.phase === 'turn' && !S.paused && (S.mode === 'local' || S.turn === S.me);
const clampAim = () => { aim.yaw = Ph.clamp(aim.yaw, -Ph.MAXYAW, Ph.MAXYAW); aim.pitch = Ph.clamp(aim.pitch, Ph.MINP, Ph.MAXP); };

/* ---------- Audio (sintetizado, sem arquivos) ---------- */
let AC, NB;
function au() {
  if (AC && AC.state === 'running') return;
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); NB = AC.createBuffer(1, AC.sampleRate / 2, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  AC.resume();
}
['pointerdown', 'touchend', 'click', 'keydown'].forEach(e => addEventListener(e, au));
function tone(f, d, t = 'sine', v = .2, f2 = f, at = 0) {
  if (!cfg.sound || !AC) return; const o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime + at;
  o.type = t; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(f2, n + d);
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + d); o.connect(g); g.connect(AC.destination); o.start(n); o.stop(n + d);
}
function noise(d, fq, v = .3) {
  if (!cfg.sound || !AC) return; const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NB; f.type = 'lowpass'; f.frequency.value = fq; g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d);
  s.connect(f); f.connect(g); g.connect(AC.destination); s.start(); s.stop(AC.currentTime + d);
}
const SND = {
  shoot: () => { tone(600, .15, 'triangle', .25, 120); noise(.1, 3000, .15); },
  splat: () => noise(.25, 900, .4),
  tick: () => tone(880, .1, 'square', .1),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'triangle', .25, f, i * .12)),
  lose: () => tone(300, .4, 'sawtooth', .15, 100)
};

/* ---------- Cena 3D ---------- */
const R = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFShadowMap;
let pr = Math.min(devicePixelRatio || 1, cfg.low ? 1 : 2);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1d3d); scene.fog = new THREE.Fog(0x1a1d3d, 12, 28);
const cam = new THREE.PerspectiveCamera(60, 1, .1, 50); cam.position.set(0, 1.6, .8); scene.add(cam);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a3a70, 1));
const sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(3, 8, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 22 }); scene.add(sun);
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .6, metalness: .1 }, o));
const add = (g, m, x, y, z, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); (p || scene).add(o); return o; };
function tex(draw, w, h, rx, ry) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; }
const floorT = tex(g => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#3a3f7a' : '#2b2f63'; g.fillRect(i * 32, j * 32, 32, 32); } }, 256, 256, 6, 5.5);
const wallT = tex(g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#262b66' : '#1f2358'; g.fillRect(i * 32, 0, 32, 64); } g.fillStyle = '#ff8a1f55'; g.fillRect(0, 50, 256, 6); }, 256, 64, 3, 1);
add(new THREE.PlaneGeometry(12, 11), std(0xffffff, { map: floorT, roughness: .8 }), 0, 0, -.5).rotation.x = -Math.PI / 2;
scene.children[scene.children.length - 1].receiveShadow = true;
add(new THREE.PlaneGeometry(12, 7), std(0xffffff, { map: wallT }), 0, 3.5, Z0 - .15).receiveShadow = true;
add(new THREE.PlaneGeometry(11, 7), std(0x20245a), -6, 3.5, -.5).rotation.y = Math.PI / 2;
add(new THREE.PlaneGeometry(11, 7), std(0x20245a), 6, 3.5, -.5).rotation.y = -Math.PI / 2;
for (const x of [-4.6, 4.6]) for (const z of [-5, -2.2]) { const c = x < 0 ? COL[0] : COL[1]; add(new THREE.BoxGeometry(.6, 2.6, .6), std(c, { emissive: c, emissiveIntensity: .35 }), x, 1.3, z).castShadow = true; }
const B = new THREE.Group(); scene.add(B);
add(new THREE.BoxGeometry(3.6, 3.6, .1), std(0x1e2250), 0, Ph.CY, Z0 - .08, B).castShadow = true;
const cm = std(0xf3f5ff, { roughness: .9 }), cg = new THREE.PlaneGeometry(.94, .94);
for (let i = 0; i < 9; i++) add(cg, cm, i % 3 - 1, Ph.CY + 1 - Math.floor(i / 3), Z0 - .025, B);
const hov = add(cg, new THREE.MeshBasicMaterial({ transparent: true, opacity: .5, color: 0xffffff, depthWrite: false }), 0, 0, Z0 - .02, B); hov.visible = false;
// simbolos
const symM = COL.map(c => std(c, { roughness: .35, emissive: c, emissiveIntensity: .35 })), gX = new THREE.BoxGeometry(.78, .15, .12), gO = new THREE.TorusGeometry(.28, .08,10, 24), gC = new THREE.CircleGeometry(.45, 20);
const splM = COL.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .45 })), sym = Array(9).fill(null);
function place(i, p, anim) {
  const g = new THREE.Group();
  if (p === 0) for (const a of [.785, -.785]) { const m = new THREE.Mesh(gX, symM[0]); m.rotation.z = a; g.add(m); } else g.add(new THREE.Mesh(gO, symM[1]));
  const c = new THREE.Mesh(gC, splM[p]); c.position.z = -.03; g.add(c);
  g.position.set(i % 3 - 1, Ph.CY + 1 - Math.floor(i / 3), Z0 + .04); g.userData.s = anim ? 0 : 1; g.scale.setScalar(anim ? .01 : 1);
  B.add(g); sym[i] = g;
}
function syncBoard(b) { for (let i = 0; i < 9; i++) { if (b[i] !== null && !sym[i]) place(i, b[i], false); else if (b[i] === null && sym[i]) { B.remove(sym[i]); sym[i] = null; } } S.board = b.slice(); }
// arma em primeira pessoa
const gun = new THREE.Group(); cam.add(gun); gun.position.set(.3, -.28, -.6);
const gm = std(0x2a2d4f, { metalness: .5, roughness: .3 }), tank = new THREE.MeshStandardMaterial({ color: COL[0], emissive: COL[0], emissiveIntensity: .4, roughness: .3 });
add(new THREE.CylinderGeometry(.04, .05, .55, 12), gm, 0, 0, -.2, gun).rotation.x = Math.PI / 2;
add(new THREE.BoxGeometry(.12, .16, .3), gm, 0, -.03, .05, gun); add(new THREE.SphereGeometry(.1, 14, 10), tank, 0, .1, .02, gun); add(new THREE.BoxGeometry(.08, .2, .1), gm, 0, -.15, .12, gun);
// bola, trajetoria
const ballM = COL.map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .5, roughness: .3 })), ball = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), ballM[0]); ball.visible = false; scene.add(ball);
const NP = 36, pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: .09, transparent: true, opacity: .8 })); pts.frustumCulled = false; scene.add(pts);
// particulas (um InstancedMesh reutilizavel) e decalques de tinta
const NPA = 160, pm = new THREE.InstancedMesh(new THREE.SphereGeometry(.05, 6, 4), new THREE.MeshBasicMaterial(), NPA), pp = [], dm = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0), tc = new THREE.Color(); let pi = 0;
for (let i = 0; i < NPA; i++) { pp.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), l: 0, s: 1 }); pm.setMatrixAt(i, zero); pm.setColorAt(i, tc.setHex(0xffffff)); }
pm.frustumCulled = false; scene.add(pm);
function burst(x, y, z, c, n, sp) {
  for (let k = 0; k < n; k++) { const q = pp[pi = (pi + 1) % NPA]; q.p.set(x, y, z); q.v.set((Math.random() - .5) * sp, (Math.random() - .2) * sp, Math.random() * sp * .8); q.l = .7 + Math.random() * .6; q.s = .6 + Math.random() * 1.2; pm.setColorAt(pi, tc.setHex(Array.isArray(c) ? c[k % c.length] : c)); }
  pm.instanceColor.needsUpdate = true;
}
function stepP(dt) { for (const q of pp) { if (q.l <= 0) continue; q.l -= dt; q.v.y -= 9.8 * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0) { q.p.y = 0; q.v.set(0, 0, 0); } if (q.p.z < Z0) { q.p.z = Z0; q.v.set(0, q.v.y * .2, 0); } } }
function drawP() { for (let i = 0; i < NPA; i++) { const q = pp[i]; if (q.l > 0) { dm.position.copy(q.p); dm.scale.setScalar(q.s * Math.min(1, q.l * 3)); dm.updateMatrix(); pm.setMatrixAt(i, dm.matrix); } else pm.setMatrixAt(i, zero); } pm.instanceMatrix.needsUpdate = true; }
const ND = 24, dec = [], dg = new THREE.CircleGeometry(.3, 18); let di = 0;
for (let i = 0; i < ND; i++) { const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ transparent: true, opacity: .75, depthWrite: false })); m.visible = false; scene.add(m); dec.push(m); }
function decal(o, c) {
  const m = dec[di = (di + 1) % ND]; m.material.color.setHex(c); m.visible = true; m.scale.setScalar(.6 + Math.random() * .9); m.rotation.set(0, 0, 0);
  if (o.type === 'floor') { m.rotation.x = -Math.PI / 2; m.position.set(o.x, .012, o.z); } else if (o.type === 'side') { m.rotation.y = o.x > 0 ? -Math.PI / 2 : Math.PI / 2; m.position.set(o.x - Math.sign(o.x) * .012, o.y, o.z); } else m.position.set(o.x, o.y, Z0 + .012);
}
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h; R.setPixelRatio(pr); R.setSize(w, h, false); cam.aspect = a;
  cam.fov = Math.min(100, Math.max(60, 2 * Math.atan(2.6 / (6.8 * a)) * 180 / Math.PI)); cam.updateProjectionMatrix();
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200)); resize();

/* ---------- Fluxo da partida ---------- */
const names = () => S.mode === 'online' ? [S.me === 0 ? 'Você' : 'Oponente', S.me === 1 ? 'Você' : 'Oponente'] : ['Jogador 1', 'Jogador 2'];
function updHUD() {
  const n = names(); for (let i = 0; i < 2; i++) { $('n' + i).textContent = n[i]; $('s' + i).textContent = S.wins[i]; $('c' + i).classList.toggle('on', S.turn === i && S.phase !== 'over'); }
  $('banner').textContent = S.mode === 'local' ? `Vez de ${n[S.turn]} · ${SYM[S.turn]}` : (S.turn === S.me ? 'Sua vez · atire!' : 'Vez do oponente');
  document.documentElement.style.setProperty('--pc', CSSC[S.turn]); tank.color.setHex(COL[S.turn]); tank.emissive.setHex(COL[S.turn]); $('fire').disabled = !canAim();
}
function go(id) { document.querySelectorAll('.scr').forEach(e => e.classList.add('hidden')); ['pass', 'pause', 'result', 'toast'].forEach(hide); if (id === 'game') show('hud'); else { hide('hud'); show(id); } }
function resetBoard() { for (let i = 0; i < 9; i++) if (sym[i]) { B.remove(sym[i]); sym[i] = null; } dec.forEach(d => d.visible = false); S.board = Array(9).fill(null); S.winLine = null; S.turn = 0; S.fl = null; S.pend = null; ball.visible = false; }
function startTurn(ms) { S.phase = 'turn'; S.sent = false; S.paused = false; S.end = performance.now() + ms; S.last = 99; updHUD(); }
function startLocal() { S.mode = 'local'; S.match = new Match(); S.wins = [0, 0]; S.round = 0; resetBoard(); go('game'); startTurn(10000); }
function nextLocal() {
  if (cfg.pass) { S.phase = 'pass'; $('passT').textContent = `Vez de ${names()[S.turn]} (${SYM[S.turn]})`; $('pass').style.setProperty('--pc', CSSC[S.turn]); show('pass'); updHUD(); } else startTurn(10000);
}
function fire() {
  if (!canAim() || S.sent) return; S.sent = true;
  if (S.mode === 'local') { const r = S.match.shoot(S.turn, aim.yaw, aim.pitch); if (!r) { S.sent = false; return; } fly(r); }
  else MP.shoot(aim.yaw, aim.pitch, ok => { if (!ok) S.sent = false; });
}
function fly(r) {
  const s = Ph.simulate(r.yaw, r.pitch); S.phase = 'flight'; S.sent = true; S.turn = r.player;
  S.fl = { r, path: s.path, out: s.out, t: 0 }; ball.material = ballM[r.player]; ball.visible = true; S.recoil = 1; S.shake = .6; SND.shoot(); vib(15); updHUD();
}
function stepFlight(dt) {
  const f = S.fl; if (!f) return; f.t += dt; const k = f.t / Ph.DT, i = Math.floor(k), P = f.path;
  if (i >= P.length - 1) return land(f);
  const a = P[i], b = P[i + 1], u = k - i; ball.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
}
function land(f) {
  ball.visible = false; S.fl = null; const o = f.out, r = f.r, c = COL[r.player];
  burst(o.x, o.y, o.z, c, r.claimed ? 44 : 30, 4); SND.splat(); vib(30); S.shake = .3;
  if (r.claimed) { S.board[r.cell] = r.player; place(r.cell, r.player, true); } else { decal(o, c); toast(o.type === 'cell' ? 'Célula ocupada! Turno perdido' : 'Errou! Turno perdido', 1200); }
  setTimeout(() => after(r), 700);
}
function after(r) {
  if (!S.mode) return;
  if (S.mode === 'local') {
    if (r.over) { if (r.winner !== null) S.wins[r.winner]++; return finish(r.winner, r.line, r.reason); }
    S.turn = S.match.turn; S.phase = 'wait'; nextLocal();
  } else { S.phase = 'wait'; if (S.pend) { const p = S.pend; S.pend = null; applyState(p); } }
}
function localTimeout() {
  const t = S.match.timeout(); S.phase = 'wait'; toast('⏰ Tempo esgotado!'); SND.lose();
  if (t.over) return finish(null, null, 'timeout'); S.turn = S.match.turn; nextLocal();
}
function finish(w, line, reason) {
  S.phase = 'over'; S.winLine = line; updHUD(); let t, sub; const me = S.mode === 'online' ? S.me : -1;
  if (w === null) { t = '🤝 Empate!'; sub = reason === 'timeout' ? 'Dois turnos seguidos sem jogar: partida encerrada como empate.' : 'Tabuleiro cheio sem linha vencedora.'; SND.lose(); }
  else { t = S.mode === 'local' ? `🏆 ${names()[w]} venceu!` : (w === me ? '🏆 Você venceu!' : '😵 Você perdeu'); sub = `Linha de ${SYM[w]} completa`; SND.win(); burst(0, Ph.CY + 1.6, Z0 + .2, [COL[w], 0xffffff, 0xffd400], 120, 7); }
  $('bAgain').textContent = 'Jogar novamente';
  setTimeout(() => { if (S.phase !== 'over') return; $('rT').textContent = t; $('rS').textContent = sub; show('result'); }, w === null ? 300 : 1200);
}
function leave() { if (S.mode === 'online') MP.leave(); S.mode = null; S.phase = 'menu'; S.paused = false; resetBoard(); go('menu'); }
function tick(now) {
  if (S.phase !== 'turn' || S.paused) return;
  const left = Math.max(0, (S.end - now) / 1000), sec = Math.ceil(left);
  if (sec !== S.last) { S.last = sec; $('timer').textContent = sec; $('timer').classList.toggle('warn', sec <= 3); if (sec <= 3 && sec > 0) { SND.tick(); vib(10); } }
  if (left <= 0 && S.mode === 'local') localTimeout();
}

/* ---------- Online ---------- */
function applyState(s) {
  if (!S.mode) return; S.turn = s.turn; S.wins = s.wins; syncBoard(s.board);
  if (s.phase === 'waiting') return;
  if ($('hud').classList.contains('hidden')) go('game');
  if (s.phase === 'turn') { hide('result'); hide('toast'); S.winLine = null; startTurn(s.remain); }
  else if (s.phase === 'paused') { S.phase = 'paused'; updHUD(); toast('Oponente desconectado… aguardando reconexão', 60000); }
  else if (s.phase === 'over') finish(s.winner, s.line, s.reason);
}
const H = {
  state: s => { if (S.phase === 'flight') S.pend = s; else applyState(s); },
  shot: r => fly(r),
  timeout: d => { toast(d.player === S.me ? '⏰ Seu tempo esgotou!' : '⏰ Tempo do oponente esgotou'); SND.lose(); },
  closed: d => { toast(d.reason, 3000); leave(); },
  back: r => { S.me = r.seat; toast('Reconectado', 1200); },
  net: () => { if (S.mode === 'online') toast('Conexão perdida. Reconectando…', 4000); }
};
const lobMsg = m => $('lobMsg').textContent = m || '';
$('bCreate').onclick = async () => {
  lobMsg('Conectando…'); S.mode = 'online';
  try { await MP.connect(H); } catch (e) { S.mode = null; return lobMsg(e.message); }
  MP.create(r => { if (!r.ok) return lobMsg(r.error); S.me = r.seat; S.wins = [0, 0]; $('code').textContent = r.code; $('qr').src = '/qr?u=' + encodeURIComponent(location.origin + '/?room=' + r.code); show('roomBox'); lobMsg(''); });
};
$('bJoin').onclick = async () => {
  const c = $('inCode').value.trim().toUpperCase(); if (c.length !== 6) return lobMsg('O código tem 6 caracteres'); lobMsg('Conectando…'); S.mode = 'online';
  try { await MP.connect(H); } catch (e) { S.mode = null; return lobMsg(e.message); }
  MP.join(c, r => { if (!r.ok) { lobMsg(r.error); MP.leave(); S.mode = null; return; } S.me = r.seat; S.wins = [0, 0]; lobMsg('Entrou! Iniciando…'); });
};

/* ---------- UI ---------- */
$('bLocal').onclick = startLocal;
$('bMulti').onclick = () => { lobMsg(''); hide('roomBox'); go('lobby'); };
$('bLobBack').onclick = () => { if (S.mode === 'online') leave(); else go('menu'); go('menu'); };
$('bSet').onclick = () => go('set'); $('bSetBack').onclick = () => go('menu');
$('bTut').onclick = () => go('tut'); $('bTutBack').onclick = () => go('menu');
for (const [id, k] of [['oSound', 'sound'], ['oVib', 'vib'], ['oPass', 'pass'], ['oLow', 'low']]) {
  $(id).checked = cfg[k]; $(id).onchange = () => { cfg[k] = $(id).checked; localStorage.setItem('ptac3d', JSON.stringify(cfg)); if (k === 'low') { pr = Math.min(devicePixelRatio || 1, cfg.low ? 1 : 2); resize(); } };
}
$('pass').onclick = () => { hide('pass'); startTurn(10000); };
$('bPause').onclick = () => { if (S.phase === 'over' || S.phase === 'menu') return; if (S.mode === 'local' && S.phase === 'turn' && !S.paused) { S.paused = true; S.pauseLeft = S.end - performance.now(); } show('pause'); };
$('bResume').onclick = () => { hide('pause'); if (S.paused) { S.paused = false; S.end = performance.now() + S.pauseLeft; } };
$('bQuit').onclick = () => leave(); $('bMenu').onclick = () => leave();
$('bAgain').onclick = () => {
  if (S.mode === 'local') { S.round++; S.match.reset(); S.match.turn = S.round % 2; const t = S.match.turn; resetBoard(); S.turn = t; hide('result'); startTurn(10000); }
  else { MP.rematch(); $('bAgain').textContent = 'Aguardando oponente…'; }
};
$('fire').addEventListener('pointerdown', e => { e.preventDefault(); au(); fire(); });
const cv = $('c'); let drag = null;
cv.addEventListener('pointerdown', e => { au(); if (e.pointerType === 'mouse') { if (e.button === 0) fire(); return; } drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
cv.addEventListener('pointermove', e => {
  if (!canAim()) return;
  if (e.pointerType === 'mouse') { aim.yaw = (e.clientX / innerWidth - .5) * 2 * Ph.MAXYAW; aim.pitch = Ph.MINP + (1 - e.clientY / innerHeight) * (Ph.MAXP - Ph.MINP); }
  else if (drag) { aim.yaw += (e.clientX - drag.x) * .0035; aim.pitch -= (e.clientY - drag.y) * .0035; drag = { x: e.clientX, y: e.clientY }; clampAim(); }
});
['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => drag = null));
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); fire(); }
  const d = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, .015], ArrowDown: [0, -.015] }[e.code]; if (d) { aim.yaw += d[0]; aim.pitch += d[1]; clampAim(); }
});

/* ---------- Loop (timestep fixo para fisica; render livre) ---------- */
const v3 = new THREE.Vector3(), ret = $('ret'); let prev = performance.now(), acc = 0, fa = 0, fn = 0;
function preview() {
  const on = canAim(); pts.visible = on; hov.visible = false; ret.style.display = on ? 'block' : 'none'; if (!on) return;
  const s = Ph.simulate(aim.yaw, aim.pitch), P = s.path, a = pg.attributes.position.array, o = s.out;
  for (let i = 0; i < NP; i++) { const p = P[Math.round(i * (P.length - 1) / (NP - 1))]; a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; }
  pg.attributes.position.needsUpdate = true;
  if (o.type === 'cell' && S.board[o.cell] === null) { hov.visible = true; hov.position.set(o.cell % 3 - 1, Ph.CY + 1 - Math.floor(o.cell / 3), Z0 - .02); hov.material.color.setHex(COL[S.turn]); }
  v3.set(o.x, o.y, o.z).project(cam); ret.style.transform = `translate(${(v3.x + 1) / 2 * innerWidth}px,${(1 - v3.y) / 2 * innerHeight}px)`;
}
function frame(dt, t) {
  tick(t); preview();
  S.recoil = Math.max(0, S.recoil - dt * 5); gun.position.z = -.6 + S.recoil * .15; gun.rotation.set(aim.pitch * .5 - .1, -aim.yaw * .6, 0);
  S.shake = Math.max(0, S.shake - dt * 4); cam.position.set((Math.random() - .5) * S.shake * .04, 1.6 + (Math.random() - .5) * S.shake * .04, .8); cam.lookAt(0, 1.75, Z0);
  sym.forEach((g, i) => {
    if (!g) return; let s = g.userData.s;
    if (s < 1) { s = g.userData.s = Math.min(1, s + dt * 4); const k = s - 1; g.scale.setScalar(Math.max(.01, 1 + 2.7 * k * k * k + 1.7 * k * k)); }
    else if (S.winLine && S.winLine.includes(i)) g.scale.setScalar(1.15 + .15 * Math.sin(t * .01));
    else if (g.scale.x !== 1) g.scale.setScalar(1);
  });
  drawP();
  if (!document.hidden && ++fn === 90) { if (90 / fa < 42 && pr > 1) { pr = Math.max(1, pr - .25); resize(); } fa = 0; fn = 0; }
}
function loop(t) {
  requestAnimationFrame(loop); const dt = Math.min((t - prev) / 1000, .1); prev = t; acc += dt; fa += dt;
  while (acc >= STEP) { stepFlight(STEP); stepP(STEP); acc -= STEP; }
  frame(dt, t); R.render(scene, cam);
}
requestAnimationFrame(loop);
const qp = new URLSearchParams(location.search).get('room');
if (qp) { go('lobby'); $('inCode').value = qp.toUpperCase().slice(0, 6); setTimeout(() => $('bJoin').click(), 150); }