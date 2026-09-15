// Offline build: transpile src/**/*.ts -> lib/**/*.js using Node's built-in
// TypeScript type stripping (no esbuild/tsdown/registry needed).
// Relative imports in this repo already carry `.js` extensions (Node-native
// ESM), so the multi-file output resolves as-is. Bare specifiers
// (@deepseek-ai/*, yaml, node:*) are left external and resolved by the DSH
// host's bare-module base at load time.
//
// The resulting lib/ is a complete, runnable artifact that is COMMITTED to the
// repo so it can be installed directly with no build step and no package
// registry (see README "Install from prebuilt artifacts"). This build is
// runtime-only: it also emits a minimal lib/index.d.ts so package.json's
// `types` reference resolves; the full type surface is produced by the normal
// `pnpm run build` (tsdown).
import {
  readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync,
  existsSync, rmSync,
} from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');
const libDir = join(root, 'lib');

// Clean previous lib output.
if (existsSync(libDir)) rmSync(libDir, { recursive: true, force: true });
mkdirSync(libDir, { recursive: true });

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

let ok = 0, failed = 0;
for (const ts of walk(srcDir)) {
  const code = readFileSync(ts, 'utf8');
  let js;
  try {
    js = stripTypeScriptTypes(code, { mode: 'transform' });
  } catch (e) {
    failed++;
    console.error('  TRANSPILE FAIL:', relative(root, ts), '->', e.message);
    continue;
  }
  const rel = relative(srcDir, ts);
  const outPath = join(libDir, rel.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, js);
  ok++;
}

// client.js is plain JS (window.__ModuleLoader__ CJS), copied verbatim.
const clientSrc = join(srcDir, 'client.js');
if (existsSync(clientSrc)) {
  copyFileSync(clientSrc, join(libDir, 'client.js'));
  console.log('  client.js copied');
}

console.log(`  transpiled ${ok} file(s), ${failed} failed`);

// Minimal public-entry type declaration, so the offline artifact resolves the
// `types`/`exports` reference in package.json. Declares the entry's runtime value
// exports only; the full type surface (config/service/domain types) is emitted
// by the normal `pnpm run build` (tsdown) and re-exported from here at build.
const dts = join(libDir, 'index.d.ts');
writeFileSync(dts, [
  '/**',
  ' * Public entry types for @jacksonchen/dsh-devops.',
  ' *',
  ' * Emitted by scripts/offline-build.mjs (a no-registry build using Node\'s',
  ' * built-in TypeScript type stripping). Declares the runtime value exports',
  ' * only; the full type surface is produced by the normal `pnpm run build`.',
  ' */',
  'export declare const name: string',
  'export declare const inject: string[]',
  'export declare const Config: unknown',
  'export declare function apply(ctx: unknown, rawConfig?: unknown): void',
  '',
].join('\n'));
console.log('  emitted lib/index.d.ts (minimal entry types)');

process.exitCode = failed ? 1 : 0;
