import fs from 'node:fs';
const C = JSON.parse(fs.readFileSync('datos/completo.json')), K = JSON.parse(fs.readFileSync('datos/controles.json')), V = JSON.parse(fs.readFileSync('datos/variab.json')), PI = JSON.parse(fs.readFileSync('datos/piloto.json'));
const aprend = fs.readFileSync('aprendizajes.html', 'utf8');
const R = { fecha: C.fecha, N: C.N, rivales: C.rivales, configs: C.configs, controles: K.configs,
  variab: V.configs.map(v => ({ config: v.config, mismas_3_veces: v.mismas_3_veces, optimas: v.optimas, de: v.de })),
  ejemplos: { ...C.ejemplos, ...K.ejemplos }, llamadas: C.llamadas + V.llamadas + PI.llamadas, gasto: +(C.gasto + V.gasto + PI.gasto).toFixed(4),
  aprendizajes_html: aprend };
fs.writeFileSync('publicar/resultados.json', JSON.stringify(R));
console.log('ok', fs.statSync('publicar/resultados.json').size, R.llamadas, R.gasto);
