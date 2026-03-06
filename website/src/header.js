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
        <a href="/#schema-reference">Schema Reference</a>
        <a href="/#examples">Examples</a>
        <a href="/recipes.html" data-page="recipes">Recipes</a>
        <a href="/playground.html" data-page="playground">Playground</a>
        <a href="https://github.com/serialexp/binschema" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </div>`;

export function initHeader() {
  const header = document.querySelector('header.site-header');
  if (!header) return;
  header.innerHTML = HEADER_HTML;

  // Determine current page from pathname
  const path = window.location.pathname;
  let currentPage = 'home';
  if (path.includes('recipes')) currentPage = 'recipes';
  else if (path.includes('playground')) currentPage = 'playground';

  // Mark matching nav links as active
  header.querySelectorAll('.site-nav a[data-page]').forEach(link => {
    if (link.dataset.page === currentPage) {
      link.classList.add('active');
    }
  });
}

initHeader();
