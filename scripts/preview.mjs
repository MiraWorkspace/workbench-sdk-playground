import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const server = createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const target = resolve(root, '.' + (name === '/' ? '/index.html' : name))
    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403).end(); return }
    const data = await readFile(target)
    response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' })[extname(target)] || 'application/octet-stream')
    response.end(data)
  } catch { response.writeHead(404).end() }
})
server.listen(4178, '127.0.0.1', () => console.log('http://127.0.0.1:4178 · 普通浏览器仅用于阅读，不连接模拟宿主。'))
