import { createRequire } from 'node:module'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
// eslint-disable-next-line
globalThis.require = createRequire(__filename)
