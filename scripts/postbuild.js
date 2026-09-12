// Post-build: copy client.js from src to lib/ (tsdown clean:true wipes lib/)
import { copyFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientSrc = resolve(__dirname, '../src/client.js')
const clientDst = resolve(__dirname, '../lib/client.js')

if (existsSync(clientSrc)) {
  copyFileSync(clientSrc, clientDst)
  console.log(`✓ lib/client.js copied from src/client.js`)
} else {
  console.log('⚠ src/client.js not found — skipping client copy')
}
