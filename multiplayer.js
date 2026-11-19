// Cliente Socket.IO. O script do socket.io so e carregado ao usar o modo Wi-Fi.
const MP = {
  sock: null, sess: null, seat: 0,
  load() {
    return new Promise((ok, no) => {
      if (window.io) return ok();
      const s = document.createElement('script'); s.src = '/socket.io/socket.io.js'; s.onload = ok;
      s.onerror = () => no(new Error('Servidor não encontrado. Abra o jogo pelo endereço do servidor Node (ex.: http://192.168.0.10:3000).'));
      document.head.appendChild(s);
    });
  },
  async connect(h) {
    if (this.sock) return;
    await this.load();
    const s = this.sock = io();
    for (const e of ['state', 'shot', 'timeout', 'closed']) s.on(e, d => h[e](d));
    s.on('connect', () => { if (this.sess) s.emit('rejoin', this.sess, r => { if (r && r.ok) h.back(r); else { this.sess = null; h.closed({ reason: 'Sala encerrada' }); } }); });
    s.on('disconnect', () => h.net());
  },
  create(cb) { this.sock.emit('create', null, r => { if (r.ok) { this.sess = { code: r.code, tok: r.tok }; this.seat = r.seat; } cb(r); }); },
  join(code, cb) { this.sock.emit('join', { code }, r => { if (r.ok) { this.sess = { code: r.code, tok: r.tok }; this.seat = r.seat; } cb(r); }); },
  shoot(yaw, pitch, cb) { this.sock.emit('shoot', { yaw, pitch }, cb); },
  rematch() { this.sock.emit('rematch'); },
  leave() { if (this.sock) { this.sock.emit('leave'); this.sock.disconnect(); } this.sock = null; this.sess = null; }
};