import * as M from './motor.js';
// todas las posiciones alcanzables no terminales
const vistas = new Map();
(function rec(b) { const k = b.join(','); if (vistas.has(k) || M.ganador(b)) return; vistas.set(k, b.slice());
  for (const i of M.libres(b)) { const c = b.slice(); c[i] = M.turnoDe(b); rec(c); } })(M.vacio());
let n = 0, okRegla = 0, tipos = {}, noOptRegla = [];
for (const b of vistas.values()) {
  n++; const t = M.tipoTurno(b); tipos[t] = (tipos[t] || 0) + 1;
  const r = M.regla(b); if (M.optimas(b).includes(r)) okRegla++; else noOptRegla.push([b.join(''), M.CASILLAS[r], M.veredicto(b, r)]);
}
console.log('posiciones', n, tipos, 'regla óptima', okRegla, '/', n);
const perdidas = noOptRegla.filter(x => x[2] === 'pierde');
console.log('regla: no óptimas', noOptRegla.length, 'de ellas pierden', perdidas.length, perdidas.slice(0, 5));
// regla nunca pierde contra cualquier rival (exhaustivo)
let pierde = 0;
for (const yo of ['X', 'O']) (function rec(b) { const g = M.ganador(b); if (g) { if (g === M.otro(yo)) pierde++; return; }
  if (M.turnoDe(b) === yo) { const c = b.slice(); c[M.regla(b)] = yo; rec(c); }
  else for (const i of M.libres(b)) { const c = b.slice(); c[i] = M.turnoDe(b); rec(c); } })(M.vacio());
console.log('partidas perdidas por la regla en árbol completo:', pierde);
// sanity de preguntas
const b = M.vacio(); b[0] = 'X'; b[4] = 'O'; b[8] = 'X';
for (const m of ['choice', 'score', 'noul']) for (const nv of ['A', 'B', 'C']) {
  const q = M.armarPregunta(b, m, nv); if (m === 'choice' && nv === 'C') console.log(JSON.stringify(q.body).slice(0, 900));
}
console.log(M.libres(b).map(i => [M.CASILLAS[i], M.hechos(b, i).permite_doble_amenaza_rival, M.veredicto(b, i)]));
const s = M.semilla(1); const res = { X: 0, O: 0, empate: 0 };
for (let k = 0; k < 200; k++) { const g = await M.partida({ X: async b => ({ i: M.azar(b, s) }), O: async b => ({ i: M.minimax(b, s) }) }); res[g.ganador]++; }
console.log('azar(X) vs minimax(O)', res);
