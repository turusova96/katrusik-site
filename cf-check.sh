#!/bin/bash
# Проверяет токен Cloudflare и достаёт Zone ID для katrusik.pro.
cd "$(dirname "$0")" || exit 1
[ -f .env ] || { echo "нет .env — скопируй .env.example в .env и заполни"; exit 1; }
set -a; . ./.env; set +a

[ -n "$CLOUDFLARE_API_TOKEN" ] || { echo "CLOUDFLARE_API_TOKEN пуст"; exit 1; }
API=https://api.cloudflare.com/client/v4
AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")

show() { python3 -c "
import json,sys
d=json.load(sys.stdin)
if not d.get('success'):
    print('  ОШИБКА:', '; '.join(e.get('message','?') for e in d.get('errors',[])))
    sys.exit(1)
print('  ок')
r=d.get('result')
$1" ; }

# /user/tokens/verify отвечает «Invalid API Token» для account-owned токенов —
# это не признак поломки, поэтому проверку живости делаем запросом аккаунтов ниже.
echo "== 1. Токен живой? =="
curl -s "${AUTH[@]}" "$API/user/tokens/verify" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
if d.get('success'): print('  ок, статус:', d['result'].get('status'))
else: print('  это account-owned токен (user-эндпоинт его не проверяет) —')
     " 2>/dev/null || true

echo "== 2. Аккаунт виден? =="
curl -s "${AUTH[@]}" "$API/accounts" | show "
for a in r: print('  ', a['id'], a['name'])"

echo "== 3. Zone ID для katrusik.pro =="
curl -s "${AUTH[@]}" "$API/zones?name=katrusik.pro" | show "
for z in r: print('  ', z['id'], z['name'], '| статус:', z['status'])"

echo "== 4. Права на Pages (список проектов) =="
if [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
  curl -s "${AUTH[@]}" "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects" | show "
print('  проектов:', len(r))
for p in r: print('  ', p['name'])"
else
  echo "  CLOUDFLARE_ACCOUNT_ID пуст — подставь из п.2 и повтори"
fi
