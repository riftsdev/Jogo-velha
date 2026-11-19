// Regras do jogo (sem DOM, sem timers). Usado no modo local e no servidor.
(function (r) {
  const P = r.Physics || require('./physics.js');
  const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  class Match {
    constructor() { this.reset(); }
    reset() { this.board = Array(9).fill(null); this.turn = 0; this.timeouts = 0; this.over = false; this.winner = null; this.line = null; this.reason = null; }
    // Errar ou acertar celula ocupada gasta o turno.
    shoot(p, yaw, pitch) {
      if (this.over || p !== this.turn) return null;
      const s = P.simulate(yaw, pitch), o = s.out; let cell = -1;
      if (o.type === 'cell' && this.board[o.cell] === null) { cell = o.cell; this.board[cell] = p; }
      this.timeouts = 0;
      for (const l of L) if (l.every(i => this.board[i] === p)) { this.over = true; this.winner = p; this.line = l; this.reason = 'line'; }
      if (!this.over && this.board.every(c => c !== null)) { this.over = true; this.reason = 'full'; }
      if (!this.over) this.turn = 1 - p;
      return { player: p, yaw: s.yaw, pitch: s.pitch, cell, claimed: cell >= 0, flight: s.time, over: this.over, winner: this.winner, line: this.line, reason: this.reason };
    }
    // Regra anunciada: 2 turnos seguidos perdidos por tempo = empate.
    timeout() {
      if (this.over) return null;
      const p = this.turn;
      if (++this.timeouts >= 2) { this.over = true; this.reason = 'timeout'; } else this.turn = 1 - p;
      return { player: p, over: this.over, reason: this.reason };
    }
  }
  if (typeof module !== 'undefined') module.exports = Match; else r.Match = Match;
})(typeof window !== 'undefined' ? window : globalThis);