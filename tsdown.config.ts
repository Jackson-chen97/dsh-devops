import { defineConfig } from 'tsdown'

export default defineConfig([
  // Server-side entry (node)
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    // `.d.ts` is not required for the DSH host to load the plugin (it imports
    // the .js), and its type graph pulls in @deepseek-ai/* types that are only
    // resolved by the host at run time. Keep the build light and reliable.
    dts: false,
    outDir: 'lib',
    clean: true,
    platform: 'node',
    // These bare specifiers are provided by the DSH install host (resolved via
    // the host's bare-module base at load time) or are tiny shared runtime deps.
    // Externalize them so the bundle stays small and host-owned; bundle only the
    // plugin's own source.
    external: [/@^@deepseek-ai\//, 'yaml'],
  },
])
