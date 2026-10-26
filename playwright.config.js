// Testes de navegador rodam no Chrome instalado, sem baixar navegador do Playwright.
module.exports = {
  testDir: "test/e2e",
  use: { channel: "chrome", headless: true },
};
