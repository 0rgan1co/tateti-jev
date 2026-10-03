// Runner de corridas: Jev (3 primitivas × 3 niveles de state) contra azar y minimax, más controles sin IA.
// Uso: node correr.mjs --piloto | --completo | --variab | --controles  [--n=50] [--conc=8] [--limite=1]
import fs from 'node:fs';
import * as M from './motor.js';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k)); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const N = +arg('n', arg('piloto') ? 5 : 50), CONC = +arg('conc', 8), LIMITE = +arg('limite', 1);
const RIVALES = arg('piloto') ? ['minimax'] : ['azar', 'minimax'];
const MODOS = ['choice', 'score', 'noul'], NIVELES = ['A', 'B', 'C'];
let env = ''; try { env = fs.readFileSync(process.env.HOME + '/.secrets/openrouter.env', 'utf8'); } catch {}
const KEY = env.match(/OPENROUTER_API_KEY\s*=\s*['"]?([^'"\s]+)/)?.[1];
let gasto = 0, llamadas = 0;
const log = fs.createWriteStream('turnos.jsonl', { flags: 'a' });

async function decidir(body) {
  if (gasto > LIMITE) throw new Error(`LIMITE de gasto alcanzado: US$ ${gasto.toFixed(4)}`);
  const t0 = Date.now();
  const r = await fetch('https://openrouter.ai/api/alpha/decisions', { method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'X-Title': 'Tateti Jev' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  llamadas++; gasto += j.usage?.cost || 0;
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return { j, ms: Date.now() - t0 };
}
// jugador Jev: valida; si la respuesta es inválida, reintenta una vez; si vuelve a fallar, azar (registrado)
const jugadorJev = (modo, nivel, meta) => async b => {
  const q = M.armarPregunta(b, modo, nivel);
  let intentos = 0, costo = 0, ms = 0, ultimo = null;
  while (intentos < 2) {
    intentos++;
    try {
      const { j, ms: t } = await decidir(q.body); ms += t; costo += j.usage?.cost || 0; ultimo = j.answers;
      const e = q.elegir(j.answers);
      if (e && !b[e.i]) {
        const info = { modo, nivel, st: JSON.parse(q.body.state), qs: q.body.questions, ans: j.answers, p: e.p, valores: e.valores, ms, costo, intentos, fallback: false };
        log.write(JSON.stringify({ ...meta, tablero: b.map(x => x || '-').join(''), casilla: M.CASILLAS[e.i], optima: M.optimas(b).includes(e.i), tipo: M.tipoTurno(b), ms, costo, p: e.p }) + '\n');
        return { i: e.i, info };
      }
    } catch (err) { if (String(err).includes('LIMITE')) throw err; ultimo = String(err); }
  }
  const i = M.azar(b);
  return { i, info: { modo, nivel, st: JSON.parse(q.body.state), qs: q.body.questions, ans: ultimo, ms, costo, intentos, fallback: true } };
};
const ctrl = { azar: (s) => async b => ({ i: M.azar(b, s) }), minimax: (s) => async b => ({ i: M.minimax(b, s) }), regla: () => async b => ({ i: M.regla(b) }) };

async function pool(tareas, n) { const out = []; let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < tareas.length) { const t = k++; out[t] = await tareas[t](); } })); return out; }

function resumir(nombre, partidas) {
  const r = { config: nombre, partidas: partidas.length, porRival: {}, turnos: 0, opt: {}, llamadas: 0, costo: 0, ms: [], dudosas: 0, fallbacks: 0, reintentos: 0 };
  for (const g of partidas) {
    const pr = (r.porRival[g.rival] ||= { G: 0, E: 0, P: 0 });
    pr[g.ganador === 'empate' ? 'E' : g.ganador === g.jev ? 'G' : 'P']++;
    for (const t of g.turnos.filter(t => t.p === g.jev)) {
      r.turnos++; const o = (r.opt[t.tipo] ||= { n: 0, ok: 0 }); o.n++; if (t.optima) o.ok++;
      if (t.info) { r.costo += t.info.costo || 0; r.llamadas += t.info.intentos || 0; if (t.info.ms) r.ms.push(t.info.ms);
        if (t.info.fallback) r.fallbacks++; if (t.info.intentos > 1) r.reintentos++; if (t.info.p != null && t.info.p < 0.6 && t.info.modo === 'choice') r.dudosas++; }
    }
  }
  r.ms.sort((a, b) => a - b); r.ms_p50 = r.ms[Math.floor(r.ms.length / 2)] || 0; r.ms_prom = r.ms.length ? Math.round(r.ms.reduce((a, b) => a + b, 0) / r.ms.length) : 0; delete r.ms;
  r.costo = +r.costo.toFixed(6);
  return r;
}

async function correrConfig(nombre, crearJev) {
  const tareas = [];
  for (const rival of RIVALES) for (let k = 0; k < N; k++) tareas.push(async () => {
    const s = M.semilla(1000 + k * 7 + (rival === 'azar' ? 1 : 0)), jev = k % 2 === 0 ? 'X' : 'O';
    const meta = { config: nombre, rival, k };
    const g = await M.partida({ [jev]: crearJev(meta, s), [M.otro(jev)]: ctrl[rival](s) });
    return { ...g, rival, jev, config: nombre };
  });
  const t0 = Date.now(); const ps = await pool(tareas, CONC);
  const r = resumir(nombre, ps); r.seg = Math.round((Date.now() - t0) / 1000);
  console.log(JSON.stringify(r)); return { r, ps };
}

async function main() {
  const salida = arg('out', arg('piloto') ? 'piloto.json' : arg('controles') ? 'controles.json' : arg('variab') ? 'variab.json' : 'completo.json');
  const res = { fecha: new Date().toISOString(), N, rivales: RIVALES, configs: [], ejemplos: {} };
  if (arg('controles')) {
    for (const c of ['azar', 'minimax', 'regla']) { const { r, ps } = await correrConfig('control:' + c, (m, s) => ctrl[c](s)); res.configs.push(r); res.ejemplos[r.config] = ps.find(p => p.rival === 'minimax'); }
  } else if (arg('variab')) {
    // 20 estados difíciles fijos × 9 configs × 3 repeticiones
    const vistas = new Map();
    (function rec(b) { const k = b.join(','); if (vistas.has(k) || M.ganador(b)) return; vistas.set(k, b.slice());
      for (const i of M.libres(b)) { const c = b.slice(); c[i] = M.turnoDe(b); rec(c); } })(M.vacio());
    const s = M.semilla(42), dif = [...vistas.values()].filter(b => M.tipoTurno(b) === 'dificil');
    const set = Array.from({ length: 20 }, () => dif.splice(Math.floor(s() * dif.length), 1)[0]);
    for (const modo of MODOS) for (const nivel of NIVELES) {
      const filas = await pool(set.map((b, n) => async () => {
        const reps = []; for (let k = 0; k < 3; k++) { const x = await jugadorJev(modo, nivel, { config: `${modo}/${nivel}`, var: n, rep: k })(b); reps.push(x.i); }
        return { tablero: b.join(','), reps, optimas: reps.map(i => M.optimas(b).includes(i)), iguales: new Set(reps).size === 1 };
      }), CONC);
      const r = { config: `${modo}/${nivel}`, estados: 20, mismas_3_veces: filas.filter(f => f.iguales).length,
        optimas: filas.reduce((a, f) => a + f.optimas.filter(Boolean).length, 0), de: 60, filas };
      console.log(r.config, 'iguales', r.mismas_3_veces, '/20 · óptimas', r.optimas, '/60'); res.configs.push(r);
    }
  } else {
    for (const modo of MODOS) for (const nivel of NIVELES) {
      const { r, ps } = await correrConfig(`${modo}/${nivel}`, (meta) => jugadorJev(modo, nivel, meta));
      res.configs.push(r);
      // ejemplo para "¿Por qué pasó?": una partida contra minimax, preferí una con error de Jev si existe
      const mm = ps.filter(p => p.rival === 'minimax');
      res.ejemplos[r.config] = mm.find(p => p.turnos.some(t => t.p === p.jev && !t.optima)) || mm[0];
    }
  }
  res.gasto = +gasto.toFixed(6); res.llamadas = llamadas;
  fs.writeFileSync(salida, JSON.stringify(res));
  console.log(`LISTO ${salida} · llamadas ${llamadas} · gasto US$ ${gasto.toFixed(4)}`);
  log.end();
}
main().catch(e => { console.error('ERROR', e); fs.writeFileSync('ERROR.txt', String(e)); process.exit(1); });
