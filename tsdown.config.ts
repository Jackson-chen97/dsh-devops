import { readFile } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserConfig, TsdownPlugin } from 'tsdown'
import { transform } from 'lightningcss'

const PLUGIN_ID = '@jacksonchen/dsh-devops'
const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url))

/**
 * Bare specifiers resolved by the DSH install host at load time (the host owns
 * these modules and their versions) — never bundle them into the plugin.
 */
const HOST_EXTERNALS = [
  /^@deepseek-ai\/(?:cordis|dsh-tools|schemastery)(?:\/.*)?$/,
  'schemastery',
  'yaml',
]

const CLIENT_EXTERNALS = [
  /^react(?:\/.*)?$/,
  /^react-dom(?:\/.*)?$/,
]

const CSS_VIRTUAL_PREFIX = '\0dsh-devops-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Node ESM build loaded by the DSH host (`lib/index.js`). */
const host: UserConfig = {
  name: PLUGIN_ID,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2023',
  fixedExtension: false,
  dts: false,
  clean: true,
  deps: { neverBundle: HOST_EXTERNALS },
}

/**
 * Browser CJS build injected into the DSH WebUI (`lib/client.js`).
 * The banner/footer wrap the bundle in the DSH client ModuleLoader contract:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * `react` / `react-dom` are provided by the host's ModuleLoader require.
 */
const client: UserConfig = {
  name: `${PLUGIN_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  fixedExtension: false,
  outExtensions: () => ({ js: '.js' }),
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: false,
  clean: false,
  deps: { neverBundle: CLIENT_EXTERNALS },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  plugins: [clientCssPlugin()],
  outputOptions: {
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

/**
 * Compile `.module.css` imports into minified CSS inlined as a runtime
 * `<style data-plugin-css>` tag, exporting the class-name map. Shared with
 * vitest (`injectStyles: false`) so tests get real class names without DOM
 * style injection.
 */
export function clientCssPlugin(injectStyles = true): TsdownPlugin {
  return {
    name: 'dsh-devops-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const absolute = importer === undefined ? source : resolvePath(importer, '..', source)
      return CSS_VIRTUAL_PREFIX + absolute + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap = Object.fromEntries(
        Object.entries(cssExports ?? {})
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([local, exported]) => [local, exported.name]),
      )
      const tagId = `${PLUGIN_ID}/${fileId}`
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        `if (${injectStyles} && typeof document !== "undefined") {`,
        '  let tag = document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]");',
        '  if (!tag) { tag = document.createElement("style"); tag.dataset.pluginCss = tagId; document.head.appendChild(tag); }',
        '  if (tag.textContent !== css) tag.textContent = css;',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }
}

export default [host, client]
