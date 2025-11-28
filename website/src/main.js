import './style.css';

const EXAMPLES = [
  {
    id: 'dns',
    name: 'DNS RFC 1035',
    description: 'Complete DNS message implementation including compression pointers.',
    schema: 'examples/dns.schema.json',
    docs: 'examples/dns-docs.html'
  },
  {
    id: 'zip',
    name: 'ZIP Archive',
    description: 'ZIP file format with local headers, central directory, and computed CRCs.',
    schema: 'examples/zip.schema.json',
    docs: 'examples/zip-docs.html'
  },
  {
    id: 'png',
    name: 'PNG Image',
    description: 'PNG chunk-based format with variant-terminated arrays.',
    schema: 'examples/png.schema.json',
    docs: 'examples/png-docs.html'
  },
  {
    id: 'midi',
    name: 'MIDI File',
    description: 'Standard MIDI file format with variable-length quantities (VLQ).',
    schema: 'examples/midi.schema.json',
    docs: 'examples/midi-docs.html'
  },
  {
    id: 'kerberos',
    name: 'Kerberos',
    description: 'Kerberos authentication protocol with ASN.1 DER encoding.',
    schema: 'examples/kerberos.schema.json',
    docs: 'examples/kerberos-docs.html'
  },
  {
    id: 'sensornet',
    name: 'SensorNet Telemetry',
    description: 'Binary telemetry format for low-power sensor networks.',
    schema: 'examples/sensornet.schema.json',
    docs: 'examples/sensornet-docs.html'
  }
];

const renderExamples = () => {
  const container = document.querySelector('#examples-grid');

  EXAMPLES.forEach((example) => {
    const card = document.createElement('div');
    card.className = 'example-card';
    card.innerHTML = `
      <h3>${example.name}</h3>
      <p>${example.description}</p>
      <div class="example-links">
        <a href="${example.docs}">View Docs</a>
        <a href="${example.schema}" target="_blank" rel="noreferrer">Schema JSON</a>
      </div>
    `;
    container.appendChild(card);
  });
};

// Initialize
renderExamples();
