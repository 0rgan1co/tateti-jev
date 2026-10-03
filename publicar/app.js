import * as M from './motor.js';

const $ = s => document.querySelector(s);
const sel = { modo: 'choice', nivel: 'C', rival: 'humano', ficha: 'O' };
const DESC = {
  modo: { choice: 'Una pregunta: "¿qué casilla jugás?". Jev elige una opción entre las casillas libres.',
          score: 'Una Score 0–3 por casilla libre. El código juega la de mayor valor esperado.',
          noul: 'Una Noul por casilla: "¿es la mejor jugada?". El código juega la de mayor probabilidad.' },
  nivel: { A: 'Sin hechos: solo de quién es cada casilla y las líneas ganadoras. Jev tiene que hacer las cuentas.',
           B: 'El código le dice qué casilla gana ya y cuál bloquea una victoria del rival.',
           C: 'Todos los hechos: además doble amenaza propia y del rival (dos jugadas adelante), posición y líneas abiertas.' },
  rival: { humano: 'Jugás vos: hacé clic en una casilla cuando sea tu turno.', azar: 'Juega al azar entre las casillas libres.',
           minimax: 'Juega perfecto: nunca pierde. Contra él, lo mejor posible es empatar.' } };
const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '—');
const usd = x => 'US$ ' + (x < 0.01 ? x.toFixed(5) : x.toFixed(3)).replace('.', ',');
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---------- selección ----------
for (const [id, k] of [['#sModo', 'modo'], ['#sNivel', 'nivel'], ['#sRival', 'rival'], ['#sFicha', 'ficha']]) {
  $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    sel[k] = b.dataset.v; $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); pintarDesc(); });
}
function pintarDesc() { $('#dModo').textContent = DESC.modo[sel.modo]; $('#dNivel').textContent = DESC.nivel[sel.nivel]; $('#dRival').textContent = DESC.rival[sel.rival]; }
pintarDesc();

// ---------- cuenta anfitriona ----------
let anfitrion = false;
fetch('api/or/estado').then(r => r.json()).then(j => { anfitrion = !!j.anfitrion; })
  .catch(() => {}).finally(() => { $('#estadoCuenta').textContent = anfitrion
    ? 'Jev real vía la cuenta anfitriona (OpenRouter). Cada turno cuesta una fracción de centavo.'
    : 'Sin cuenta anfitriona: Jev está SIMULADO (elige la jugada de la regla con p 0,9). Rotulado en cada turno.'; });

// Jev: arma la pregunta, llama, valida; si la respuesta es inválida reintenta una vez; si vuelve a fallar, azar (rotulado)
async function jev(b, modo, nivel) {
  const q = M.armarPregunta(b, modo, nivel);
  let intentos = 0, ms = 0, costo = 0, ultimo = null;
  while (intentos < 2) {
    intentos++;
    const t0 = performance.now();
    try {
      let j;
      if (anfitrion) {
        const r = await fetch('api/or/api/alpha/decisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q.body) });
        j = await r.json(); if (!r.ok) throw new Error('HTTP ' + r.status);
      } else j = simular(b, modo, q.body);
      ms += Math.round(performance.now() - t0); costo += j.usage?.cost || 0; ultimo = j.answers;
      const e = q.elegir(j.answers);
      if (e && !b[e.i]) return { i: e.i, info: { modo, nivel, st: JSON.parse(q.body.state), qs: q.body.questions, ans: j.answers, p: e.p, valores: e.valores, ms, costo, intentos, fallback: false, simulado: !anfitrion } };
    } catch (err) { ultimo = String(err); }
  }
  return { i: M.azar(b), info: { modo, nivel, st: JSON.parse(q.body.state), qs: q.body.questions, ans: ultimo, ms, costo, intentos, fallback: true } };
}
function simular(b, modo, body) {
  const L = M.libres(b), r = M.regla(b), ans = {};
  if (modo === 'choice') { const pr = {}; L.forEach((i, k) => (pr['o' + k] = i === r ? 0.9 : +(0.1 / Math.max(1, L.length - 1)).toFixed(3)));
    ans.jugada = { type: 'choice', choice: 'o' + L.indexOf(r), probabilities: pr }; }
  else for (const i of L) ans[M.CASILLAS[i]] = modo === 'noul' ? { type: 'noul', noul: i === r ? 0.9 : 0.2 }
    : { type: 'score', probabilities: i === r ? { 0: 0, 1: 0.1, 2: 0.2, 3: 0.7 } : { 0: 0.2, 1: 0.6, 2: 0.2, 3: 0 } };
  return { answers: ans, usage: { cost: 0 } };
}

// ---------- tablero ----------
let P = null;   // partida en curso
function pintar(b, ultima, mia) {
  const g = M.ganador(b), linea = g && g !== 'empate' ? M.LINEAS.find(l => l.every(i => b[i] === g)) : null;
  $('#bd').innerHTML = b.map((v, i) => `<button class="c ${v} ${v ? '' : 'lib'} ${mia && !v ? 'mia' : ''} ${ultima?.i === i ? 'new' : ''} ${ultima?.i === i && ultima.jev ? 'j' : ''} ${linea?.includes(i) ? 'win' : ''}" data-i="${i}" aria-label="${M.CASILLAS[i]}"><span class="nm">${M.CASILLAS[i]}</span>${v}</button>`).join('');
}
$('#bd').addEventListener('click', e => { const c = e.target.closest('.c'); if (c && P?.esperando && !P.b[+c.dataset.i]) P.esperando(+c.dataset.i); });

function stats(turnos) {
  const js = turnos.filter(t => t.info);
  $('#sLl').textContent = js.reduce((a, t) => a + (t.info.intentos || 1), 0);
  $('#sCo').textContent = usd(js.reduce((a, t) => a + (t.info.costo || 0), 0));
  $('#sMs').textContent = js.length ? Math.round(js.reduce((a, t) => a + t.info.ms, 0) / js.length) : '—';
  const nt = js.filter(t => t.tipo !== 'trivial'); $('#sOp').textContent = nt.length ? `${nt.filter(t => t.optima).length}/${nt.length}` : '—';
}

// explicación de un turno
function hechosTxt(b) {
  const L = M.libres(b).map(i => ({ c: M.CASILLAS[i], ...M.hechos(b, i) }));
  const lista = f => L.filter(f).map(x => x.c).join(', ');
  const p = [];
  const g = lista(x => x.gana_ya); if (g) p.push(`<b>${g}</b> gana ya`);
  const bl = lista(x => x.bloquea_victoria_rival); if (bl) p.push(`<b>${bl}</b> bloquea una victoria del rival`);
  const d = lista(x => x.arma_doble_amenaza); if (d) p.push(`<b>${d}</b> arma doble amenaza`);
  const pe = lista(x => x.permite_doble_amenaza_rival || x.deja_ganar_al_rival); if (pe) p.push(`<b>${pe}</b> le deja al rival ganar o armar doble amenaza`);
  return p.length ? p.join(' · ') : 'ninguna casilla gana, bloquea ni tiene trampa a la vista';
}
function decTxt(t) {
  const f = t.info, c = t.casilla;
  if (f.fallback) return `Jev no dio una respuesta válida (2 intentos): se jugó <b>${c}</b> al azar.`;
  const sim = f.simulado ? ' <span class="k">(simulado)</span>' : '';
  if (f.modo === 'choice') return `Jev eligió <b>${c}</b> con p ${(f.p ?? 0).toFixed(2).replace('.', ',')}${f.p != null && f.p < 0.6 ? ' <span class="k">(dudosa)</span>' : ''}${sim}`;
  const vs = Object.entries(f.valores || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(2).replace('.', ',')}`).join(' · ');
  return (f.modo === 'score' ? `Valor esperado (0–3) más alto: <b>${c}</b> · ${vs}` : `Mayor probabilidad de "sí": <b>${c}</b> · ${vs}`) + sim;
}
function verTxt(t, b) {
  if (t.tipo === 'trivial') return `<span class="ver mut">cualquier jugada daba el mismo resultado con juego perfecto (${t.veredicto})</span>`;
  if (t.optima) return `<span class="ver ok">✓ óptima según minimax (${t.veredicto})</span>`;
  return `<span class="ver bad">✗ no óptima: con juego perfecto ${t.veredicto === 'pierde' ? 'pierde' : 'deja de ganar'}. Óptimas: ${M.optimas(b).map(i => M.CASILLAS[i]).join(', ')}</span>`;
}
function turnoHTML(t, n, b, quien) {
  const esJev = !!t.info, nivel = t.info?.nivel;
  const cod = esJev ? (nivel === 'A' ? `El código <b>no</b> le pasó hechos (state A). Lo que sabía: ${hechosTxt(b)}.` : `El código calculó: ${hechosTxt(b)}.`) : '';
  return `<div class="t ${esJev ? 'jev' : ''}"><div class="h"><span>Turno ${n} · ${quien} (${t.p}) jugó ${t.casilla}</span>${esJev ? `<button class="ins" data-n="${n - 1}">ver a Jev</button>` : ''}</div>
    ${esJev ? `<div class="cod">${cod}</div><div class="dec">${decTxt(t)}</div>` : ''}${verTxt(t, b)}</div>`;
}
function pintarWhy(turnos, nombres) {
  let b = M.vacio(); const h = [];
  turnos.forEach((t, n) => { h.push(turnoHTML(t, n + 1, b, nombres[t.p])); b = b.slice(); b[t.i] = t.p; });
  $('#why').innerHTML = h.reverse().join('') || '<p class="note">Cada turno aparece acá.</p>';
  $('#why').querySelectorAll('.ins').forEach(x => x.onclick = () => inspector(turnos[+x.dataset.n], +x.dataset.n + 1));
}

// ---------- jugar ----------
$('#bJugar').onclick = () => jugar();
async function jugar() {
  const { modo, nivel, rival, ficha } = sel, rv = M.otro(ficha), nombres = { [ficha]: 'Jev', [rv]: rival === 'humano' ? 'Vos' : rival === 'azar' ? 'Azar' : 'Minimax' };
  const id = Symbol(); P = { id, b: M.vacio(), turnos: [] };
  $('#bJugar').textContent = 'Reiniciar';
  $('#lblPartida').textContent = `· ${modo} · state ${nivel} · Jev (${ficha}) contra ${nombres[rv]}`;
  $('#tTitulo').textContent = `Jev (${ficha}) vs ${nombres[rv]} (${rv})`;
  $('#tEstado').className = 'tag run'; $('#tEstado').textContent = 'jugando';
  document.getElementById('secJuego').scrollIntoView({ behavior: 'smooth', block: 'start' });
  pintar(P.b); pintarWhy([], nombres); stats([]);
  while (!M.ganador(P.b)) {
    if (P.id !== id) return;
    const p = M.turnoDe(P.b), antes = P.b.slice(); let r;
    if (p === ficha) { $('#msg').textContent = 'Jev está decidiendo…'; r = await jev(antes, modo, nivel); }
    else if (rival === 'humano') { $('#msg').textContent = 'Tu turno: hacé clic en una casilla.'; pintar(P.b, P.ult, true);
      r = { i: await new Promise(res => (P.esperando = res)) }; P.esperando = null; }
    else { await new Promise(res => setTimeout(res, 450)); r = { i: rival === 'azar' ? M.azar(antes) : M.minimax(antes) }; }
    if (P.id !== id) return;
    P.turnos.push({ p, i: r.i, casilla: M.CASILLAS[r.i], tipo: M.tipoTurno(antes), optima: M.optimas(antes).includes(r.i), veredicto: M.veredicto(antes, r.i), info: r.info || null });
    P.b[r.i] = p; P.ult = { i: r.i, jev: p === ficha };
    pintar(P.b, P.ult); pintarWhy(P.turnos, nombres); stats(P.turnos);
  }
  const g = M.ganador(P.b);
  $('#tEstado').className = 'tag ' + (g === ficha ? 'ok' : g === 'empate' ? '' : 'bad');
  $('#tEstado').textContent = g === 'empate' ? 'empate' : g === ficha ? 'ganó Jev' : `ganó ${nombres[rv]}`;
  $('#msg').textContent = 'Partida terminada. Abrí "ver a Jev" en cualquier turno para ver la pregunta y la respuesta.';
}

// ---------- inspector ----------
document.querySelectorAll('[data-cerrar]').forEach(b => b.onclick = () => b.closest('.modal').classList.remove('on'));
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('on'); }));
function inspector(t, n) {
  const f = t.info; $('#insTit').textContent = `Ver a Jev · turno ${n} · ${f.modo} · state ${f.nivel}`;
  $('#insSt').textContent = JSON.stringify(f.st, null, 2);
  const q = JSON.parse(JSON.stringify(f.qs)); if (q.jugada) q.jugada.criteria = `(${Object.keys(q.jugada.criteria).length} opciones, a la derecha)`;
  $('#insQ').textContent = JSON.stringify(q, null, 2);
  $('#insMeta').textContent = `${f.ms} ms · ${usd(f.costo || 0)} · ${f.intentos} intento(s)${f.simulado ? ' · SIMULADO' : ''}`;
  let h = '';
  if (f.fallback) h = `<p class="err">Respuesta inválida: ${esc(JSON.stringify(f.ans)).slice(0, 400)}</p>`;
  else if (f.modo === 'choice') {
    const a = f.ans.jugada, crit = f.qs.jugada.criteria;
    h = Object.keys(crit).sort((x, y) => (a.probabilities?.[y] || 0) - (a.probabilities?.[x] || 0)).map(k => {
      const p = a.probabilities?.[k] || 0, o = { ...crit[k] }; const c = o.casilla; delete o.casilla;
      return `<div class="opt ${k === a.choice ? 'win' : ''}"><div class="o">${k} · ${c}<small>${esc(Object.entries(o).map(([x, v]) => `${x}: ${v}`).join(' · ') || 'sin hechos')}</small></div><div class="bar"><i style="width:${p * 100}%"></i></div><div class="pct">${(p * 100).toFixed(0)}%</div></div>`; }).join('');
  } else {
    const mx = f.modo === 'score' ? 3 : 1;
    h = Object.entries(f.valores).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
      const a = f.ans[c], hech = f.st.casillas?.[c] || {}, o = { ...hech }; delete o.casilla;
      const dist = f.modo === 'score' && a.probabilities ? ' · niveles ' + Object.entries(a.probabilities).map(([n, p]) => `${n}:${(p * 100).toFixed(0)}%`).join(' ') : '';
      return `<div class="opt ${c === t.casilla ? 'win' : ''}"><div class="o">${c}<small>${esc(Object.entries(o).map(([x, w]) => `${x}: ${w}`).join(' · ') || 'sin hechos')}${dist}</small></div><div class="bar"><i style="width:${(v / mx) * 100}%"></i></div><div class="pct">${f.modo === 'score' ? v.toFixed(2).replace('.', ',') : (v * 100).toFixed(0) + '%'}</div></div>`; }).join('');
  }
  $('#insA').innerHTML = h; $('#insModal').classList.add('on');
}

// ---------- resultados grabados ----------
let R = null;
const NOM = { choice: 'Choice', score: 'Score', noul: 'Noul' };
fetch('resultados.json').then(r => r.json()).then(j => { R = j; pintarRes(); }).catch(() => ($('#resMeta').textContent = 'Todavía no hay resultados grabados.'));
function fila(c, v, ctrl) {
  const az = c.porRival.azar || { G: 0, E: 0, P: 0 }, mm = c.porRival.minimax || { G: 0, E: 0, P: 0 }, nmm = mm.G + mm.E + mm.P;
  const fa = c.opt.facil || { n: 0, ok: 0 }, di = c.opt.dificil || { n: 0, ok: 0 };
  const [m, n] = c.config.split('/'), nombre = ctrl ? `Control: ${c.config.split(':')[1]}` : `${NOM[m]} <span class="k">state ${n}</span>`;
  const sinPerder = nmm ? (mm.G + mm.E) / nmm : 0;
  const nAz = az.G + az.E + az.P;
  return `<tr class="${ctrl ? 'ctrl' : ''}"><td>${nombre}</td><td>${nAz ? `${az.G}–${az.E}–${az.P}` : '—'}</td>
    <td>${nmm ? `<span class="barra" style="width:${Math.round(sinPerder * 60)}px"></span>${pct(mm.G + mm.E, nmm)}` : '—'}</td>
    <td>${pct(fa.ok, fa.n)} <span class="k">${fa.ok}/${fa.n}</span></td><td>${pct(di.ok, di.n)} <span class="k">${di.ok}/${di.n}</span></td>
    <td>${v ? `${v.mismas_3_veces}/20 · ${pct(v.optimas, v.de)}` : '—'}</td>
    <td>${ctrl ? 'US$ 0' : usd(c.costo / c.partidas)}</td><td>${ctrl ? '—' : c.ms_p50 + ' ms'}</td></tr>`;
}
function encabezado() {
  return `<tr><th>Quién decide</th><th title="Ganadas–empatadas–perdidas contra un jugador al azar">vs azar G–E–P</th>
    <th title="Contra minimax no se puede ganar: lo mejor es no perder">vs minimax sin perder</th>
    <th title="Turnos con algo para ganar o bloquear: % de jugadas óptimas">Óptimas · fáciles</th>
    <th title="Turnos sin ganar ni bloquear donde alguna jugada pierde">Óptimas · difíciles</th>
    <th title="20 posiciones difíciles × 3 repeticiones: cuántas veces eligió lo mismo las 3 veces · % óptimas">Consistencia 3×</th>
    <th>US$ / partida</th><th>Latencia p50</th></tr>`;
}
function pintarRes() {
  const vmap = Object.fromEntries((R.variab || []).map(v => [v.config, v]));
  let h = encabezado();
  for (const m of ['choice', 'score', 'noul']) { ['A', 'B', 'C'].forEach((n, k) => { const c = R.configs.find(x => x.config === `${m}/${n}`); if (c) h += fila(c, vmap[c.config]).replace('<tr class="', `<tr class="${k === 2 ? 'sep ' : ''}`); }); }
  for (const c of R.controles || []) h += fila(c, null, true);
  $('#tRes').innerHTML = h;
  $('#resMeta').innerHTML = `Resultados grabados el ${new Date(R.fecha).toLocaleDateString('es-AR')}: ${R.N} partidas por configuración contra cada rival · ${R.llamadas} llamadas a Jev · gasto total ${usd(R.gasto)}. Jev juega X en la mitad de las partidas.`;
  $('#selEj').innerHTML = Object.keys(R.ejemplos || {}).map(k => `<option value="${k}">${k.startsWith('control') ? k : `${NOM[k.split('/')[0]]} · state ${k.split('/')[1]}`}</option>`).join('');
  if (R.aprendizajes_html) $('#aprendizajes').innerHTML = R.aprendizajes_html; else $('#aprendizajes').remove();
}
$('#bEj').onclick = () => {
  const g = R?.ejemplos?.[$('#selEj').value]; if (!g) return;
  P = { id: Symbol() }; const nombres = { [g.jev]: g.config.startsWith('control') ? g.config.split(':')[1] : 'Jev', [M.otro(g.jev)]: g.rival === 'azar' ? 'Azar' : 'Minimax' };
  $('#lblPartida').textContent = `· partida grabada · ${g.config} · Jev (${g.jev}) contra ${nombres[M.otro(g.jev)]}`;
  $('#tTitulo').textContent = `Grabada: ${nombres[g.jev]} (${g.jev}) vs ${nombres[M.otro(g.jev)]}`;
  $('#tEstado').className = 'tag ' + (g.ganador === g.jev ? 'ok' : g.ganador === 'empate' ? '' : 'bad');
  $('#tEstado').textContent = g.ganador === 'empate' ? 'empate' : g.ganador === g.jev ? 'ganó Jev' : 'perdió Jev';
  const last = g.turnos.at(-1); pintar(g.tablero, { i: last.i, jev: last.p === g.jev }); pintarWhy(g.turnos, nombres); stats(g.turnos);
  $('#msg').textContent = 'Partida grabada en la corrida de medición.';
  document.getElementById('secJuego').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ---------- correr en vivo (acotado: 10 partidas por modo) ----------
let armado = false;
$('#bVivo').onclick = async () => {
  const rival = sel.rival === 'humano' ? 'minimax' : sel.rival, est = 30 * 4.5 * 0.00005;
  if (!armado) { armado = true; $('#bVivo').textContent = `Confirmar: 30 partidas, state ${sel.nivel}, vs ${rival} (≈ ${usd(est)})`; setTimeout(() => { if (armado) { armado = false; $('#bVivo').textContent = 'Correr en vivo (10 partidas por modo)'; } }, 6000); return; }
  armado = false; $('#bVivo').disabled = true; $('#bVivo').textContent = 'Corriendo…';
  const filas = [];
  for (const modo of ['choice', 'score', 'noul']) {
    const ps = [];
    for (let k = 0; k < 10; k++) {
      const jv = k % 2 ? 'O' : 'X';
      const g = await M.partida({ [jv]: b => jev(b, modo, sel.nivel), [M.otro(jv)]: async b => ({ i: rival === 'azar' ? M.azar(b) : M.minimax(b) }) });
      ps.push({ ...g, jev: jv, rival });
      $('#vivo').innerHTML = `<p class="note">${NOM[modo]}: partida ${k + 1}/10…</p>`;
    }
    const r = { config: `${modo}/${sel.nivel}`, partidas: ps.length, porRival: { [rival]: { G: 0, E: 0, P: 0 } }, opt: {}, costo: 0, ms: [] };
    for (const g of ps) { r.porRival[rival][g.ganador === 'empate' ? 'E' : g.ganador === g.jev ? 'G' : 'P']++;
      for (const t of g.turnos.filter(t => t.p === g.jev)) { const o = (r.opt[t.tipo] ||= { n: 0, ok: 0 }); o.n++; if (t.optima) o.ok++; r.costo += t.info?.costo || 0; r.ms.push(t.info?.ms || 0); } }
    r.ms.sort((a, b) => a - b); r.ms_p50 = r.ms[Math.floor(r.ms.length / 2)]; filas.push(r);
    $('#vivo').innerHTML = `<p class="note">En vivo · 10 partidas por modo · state ${sel.nivel} · vs ${rival}${anfitrion ? '' : ' · SIMULADO'}</p><div class="scroll"><table class="res">${encabezado()}${filas.map(f => fila(f)).join('')}</table></div>`;
  }
  $('#bVivo').disabled = false; $('#bVivo').textContent = 'Correr en vivo (10 partidas por modo)';
};
