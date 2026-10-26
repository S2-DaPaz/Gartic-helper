const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const URL_FIXTURE = "file://" + path.resolve(__dirname, "../fixtures/gartic.html");
const HELPER = path.resolve(__dirname, "../../helper.js");
const fixture = (nome) => fs.readFileSync(path.resolve(__dirname, "../fixtures", nome), "utf8");
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Abre a fixture do gartic e injeta o helper, como o bookmarklet faria. */
async function abrir(page) {
  await page.goto(URL_FIXTURE);
  await page.addScriptTag({ path: HELPER });
}

/**
 * Responde as três APIs e as imagens com as fixtures gravadas, sem rede.
 * Devolve contadores de chamadas e a lista de URLs de busca pedidas.
 * opcoes: falhar (aborta as APIs), atrasoMs (todas), atrasoPorTermo ({ cat: 2000 }).
 */
async function simularApis(page, opcoes = {}) {
  const chamadas = { traducao: 0, iconify: 0, openverse: 0, urls: [] };
  await page.route(/^https?:\/\//, async (route) => {
    const url = route.request().url();
    const termo = new URL(url).searchParams.get("query") || new URL(url).searchParams.get("q") || "";
    let corpo = null;
    if (url.includes("translate.googleapis.com")) {
      chamadas.traducao++;
      const pt = termo;
      const en = { girafa: "giraffe", gato: "cat" }[pt] || pt;
      corpo = JSON.stringify([[[en, pt, null, null, 10]], null, "pt"]);
    } else if (url.includes("api.iconify.design/search")) {
      chamadas.iconify++;
      corpo = termo === "giraffe" ? JSON.stringify({ icons: ["fxemoji:giraffe", "noto:giraffe"] }) : fixture("iconify-cat.json");
    } else if (url.includes("api.openverse.org/v1/images/?")) {
      chamadas.openverse++;
      corpo = fixture("openverse-giraffe.json");
    }
    if (corpo === null) {
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG, headers: { "access-control-allow-origin": "*" } });
    }
    chamadas.urls.push(url);
    if (opcoes.falhar) return route.abort();
    const atraso = (opcoes.atrasoPorTermo && opcoes.atrasoPorTermo[termo]) || opcoes.atrasoMs || 0;
    if (atraso) await espera(atraso);
    try {
      await route.fulfill({ status: 200, contentType: "application/json", body: corpo, headers: { "access-control-allow-origin": "*" } });
    } catch (e) {
      // pedido já abortado pelo timeout do helper
    }
  });
  return chamadas;
}

/** Cor RGB de um pixel da tela, lida de um print 1×1 (o PNG de 1 pixel não depende do filtro de linha). */
async function corNoPonto(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const dados = [];
  for (let i = 8; i < png.length;) {
    const tamanho = png.readUInt32BE(i);
    if (png.toString("ascii", i + 4, i + 8) === "IDAT") dados.push(png.subarray(i + 8, i + 8 + tamanho));
    i += 12 + tamanho;
  }
  const bruto = zlib.inflateSync(Buffer.concat(dados));
  return [bruto[1], bruto[2], bruto[3]];
}

/** Duas caixas iguais com tolerância de 1px (subpixel). */
function caixasIguais(a, b) {
  return ["x", "y", "width", "height"].every((k) => Math.abs(a[k] - b[k]) <= 1);
}

module.exports = { URL_FIXTURE, HELPER, abrir, simularApis, corNoPonto, caixasIguais };
