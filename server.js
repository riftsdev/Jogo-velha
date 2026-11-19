// Servidor autoritativo: salas, turnos, tempo, regras e resultado.
const express = require('express'), http = require('http'), os = require('os'), crypto = require('crypto');
const { Server } = require('socket.io'), QR = require('qrcode'), Match = require('./game.js');
const TURN = 10000, GRACE = 500, ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rooms = new Map();
const app = express(); app.use(express.static(__dirname));
app.get('/qr', async (q, s) => { try { s.type('png').send(await QR.toBuffer(String(q.query.u || '').slice(0, 300), { margin: 1, width: 240 })); } catch (e) { s.sendStatus(400); } });
const srv = http.createServer(app), io = new Server(srv);
const emit = (r, e, d) => io.to(r.code).emit(e, d);
const allOn = r => r.seats.length === 2 && r.seats.every(x => x.on);
const snap = r => ({ code: r.code, phase: r.phase, board: r.m.board, turn: r.m.turn, remain: Math.max(0, r.dl - Date.now()), winner: r.m.winner, line: r.m.line, reason: r.m.reason, wins: r.wins });
function startTurn(r) {
  clearTimeout(r.t); r.phase = 'turn'; r.dl = Date.now() + TURN;
  r.t = setTimeout(() => { const x = r.m.timeout(); if (!x) return; emit(r, 'timeout', { player: x.player }); r.m.over ? end(r) : startTurn(r); }, TURN + GRACE);
  emit(r, 'state', snap(r));
}
function end(r) { clearTimeout(r.t); r.phase = 'over'; r.rm = [false, false]; if (r.m.winner !== null) r.wins[r.m.winner]++; emit(r, 'state', snap(r)); }
function resume(r) { clearTimeout(r.gc); if (r.phase === 'over' || r.phase === 'flight') emit(r, 'state', snap(r)); else startTurn(r); }
const tok = () => crypto.randomBytes(8).toString('hex');
io.on('connection', s => {
  s.data = {};
  const R = () => rooms.get(s.data.code);
  s.on('create', (_, ack) => {
    let c; do { c = Array.from({ length: 6 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join(''); } while (rooms.has(c));
    const t = tok(), r = { code: c, m: new Match(), seats: [{ id: s.id, tok: t, on: true }], phase: 'waiting', dl: 0, wins: [0, 0], rm: [false, false], round: 0 };
    rooms.set(c, r); s.data = { code: c, seat: 0 }; s.join(c); ack({ ok: true, code: c, tok: t, seat: 0 });
  });
  s.on('join', (d, ack) => {
    const c = String((d && d.code) || '').toUpperCase(), r = rooms.get(c);
    if (!r) return ack({ ok: false, error: 'Sala não encontrada' });
    if (r.seats.length >= 2) return ack({ ok: false, error: 'Sala cheia' });
    const t = tok(); r.seats.push({ id: s.id, tok: t, on: true }); s.data = { code: c, seat: 1 }; s.join(c);
    ack({ ok: true, code: c, tok: t, seat: 1 }); startTurn(r);
  });
  s.on('rejoin', (d, ack) => {
    const r = rooms.get(d && d.code), i = r ? r.seats.findIndex(x => x.tok === d.tok) : -1;
    if (i < 0) return ack({ ok: false });
    r.seats[i].id = s.id; r.seats[i].on = true; s.data = { code: r.code, seat: i }; s.join(r.code);
    ack({ ok: true, seat: i }); if (allOn(r)) resume(r);
  });
  s.on('shoot', (d, ack) => {
    const r = R(), ok = v => typeof ack === 'function' && ack(v);
    if (!r || r.phase !== 'turn' || s.data.seat !== r.m.turn || Date.now() > r.dl + GRACE || !d || !isFinite(d.yaw) || !isFinite(d.pitch)) return ok(false);
    clearTimeout(r.t);
    const x = r.m.shoot(s.data.seat, +d.yaw, +d.pitch); if (!x) return ok(false);
    r.phase = 'flight'; ok(true); emit(r, 'shot', x);
    setTimeout(() => {
      if (!rooms.has(r.code)) return;
      if (r.m.over) end(r); else if (allOn(r)) startTurn(r); else { r.phase = 'paused'; emit(r, 'state', snap(r)); }
    }, Math.ceil(x.flight * 1000) + 900);
  });
  s.on('rematch', () => {
    const r = R(); if (!r || r.phase !== 'over') return;
    r.rm[s.data.seat] = true;
    if (r.rm[0] && r.rm[1]) { r.m.reset(); r.m.turn = ++r.round % 2; startTurn(r); }
  });
  s.on('leave', () => {
    const r = R(); if (!r) return;
    s.leave(r.code); clearTimeout(r.t); clearTimeout(r.gc); rooms.delete(r.code);
    io.to(r.code).emit('closed', { reason: 'O oponente saiu da sala' }); s.data = {};
  });
  s.on('disconnect', () => {
    const r = R(); if (!r) return;
    const seat = r.seats[s.data.seat]; if (!seat || seat.id !== s.id) return;
    seat.on = false;
    if (r.phase === 'turn') { clearTimeout(r.t); r.phase = 'paused'; }
    emit(r, 'state', snap(r));
    clearTimeout(r.gc); r.gc = setTimeout(() => { emit(r, 'closed', { reason: 'Sala encerrada por inatividade' }); rooms.delete(r.code); }, 60000);
  });
});
const PORT = process.env.PORT || 3000;
srv.listen(PORT, '0.0.0.0', () => {
  console.log('PAINT TAC 3D rodando. Abra nos celulares (mesma rede Wi-Fi):');
  for (const l of Object.values(os.networkInterfaces())) for (const a of l) if (a.family === 'IPv4' && !a.internal) console.log('  http://' + a.address + ':' + PORT);
});