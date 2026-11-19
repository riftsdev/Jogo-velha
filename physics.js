// Fisica leve e deterministica (timestep fixo). Usada pelo cliente E pelo servidor.
(function (r) {
  const P = { G: -9.8, V: 13, DT: 1 / 120, BZ: -6, CY: 1.8, MAXYAW: .45, MINP: 0, MAXP: .5, O: [0, 1.4, 0] };
  P.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Integra a bola ate bater no tabuleiro (z = BZ), chao ou parede lateral.
  P.simulate = function (yaw, pitch) {
    yaw = P.clamp(+yaw || 0, -P.MAXYAW, P.MAXYAW); pitch = P.clamp(+pitch || 0, P.MINP, P.MAXP);
    const c = Math.cos(pitch), D = P.DT;
    let vx = P.V * Math.sin(yaw) * c, vy = P.V * Math.sin(pitch), vz = -P.V * Math.cos(yaw) * c;
    let x = P.O[0], y = P.O[1], z = P.O[2], out = null;
    const path = [[x, y, z]];
    const end = (type, px, py, pz, cell) => { path.push([px, py, pz]); out = { type, x: px, y: py, z: pz, cell: cell === undefined ? -1 : cell }; };
    for (let i = 0; i < 720 && !out; i++) {
      vy += P.G * D;
      const nx = x + vx * D, ny = y + vy * D, nz = z + vz * D;
      if (nz <= P.BZ) {
        const k = (P.BZ - z) / (nz - z), hx = x + (nx - x) * k, hy = y + (ny - y) * k;
        const col = Math.floor(hx + 1.5), row = Math.floor(P.CY + 1.5 - hy);
        const ok = col >= 0 && col < 3 && row >= 0 && row < 3;
        end(ok ? 'cell' : 'wall', hx, hy, P.BZ, ok ? row * 3 + col : -1);
      } else if (ny <= 0) { const k = y / (y - ny); end('floor', x + (nx - x) * k, 0, z + (nz - z) * k); }
      else if (Math.abs(nx) >= 6) end('side', Math.sign(nx) * 6, ny, nz);
      else { x = nx; y = ny; z = nz; path.push([x, y, z]); }
    }
    if (!out) end('floor', x, 0, z);
    return { yaw, pitch, path, out, time: (path.length - 1) * D };
  };
  if (typeof module !== 'undefined') module.exports = P; else r.Physics = P;
})(typeof window !== 'undefined' ? window : globalThis);