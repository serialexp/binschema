# Changelog

## 0.6.0 (2026-03-06)

### Features

- add performance benchmarks, CLI/API tabs, and nav styling
- add ldns (C library) to DNS benchmark comparison

## 0.5.0 (2026-03-06)

### Features

- add bool, bytes, and utf16 sugar types across all generators
- bundle runtime files during Go/Rust generation

### Chores

- clean up uncommitted changes

## 0.4.0 (2026-03-02)

### Features

- add recipes page with 12 common binary format patterns

### Bug Fixes

- add recipes.html to Vite build entry points
- normalize JSON formatting in recipes and use local Prism

### Refactoring

- share site header across all pages via header.js

### Chores

- mark website package as private

## 0.3.0 (2026-02-18)

### Features

- major redesign with multi-language examples and marketing
- improve docs, examples, and playground link

### Bug Fixes

- remove nonexistent type-reference.html from Dockerfile
- rebuild packages inside Docker instead of copying dist
- fix broken doc links, domain references, and add 404 page

### Chores

- gitignore generated website docs and example code

