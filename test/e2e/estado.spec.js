const { test, expect } = require("@playwright/test");
const { abrir } = require("./apoio");

const estado = (page) => page.evaluate(() => window.__garticHelper.lerEstado(document));

test("parado", async ({ page }) => {
  await abrir(page);
  expect(await estado(page)).toEqual({ tipo: "parado" });
});

test("escolhendo lê as duas palavras", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoEscolhendo("Girafa", "Bob Esponja"));
  expect(await estado(page)).toEqual({ tipo: "escolhendo", palavras: ["girafa", "bob esponja"] });
});

test("desenhando lê a palavra com espaço", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("BOB ESPONJA"));
  expect(await estado(page)).toEqual({ tipo: "desenhando", palavra: "bob esponja" });
});

test("hint de outro jogador não é desenho", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoOutroDesenhando("G___A"));
  expect(await estado(page)).toEqual({ tipo: "parado" });
});
