# Ta-te-ti × Jev

Un ta-te-ti para aprender a diseñar decisiones con **Jev** (TypeSafe, "System One"): **el código calcula, Jev decide**.
Compara las tres primitivas (Choice, Score, Noul) y tres niveles de state (A: sin hechos · B: gana/bloquea · C: hechos completos).

- Página: https://tateti-jev.pages.dev
- `motor.js` — reglas, minimax, hechos por casilla, controles (azar, minimax, regla fija) y armado de preguntas. Lo usan la página y el runner.
- `correr.mjs` — corridas de medición vía OpenRouter (`POST /api/alpha/decisions`, `typesafe/jev-1.13`): `--piloto`, `--completo`, `--variab`, `--controles`, con tope de gasto `--limite=`.
- `functions/api/or/[[path]].js` — cuenta anfitriona (Cloudflare Pages Function): la clave vive como secreto `OPENROUTER_API_KEY`; solo deja pasar decisiones de Jev desde la misma página.
- `publicar/` — la página (index.html + app.js + motor.js + resultados.json).

Resultados (2026-10-02, 4.110 llamadas, US$ 0,21): con state C las tres primitivas juegan 100% óptimo, igual que una regla fija sin IA; con state A, Jev queda cerca del azar. Detalle en la sección "Qué aprendimos" de la página.

Licencia MIT.
