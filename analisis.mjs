// Análisis extra: ¿Jev con state C elige lo mismo que la regla fija? ¿Y la regla en el set de variabilidad?
import fs from 'node:fs';
import * as M from './motor.js';
const C = JSON.parse(fs.readFileSync('completo.json', 'utf8'));
const V = JSON.parse(fs.readFileSync('variab.json', 'utf8'));
// coincidencia con la regla: recorrer ejemplos no alcanza; recalculamos desde turnos guardados en las partidas de ejemplo
// set de variabilidad: regla y azar esperado
const v0 = V.configs[0].filas.map(f => f.tablero.split(','));
const reglaOk = v0.filter(b => M.optimas(b).includes(M.regla(b))).length;
const azarEsp = v0.reduce((a, b) => a + M.optimas(b).length / M.libres(b).length, 0);
console.log('set variab: regla óptima', reglaOk, '/20 · azar esperado', azarEsp.toFixed(1), '/20');
for (const c of V.configs) console.log(c.config, 'iguales', c.mismas_3_veces, 'óptimas', c.optimas, '/60');
console.log('gasto variab', V.gasto, 'llamadas', V.llamadas, '· completo', C.gasto, C.llamadas);
