// Motor de ta-te-ti × Jev — compartido entre la página y el runner (ES module, sin dependencias).
// Principio: el código calcula (reglas, hechos, minimax), Jev decide.

export const CASILLAS = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3']; // letra = fila (a arriba), número = columna
export const LINEAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export const POS = i => (i === 4 ? 'centro' : [0, 2, 6, 8].includes(i) ? 'esquina' : 'borde');
export const otro = p => (p === 'X' ? 'O' : 'X');
export const vacio = () => Array(9).fill('');
export const libres = b => b.reduce((a, v, i) => (v ? a : (a.push(i), a)), []);
export const turnoDe = b => (b.filter(Boolean).length % 2 === 0 ? 'X' : 'O');

export function ganador(b) {
  for (const [x, y, z] of LINEAS) if (b[x] && b[x] === b[y] && b[y] === b[z]) return b[x];
  return b.every(Boolean) ? 'empate' : null;
}
const con = (b, i, p) => { const c = b.slice(); c[i] = p; return c; };
// casillas donde p gana jugando ya
export const victoriasDe = (b, p) => libres(b).filter(i => ganador(con(b, i, p)) === p);

// ---------- minimax exacto (memo) ----------
const memo = new Map();
// valor desde el punto de vista de X: +1 gana X, 0 empate, -1 gana O (con juego perfecto)
export function valor(b) {
  const k = b.join(',');
  if (memo.has(k)) return memo.get(k);
  const g = ganador(b);
  let v;
  if (g === 'X') v = 1; else if (g === 'O') v = -1; else if (g === 'empate') v = 0;
  else {
    const p = turnoDe(b), hijos = libres(b).map(i => valor(con(b, i, p)));
    v = p === 'X' ? Math.max(...hijos) : Math.min(...hijos);
  }
  memo.set(k, v);
  return v;
}
// jugadas óptimas para quien mueve (las que conservan el mejor resultado posible)
export function optimas(b) {
  const p = turnoDe(b), vs = libres(b).map(i => [i, valor(con(b, i, p))]);
  const mejor = p === 'X' ? Math.max(...vs.map(x => x[1])) : Math.min(...vs.map(x => x[1]));
  return vs.filter(x => x[1] === mejor).map(x => x[0]);
}
// resultado esperado (para quien mueve) de jugar i: 'gana' | 'empata' | 'pierde'
export function veredicto(b, i) {
  const p = turnoDe(b), v = valor(con(b, i, p)) * (p === 'X' ? 1 : -1);
  return v > 0 ? 'gana' : v < 0 ? 'pierde' : 'empata';
}

// ---------- hechos que calcula el código, por casilla libre ----------
export function hechos(b, i) {
  const yo = turnoDe(b), rv = otro(yo), d = con(b, i, yo);
  const gana_ya = ganador(d) === yo;
  const rivalGana = victoriasDe(b, rv);
  const bloquea_victoria_rival = rivalGana.includes(i);
  const misAmenazas = gana_ya ? [] : victoriasDe(d, yo);
  const crea_amenaza = misAmenazas.length >= 1;
  const arma_doble_amenaza = misAmenazas.length >= 2;
  // ¿le permite al rival armar una doble amenaza en su próxima jugada?
  // si mi jugada crea una amenaza, el rival está obligado a bloquear: solo cuentan esas respuestas.
  let permite_doble_amenaza_rival = false, deja_ganar_al_rival = false;
  if (!gana_ya && !ganador(d)) {
    deja_ganar_al_rival = victoriasDe(d, rv).length > 0;
    const respuestas = misAmenazas.length === 1 ? misAmenazas : misAmenazas.length >= 2 ? [] : libres(d);
    if (!deja_ganar_al_rival)
      permite_doble_amenaza_rival = respuestas.some(r => {
        const e = con(d, r, rv);
        return !ganador(e) && victoriasDe(e, rv).length >= 2 && victoriasDe(e, yo).length === 0;
      });
  }
  const lineas_abiertas = LINEAS.filter(l => l.includes(i) && !l.some(j => b[j] === rv)).length;
  return { gana_ya, bloquea_victoria_rival, deja_ganar_al_rival, crea_amenaza, arma_doble_amenaza,
           permite_doble_amenaza_rival, posicion: POS(i), lineas_abiertas };
}
// qué hechos ve Jev según el nivel de state
export const NIVELES = {
  A: { nombre: 'Sin hechos', campos: [] },
  B: { nombre: 'Hechos inmediatos', campos: ['gana_ya', 'bloquea_victoria_rival'] },
  C: { nombre: 'Hechos completos', campos: ['gana_ya', 'bloquea_victoria_rival', 'deja_ganar_al_rival', 'arma_doble_amenaza',
       'permite_doble_amenaza_rival', 'crea_amenaza', 'posicion', 'lineas_abiertas'] },
};
export function hechosNivel(b, i, nivel) {
  const h = hechos(b, i), o = { casilla: CASILLAS[i] };
  for (const c of NIVELES[nivel].campos) o[c] = h[c];
  return o;
}
// ¿turno fácil (hay ganar o bloquear) o difícil? ¿trivial (todas las jugadas son óptimas)?
export function tipoTurno(b) {
  const yo = turnoDe(b);
  const facil = victoriasDe(b, yo).length > 0 || victoriasDe(b, otro(yo)).length > 0;
  const trivial = optimas(b).length === libres(b).length;
  return trivial ? 'trivial' : facil ? 'facil' : 'dificil';
}

// ---------- jugadores sin IA (controles) ----------
export const rnd = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
export const azar = (b, r) => rnd(libres(b), r);
export const minimax = (b, r) => rnd(optimas(b), r);   // perfecto, al azar entre óptimas
// regla fija con los mismos hechos del nivel C (sin IA)
export function regla(b) {
  const L = libres(b).map(i => ({ i, ...hechos(b, i) }));
  const f = p => L.filter(p);
  let c = f(x => x.gana_ya); if (c.length) return c[0].i;
  c = f(x => x.bloquea_victoria_rival); if (c.length) return c[0].i;
  c = f(x => x.arma_doble_amenaza && !x.deja_ganar_al_rival); if (c.length) return c[0].i;
  const seguras = f(x => !x.permite_doble_amenaza_rival && !x.deja_ganar_al_rival);
  const pool = seguras.length ? seguras : L;
  const pr = x => (x.posicion === 'centro' ? 3 : 0) + (x.crea_amenaza ? 2 : 0) + (x.posicion === 'esquina' ? 1 : 0) + x.lineas_abiertas / 10;
  return pool.slice().sort((a, b2) => pr(b2) - pr(a))[0].i;
}

// ---------- preguntas para Jev ----------
export const JEV_ID = 'typesafe/jev-1.13';
export const REGLAS = 'Ta-te-ti en un tablero de 3x3. Casillas a1..c3: la letra es la fila (a arriba, c abajo) y el número es la columna (1 izquierda, 3 derecha); b2 es el centro. Gana quien completa 3 casillas propias en una fila, una columna o una diagonal.';
const ESTRATEGIA = 'Si podés ganar ya, ganá. Si el rival puede ganar en su próxima jugada, bloquealo. Evitá jugadas que le dejen al rival armar una doble amenaza (dos victorias posibles a la vez). Si nada de eso aplica, buscá crear tus propias amenazas.';
export const NIVELES_SCORE = ['0: mala: deja al rival ganar o armar una doble amenaza',
  '1: neutra: no gana, no bloquea y no crea amenazas',
  '2: buena: crea una amenaza propia o una doble amenaza, sin riesgo',
  '3: decisiva: gana ya o bloquea una victoria inmediata del rival'];

export function armarState(b, nivel) {
  const yo = turnoDe(b), rv = otro(yo);
  const st = { reglas: REGLAS, juegas_con: yo, rival: rv, fichas_en_tablero: b.filter(Boolean).length };
  if (nivel === 'A') {
    st.mis_casillas = CASILLAS.filter((_, i) => b[i] === yo);
    st.casillas_del_rival = CASILLAS.filter((_, i) => b[i] === rv);
    st.lineas_ganadoras = LINEAS.map(l => l.map(i => CASILLAS[i]));
  }
  return st;
}
// devuelve { body (para /api/alpha/decisions), elegir(answers) -> índice de casilla | null }
export function armarPregunta(b, modo, nivel) {
  const L = libres(b), st = armarState(b, nivel), qs = {};
  const conHechos = nivel === 'A' ? '' : ' El código ya calculó los hechos de cada casilla (no los recalcules).';
  if (modo === 'choice') {
    const crit = {}; L.forEach((i, k) => (crit['o' + k] = hechosNivel(b, i, nivel)));
    qs.jugada = { type: 'choice', criteria: crit,
      instructions: `Sos el jugador \`juegas_con\`. Elegí UNA casilla libre para jugar.${conHechos} ${ESTRATEGIA}` };
  } else {
    st.casillas = {}; L.forEach(i => (st.casillas[CASILLAS[i]] = hechosNivel(b, i, nivel)));
    L.forEach(i => {
      const c = CASILLAS[i];
      qs[c] = modo === 'score'
        ? { type: 'score', criteria: NIVELES_SCORE, instructions: `Qué tan buena es para vos (\`juegas_con\`) jugar ahora en \`casillas.${c}\`.${conHechos} ${ESTRATEGIA}` }
        : { type: 'noul', instructions: `¿Jugar ahora en \`casillas.${c}\` es la mejor jugada disponible para vos (\`juegas_con\`)?${conHechos} ${ESTRATEGIA}` };
    });
  }
  const body = { model: JEV_ID, state: JSON.stringify(st), questions: qs };
  const elegir = ans => {
    if (!ans) return null;
    if (modo === 'choice') {
      const a = ans.jugada, k = a?.choice;
      if (!k || !/^o\d+$/.test(k) || +k.slice(1) >= L.length) return null;
      return { i: L[+k.slice(1)], p: a.probabilities?.[k] ?? null, valores: Object.fromEntries(L.map((i, n) => [CASILLAS[i], a.probabilities?.['o' + n] ?? 0])) };
    }
    const vals = {};
    for (const i of L) {
      const a = ans[CASILLAS[i]]; if (!a) return null;
      let v;
      if (modo === 'score') v = a.probabilities ? Object.entries(a.probabilities).reduce((s, [n, p]) => s + (+n) * p, 0) : a.score;
      else v = a.noul;
      if (typeof v !== 'number' || Number.isNaN(v)) return null;
      vals[CASILLAS[i]] = +v.toFixed(3);
    }
    let best = L[0];   // empate: la primera en orden fijo
    for (const i of L) if (vals[CASILLAS[i]] > vals[CASILLAS[best]]) best = i;
    return { i: best, p: modo === 'noul' ? vals[CASILLAS[best]] : null, valores: vals };
  };
  return { body, elegir };
}

// ---------- una partida ----------
// jugadores: { X: fn, O: fn } donde fn(b) -> Promise<{ i, info? }>
export async function partida(jugadores) {
  const b = vacio(), turnos = [];
  while (!ganador(b)) {
    const p = turnoDe(b), antes = b.slice();
    const r = await jugadores[p](antes);
    if (b[r.i]) throw new Error('jugada inválida en ' + CASILLAS[r.i]);
    turnos.push({ p, i: r.i, casilla: CASILLAS[r.i], tipo: tipoTurno(antes), optima: optimas(antes).includes(r.i),
                  veredicto: veredicto(antes, r.i), hechos: hechos(antes, r.i), info: r.info || null });
    b[r.i] = p;
  }
  return { ganador: ganador(b), turnos, tablero: b.slice() };
}

// RNG reproducible
export function semilla(s) { let a = s >>> 0 || 1; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); }
