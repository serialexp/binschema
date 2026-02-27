/**
 * Shared site header injected into all pages.
 * Import this module to replace <header class="site-header"></header> with the canonical header.
 */

const HEADER_HTML = `
    <div class="container">
      <div class="branding">
        <a href="/" class="logo">BinSchema</a>
        <p class="tagline">Bit-level binary schema generator with multi-language tooling.</p>
      </div>
      <nav class="site-nav">
        <a href="/" data-page="home">Home</a>
        <a href="/#schema-reference" data-page="home">Schema Reference</a>
        <a href="/#examples" data-page="home">Examples</a>
        <a href="/recipes.html" data-page="recipes">Recipes</a>
        <a href="/playground.html" data-page="playground">Playground</a>
        <a href="https://github.com/serialexp/binschema" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </div>`;

export function initHeader() {
  const header = document.querySelector('header.site-header');
  if (!header) return;
  header.innerHTML = HEADER_HTML;
}

initHeader();
