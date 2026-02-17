import './style.css';
import './playground.css';

import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';

import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';

import {
  generateTypeScript,
  generateGo,
  generateRust,
  BinarySchemaSchema,
  validateSchema,
} from 'binschema';

// =============================================================================
// Example Schemas
// =============================================================================

const EXAMPLES = {
  sensor: JSON.stringify({
    config: { endianness: "big_endian" },
    types: {
      SensorReading: {
        sequence: [
          { name: "device_id", type: "uint16" },
          { name: "temperature", type: "float32" },
          { name: "humidity", type: "uint8" },
          { name: "timestamp", type: "uint32" }
        ]
      }
    }
  }, null, 2),

  packet: JSON.stringify({
    config: { endianness: "big_endian" },
    types: {
      Packet: {
        sequence: [
          { name: "version", type: "uint8" },
          { name: "type", type: "uint8" },
          { name: "length", type: "uint16", computed: { type: "length_of", target: "payload" } },
          { name: "payload", type: "array", kind: "field_referenced", length_field: "length", items: "uint8" },
          { name: "checksum", type: "uint32" }
        ]
      }
    }
  }, null, 2),

  bitfield: JSON.stringify({
    config: { endianness: "big_endian", bit_order: "msb_first" },
    types: {
      StatusFlags: {
        sequence: [
          { name: "power_on", type: "bit", size: 1 },
          { name: "error", type: "bit", size: 1 },
          { name: "mode", type: "bit", size: 3 },
          { name: "reserved", type: "bit", size: 3 },
          { name: "sensor_id", type: "uint8" },
          { name: "reading", type: "float32" }
        ]
      }
    }
  }, null, 2),
};

// =============================================================================
// State
// =============================================================================

let debounceTimer = null;

// =============================================================================
// Editor Setup
// =============================================================================

const initialSchema = getSchemaFromURL() || EXAMPLES.sensor;

const editor = new EditorView({
  state: EditorState.create({
    doc: initialSchema,
    extensions: [
      basicSetup,
      json(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          scheduleGeneration();
        }
      }),
    ],
  }),
  parent: document.getElementById('editor-container'),
});

// =============================================================================
// Code Generation
// =============================================================================

function scheduleGeneration() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(generate, 400);
}

function generate() {
  const source = editor.state.doc.toString();

  // Step 1: Parse JSON
  let rawSchema;
  try {
    rawSchema = JSON.parse(source);
  } catch (err) {
    showError(`JSON parse error: ${err.message}`);
    return;
  }

  // Step 2: Validate with Zod schema
  let schema;
  try {
    schema = BinarySchemaSchema.parse(rawSchema);
  } catch (err) {
    const issues = err.issues || [{ message: err.message }];
    const msg = issues
      .map(i => `${i.path?.join('.') || 'root'}: ${i.message}`)
      .join('\n');
    showError(`Schema validation error:\n${msg}`);
    return;
  }

  // Step 3: Semantic validation
  const validation = validateSchema(schema);
  if (!validation.valid) {
    const msg = validation.errors
      .map(e => `${e.path || ''}: ${e.message}`)
      .join('\n');
    showError(`Validation error:\n${msg}`);
    return;
  }

  // Step 4: Generate code
  clearError();

  // TypeScript: generates all types at once
  try {
    const tsCode = generateTypeScript(schema);
    setOutput('typescript', tsCode);
  } catch (err) {
    setOutput('typescript', `// Generation error: ${err.message}`);
  }

  // Go and Rust: generate per type, skip generic types (containing '<')
  const typeNames = Object.keys(schema.types).filter(n => !n.includes('<'));

  // Go
  try {
    const goOutputs = typeNames.map(name => {
      const result = generateGo(schema, name);
      return result.code;
    });
    setOutput('go', goOutputs.join('\n\n'));
  } catch (err) {
    setOutput('go', `// Generation error: ${err.message}`);
  }

  // Rust
  try {
    const rustOutputs = typeNames.map(name => {
      const result = generateRust(schema, name);
      return result.code;
    });
    setOutput('rust', rustOutputs.join('\n\n'));
  } catch (err) {
    setOutput('rust', `// Generation error: ${err.message}`);
  }
}

// =============================================================================
// Output Rendering
// =============================================================================

function setOutput(lang, code) {
  const el = document.getElementById(`output-${lang}`);
  el.textContent = code;
  // Only highlight if the panel is visible
  if (!el.closest('.tab-panel')?.hidden) {
    Prism.highlightElement(el);
  }
}

function showError(msg) {
  const panel = document.getElementById('error-panel');
  panel.textContent = msg;
  panel.hidden = false;
  const status = document.getElementById('status-indicator');
  status.className = 'status invalid';
  status.textContent = 'Invalid schema';
}

function clearError() {
  document.getElementById('error-panel').hidden = true;
  const status = document.getElementById('status-indicator');
  status.className = 'status valid';
  status.textContent = 'Valid schema';
}

// =============================================================================
// URL Sharing
// =============================================================================

function getSchemaFromURL() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#schema=')) {
    try {
      const encoded = hash.slice('#schema='.length);
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      return null;
    }
  }
  return null;
}

document.getElementById('share-btn').addEventListener('click', () => {
  const source = editor.state.doc.toString();
  const encoded = btoa(unescape(encodeURIComponent(source)));
  const url = `${window.location.origin}${window.location.pathname}#schema=${encoded}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('share-btn');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
});

// =============================================================================
// Tab Switching
// =============================================================================

document.querySelectorAll('.playground-output .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.tab;

    // Update buttons
    document.querySelectorAll('.playground-output .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === lang);
    });

    // Update panels
    document.querySelectorAll('.playground-output .tab-panel').forEach(panel => {
      panel.hidden = panel.dataset.tab !== lang;
    });

    // Highlight the newly visible panel
    const visibleCode = document.getElementById(`output-${lang}`);
    if (visibleCode && visibleCode.textContent) {
      Prism.highlightElement(visibleCode);
    }
  });
});

// =============================================================================
// Example Selector
// =============================================================================

document.getElementById('example-select').addEventListener('change', (e) => {
  const schema = EXAMPLES[e.target.value];
  if (schema) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: schema }
    });
  }
});

// =============================================================================
// Initial Generation
// =============================================================================

generate();
