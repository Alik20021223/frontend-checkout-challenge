# @checkout/web

Фронтенд магазина на Next.js 16 (App Router), React 19 и TypeScript. Описание решения, устройство слоя API и проверенные сценарии — в [README репозитория](../../README.md).

```sh
npm run dev -w @checkout/web     # http://localhost:3000, API должен работать на :4000
npm run build -w @checkout/web
npm run start -w @checkout/web
npm run typecheck -w @checkout/web
npm run e2e -w @checkout/web     # сценарный прогон по запущенному приложению
```

Адрес API задаётся переменной `NEXT_PUBLIC_API_URL`, по умолчанию `http://localhost:4000`.
