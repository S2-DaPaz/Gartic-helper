const { test, expect } = require("@playwright/test");
const { abrir, simularApis, HELPER } = require("./apoio");

const ICONE_GATO = "https://api.iconify.design/mdi/cat.svg?height=512";
const ICONE_GIRAFA = "https://api.iconify.design/fxemoji/giraffe.svg?height=512";
const ILUSTRACAO_1 = "https://upload.wikimedia.org/wikipedia/commons/4/47/WikiIndaba_Dar_es_Salaam_-_Giraffe_icon_tz.svg";

test("escolhendo abre o painel com duas colunas de miniaturas", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoEscolhendo("Gato", "Girafa"));
  await expect(page.locator("#gh-painel")).toBeVisible();
  await expect(page.locator(".gh-coluna")).toHaveCount(2);
  await expect(page.locator(".gh-coluna").nth(0).locator("img.gh-miniatura").first()).toBeVisible();
  await expect(page.locator(".gh-coluna").nth(1).locator("img.gh-miniatura").first()).toBeVisible();
});

test("desenhando aplica o primeiro ícone", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", ICONE_GATO);
});

test("fim do desenho remove a sobreposição", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(1);
  await page.evaluate(() => estadoParado());
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(0);
});

test("hint de outro jogador não abre nada", async ({ page }) => {
  const chamadas = await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoOutroDesenhando("G__O"));
  await page.waitForTimeout(500);
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(0);
  await expect(page.locator("#gh-painel")).toBeHidden();
  expect(chamadas.urls).toEqual([]);
});

test("trocar aba e miniatura troca a imagem", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", ICONE_GATO);
  await page.click("#gh-bolinha");
  await page.click('button[data-fonte="ilustracao"]');
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", ILUSTRACAO_1);
  const segunda = page.locator(".gh-grade img.gh-miniatura").nth(1);
  await segunda.click();
  const esperado = await segunda.getAttribute("data-grande");
  expect(esperado).not.toBe(ILUSTRACAO_1);
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", esperado);
});

test("controles do painel mudam opacidade e ocultam", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(1);
  await page.click("#gh-bolinha");
  await page.locator("#gh-opacidade").fill("50");
  await expect(page.locator("#gh-sobreposicao")).toHaveCSS("opacity", "0.5");
  await page.click("#gh-ocultar");
  await expect(page.locator("#gh-sobreposicao")).toBeHidden();
});

test("sem resultado mostra o aviso sem exceção", async ({ page }) => {
  const erros = [];
  page.on("pageerror", (e) => erros.push(e));
  await simularApis(page, { falhar: true });
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator(".gh-aviso")).toHaveText("sem resultado — tente a outra aba ou edite o termo");
  expect(erros).toEqual([]);
});

test("rodar duas vezes mantém uma bolinha", async ({ page }) => {
  await abrir(page);
  await page.addScriptTag({ path: HELPER });
  await expect(page.locator("#gh-bolinha")).toHaveCount(1);
  await expect(page.locator("#gh-painel")).toHaveCount(1);
});

test("resposta atrasada da palavra anterior é descartada", async ({ page }) => {
  await simularApis(page, { atrasoPorTermo: { cat: 2000 } });
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await page.waitForTimeout(400);
  await page.evaluate(() => estadoParado());
  await page.waitForTimeout(400);
  await page.evaluate(() => estadoDesenhando("GIRAFA"));
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", ICONE_GIRAFA);
  await page.waitForTimeout(2500);
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", ICONE_GIRAFA);
});

test("localStorage que lança não quebra o helper", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("bloqueado"); } });
  });
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(1);
});

test("termo editado refaz a busca", async ({ page }) => {
  const chamadas = await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(1);
  await page.click("#gh-bolinha");
  await expect(page.locator("#gh-termo")).toHaveValue("cat");
  await page.fill("#gh-termo", "giraffe");
  await page.press("#gh-termo", "Enter");
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", ICONE_GIRAFA);
  expect(chamadas.urls.some((u) => u.includes("query=giraffe"))).toBe(true);
});

test("palavra manual busca fora da vez", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.click("#gh-bolinha");
  await page.fill("#gh-manual", "gato");
  await page.press("#gh-manual", "Enter");
  await expect(page.locator(".gh-grade img.gh-miniatura").first()).toBeVisible();
});

test("página mudando sem parar não impede a detecção", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => {
    let n = 0;
    setInterval(() => { document.getElementById("time").textContent = String(n++); }, 100);
  });
  await page.evaluate(() => estadoEscolhendo("Gato", "Girafa"));
  await expect(page.locator("#gh-painel")).toBeVisible({ timeout: 2000 });
});

test("bolinha salva fora da tela volta para dentro", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gartic_helper_pos", JSON.stringify({ x: 5000, y: 5000 })));
  await abrir(page);
  const box = await page.locator("#gh-bolinha").boundingBox();
  const tela = page.viewportSize();
  expect(box.x + box.width).toBeLessThanOrEqual(tela.width);
  expect(box.y + box.height).toBeLessThanOrEqual(tela.height);
});

test("botão da coluna escolhe a palavra no jogo", async ({ page }) => {
  await simularApis(page);
  await abrir(page);
  await page.evaluate(() => estadoEscolhendo("Gato", "Girafa"));
  await page.locator(".gh-coluna").nth(1).locator("button.gh-escolher").click();
  expect(await page.evaluate(() => window.escolhida)).toBe(1);
});
