# Gartic Helper

Não use o helper em salas públicas. Ele estraga a partida de quem joga com você.

Na sua vez de desenhar no [gartic.io](https://gartic.io), o helper lê a palavra, busca uma imagem
dela e a coloca por cima da área de desenho com pouca opacidade. Você desenha por cima. A imagem
é só um elemento da sua tela e não entra no desenho, então os outros jogadores não a veem.

Funciona por bookmarklet, no computador e no navegador do celular. Não precisa de extensão nem de
download, e não funciona no aplicativo do Gartic.

## Como usar

1. Acesse https://s2-dapaz.github.io/Gartic-helper e clique em "Copiar bookmarklet".
2. No navegador, crie um favorito (ou edite um existente) e cole o bookmarklet no campo URL.
3. Abra https://gartic.io e entre numa sala.
4. Toque no favorito "Gartic Helper". A bolinha ✏️ aparece no canto da tela.

## Durante o jogo

- **Escolha da palavra:** o painel abre sozinho com imagens das duas palavras sorteadas, para
  você escolher a mais fácil de desenhar. O botão "Desenhar esta" de cada coluna escolhe a palavra
  no jogo, porque o painel cobre parte da tela de escolha.
- **Desenhando:** a primeira imagem da aba ativa aparece por cima da tela. O painel fecha para
  não cobrir o desenho. Toque na bolinha para abri-lo.
- **Abas Ícone / Ilustração:** ícone (Iconify) tem traço limpo e é o mais fácil de decalcar.
  Ilustração (Openverse) cobre mais palavras. A aba escolhida fica lembrada.
- **Miniaturas:** toque em outra miniatura para trocar a imagem.
- **Opacidade, tamanho e ocultar:** ajustam a imagem. Opacidade e tamanho ficam lembrados.
- **Buscar palavra:** busca qualquer palavra fora da sua vez, ou quando a leitura automática
  falhar.
- **Arrastar a bolinha:** muda a posição dela, que fica salva.

## Tradução

As duas fontes de imagem buscam em inglês. A palavra é traduzida pelo tradutor do Google
(endpoint público, sem chave). Palavra ambígua pode sair com o sentido errado: "manga" sai
"sleeve" (a da camisa) mesmo quando era a fruta. O termo em inglês aparece no painel. Corrija o
termo e aperte Enter para buscar de novo.

Se a tradução falhar, o helper busca com a palavra em português.

O MyMemory foi a primeira opção e foi descartado depois de uma partida real: ele devolve a
memória de tradução colaborativa, e "pinguim" virou "linux" e "mico-leão-dourado" virou "how to
spell blue macaw in english".

## Desenvolvimento

```bash
npm install
npm run test:unit   # funções puras, node --test
npm run test:e2e    # Playwright no Chrome instalado, com as APIs simuladas
```

`test/fixtures/gartic.html` reproduz o DOM do gartic.io, lido do bundle da página de sala.
Se o jogo mudar e o helper parar de ler a palavra, comece por `lerEstado` em `helper.js` e por
essa fixture.
