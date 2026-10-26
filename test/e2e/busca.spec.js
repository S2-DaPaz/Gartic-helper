const { test, expect } = require("@playwright/test");
const { abrir, simularApis } = require("./apoio");

test("traduz e usa o cache na segunda vez", async ({ page }) => {
  const chamadas = await simularApis(page);
  await abrir(page);
  const r = await page.evaluate(async () => [await __garticHelper.traduzir("girafa"), await __garticHelper.traduzir("girafa")]);
  expect(r).toEqual(["giraffe", "giraffe"]);
  expect(chamadas.traducao).toBe(1);
});

test("busca ícones e ilustrações", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  const [ic, il] = await page.evaluate(async () => [
    (await __garticHelper.buscarImagens("icone", "cat")).length,
    (await __garticHelper.buscarImagens("ilustracao", "giraffe")).length]);
  expect(ic).toBeGreaterThan(0);
  expect(il).toBeGreaterThan(0);
});

test("API fora do ar devolve lista vazia e tradução original", async ({ page }) => {
  await simularApis(page, { falhar: true });
  await abrir(page);
  const r = await page.evaluate(async () => [await __garticHelper.traduzir("gato"), await __garticHelper.buscarImagens("icone", "cat")]);
  expect(r).toEqual(["gato", []]);
});

test("timeout de 6 s vira lista vazia", async ({ page }) => {
  test.setTimeout(15000);
  await simularApis(page, { atrasoMs: 8000 });
  await abrir(page);
  expect(await page.evaluate(() => __garticHelper.buscarImagens("icone", "cat"))).toEqual([]);
});
