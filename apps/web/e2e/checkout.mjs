// Сценарный прогон по запущенному приложению: API на :4000 и фронтенд на :3000.
// Запуск: npm run e2e -w @checkout/web (перед этим npx playwright install chromium).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';
const shots = new URL('./screenshots/', import.meta.url);
mkdirSync(shots, { recursive: true });
const shot = (name) => new URL(`${name}.png`, shots).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'ru-RU',
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', (error) => console.log('  ошибка страницы:', error.message));

let failed = 0;
async function step(name, run) {
  try {
    await run();
    console.log('✔', name);
  } catch (error) {
    failed += 1;
    console.log('✘', name, '\n   ', error.message.split('\n')[0]);
    await page.screenshot({ path: shot(`fail-${failed}`), fullPage: true });
  }
}

const total = () => page.locator('.lines__total');
const totals = () => page.locator('.lines__totals');
const quantity = (title) => page.getByRole('group', { name: `Количество: ${title}` });
const ordersCount = () =>
  page.evaluate(async (api) => {
    const token = JSON.parse(localStorage.getItem('checkout:token'));
    const response = await fetch(`${api}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await response.json()).data.length;
  }, API);

async function fillContacts() {
  await page.getByLabel('Имя').fill('Тестовый Покупатель');
  await page.getByLabel('Email').fill('buyer@example.test');
  await page.getByLabel('Телефон').fill('+79990000000');
}

async function payWith(card, amount) {
  await page.getByText('Карта', { exact: true }).waitFor();
  await page.getByLabel(card).check();
  await page.getByRole('button', { name: `Оплатить ${amount}` }).click();
}

await step('каталог: четыре товара, недоступный товар нельзя добавить', async () => {
  await page.goto(BASE);
  await page.locator('.product').nth(3).waitFor();
  if ((await page.locator('.product').count()) !== 4) throw new Error('ожидалось 4 товара');
  const soldOut = page.getByRole('button', { name: /В корзину: Часы/ });
  if (!(await soldOut.isDisabled())) throw new Error('кнопка недоступного товара активна');
  await page.screenshot({ path: shot('catalog-1280'), fullPage: true });
});

await step('добавление в корзину и изменение количества из каталога', async () => {
  await page.getByRole('button', { name: 'В корзину: Настольная лампа «Орбита»' }).click();
  await quantity('Настольная лампа «Орбита»').getByRole('button', { name: 'Увеличить' }).click();
  await page.getByRole('link', { name: 'Корзина (2)' }).waitFor();
  await page.getByRole('button', { name: 'В корзину: Кружка «Линия»' }).click();
  await page.getByRole('link', { name: 'Корзина (3)' }).waitFor();
});

await step('корзина: ввод количества с клавиатуры, удаление позиции, итог', async () => {
  await page.getByRole('link', { name: 'Корзина (3)' }).click();
  const input = quantity('Настольная лампа «Орбита»').getByRole('spinbutton');
  await input.fill('3');
  await input.press('Enter');
  await page.getByText(/4 товара на сумму/).waitFor();
  await page.getByRole('button', { name: 'Удалить: Кружка «Линия»' }).click();
  await page.getByText(/3 товара на сумму/).waitFor();
  await page.locator('.cart__footer').getByText('7 470 ₽').waitFor();
  await input.fill('1');
  await input.press('Enter');
  await page.getByText(/1 товар на сумму/).waitFor();
});

await step('превышение остатка показывает ошибку сервера у позиции', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'В корзину: Сумка «День»' }).click();
  const input = quantity('Сумка «День»').getByRole('spinbutton');
  await input.fill('6');
  await input.press('Enter');
  await page.getByText('Доступно не более 5 шт.').waitFor();
  await page.getByRole('link', { name: 'Корзина (2)' }).click();
  await page.getByRole('button', { name: 'Удалить: Сумка «День»' }).click();
  await page.getByText(/1 товар на сумму/).waitFor();
});

await step('оформление: расчёт самовывоза и ошибки полей до отправки', async () => {
  await page.getByRole('link', { name: 'Оформить заказ' }).click();
  await totals().getByText('Бесплатно').waitFor();
  await total().getByText('2 490 ₽').waitFor();
  await page.getByRole('button', { name: 'Перейти к оплате' }).click();
  await page.getByText('Укажите имя, от 2 до 100 символов').waitFor();
  await page.getByText('Укажите email в формате name@example.com').waitFor();
  await page.getByText('Телефон в международном формате').waitFor();
});

await step('оформление: курьер и адрес пересчитывают доставку с сервера', async () => {
  await page.getByLabel('Курьер').check();
  await page.getByText('Заполните адрес, чтобы рассчитать доставку.').waitFor();
  await page.getByLabel('Город').fill('Учебный');
  await page.getByLabel('Улица').fill('Примерная');
  await page.getByLabel('Дом').fill('10');
  await page.getByLabel('Квартира').fill('1');
  await totals().getByText('390 ₽').waitFor();
  await total().getByText('2 880 ₽').waitFor();
  await fillContacts();
  await page.screenshot({ path: shot('checkout-1280'), fullPage: true });
});

await step('перезагрузка страницы сохраняет заполненную форму', async () => {
  await page.reload();
  await page.getByRole('heading', { name: 'Оформление заказа' }).waitFor();
  if ((await page.getByLabel('Имя').inputValue()) !== 'Тестовый Покупатель')
    throw new Error('имя не сохранилось');
  if (!(await page.getByLabel('Курьер').isChecked())) throw new Error('способ доставки сброшен');
  if ((await page.getByLabel('Город').inputValue()) !== 'Учебный') throw new Error('адрес сброшен');
  await total().getByText('2 880 ₽').waitFor();
});

await step('заказ картой: отказ банка, затем успешная повторная оплата', async () => {
  await page.getByRole('button', { name: 'Перейти к оплате' }).click();
  await page.getByRole('heading', { name: 'Оплата заказа' }).waitFor();
  await page.getByRole('link', { name: 'Корзина', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Оплатить 2 880 ₽' }).click();
  await payWith('Тестовая карта: отказ банка', '2 880 ₽');
  await page.getByText('Ждём подтверждение от банка…').waitFor();
  await page.getByText('Банк отклонил оплату').waitFor();
  await page.getByRole('button', { name: 'Оплатить ещё раз' }).click();
  await payWith('Тестовая карта: успешная оплата', '2 880 ₽');
  await page.getByText('Оплата прошла успешно').waitFor();
  await page.getByRole('heading', { name: 'Заказ оформлен' }).waitFor();
  await page.getByText(/DEMO-\d{6}/).waitFor();
  await page.getByText('Курьером: Учебный, Примерная, д. 10, кв. 1').waitFor();
  await page.screenshot({ path: shot('order-1280'), fullPage: true });
});

await step('отмена оплаты, перезагрузка во время обработки, успешный повтор', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'В корзину: Кружка «Линия»' }).click();
  await page.getByRole('link', { name: 'Корзина (1)' }).click();
  await page.getByRole('link', { name: 'Оформить заказ' }).click();
  await page.getByRole('heading', { name: 'Оформление заказа' }).waitFor();
  if ((await page.getByLabel('Имя').inputValue()) !== '') throw new Error('черновик не очищен');
  await fillContacts();
  await total().getByText('890 ₽').waitFor();
  await page.getByRole('button', { name: 'Перейти к оплате' }).click();
  await page.getByRole('button', { name: 'Оплатить 890 ₽' }).click();
  await page.getByRole('button', { name: 'Отменить оплату' }).click();
  await page.getByText('Оплата отменена').waitFor();
  await page.getByRole('button', { name: 'Оплатить ещё раз' }).click();
  await payWith('Тестовая карта: успешная оплата', '890 ₽');
  await page.getByText('Ждём подтверждение от банка…').waitFor();
  await page.reload();
  await page.getByText('Оплата прошла успешно').waitFor();
});

await step('заказ наличными: двойное нажатие создаёт один заказ', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'В корзину: Сумка «День»' }).click();
  await page.getByRole('link', { name: 'Корзина (1)' }).click();
  await page.getByRole('link', { name: 'Оформить заказ' }).click();
  await fillContacts();
  await page.getByLabel('Наличными при получении').check();
  await total().getByText('1 590 ₽').waitFor();
  const before = await ordersCount();
  await page.getByRole('button', { name: 'Оформить заказ' }).dblclick();
  await page.getByText('Заказ оформлен, оплата при получении.').waitFor();
  const created = (await ordersCount()) - before;
  if (created !== 1) throw new Error(`создано заказов: ${created}`);
});

await step('ссылка «Мой заказ» открывает последний заказ после перезагрузки', async () => {
  await page.goto(BASE);
  await page.getByRole('link', { name: 'Мой заказ' }).click();
  await page.getByRole('heading', { name: 'Заказ оформлен' }).waitFor();
  await page.getByText('Сумка «День»').waitFor();
});

await step('ширина 390: страницы без горизонтальной прокрутки', async () => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
  });
  const view = await mobile.newPage();
  view.setDefaultTimeout(10000);
  await view.goto(BASE);
  await view.getByRole('button', { name: 'В корзину: Настольная лампа «Орбита»' }).click();
  await view.getByRole('link', { name: 'Корзина (1)' }).waitFor();
  await view.screenshot({ path: shot('catalog-390'), fullPage: true });
  for (const path of ['/cart', '/checkout']) {
    await view.goto(BASE + path);
    await view.locator('h1').waitFor();
    await view.waitForTimeout(800);
    await view.screenshot({ path: shot(`${path.slice(1)}-390`), fullPage: true });
    const width = await view.evaluate(() => document.documentElement.scrollWidth);
    if (width > 390) throw new Error(`${path}: ширина документа ${width}`);
  }
  await mobile.close();
});

await browser.close();
console.log(failed ? `\nШагов с ошибками: ${failed}` : '\nВсе шаги прошли');
process.exit(failed ? 1 : 0);
