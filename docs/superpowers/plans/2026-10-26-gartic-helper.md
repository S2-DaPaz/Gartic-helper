# Gartic Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bookmarklet que, na vez do jogador no gartic.io, busca uma imagem da palavra e a sobrepõe ao canvas com opacidade baixa.

**Architecture:** Um único `helper.js` (IIFE) injetado pelo bookmarklet via jsDelivr. Lê o estado do jogo pelo DOM com `MutationObserver`, traduz pt→en no MyMemory, busca no Iconify/Openverse e põe um `<img>` com `pointer-events:none` sobre `#drawing`. Funções puras são exportadas por `module.exports` para teste no Node.

**Tech Stack:** JavaScript puro (ES2020, sem dependência em runtime) · `node --test` (Node 24) · `@playwright/test` com `channel: "chrome"` (Chrome instalado em `C:\Program Files\Google\Chrome`).

**Spec:** `docs/superpowers/specs/2026-10-26-gartic-helper-design.md`

## Global Constraints

- `helper.js` sem dependência em runtime; `@playwright/test` é a única devDependency.
- Fontes: Iconify `search?query=<en>&limit=12`, imagem `https://api.iconify.design/<prefixo>/<nome>.svg?height=512`; Openverse `?q=<en>&category=illustration&page_size=12`; MyMemory `get?q=<pt>&langpair=pt|en`.
- Timeout de 6 s por requisição (`AbortController`).
- Mensagem de busca vazia/falha, literal: `sem resultado — tente a outra aba ou edite o termo`.
- Opacidade inicial 30%, faixa 5–80%; tamanho 50–100%; ambos lembrados no `localStorage`.
- Toda chave de `localStorage` começa com `gartic_helper_`; todo acesso a `localStorage` passa por `ler`/`gravar` com `try/catch`.
- Todo id/classe criado pelo helper começa com `gh-`, para não colidir com o jogo.
- Textos da interface em pt-BR. Doc comment curto em pt-BR em toda função (regra do workspace).
- Commits: só depois de o dono autorizar; mensagem sem `Co-Authored-By` (regra do workspace).

## Review Focus

1. **Corrida entre rodadas** — resposta da busca da palavra anterior chegando depois da palavra nova não pode trocar a imagem (teste em Task 5).
2. **Palavra com acento e com espaço** ("maçã", "bob esponja") — URL codificada e letras de várias `.word` juntadas com espaço (testes em Task 1).
3. **Cota do MyMemory esgotada** — a resposta vem com status 200 e o aviso `MYMEMORY WARNING` no `translatedText`; usar a palavra original (teste em Task 1).
4. **Redimensionar a janela** — a sobreposição continua cobrindo `#drawing` (teste em Task 4).
5. **`localStorage` que lança exceção** (aba privada, bloqueio de site) — o helper funciona sem lembrar preferências (teste em Task 5).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `helper.js` | runtime inteiro: funções puras, leitura do DOM, busca, sobreposição, interface, observer |
| `index.html` | página do Pages com o bookmarklet |
| `README.md` | uso e aviso de sala pública |
| `package.json` | scripts `test:unit`, `test:e2e`; devDependency `@playwright/test` |
| `playwright.config.js` | `testDir: "test/e2e"`, `use.channel: "chrome"`, `headless: true` |
| `test/unit.test.js` | `node --test` das funções puras |
| `test/fixtures/*.json` | respostas reais gravadas das três APIs |
| `test/fixtures/gartic.html` | página que reproduz o contrato de DOM da spec |
| `test/e2e/*.spec.js` | testes Playwright |

`helper.js` é organizado em seções comentadas na ordem: CONFIG · FUNÇÕES PURAS · ARMAZENAMENTO · DOM DO JOGO · BUSCA · SOBREPOSIÇÃO · INTERFACE · CONTROLADOR · INÍCIO. As seções de DOM em diante só rodam quando `typeof window !== "undefined"`; ao fim, `if (typeof module !== "undefined") module.exports = { ...funções puras }`.

Tipo usado em todo o plano:

```js
/** @typedef {{ miniatura: string, grande: string, titulo: string }} Imagem */
/** @typedef {{ tipo: "parado" } | { tipo: "escolhendo", palavras: [string, string] } | { tipo: "desenhando", palavra: string }} Estado */
```

---

### Task 1: Esqueleto e funções puras

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules/`, `test-results/`, `playwright-report/`), `helper.js`, `test/unit.test.js`, `test/fixtures/iconify-cat.json`, `test/fixtures/openverse-giraffe.json`, `test/fixtures/mymemory-girafa.json`

**Interfaces:**
- Produces (exportadas):
  - `juntarLetras(palavras: string[][]): string` — junta letras de cada palavra, palavras separadas por espaço, `toLowerCase()`, `trim()`.
  - `urlTraducao(pt: string): string`
  - `lerTraducao(json: object, original: string): string`
  - `urlIconify(en: string): string`, `lerIconify(json: object): Imagem[]`
  - `urlOpenverse(en: string): string`, `lerOpenverse(json: object): Imagem[]`
  - `limitar(valor: number, min: number, max: number): number`

- [ ] **Step 1: Gravar as fixtures das APIs reais**

```bash
curl -s "https://api.iconify.design/search?query=cat&limit=12" -o test/fixtures/iconify-cat.json
curl -s "https://api.openverse.org/v1/images/?q=giraffe&category=illustration&page_size=12" -o test/fixtures/openverse-giraffe.json
curl -s "https://api.mymemory.translated.net/get?q=girafa&langpair=pt%7Cen" -o test/fixtures/mymemory-girafa.json
```
Expected: três arquivos JSON válidos (`node -e "require('./test/fixtures/iconify-cat.json')"` sem erro).

- [ ] **Step 2: Escrever os testes que falham**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helper.js");

test("juntarLetras junta palavras com espaço e minúsculas", () => {
  assert.equal(h.juntarLetras([["B","O","B"],["E","S","P","O","N","J","A"]]), "bob esponja");
});
test("urlTraducao codifica acento e o pipe", () => {
  assert.equal(h.urlTraducao("maçã"),
    "https://api.mymemory.translated.net/get?q=ma%C3%A7%C3%A3&langpair=pt%7Cen");
});
test("lerTraducao devolve a tradução em minúsculas", () => {
  assert.equal(h.lerTraducao(require("./fixtures/mymemory-girafa.json"), "girafa"), "giraffe");
});
test("lerTraducao cai na original com aviso de cota", () => {
  const json = { responseStatus: 200, responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY." } };
  assert.equal(h.lerTraducao(json, "girafa"), "girafa");
});
test("lerTraducao cai na original com status diferente de 200 ou texto vazio", () => {
  assert.equal(h.lerTraducao({ responseStatus: 429, responseData: { translatedText: "x" } }, "gato"), "gato");
  assert.equal(h.lerTraducao({ responseStatus: 200, responseData: { translatedText: "" } }, "gato"), "gato");
});
test("urlIconify e lerIconify", () => {
  assert.equal(h.urlIconify("hot dog"), "https://api.iconify.design/search?query=hot%20dog&limit=12");
  const imgs = h.lerIconify(require("./fixtures/iconify-cat.json"));
  assert.ok(imgs.length > 0 && imgs.length <= 12);
  assert.deepEqual(imgs[0], { miniatura: "https://api.iconify.design/mdi/cat.svg?height=512",
    grande: "https://api.iconify.design/mdi/cat.svg?height=512", titulo: "mdi:cat" });
});
test("lerIconify ignora id sem prefixo e json sem icons", () => {
  assert.deepEqual(h.lerIconify({ icons: ["semprefixo", "a:b"] }).map(i => i.titulo), ["a:b"]);
  assert.deepEqual(h.lerIconify({}), []);
});
test("urlOpenverse e lerOpenverse", () => {
  assert.equal(h.urlOpenverse("giraffe"),
    "https://api.openverse.org/v1/images/?q=giraffe&category=illustration&page_size=12");
  const imgs = h.lerOpenverse(require("./fixtures/openverse-giraffe.json"));
  assert.ok(imgs.length > 0);
  assert.ok(imgs.every(i => i.grande.startsWith("http") && i.miniatura.startsWith("http")));
  assert.deepEqual(h.lerOpenverse({}), []);
});
test("limitar", () => {
  assert.equal(h.limitar(90, 5, 80), 80);
  assert.equal(h.limitar(1, 5, 80), 5);
  assert.equal(h.limitar(30, 5, 80), 30);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test test/` · Expected: FAIL (`Cannot find module '../helper.js'` ou funções indefinidas).

- [ ] **Step 4: Implementar as funções puras em `helper.js`**

`lerTraducao`: original quando `responseStatus !== 200`, texto vazio ou texto que começa com `MYMEMORY WARNING`. `lerOpenverse`: `miniatura = r.thumbnail || r.url`, `grande = r.url`, `titulo = r.title || ""`. `package.json`: `"test:unit": "node --test test/"`, `"test:e2e": "playwright test"`.

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test test/` · Expected: 9 testes, 0 falhas.

- [ ] **Step 6: Commit** (após autorização) — `feat: funções puras de tradução e busca`

---

### Task 2: Leitura do estado do jogo pelo DOM

**Files:**
- Create: `playwright.config.js`, `test/fixtures/gartic.html`, `test/e2e/estado.spec.js`
- Modify: `helper.js` (seção DOM DO JOGO)

**Interfaces:**
- Consumes: `juntarLetras` (Task 1).
- Produces:
  - `lerEstado(doc: Document): Estado` — exposto em `window.__garticHelper.lerEstado` para teste.
  - Fixture `gartic.html` com `#canvas > #drawing > canvas#tela` (767×448; cliques no canvas contados em `window.cliques`) e as funções globais `estadoParado()`, `estadoEscolhendo(a, b)`, `estadoDesenhando(palavra)`, `estadoOutroDesenhando(mascara)`, que reescrevem o DOM exatamente como a tabela "Contrato de DOM" da spec: escolha em `#notification.yourTurn .containerWords .word span` (+ botão); desenhista em `#hint` com `button`, `div > .word > span` por letra e outro `button`; outro jogador em `#hint` com `h4` e letras `_` vazias.

- [ ] **Step 1: Escrever a fixture e o teste que falha**

```js
// test/e2e/estado.spec.js
const { test, expect } = require("@playwright/test");
const path = require("path");
const URL_FIXTURE = "file://" + path.resolve(__dirname, "../fixtures/gartic.html");
async function abrir(page) {
  await page.goto(URL_FIXTURE);
  await page.addScriptTag({ path: path.resolve(__dirname, "../../helper.js") });
}
const estado = page => page.evaluate(() => window.__garticHelper.lerEstado(document));

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
```

Nos testes de Task 2 as APIs não são chamadas (estado parado na carga); o controlador de Task 5 só é exercitado nos testes dele.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm i -D @playwright/test && npx playwright test test/e2e/estado.spec.js` · Expected: FAIL (`window.__garticHelper` indefinido).

- [ ] **Step 3: Implementar `lerEstado(doc)`**

Ordem de checagem: `.containerWords` → escolhendo (texto dos `span`, `trim().toLowerCase()`); senão `#hint` com `button` e sem `h4` → desenhando (`juntarLetras` das `.word`); senão parado.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx playwright test test/e2e/estado.spec.js` · Expected: 4 passed.

- [ ] **Step 5: Commit** (após autorização) — `feat: leitura do estado do jogo pelo DOM`

---

### Task 3: Busca com tradução, cache e timeout

**Files:**
- Modify: `helper.js` (seções ARMAZENAMENTO e BUSCA)
- Create: `test/e2e/apoio.js` (helpers de teste), `test/e2e/busca.spec.js`

**Interfaces:**
- Consumes: `urlTraducao`, `lerTraducao`, `urlIconify`, `lerIconify`, `urlOpenverse`, `lerOpenverse` (Task 1).
- Produces:
  - `ler(chave: string, padrao: any): any`, `gravar(chave: string, valor: any): void` — JSON no `localStorage`, `try/catch`, devolvem/ignoram em falha.
  - `buscarJson(url: string): Promise<object>` — `fetch` com `AbortController` de 6000 ms; rejeita em status não-2xx.
  - `traduzir(pt: string): Promise<string>` — cache `Map` + chave `gartic_helper_traducoes`; falha → `pt`.
  - `buscarImagens(fonte: "icone" | "ilustracao", termo: string): Promise<Imagem[]>` — falha → `[]`.
  - `test/e2e/apoio.js`: `abrir(page)`, `simularApis(page, { atrasoMs?, falhar? })` que responde as três APIs com as fixtures de Task 1 via `page.route` (header `access-control-allow-origin: *`), e `contarChamadas(page)`.
  - Expostos em `window.__garticHelper.traduzir` e `.buscarImagens`.

- [ ] **Step 1: Testes que falham**

```js
test("traduz e usa o cache na segunda vez", async ({ page }) => {
  const chamadas = await simularApis(page); await abrir(page);
  const r = await page.evaluate(async () => [await __garticHelper.traduzir("girafa"), await __garticHelper.traduzir("girafa")]);
  expect(r).toEqual(["giraffe", "giraffe"]);
  expect(chamadas.mymemory).toBe(1);
});
test("busca ícones e ilustrações", async ({ page }) => {
  await simularApis(page); await abrir(page);
  const [ic, il] = await page.evaluate(async () => [
    (await __garticHelper.buscarImagens("icone", "cat")).length,
    (await __garticHelper.buscarImagens("ilustracao", "giraffe")).length]);
  expect(ic).toBeGreaterThan(0); expect(il).toBeGreaterThan(0);
});
test("API fora do ar devolve lista vazia e tradução original", async ({ page }) => {
  await simularApis(page, { falhar: true }); await abrir(page);
  const r = await page.evaluate(async () => [await __garticHelper.traduzir("gato"), await __garticHelper.buscarImagens("icone", "cat")]);
  expect(r).toEqual(["gato", []]);
});
test("timeout de 6 s vira lista vazia", async ({ page }) => {
  test.setTimeout(15000);
  await simularApis(page, { atrasoMs: 8000 }); await abrir(page);
  expect(await page.evaluate(() => __garticHelper.buscarImagens("icone", "cat"))).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx playwright test test/e2e/busca.spec.js` · Expected: FAIL.
- [ ] **Step 3: Implementar** as funções do bloco Produces.
- [ ] **Step 4: Rodar e ver passar** — Expected: 4 passed.
- [ ] **Step 5: Commit** (após autorização) — `feat: busca com tradução, cache e timeout`

---

### Task 4: Sobreposição sobre o canvas

**Files:**
- Modify: `helper.js` (seção SOBREPOSIÇÃO)
- Create: `test/e2e/sobreposicao.spec.js`

**Interfaces:**
- Produces:
  - `mostrarSobreposicao(imagem: Imagem): void` — cria ou reaproveita `img#gh-sobreposicao` logo após `#drawing`; não faz nada se não houver `#drawing`.
  - `ajustarSobreposicao({ opacidade?: number, tamanho?: number, visivel?: boolean }): void` — opacidade e tamanho em %, passados por `limitar` com as faixas das Global Constraints; grava `gartic_helper_opacidade` e `gartic_helper_tamanho`.
  - `removerSobreposicao(): void`
  - `posicionarSobreposicao(): void` — copia `offsetLeft/Top/Width/Height` de `#drawing`; chamada em `resize` e a cada mutação.
  - Expostos em `window.__garticHelper`.

- [ ] **Step 1: Testes que falham**

```js
test("aparece sobre #drawing com 30% e deixa o clique passar", async ({ page }) => {
  await abrir(page); await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate(() => __garticHelper.mostrarSobreposicao({ miniatura: "data:,", grande: "data:,", titulo: "t" }));
  const img = page.locator("#gh-sobreposicao");
  await expect(img).toHaveCSS("opacity", "0.3");
  await expect(img).toHaveCSS("pointer-events", "none");
  expect(await img.boundingBox()).toEqual(await page.locator("#drawing").boundingBox());
  const box = await page.locator("#drawing").boundingBox();
  await page.mouse.click(box.x + 50, box.y + 50);
  expect(await page.evaluate(() => window.cliques)).toBe(1);
});
test("acompanha o redimensionamento", async ({ page }) => {
  await abrir(page); await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate(() => __garticHelper.mostrarSobreposicao({ miniatura: "data:,", grande: "data:,", titulo: "t" }));
  await page.setViewportSize({ width: 600, height: 500 });
  await expect.poll(async () => JSON.stringify(await page.locator("#gh-sobreposicao").boundingBox()))
    .toBe(JSON.stringify(await page.locator("#drawing").boundingBox()));
});
test("ajustes limitam e lembram; ocultar e remover", async ({ page }) => {
  await abrir(page); await page.evaluate(() => estadoDesenhando("GATO"));
  await page.evaluate(() => { __garticHelper.mostrarSobreposicao({ miniatura: "data:,", grande: "data:,", titulo: "t" });
    __garticHelper.ajustarSobreposicao({ opacidade: 95, tamanho: 60 }); });
  await expect(page.locator("#gh-sobreposicao")).toHaveCSS("opacity", "0.8");
  expect(await page.evaluate(() => localStorage.getItem("gartic_helper_tamanho"))).toBe("60");
  await page.evaluate(() => __garticHelper.ajustarSobreposicao({ visivel: false }));
  await expect(page.locator("#gh-sobreposicao")).toBeHidden();
  await page.evaluate(() => __garticHelper.removerSobreposicao());
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(0);
});
```

O tamanho 60% reduz a imagem dentro da caixa (via `transform: scale(0.6)` ou `padding`), sem mudar a caixa que cobre `#drawing`.

- [ ] **Step 2: Rodar e ver falhar** — Expected: FAIL.
- [ ] **Step 3: Implementar** as funções do bloco Produces.
- [ ] **Step 4: Rodar e ver passar** — Expected: 3 passed.
- [ ] **Step 5: Commit** (após autorização) — `feat: sobreposição da imagem sobre o canvas`

---

### Task 5: Interface e controlador

**Files:**
- Modify: `helper.js` (seções INTERFACE, CONTROLADOR, INÍCIO)
- Create: `test/e2e/fluxo.spec.js`

**Interfaces:**
- Consumes: `lerEstado` (T2), `traduzir`, `buscarImagens`, `ler`, `gravar` (T3), `mostrarSobreposicao`, `ajustarSobreposicao`, `removerSobreposicao`, `posicionarSobreposicao` (T4).
- Produces (ids usados pelos testes e pelo QA):
  - `#gh-bolinha` (arrastável, posição em `gartic_helper_pos`), `#gh-painel`.
  - Abas `button[data-fonte="icone"]` e `button[data-fonte="ilustracao"]`; aba ativa em `gartic_helper_fonte`, padrão `icone`.
  - Na escolha: `.gh-coluna` por palavra (duas), cada uma com título da palavra e `img.gh-miniatura`.
  - Desenhando: `#gh-termo` (input com o termo em inglês; Enter refaz a busca), `.gh-grade img.gh-miniatura`, `#gh-opacidade` (range 5–80), `#gh-tamanho` (range 50–100), `#gh-ocultar`.
  - `#gh-manual` (input de palavra manual; Enter busca e mostra como se fosse desenhando).
  - `.gh-aviso` com a mensagem literal das Global Constraints.
  - Guarda de inicialização: se `window.__garticHelper` já existir com `iniciado: true`, não monta de novo.
  - Controle de corrida: cada busca leva um número de geração; resposta de geração antiga é descartada.

- [ ] **Step 1: Testes que falham** — um teste por item, todos com `simularApis`:

```js
test("escolhendo abre o painel com duas colunas de miniaturas", /* critério 1 */ async ({ page }) => {
  await simularApis(page); await abrir(page);
  await page.evaluate(() => estadoEscolhendo("Gato", "Girafa"));
  await expect(page.locator("#gh-painel")).toBeVisible();
  await expect(page.locator(".gh-coluna")).toHaveCount(2);
  await expect(page.locator(".gh-coluna").nth(0).locator("img.gh-miniatura").first()).toBeVisible();
  await expect(page.locator(".gh-coluna").nth(1).locator("img.gh-miniatura").first()).toBeVisible();
});
test("desenhando aplica o primeiro ícone", /* critério 2 */ async ({ page }) => {
  await simularApis(page); await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveAttribute("src", "https://api.iconify.design/mdi/cat.svg?height=512");
});
test("fim do desenho remove a sobreposição", /* critério 4 */ async ({ page }) => { /* estadoDesenhando → estadoParado → toHaveCount(0) */ });
test("hint de outro jogador não abre nada", /* critério 5 */ async ({ page }) => { /* estadoOutroDesenhando → #gh-sobreposicao count 0, #gh-painel hidden */ });
test("trocar aba e miniatura troca a imagem", /* critério 6 */ async ({ page }) => { /* clicar data-fonte=ilustracao → src começa com a url da 1ª ilustração; clicar 2ª miniatura → src muda */ });
test("sem resultado mostra o aviso sem exceção", /* critério 7 */ async ({ page }) => {
  const erros = []; page.on("pageerror", e => erros.push(e));
  await simularApis(page, { falhar: true }); await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator(".gh-aviso")).toHaveText("sem resultado — tente a outra aba ou edite o termo");
  expect(erros).toEqual([]);
});
test("rodar duas vezes mantém uma bolinha", /* critério 8 */ async ({ page }) => {
  await abrir(page); await page.addScriptTag({ path: HELPER });
  await expect(page.locator("#gh-bolinha")).toHaveCount(1);
});
test("resposta atrasada da palavra anterior é descartada", /* Review Focus 1 */ async ({ page }) => {
  /* simularApis responde a busca de "cat" com atraso de 2 s e a de "giraffe" na hora;
     estadoDesenhando("GATO") → estadoParado() → estadoDesenhando("GIRAFA");
     esperar 3 s → src da sobreposição é o 1º resultado de giraffe, não mdi:cat */
});
test("localStorage que lança não quebra o helper", /* Review Focus 5 */ async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("bloqueado"); } }); });
  await simularApis(page); await abrir(page);
  await page.evaluate(() => estadoDesenhando("GATO"));
  await expect(page.locator("#gh-sobreposicao")).toHaveCount(1);
});
test("termo editado refaz a busca", async ({ page }) => { /* desenhando → preencher #gh-termo "giraffe" + Enter → chamada ao Iconify com query=giraffe */ });
test("palavra manual busca fora da vez", async ({ page }) => { /* estadoParado → #gh-manual "gato" + Enter → .gh-grade com miniaturas */ });
```

Para o teste da corrida, `simularApis` aceita `atrasoPorTermo: { cat: 2000 }`; acrescentar em `apoio.js`.

- [ ] **Step 2: Rodar e ver falhar** — `npx playwright test test/e2e/fluxo.spec.js` · Expected: FAIL.
- [ ] **Step 3: Implementar** interface e controlador. O observer chama `lerEstado` com debounce de 150 ms e só age quando o estado muda (comparar `JSON.stringify`). Estilo visual seguindo o Stopots (fundo `#17183a`, destaque `#29d3b2`), `z-index` 999999 na bolinha e no painel.
- [ ] **Step 4: Rodar a suíte inteira** — `npm run test:unit && npx playwright test` · Expected: 9 unit + 22 e2e passed, 0 falhas.
- [ ] **Step 5: Commit** (após autorização) — `feat: painel, prévia da escolha e controlador`

---

### Task 6: Página do bookmarklet e README

**Files:**
- Create: `index.html`, `README.md`, `test/e2e/pagina.spec.js`

**Interfaces:**
- Produces: bookmarklet idêntico em estrutura ao do Stopots, com `R='S2-DaPaz/Gartic-helper'` e arquivo `helper.js`:
  `javascript:(()=>{const R='S2-DaPaz/Gartic-helper',L=v=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/'+R+'@'+v+'/helper.js';document.body.appendChild(s)};fetch('https://api.github.com/repos/'+R+'/commits/main').then(r=>r.json()).then(c=>L(c.sha)).catch(()=>L('main'))})();`

- [ ] **Step 1: Teste que falha**

```js
test("página mostra o bookmarklet", async ({ page }) => {
  await page.goto("file://" + path.resolve(__dirname, "../../index.html"));
  const bm = await page.locator("#bm").inputValue();
  expect(bm.startsWith("javascript:")).toBe(true);
  expect(bm).toContain("S2-DaPaz/Gartic-helper");
  expect(bm).toContain("/helper.js");
});
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: FAIL.
- [ ] **Step 3: Escrever `index.html`** no visual do Stopots (sem service worker/manifest) e **`README.md`**: passo a passo do bookmarklet, o que cada controle faz, a limitação da tradução (editar o termo), e o aviso "Não use o helper em salas públicas: estraga a partida de quem joga com você."
- [ ] **Step 4: Rodar e ver passar** — Expected: 1 passed; suíte inteira 9 unit + 23 e2e.
- [ ] **Step 5: Commit** (após autorização) — `docs: página do bookmarklet e README`

---

### Task 7: QA numa partida real

Sem código novo; resultado vai para o relatório.

- [ ] **Step 1:** Abrir dois contextos do Chrome (Playwright, `headless: false`), criar sala privada em `gartic.io/create` num deles e entrar com o link no outro.
- [ ] **Step 2:** Se o Turnstile bloquear, parar aqui e registrar "partida real não testada — Turnstile bloqueou o navegador automatizado; teste fica com o dono".
- [ ] **Step 3:** Se entrar: injetar `helper.js` local com `addScriptTag` no contexto que vai desenhar; conferir na tela os critérios 1, 2, 3, 4 e 5 e tirar captura de cada um.
- [ ] **Step 4:** Divergência entre DOM real e fixture → corrigir `lerEstado` e a fixture juntos, e rodar a suíte de novo.
