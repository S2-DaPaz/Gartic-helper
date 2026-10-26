# Gartic Helper — design

Data: 2026-10-26 · Status: aguardando revisão do dono

## Objetivo

Bookmarklet para o gartic.io que, na vez do jogador desenhar, lê a palavra, busca uma
imagem limpa dela e a sobrepõe ao canvas com opacidade baixa, para o jogador desenhar
por cima. Mesmo formato do Stopots Helper (`S2-DaPaz/Stopts-cheat`): página no GitHub
Pages com "Copiar bookmarklet" e bolinha flutuante dentro do jogo.

## Decisões do dono

| Pergunta | Resposta |
|---|---|
| Fonte de imagem | Iconify (ícone) **e** Openverse (ilustração); o usuário escolhe a aba por palavra |
| Onde mora | Repositório novo `S2-DaPaz/Gartic-helper` |
| Prévia na escolha | Sim — mostrar imagens das duas palavras sorteadas antes de escolher |

## Fatos verificados (2026-10-26)

- `gartic.io` **não** envia `Content-Security-Policy`: injetar `<script>` do jsDelivr e
  carregar imagem/fetch de outro domínio funciona.
- Respondem com `access-control-allow-origin: *` e sem chave: Iconify
  (`api.iconify.design/search`), MyMemory (`api.mymemory.translated.net/get`), Openverse
  (`api.openverse.org/v1/images/`).
- Contrato de DOM, lido do bundle `/_next/static/chunks/pages/room-3be36ccf3a3828bde5af.js`
  (**não** confirmado numa partida real):

| Momento | Elemento |
|---|---|
| Escolha da palavra (vez do jogador) | `#notification.yourTurn .containerWords .word span` — duas palavras |
| Desenhando (vez do jogador) | `#hint .word span` — uma letra por span, palavra em maiúsculas, várias `.word` quando há espaço; o `#hint` do desenhista tem `button` e **não** tem `h4` |
| Outro jogador desenhando | `#hint` com `h4` e `_` no lugar das letras ocultas — ignorar |
| Área de desenho | `#canvas > #drawing` |

O bookmarklet roda depois que o WebSocket do jogo já abriu, então interceptar o socket
não é opção; a fonte é o DOM.

## Arquivos

- `index.html` — página do Pages; botão "Copiar bookmarklet". O bookmarklet consulta
  `api.github.com/repos/S2-DaPaz/Gartic-helper/commits/main` e carrega `helper.js` pelo
  jsDelivr fixado nesse SHA; se a API falhar, usa `@main`. Mesmo padrão do Stopots.
- `helper.js` — IIFE com toda a lógica. Funções puras exportadas via `module.exports`
  quando `module` existe, para teste no Node. Rodar o bookmarklet duas vezes não duplica
  a interface.
- `README.md` — como usar, e o aviso: não usar em sala pública.
- `test/` — testes `node --test` e fixtures.
- Sem service worker e sem manifest de PWA.

## Comportamento

### Detecção

`MutationObserver` no `body`, com debounce, mantém um de três estados:

- **parado** — nenhum dos elementos abaixo presente.
- **escolhendo** — `.containerWords` presente: guarda as duas palavras e busca as duas.
- **desenhando** — `#hint` do desenhista presente: palavra = letras de cada `.word`
  juntadas, palavras separadas por espaço, em minúsculas.

Saindo de **desenhando**, a sobreposição é removida. Campo de palavra manual no painel
força a busca de qualquer termo, em qualquer estado.

### Busca

1. Traduz pt→en no MyMemory; cache em memória e no `localStorage`.
2. O termo em inglês fica editável no painel; editar e confirmar refaz a busca.
3. **Ícone**: Iconify `search?query=<en>&limit=12`; imagem
   `https://api.iconify.design/<prefixo>/<nome>.svg?height=512`.
4. **Ilustração**: Openverse `?q=<en>&category=illustration&page_size=12`; usa a
   miniatura na grade e a `url` na sobreposição.
5. Timeout de 6 s por requisição (`AbortController`). Falha ou lista vazia mostra
   "sem resultado — tente a outra aba ou edite o termo". Falha na tradução usa a
   palavra original como termo.

### Sobreposição

- `<img>` inserido logo após `#drawing`, dentro de `#canvas`, cobrindo a área do
  `#drawing`; `object-fit: contain`, `pointer-events: none`, opacidade inicial 30%.
- Ao entrar em **desenhando**, aplica sozinho o primeiro resultado da aba ativa; tocar
  outra miniatura troca a imagem.
- Controles: opacidade (5–80%), tamanho (50–100%), mostrar/ocultar. Opacidade e
  tamanho são lembrados no `localStorage`.
- Sem arrastar a imagem (brigaria com o traço).
- A imagem não entra no desenho: é elemento da página, não pixel do canvas.

### Interface

- Bolinha flutuante arrastável, posição salva no `localStorage`; toque abre o painel.
- Escolhendo: o painel abre sozinho com as duas palavras lado a lado, cada uma com as
  miniaturas da aba ativa.
- Desenhando: palavra, termo em inglês editável, abas Ícone/Ilustração, grade de
  miniaturas, controles.
- Funciona em desktop e navegador mobile.

## Critérios de aceite

1. Com a fixture de DOM em estado **escolhendo**, o painel abre e mostra miniaturas das
   duas palavras.
2. Com a fixture em estado **desenhando**, a sobreposição aparece sobre `#drawing` com
   o primeiro resultado da aba ativa e opacidade 30%.
3. Um clique sobre a sobreposição chega ao canvas (`pointer-events: none`).
4. Removido o `#hint` do desenhista, a sobreposição some.
5. `#hint` de outro jogador (com `h4`) não dispara nada.
6. Trocar de aba ou de miniatura troca a imagem; os controles alteram opacidade e
   tamanho.
7. Fonte fora do ar ou sem resultado mostra a mensagem, sem exceção não tratada
   (`pageerror`/`unhandledrejection`); o erro de rede que o navegador registra sozinho
   não conta.
8. Rodar o bookmarklet duas vezes mantém uma bolinha só.

## Verificação

- `node --test` nas funções puras: URLs, parse das respostas (JSON gravado) e leitura da
  palavra a partir de fragmentos de HTML.
- Playwright numa página local que reproduz o DOM do gartic, cobrindo os critérios 1–8.
- Partida real com dois navegadores numa sala privada, **se** o Turnstile da Cloudflare
  deixar. Se não deixar, o teste em partida fica com o dono e o relatório diz isso.
