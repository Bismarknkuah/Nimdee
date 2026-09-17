/* eslint-disable */
/**
 * DEV-ONLY helper for environments that cannot download Prisma's native query engine
 * (e.g. sandboxed CI). It lets the generated client run on the bundled WebAssembly engine in Node.
 * Production (Railway) uses the normal native engine — run this only when PRISMA_ENGINE=wasm.
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
const pkgPath = path.join(dir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('Run `prisma generate` first');
  process.exit(1);
}
fs.writeFileSync(
  path.join(dir, 'wasm-node-loader.mjs'),
  `import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const bytes = readFileSync(fileURLToPath(new URL('./query_engine_bg.wasm', import.meta.url)));
export default Promise.resolve({ default: new WebAssembly.Module(bytes) });
`,
);
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.imports['#wasm-engine-loader'].default = './wasm-node-loader.mjs';
pkg.imports['#wasm-engine-loader'].node = './wasm-node-loader.mjs';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('WASM engine loader enabled for Node (dev only)');
