# katrusik-site — katrusik.pro на GitHub Pages

Статическая копия сайта Кати Турусовой, снятая с WordPress на VPS
81.200.145.190 (Debian 11, 1 ГБ RAM, MySQL регулярно падал от OOM).
С 4 октября 2026 статика живёт на GitHub Pages (аккаунт `turusova96`),
а Cloudflare Pages (проект `katrusik`) держит только функцию формы.

## Раскладка

```
site/              → репо turusova96/katrusik-site, домен katrusik.pro
  index.html       главная; она же /home/ (копия) — WP редиректил / на /home
  links/ thanks/   страницы «Links» и «спасибо» после формы
  404.html         страница ошибки
  s/*.pdf          4 гайда
  s/<код>/, index.php/s/<код>/, wp-admin/
                   HTML-заглушки с meta refresh: GitHub Pages не понимает
                   _redirects, поэтому короткие ссылки сделаны каталогами
files-site/        → репо turusova96/katrusik-files, домен files.katrusik.pro
                   (один домен на репо). PDF + те же заглушки, корень → katrusik.pro.
                   Отдельного git тут нет: при правке скопировать во временный
                   каталог, git init, force-push в main.
functions/         функция /api/submit — деплоится на Cloudflare Pages; форма шлёт на
                   form.katrusik.pro (custom domain проекта): *.pages.dev блокируется в РФ
cf-stub/           статика для Cloudflare Pages: только редирект на katrusik.pro,
                   чтобы на katrusik.pages.dev не висела копия сайта
```

## Деплой

Сайт: `git push` в `main` репо `turusova96/katrusik-site` — workflow
`.github/workflows/pages.yml` выкладывает `site/`. Custom domain задан в
настройках Pages (файл CNAME при сборке через Actions не используется).
Токен GitHub — `GITHUB_API_TOKEN` в `.env`:

```bash
set -a; . ./.env; set +a
git push "https://x-access-token:$GITHUB_API_TOKEN@github.com/turusova96/katrusik-site.git" main
```

Функция формы (Cloudflare Pages) — деплоить `cf-stub`, **не** `site`:

```bash
set -a; . ./.env; set +a; export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
./node_modules/.bin/wrangler pages deploy cf-stub \
  --project-name katrusik --branch main --commit-dirty=true
```

`functions/` должна лежать в корне проекта (wrangler ищет её там); признак
удачной сборки — `Uploading Functions bundle`. `wrangler` закреплён на 3.x:
четвёртому нужен Node 22, а в Debian 13 — 20.

## Форма

Форма в `site/index.html` и `site/home/index.html` постит на
`https://katrusik.pages.dev/api/submit`, функция возвращает на `https://katrusik.pro`.
Заменила `send_to_telegram.php`: то же поле `client_info`, тот же префикс
сообщения `form1 on site:`, тот же чат. Токен, chat_id и секрет Turnstile
живут в секретах Pages (`wrangler pages secret list --project-name katrusik`),
в файлах их нет. Копии значений — в `.env`, он `chmod 600`.

Turnstile (виджет «katrusik.pro — форма обратной связи», режим managed)
проверяется только если задан `TURNSTILE_SECRET_KEY`; на VPS у формы не было
никакой защиты от спама.

Проверка функции, не засоряя Кате телеграм: POST без капчи должен дать
`303 -> /?form=captcha`.

## Что осталось от WordPress

Ничего динамического. Плагины форм (`contact-form-7`, `fluentform`,
`formidable`) на страницах не использовались — форма была самописным php.
Страница `/checklist_for_posts/` была под паролем WP и в статику не ложится:
вынесена в отдельный проект `~/apps/checklist-posts`.

## Домены

С 4 октября 2026 DNS (зона на Cloudflare) указывает на GitHub, без прокси —
иначе GitHub не выпустит сертификат:
`katrusik.pro` — A на 185.199.108–111.153, `files` — CNAME на
`turusova96.github.io`. HTTPS enforced. От проекта Cloudflare Pages
домены отвязаны. Если сертификат не выпускается — снять и снова задать
cname через API `PUT /repos/.../pages`, это перезапускает выпуск.

С 3 по 4 октября оба имени были CNAME на `katrusik.pages.dev`; до 3 октября —
A на 81.200.145.190, копия записей — в `dns-before-2026-10-03.json`.

`list.katrusik.pro`, `meet.katrusik.pro` и `0095rd.katrusik.pro` удалены
3 октября 2026. У `meet` вхоста на VPS не было вовсе (отдавалась заглушка
Apache), за `0095rd` стоял туннель, пустой на всех путях. `list` отдавал
10 чек-листов от ноября 2023 — перед удалением всё содержимое сохранено в
`~/apps/katrusik/checklist/archive/` (124 файла вместе с каталогом, куда
бот писал позже).

Почта не задета: MX ведут на Cloudflare Email Routing, а не на VPS.

Первые минуты после переключения апекс отдавал ответы старого Apache —
это был кэш Cloudflare на краю, он разошёлся сам. Токен права на
`purge_cache` не имеет; если понадобится, чистить из панели.

## Если будешь пересобирать зеркало с WordPress

wget сохраняет query-строку прямо в имя файла (`frontend.js@ver=2.2.4`), и
на Pages такой файл уезжает как `application/octet-stream`. Вместе с
`x-content-type-options: nosniff` браузер отказывается исполнять скрипт —
в первую очередь падает jQuery, а за ним всё, что на нём: карусель отзывов
просто не появляется, и в консоли при этом тихо.

Поэтому после зеркалирования обязательно:

1. переименовать все файлы с `@` в имени, отрезав всё от `@` (тогда
   расширение снова настоящее и MIME определяется верно);
2. поправить ссылки на них в `*.html` и `*.css`;
3. сделать пути к `wp-content/` и `wp-includes/` в HTML **абсолютными**.
   Относительные ломаются на `/home/`: браузер ищет их в
   `/home/wp-content/...` и получает 404. В CSS трогать не надо — там
   `url()` считается от самого файла.

Навигацию wget тоже переписывает на свои имена (`index.html@p=156.html`) —
это главная и `/links/`, их нужно заменить на `/` и `/links/`.

Проверка после деплоя:

```bash
chromium --headless --disable-gpu --no-sandbox --virtual-time-budget=9000 \
  --dump-dom https://katrusik.pro/ | grep -o 'owl-loaded\|owl-item' | sort | uniq -c
```
Должно быть `owl-loaded` и 20 `owl-item` — столько же, сколько на оригинале.
