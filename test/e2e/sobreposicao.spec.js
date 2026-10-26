const { test, expect } = require("@playwright/test");
const { abrir, corNoPonto, caixasIguais } = require("./apoio");

const IMG = { miniatura: "data:,", grande: "data:,", titulo: "t" };
const VERMELHA = {
  miniatura: "", titulo: "v",
  grande: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'),
};
const centro = (box) => [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];

test("aparece sobre #drawing com 30% e deixa o clique passar", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate((img) => __garticHelper.mostrarSobreposicao(img), IMG);
  const img = page.locator("#gh-sobreposicao");
  await expect(img).toHaveCSS("opacity", "0.3");
  await expect(img).toHaveCSS("pointer-events", "none");
  expect(caixasIguais(await img.boundingBox(), await page.locator("#drawing").boundingBox())).toBe(true);
  const [x, y] = centro(await page.locator("#drawing").boundingBox());
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => window.cliques)).toBe(1);
});

test("fica visível por cima do canvas, que tem z-index próprio no jogo", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate((img) => {
    __garticHelper.mostrarSobreposicao(img);
    __garticHelper.ajustarSobreposicao({ opacidade: 80, tamanho: 100 });
  }, VERMELHA);
  await expect(page.locator("#gh-sobreposicao")).toHaveCSS("opacity", "0.8");
  await page.waitForFunction(() => document.getElementById("gh-sobreposicao").complete);
  const [x, y] = centro(await page.locator("#drawing").boundingBox());
  const [r, g] = await corNoPonto(page, x, y);
  expect(r).toBeGreaterThan(200);
  expect(g).toBeLessThan(120);
});

test("fica abaixo da dica do jogo", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate((img) => __garticHelper.mostrarSobreposicao(img), IMG);
  const z = await page.evaluate(() => [
    getComputedStyle(document.getElementById("gh-sobreposicao")).zIndex,
    getComputedStyle(document.getElementById("hint")).zIndex,
  ].map(Number));
  expect(z[0]).toBeLessThan(z[1]);
});

test("acompanha o redimensionamento", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate((img) => __garticHelper.mostrarSobreposicao(img), IMG);
  await page.setViewportSize({ width: 600, height: 500 });
  await expect.poll(async () => caixasIguais(
    await page.locator("#gh-sobreposicao").boundingBox(), await page.locator("#drawing").boundingBox())).toBe(true);
});

test("cobre #drawing quando um ancestral tem transform", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => {
    document.querySelector(".ctt").style.cssText = "transform: scale(.5); transform-origin: 0 0";
    estadoDesenhando("GATO");
  });
  await page.evaluate((img) => __garticHelper.mostrarSobreposicao(img), IMG);
  expect(caixasIguais(await page.locator("#gh-sobreposicao").boundingBox(), await page.locator("#drawing").boundingBox())).toBe(true);
});

test("ajustes limitam e lembram; ocultar e remover", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate((img) => {
    __garticHelper.mostrarSobreposicao(img);
    __garticHelper.ajustarSobreposicao({ opacidade: 95, tamanho: 60 });
  }, IMG);
  await expect(page.locator("#gh-sobreposicao")).toHaveCSS("opacity", "0.8");
  expect(await page.evaluate(() => localStorage.getItem("gartic_helper_tamanho"))).toBe("60");
  await page.evaluate(() => __garticHelper.ajustarSobreposicao({ visivel: false }));
  await expect(page.locator("#gh-sobreposicao")).toBeHidden();
  await page.evaluate(() => __garticHelper.removerSobreposicao());
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(0);
});
