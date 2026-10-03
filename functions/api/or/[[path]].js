// Cloudflare Pages Function: "cuenta anfitriona" de Ta-te-ti × Jev.
// La clave de OpenRouter vive como secreto del proyecto (OPENROUTER_API_KEY), nunca en el navegador ni en el repo.
// Solo deja pasar decisiones de Jev (typesafe/jev-1.13), desde esta misma página y con tamaño acotado.
const PERMITIDO = 'api/alpha/decisions';
const MAX_PREGUNTAS = 12, MAX_STATE = 8000;

export async function onRequest({ request, env, params }) {
  const path = (params.path || []).join('/');
  if (path === 'estado') return Response.json({ anfitrion: Boolean(env.OPENROUTER_API_KEY) });
  if (!env.OPENROUTER_API_KEY) return new Response('Sin cuenta anfitriona', { status: 503 });
  if (request.method !== 'POST' || path !== PERMITIDO) return new Response('No permitido', { status: 404 });

  const origin = request.headers.get('Origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) return new Response('Origen no permitido', { status: 403 });

  let body;
  try { body = await request.json(); } catch { return new Response('JSON inválido', { status: 400 }); }
  const qs = body && body.questions;
  if (!qs || typeof qs !== 'object' || Object.keys(qs).length > MAX_PREGUNTAS) return new Response('Demasiadas preguntas', { status: 400 });
  if (typeof body.state !== 'string' || body.state.length > MAX_STATE) return new Response('State inválido', { status: 400 });
  body = { model: 'typesafe/jev-1.13', state: body.state, questions: qs };

  const r = await fetch('https://openrouter.ai/' + PERMITIDO, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json',
               'HTTP-Referer': new URL(request.url).origin, 'X-Title': 'Tateti Jev' },
    body: JSON.stringify(body),
  });
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } });
}
