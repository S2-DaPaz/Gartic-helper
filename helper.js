(function () {
  // ======================
  // CONFIG
  // ======================
  const LIMITE_RESULTADOS = 12;
  const TIMEOUT_MS = 6000;
  const MSG_SEM_RESULTADO = "sem resultado — tente a outra aba ou edite o termo";

  /** @typedef {{ miniatura: string, grande: string, titulo: string }} Imagem */
  /** @typedef {{ tipo: "parado" } | { tipo: "escolhendo", palavras: [string, string] } | { tipo: "desenhando", palavra: string }} Estado */

  // ======================
  // FUNÇÕES PURAS
  // ======================

  /** Junta as letras de cada palavra do jogo numa frase em minúsculas, palavras separadas por espaço. */
  function juntarLetras(palavras) {
    return palavras.map((letras) => letras.join("")).join(" ").toLowerCase().trim();
  }

  /** Monta a URL do tradutor do Google (endpoint gtx, sem chave) para traduzir de português para inglês. */
  function urlTraducao(pt) {
    return "https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=en&dt=t&q=" + encodeURIComponent(pt);
  }

  /** Extrai a tradução da resposta do Google ([[[trecho, original], ...], ...]); cai na palavra original se vier inválida ou vazia. */
  function lerTraducao(json, original) {
    const trechos = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : [];
    const texto = trechos.map((t) => (Array.isArray(t) && typeof t[0] === "string" ? t[0] : "")).join("").trim();
    return texto ? texto.toLowerCase() : original;
  }

  /** Monta a URL de busca de ícones do Iconify. */
  function urlIconify(en) {
    return "https://api.iconify.design/search?query=" + encodeURIComponent(en) + "&limit=" + LIMITE_RESULTADOS;
  }

  /** Converte a resposta do Iconify em imagens SVG; a API devolve no mínimo 32, então corta em 12. */
  function lerIconify(json) {
    return ((json && json.icons) || [])
      .filter((id) => /^[\w-]+:[\w-]+$/.test(id))
      .slice(0, LIMITE_RESULTADOS)
      .map((id) => {
        const [prefixo, nome] = id.split(":");
        const url = "https://api.iconify.design/" + prefixo + "/" + nome + ".svg?height=512";
        return { miniatura: url, grande: url, titulo: id };
      });
  }

  /** Monta a URL de busca de ilustrações do Openverse. */
  function urlOpenverse(en) {
    return "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(en) +
      "&category=illustration&page_size=" + LIMITE_RESULTADOS;
  }

  /** Converte a resposta do Openverse em imagens (miniatura na grade, url original na sobreposição). */
  function lerOpenverse(json) {
    return ((json && json.results) || [])
      .filter((r) => r && r.url)
      .map((r) => ({ miniatura: r.thumbnail || r.url, grande: r.url, titulo: r.title || "" }));
  }

  /** Prende o valor entre min e max. */
  function limitar(valor, min, max) {
    return Math.min(max, Math.max(min, valor));
  }

  if (typeof module !== "undefined") {
    module.exports = { juntarLetras, urlTraducao, lerTraducao, urlIconify, lerIconify, urlOpenverse, lerOpenverse, limitar };
  }
  if (typeof window === "undefined") return;
  if (window.__garticHelper && window.__garticHelper.iniciado) return; // bookmarklet tocado de novo

  // ======================
  // ARMAZENAMENTO
  // ======================
  const PREFIXO = "gartic_helper_";

  /** Lê um valor JSON do localStorage; devolve o padrão se não houver ou se o navegador bloquear. */
  function ler(chave, padrao) {
    try {
      const bruto = localStorage.getItem(PREFIXO + chave);
      return bruto === null ? padrao : JSON.parse(bruto);
    } catch (e) {
      return padrao;
    }
  }

  /** Grava um valor JSON no localStorage; ignora em silêncio se o navegador bloquear. */
  function gravar(chave, valor) {
    try {
      localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
    } catch (e) {
      // aba privada ou site bloqueado: segue sem lembrar
    }
  }

  // ======================
  // DOM DO JOGO
  // ======================

  /** Lê em que momento o jogo está: escolhendo entre duas palavras, desenhando uma, ou parado. */
  function lerEstado(doc) {
    const escolha = doc.querySelectorAll("#notification.yourTurn .containerWords .word span");
    if (escolha.length >= 2) {
      return { tipo: "escolhendo", palavras: [0, 1].map((i) => escolha[i].textContent.trim().toLowerCase()) };
    }
    const hint = doc.getElementById("hint");
    if (hint && hint.querySelector("button") && !hint.querySelector("h4")) {
      const palavras = [...hint.querySelectorAll(".word")].map((w) => [...w.querySelectorAll("span")].map((s) => s.textContent));
      const palavra = juntarLetras(palavras);
      if (palavra) return { tipo: "desenhando", palavra };
    }
    return { tipo: "parado" };
  }

  // ======================
  // BUSCA
  // ======================
  const traducoes = new Map(Object.entries(ler("traducoes", {})));

  /** Busca JSON com timeout; rejeita em erro de rede, status não-2xx ou demora acima de TIMEOUT_MS. */
  async function buscarJson(url) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
    try {
      const resposta = await fetch(url, { signal: controle.signal });
      if (!resposta.ok) throw new Error("HTTP " + resposta.status);
      return await resposta.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Traduz pt→en com cache em memória e no localStorage; em falha devolve a própria palavra (sem cachear). */
  async function traduzir(pt) {
    if (traducoes.has(pt)) return traducoes.get(pt);
    try {
      const en = lerTraducao(await buscarJson(urlTraducao(pt)), pt);
      if (en !== pt) {
        traducoes.set(pt, en);
        gravar("traducoes", Object.fromEntries(traducoes));
      }
      return en;
    } catch (e) {
      return pt;
    }
  }

  /** Busca imagens do termo na fonte escolhida; qualquer falha vira lista vazia. */
  async function buscarImagens(fonte, termo) {
    try {
      return fonte === "icone"
        ? lerIconify(await buscarJson(urlIconify(termo)))
        : lerOpenverse(await buscarJson(urlOpenverse(termo)));
    } catch (e) {
      return [];
    }
  }

  // ======================
  // SOBREPOSIÇÃO
  // ======================
  const ajustes = { opacidade: limitar(ler("opacidade", 30), 5, 80), tamanho: limitar(ler("tamanho", 100), 50, 100), visivel: true };

  /**
   * Copia a caixa de #drawing para a sobreposição. As duas são irmãs, então medidas de layout (offset*)
   * valem para ambas mesmo com transform num ancestral. Usa a mesma camada (z-index) de #drawing:
   * no jogo ele tem z-index 1, e com "auto" a imagem ficava atrás do canvas branco; vindo logo depois
   * dele no DOM, fica por cima do canvas e abaixo da dica (z-index 2).
   */
  function posicionarSobreposicao() {
    const img = document.getElementById("gh-sobreposicao");
    const drawing = document.getElementById("drawing");
    if (!img || !drawing) return;
    Object.assign(img.style, {
      left: drawing.offsetLeft + "px", top: drawing.offsetTop + "px",
      width: drawing.offsetWidth + "px", height: drawing.offsetHeight + "px",
      zIndex: getComputedStyle(drawing).zIndex,
    });
  }

  /** Aplica opacidade, tamanho e visibilidade atuais na sobreposição, se ela existir. */
  function aplicarAjustes() {
    const img = document.getElementById("gh-sobreposicao");
    if (!img) return;
    img.style.opacity = String(ajustes.opacidade / 100);
    img.style.transform = "scale(" + ajustes.tamanho / 100 + ")";
    img.style.display = ajustes.visivel ? "block" : "none";
  }

  /** Mostra a imagem por cima de #drawing, sem capturar o mouse; não faz nada fora da tela de desenho. */
  function mostrarSobreposicao(imagem) {
    const drawing = document.getElementById("drawing");
    if (!drawing) return;
    let img = document.getElementById("gh-sobreposicao");
    if (!img) {
      img = document.createElement("img");
      img.id = "gh-sobreposicao";
      img.alt = "";
      Object.assign(img.style, { position: "absolute", objectFit: "contain", pointerEvents: "none", margin: "0" });
    }
    if (img.previousElementSibling !== drawing) drawing.after(img);
    img.src = imagem.grande;
    aplicarAjustes();
    posicionarSobreposicao();
  }

  /** Altera opacidade (5–80), tamanho (50–100) e visibilidade; os dois primeiros ficam lembrados. */
  function ajustarSobreposicao(novo) {
    if (novo.opacidade !== undefined) gravar("opacidade", ajustes.opacidade = limitar(Number(novo.opacidade), 5, 80));
    if (novo.tamanho !== undefined) gravar("tamanho", ajustes.tamanho = limitar(Number(novo.tamanho), 50, 100));
    if (novo.visivel !== undefined) ajustes.visivel = novo.visivel;
    aplicarAjustes();
  }

  /** Tira a sobreposição da página. */
  function removerSobreposicao() {
    const img = document.getElementById("gh-sobreposicao");
    if (img) img.remove();
  }

  // ======================
  // INTERFACE
  // ======================
  const CSS = `
    #gh-bolinha{position:fixed;right:16px;bottom:16px;z-index:999999;width:52px;height:52px;border-radius:50%;
      border:0;background:#29d3b2;color:#003b33;font-size:24px;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;touch-action:none}
    #gh-painel{position:fixed;right:16px;bottom:80px;z-index:999999;width:min(360px,calc(100vw - 32px));max-height:70vh;
      overflow:auto;background:#17183a;color:#fff;border-radius:16px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.45);
      font:14px system-ui,Segoe UI,Roboto,Arial;box-sizing:border-box}
    #gh-painel[hidden]{display:none}
    #gh-painel input[type=text]{width:100%;box-sizing:border-box;padding:8px;margin:4px 0;border-radius:10px;
      border:1px solid #2a2b5f;background:#0f1020;color:#fff}
    #gh-painel h4{margin:6px 0;font-size:15px}
    .gh-abas{display:flex;gap:6px;margin-bottom:6px}
    .gh-abas button,#gh-ocultar{flex:1;padding:8px;border:0;border-radius:10px;background:#2a2b5f;color:#fff;font-weight:700;cursor:pointer}
    .gh-abas button.gh-ativa{background:#29d3b2;color:#003b33}
    .gh-colunas{display:flex;gap:8px}
    .gh-coluna{flex:1;min-width:0}
    .gh-escolher{width:100%;margin:0 0 6px;padding:6px;border:0;border-radius:10px;background:#29d3b2;color:#003b33;font-weight:700;cursor:pointer}
    .gh-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}
    .gh-miniatura{width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:8px;cursor:pointer}
    .gh-aviso{opacity:.8;font-size:13px;margin:6px 0}
    .gh-controles label{display:block;margin-top:6px;font-size:13px}
    .gh-controles input[type=range]{width:100%}
  `;

  /** Cria um elemento com atributos e filhos, em uma linha. */
  function el(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => (k === "class" ? (e.className = v) : e.setAttribute(k, v)));
    filhos.forEach((f) => e.append(f));
    return e;
  }

  const ui = {};

  /** Monta a bolinha, o painel e os controles fixos (abas, palavra manual, opacidade, tamanho, ocultar). */
  function montarInterface() {
    document.head.append(el("style", { id: "gh-estilo" }, CSS));
    ui.bolinha = el("button", { id: "gh-bolinha", title: "Gartic Helper" }, "✏️");
    ui.abas = el("div", { class: "gh-abas" },
      el("button", { "data-fonte": "icone" }, "Ícone"),
      el("button", { "data-fonte": "ilustracao" }, "Ilustração"));
    ui.manual = el("input", { id: "gh-manual", type: "text", placeholder: "Buscar palavra (Enter)" });
    ui.conteudo = el("div", { id: "gh-conteudo" });
    ui.opacidade = el("input", { id: "gh-opacidade", type: "range", min: "5", max: "80", value: String(ajustes.opacidade) });
    ui.tamanho = el("input", { id: "gh-tamanho", type: "range", min: "50", max: "100", value: String(ajustes.tamanho) });
    ui.ocultar = el("button", { id: "gh-ocultar" }, "Ocultar imagem");
    ui.painel = el("div", { id: "gh-painel", hidden: "" }, ui.abas, ui.manual, ui.conteudo,
      el("div", { class: "gh-controles" },
        el("label", {}, "Opacidade", ui.opacidade), el("label", {}, "Tamanho", ui.tamanho), ui.ocultar));
    document.body.append(ui.painel, ui.bolinha);
    marcarAba();

    ui.abas.addEventListener("click", (ev) => {
      const fonte = ev.target.getAttribute("data-fonte");
      if (!fonte || fonte === fonteAtual) return;
      fonteAtual = fonte;
      gravar("fonte", fonte);
      marcarAba();
      renderizar();
    });
    ui.manual.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || !ui.manual.value.trim()) return;
      contexto = { tipo: "desenhando", palavra: ui.manual.value.trim().toLowerCase() };
      renderizar();
    });
    ui.conteudo.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.target.id !== "gh-termo" || !ev.target.value.trim()) return;
      contexto.termo = ev.target.value.trim();
      renderizar();
    });
    ui.conteudo.addEventListener("click", (ev) => {
      const grande = ev.target.getAttribute && ev.target.getAttribute("data-grande");
      if (grande) mostrarSobreposicao({ grande });
    });
    ui.opacidade.addEventListener("input", () => ajustarSobreposicao({ opacidade: ui.opacidade.value }));
    ui.tamanho.addEventListener("input", () => ajustarSobreposicao({ tamanho: ui.tamanho.value }));
    ui.ocultar.addEventListener("click", () => {
      ajustarSobreposicao({ visivel: !ajustes.visivel });
      ui.ocultar.textContent = ajustes.visivel ? "Ocultar imagem" : "Mostrar imagem";
    });
    tornarArrastavel();
  }

  /** Destaca a aba da fonte ativa. */
  function marcarAba() {
    ui.abas.querySelectorAll("button").forEach((b) => b.classList.toggle("gh-ativa", b.getAttribute("data-fonte") === fonteAtual));
  }

  /** Põe a bolinha em (x, y), sempre dentro da tela visível. */
  function moverBolinha(x, y) {
    Object.assign(ui.bolinha.style, {
      left: limitar(x, 0, innerWidth - 52) + "px", top: limitar(y, 0, innerHeight - 52) + "px", right: "auto", bottom: "auto",
    });
  }

  /** Bolinha arrastável (mouse e toque); toque sem arrastar abre/fecha o painel. Posição lembrada e trazida de volta à tela. */
  function tornarArrastavel() {
    const pos = ler("pos", null);
    if (pos) moverBolinha(pos.x, pos.y);
    window.addEventListener("resize", () => {
      if (ui.bolinha.style.left) moverBolinha(parseFloat(ui.bolinha.style.left), parseFloat(ui.bolinha.style.top));
    });
    let inicio = null;
    let arrastou = false;
    ui.bolinha.addEventListener("pointerdown", (ev) => {
      const r = ui.bolinha.getBoundingClientRect();
      inicio = { x: ev.clientX, y: ev.clientY, dx: ev.clientX - r.left, dy: ev.clientY - r.top };
      arrastou = false;
      ui.bolinha.setPointerCapture(ev.pointerId);
    });
    ui.bolinha.addEventListener("pointermove", (ev) => {
      if (!inicio) return;
      if (!arrastou && Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) < 6) return;
      arrastou = true;
      moverBolinha(ev.clientX - inicio.dx, ev.clientY - inicio.dy);
    });
    ui.bolinha.addEventListener("pointerup", () => {
      if (arrastou) gravar("pos", { x: parseFloat(ui.bolinha.style.left), y: parseFloat(ui.bolinha.style.top) });
      else ui.painel.hidden = !ui.painel.hidden;
      inicio = null;
    });
  }

  /** Grade de miniaturas, ou o aviso de sem resultado. */
  function grade(imagens) {
    if (!imagens.length) return el("div", { class: "gh-aviso" }, MSG_SEM_RESULTADO);
    return el("div", { class: "gh-grade" }, ...imagens.map((i) =>
      el("img", { class: "gh-miniatura", src: i.miniatura, "data-grande": i.grande, title: i.titulo, alt: i.titulo, loading: "lazy" })));
  }

  // ======================
  // CONTROLADOR
  // ======================
  let fonteAtual = ler("fonte", "icone") === "ilustracao" ? "ilustracao" : "icone";
  let contexto = { tipo: "parado" };
  let geracao = 0;

  /** Redesenha o painel para o contexto atual; respostas de uma geração antiga são descartadas. */
  async function renderizar() {
    const g = ++geracao;
    const atual = contexto;
    const fonte = fonteAtual;
    if (atual.tipo === "escolhendo") {
      // o painel cobre parte da tela de escolha, então cada coluna tem o próprio botão de escolher
      const colunas = atual.palavras.map((p, i) => {
        const escolher = el("button", { class: "gh-escolher" }, "Desenhar esta");
        escolher.addEventListener("click", () => {
          const botao = document.querySelectorAll("#notification.yourTurn .containerWords .word button")[i];
          if (botao) botao.click();
        });
        return el("div", { class: "gh-coluna" }, el("h4", {}, p), escolher, el("div", { class: "gh-aviso" }, "buscando…"));
      });
      ui.conteudo.replaceChildren(el("div", { class: "gh-colunas" }, ...colunas));
      await Promise.all(atual.palavras.map(async (p, i) => {
        const imagens = await buscarImagens(fonte, await traduzir(p));
        if (g === geracao) colunas[i].lastChild.replaceWith(grade(imagens.slice(0, 6)));
      }));
      return;
    }
    if (atual.tipo === "desenhando") {
      const termo = atual.termo || (atual.termo = await traduzir(atual.palavra));
      if (g !== geracao) return;
      const campo = el("input", { id: "gh-termo", type: "text", value: termo, title: "Termo em inglês (Enter refaz a busca)" });
      const lugar = el("div", { class: "gh-aviso" }, "buscando…");
      ui.conteudo.replaceChildren(el("h4", {}, atual.palavra), campo, lugar);
      const imagens = await buscarImagens(fonte, termo);
      if (g !== geracao) return;
      lugar.replaceWith(grade(imagens));
      if (imagens.length) mostrarSobreposicao(imagens[0]);
      return;
    }
    ui.conteudo.replaceChildren();
  }

  /** Reage a uma mudança de estado do jogo. */
  function mudarEstado(estado) {
    contexto = estado;
    if (estado.tipo === "escolhendo") ui.painel.hidden = false;
    if (estado.tipo === "desenhando") ui.painel.hidden = true; // não cobrir o canvas
    if (estado.tipo === "parado") {
      ui.painel.hidden = true;
      removerSobreposicao();
    }
    renderizar();
  }

  // ======================
  // INÍCIO
  // ======================
  let ultimo = JSON.stringify({ tipo: "parado" });
  let espera = null;

  /** Lê o estado do jogo e só age quando ele muda. */
  function verificar() {
    posicionarSobreposicao();
    const estado = lerEstado(document);
    const chave = JSON.stringify(estado);
    if (chave === ultimo) return;
    ultimo = chave;
    mudarEstado(estado);
  }

  montarInterface();
  window.addEventListener("resize", posicionarSobreposicao);
  // throttle, não debounce: com chat e cronômetro mudando sem parar, um debounce adiaria para sempre
  new MutationObserver(() => {
    if (espera) return;
    espera = setTimeout(() => {
      espera = null;
      verificar();
    }, 150);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  verificar();

  window.__garticHelper = Object.assign(window.__garticHelper || {}, {
    iniciado: true,
    lerEstado, traduzir, buscarImagens,
    mostrarSobreposicao, ajustarSobreposicao, removerSobreposicao, posicionarSobreposicao,
  });
})();
