/**
 * Форма «побщаться со мной» с главной страницы.
 * Замена send_to_telegram.php, который жил на VPS: то же поле client_info,
 * тот же префикс сообщения, тот же чат. Токен и chat_id — в секретах Pages.
 */

const MAX_LEN = 3000;

// Сама страница живёт на GitHub Pages, здесь только эта функция — поэтому
// возвращаем на сайт по абсолютному адресу, а не относительно request.url.
const SITE = 'https://katrusik.pro';

export async function onRequestPost({ request, env }) {
  let message;
  try {
    const form = await request.formData();
    message = (form.get('client_info') || '').toString().trim().slice(0, MAX_LEN);

    // Проверяем капчу только если ключ задан: пока его нет, форма открыта
    // ровно так же, как была на VPS, и деплой на этом не спотыкается.
    if (env.TURNSTILE_SECRET_KEY) {
      const ok = await verifyTurnstile(
        form.get('cf-turnstile-response'),
        env.TURNSTILE_SECRET_KEY,
        request.headers.get('CF-Connecting-IP'),
      );
      if (!ok) return back(request, 'captcha');
    }
  } catch {
    return back(request, 'bad-request');
  }

  if (!message) return back(request, 'empty');

  const res = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TG_CHAT_ID,
      text: `form1 on site: ${message}`,
      disable_web_page_preview: true,
    }),
  });

  // Телеграм прилёг — лучше честно сказать, чем показать «спасибо» впустую
  if (!res.ok) return back(request, 'telegram');

  return Response.redirect(new URL('/thanks/', SITE), 303);
}

async function verifyTurnstile(token, secret, ip) {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token.toString());
  if (ip) body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
                        { method: 'POST', body });
  const d = await r.json().catch(() => ({}));
  return d.success === true;
}

function back(request, reason) {
  const url = new URL('/', SITE);
  url.searchParams.set('form', reason);
  return Response.redirect(url, 303);
}

// POST забирает onRequestPost выше; этот catch-all нужен, чтобы остальные
// методы не проваливались в статику, где Pages отдаёт главную с кодом 200.
export function onRequest() {
  return new Response('Method Not Allowed', {
    status: 405, headers: { allow: 'POST' },
  });
}
