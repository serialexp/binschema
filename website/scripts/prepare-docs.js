#!/usr/bin/env node
import { mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync } from 'fs';
import { join, extname, basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '..');
const binschemaRoot = resolve(projectRoot, '..');
const binschemaPackage = join(binschemaRoot, 'packages', 'binschema');

const docsOutputDir = join(projectRoot, 'public', 'docs');
const examplesOutputDir = join(projectRoot, 'public', 'examples');

const ensureDir = (path) => mkdirSync(path, { recursive: true });

const cleanDirectory = (path, extensions) => {
  try {
    const entries = readdirSync(path);
    for (const entry of entries) {
      const entryPath = join(path, entry);
      if (statSync(entryPath).isDirectory()) continue;
      if (extensions.includes(extname(entry))) {
        unlinkSync(entryPath);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const copyIfExists = (source, destination) => {
  try {
    copyFileSync(source, destination);
    console.log(`Copied ${source} → ${destination}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Source file not found: ${source}`);
    } else {
      throw error;
    }
  }
};

// Ensure destination directories exist
ensureDir(docsOutputDir);
ensureDir(examplesOutputDir);

// Clean stale files
cleanDirectory(docsOutputDir, ['.html', '.md']);
cleanDirectory(examplesOutputDir, ['.html', '.json']);

// Copy README for usage documentation
copyIfExists(
  join(binschemaRoot, 'README.md'),
  join(docsOutputDir, 'README.md')
);

// Generate type reference HTML from the built binschema package
try {
  const generateScript = join(binschemaPackage, 'dist', 'generate-type-reference.js');
  console.log('Generating type-reference.html...');
  execSync(`node "${generateScript}"`, {
    cwd: docsOutputDir,
    stdio: 'inherit'
  });
  console.log(`Generated ${join(docsOutputDir, 'type-reference.html')}`);
} catch (error) {
  console.warn(`Failed to generate type-reference.html: ${error.message}`);
}

// Process example schemas - copy JSON and generate HTML docs
const examplesSourceDir = join(binschemaRoot, 'examples');
const cliPath = join(binschemaPackage, 'dist', 'cli', 'index.js');

try {
  const exampleFiles = readdirSync(examplesSourceDir);
  for (const file of exampleFiles) {
    const sourcePath = join(examplesSourceDir, file);
    if (statSync(sourcePath).isDirectory()) continue;

    const extension = extname(file);
    if (extension === '.json') {
      // Copy schema JSON
      const destinationPath = join(examplesOutputDir, file);
      copyIfExists(sourcePath, destinationPath);

      // Generate HTML docs from schema
      const baseName = basename(file, '.schema.json').replace('.bschema', '');
      const docsPath = join(examplesOutputDir, `${baseName}-docs.html`);

      try {
        console.log(`Generating docs for ${file}...`);
        execSync(`node "${cliPath}" docs build --schema "${sourcePath}" --out "${docsPath}"`, {
          stdio: 'inherit'
        });
        console.log(`Generated ${docsPath}`);
      } catch (error) {
        console.warn(`Failed to generate docs for ${file}: ${error.message}`);
      }
    }
  }
} catch (error) {
  if (error.code === 'ENOENT') {
    console.warn(`Examples directory not found: ${examplesSourceDir}`);
  } else {
    throw error;
  }
}
