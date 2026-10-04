# katrusik-site — katrusik.pro на Cloudflare Pages

Статическая копия сайта Кати Турусовой, снятая с WordPress на VPS
81.200.145.190 (Debian 11, 1 ГБ RAM, MySQL регулярно падал от OOM).
Проект Pages — `katrusik`, стабильный адрес `https://katrusik.pages.dev`.

## Раскладка

```
site/              то, что заливается (статика)
  index.html       главная; она же /home/ (копия) — WP редиректил / на /home
  links/           страница «Links»
  thanks/          «спасибо» после отправки формы
  404.html         обязателен: без него Pages отдаёт главную с кодом 200
                   на любой несуществующий путь
  s/*.pdf          4 гайда, перенесены с files.katrusik.pro
  _redirects       короткие ссылки на гайды + заглушки старых адресов WP
functions/         ВНЕ site/ — wrangler ищет их в корне проекта.
  api/submit.js    форма «побщаться со мной»
```

Положить `functions/` внутрь `site/` не работает: файлы уедут как статика,
а `/api/submit` ответит 405. Признак удачной сборки в выводе деплоя —
строки `Compiled Worker successfully` и `Uploading Functions bundle`.

## Деплой

```bash
cd ~/apps/katrusik-site
set -a; . ./.env; set +a; export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
./node_modules/.bin/wrangler pages deploy site \
  --project-name katrusik --branch main --commit-dirty=true
```

`wrangler` закреплён на 3.x: четвёртому нужен Node 22, а в Debian 13 — 20.

## Форма

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

`katrusik.pro` и `files.katrusik.pro` привязаны к проекту (3 октября 2026).
В DNS это CNAME на `katrusik.pages.dev`, проксированные; прежние A-записи на
81.200.145.190 заменены, копия всех записей до переключения — в
`dns-before-2026-10-03.json`.

Откат: вернуть этим двум именам тип A и адрес 81.200.145.190.

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
  --dump-dom https://katrusik.pages.dev/ | grep -o 'owl-loaded\|owl-item' | sort | uniq -c
```
Должно быть `owl-loaded` и 20 `owl-item` — столько же, сколько на оригинале.
