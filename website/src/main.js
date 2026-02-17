import './style.css';

import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-bash';

const EXAMPLES = [
  {
    id: 'dns',
    name: 'DNS RFC 1035',
    description: 'Complete DNS message implementation including compression pointers.',
    tags: ['bit-level flags', 'compression pointers', 'discriminated unions'],
    schema: '/examples/dns.schema.json',
    docs: '/examples/dns-docs.html'
  },
  {
    id: 'zip',
    name: 'ZIP Archive',
    description: 'ZIP file format with local headers, central directory, and computed CRCs.',
    tags: ['CRC32 checksums', 'computed lengths', 'random access'],
    schema: '/examples/zip.schema.json',
    docs: '/examples/zip-docs.html'
  },
  {
    id: 'png',
    name: 'PNG Image',
    description: 'PNG chunk-based format with variant-terminated arrays.',
    tags: ['variant-terminated arrays', 'CRC32', 'chunk-based'],
    schema: '/examples/png.schema.json',
    docs: '/examples/png-docs.html'
  },
  {
    id: 'midi',
    name: 'MIDI File',
    description: 'Standard MIDI file format with variable-length quantities (VLQ).',
    tags: ['variable-length integers', 'VLQ encoding', 'nested structures'],
    schema: '/examples/midi.schema.json',
    docs: '/examples/midi-docs.html'
  },
  {
    id: 'kerberos',
    name: 'Kerberos',
    description: 'Kerberos authentication protocol with ASN.1 DER encoding.',
    tags: ['ASN.1 DER', 'variable-length integers', 'computed lengths'],
    schema: '/examples/kerberos.schema.json',
    docs: '/examples/kerberos-docs.html'
  },
  {
    id: 'sensornet',
    name: 'SensorNet Telemetry',
    description: 'Binary telemetry format for low-power sensor networks.',
    tags: ['bit-packed fields', 'conditional fields', 'compact encoding'],
    schema: '/examples/sensornet.schema.json',
    docs: '/examples/sensornet-docs.html'
  }
];

const renderExamples = () => {
  const container = document.querySelector('#examples-grid');

  EXAMPLES.forEach((example) => {
    const card = document.createElement('div');
    card.className = 'example-card';
    const tagsHtml = example.tags
      ? `<div class="example-tags">${example.tags.map(t => `<span class="example-tag">${t}</span>`).join('')}</div>`
      : '';
    card.innerHTML = `
      <h3>${example.name}</h3>
      <p>${example.description}</p>
      ${tagsHtml}
      <div class="example-links">
        <a href="${example.docs}">View Docs</a>
        <a href="${example.schema}" target="_blank" rel="noreferrer">Schema JSON</a>
      </div>
    `;
    container.appendChild(card);
  });
};

// Synchronized tab switching across all tab groups
const initTabs = () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.tab;

      // Update ALL tab groups on the page so they stay in sync
      document.querySelectorAll('.code-tabs').forEach(group => {
        group.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === lang);
        });
        group.querySelectorAll('.tab-panel').forEach(panel => {
          panel.hidden = panel.dataset.tab !== lang;
        });
      });

      // Re-highlight any newly-visible code blocks (Prism skips hidden elements)
      Prism.highlightAll();
    });
  });
};

// Initialize
renderExamples();
initTabs();
Prism.highlightAll();
