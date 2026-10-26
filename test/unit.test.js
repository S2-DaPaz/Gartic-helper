const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helper.js");

test("juntarLetras junta palavras com espaço e minúsculas", () => {
  assert.equal(h.juntarLetras([["B", "O", "B"], ["E", "S", "P", "O", "N", "J", "A"]]), "bob esponja");
});

test("urlTraducao usa o Google e codifica acento", () => {
  assert.equal(h.urlTraducao("maçã"),
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=en&dt=t&q=ma%C3%A7%C3%A3");
});

test("lerTraducao devolve a tradução em minúsculas", () => {
  assert.equal(h.lerTraducao(require("./fixtures/google-pinguim.json"), "pinguim"), "penguin");
});

test("lerTraducao junta os segmentos", () => {
  assert.equal(h.lerTraducao([[["Golden ", "mico-"], ["lion tamarin", "leão-dourado"]]], "mico-leão-dourado"), "golden lion tamarin");
});

test("lerTraducao cai na original com resposta inválida ou vazia", () => {
  assert.equal(h.lerTraducao(null, "gato"), "gato");
  assert.equal(h.lerTraducao({ error: "x" }, "gato"), "gato");
  assert.equal(h.lerTraducao([[["", "gato"]]], "gato"), "gato");
});

test("urlIconify e lerIconify", () => {
  assert.equal(h.urlIconify("hot dog"), "https://api.iconify.design/search?query=hot%20dog&limit=12");
  const imgs = h.lerIconify(require("./fixtures/iconify-cat.json"));
  assert.ok(imgs.length > 0 && imgs.length <= 12);
  assert.deepEqual(imgs[0], { miniatura: "https://api.iconify.design/mdi/cat.svg?height=512",
    grande: "https://api.iconify.design/mdi/cat.svg?height=512", titulo: "mdi:cat" });
});

test("lerIconify ignora id sem prefixo e json sem icons", () => {
  assert.deepEqual(h.lerIconify({ icons: ["semprefixo", "a:b"] }).map((i) => i.titulo), ["a:b"]);
  assert.deepEqual(h.lerIconify({}), []);
});

test("urlOpenverse e lerOpenverse", () => {
  assert.equal(h.urlOpenverse("giraffe"),
    "https://api.openverse.org/v1/images/?q=giraffe&category=illustration&page_size=12");
  const imgs = h.lerOpenverse(require("./fixtures/openverse-giraffe.json"));
  assert.ok(imgs.length > 0);
  assert.ok(imgs.every((i) => i.grande.startsWith("http") && i.miniatura.startsWith("http")));
  assert.deepEqual(h.lerOpenverse({}), []);
});

test("limitar", () => {
  assert.equal(h.limitar(90, 5, 80), 80);
  assert.equal(h.limitar(1, 5, 80), 5);
  assert.equal(h.limitar(30, 5, 80), 30);
});
