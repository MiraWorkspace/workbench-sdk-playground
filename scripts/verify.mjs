// Integration check in a temporary Electron profile. Model/search/notification services use fixtures.
// Requires Mira-Harness and Mira-Workbench development dependencies; never touches user data.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { unzipSync, zipSync } from 'fflate'

const root = fileURLToPath(new URL('../', import.meta.url))
const harness = resolve(process.env.MIRA_HARNESS_DIR || resolve(root, '../Mira-Harness'))
const workbench = resolve(process.env.MIRA_WORKBENCH_DIR || resolve(root, '../Mira-Workbench'))
const require = createRequire(join(harness, 'package.json')), { build } = require('esbuild')
async function verify() {
const temp = await mkdtemp(join(tmpdir(), 'sdk-playground-check-'))
try {
  const manifest = JSON.parse(await readFile(join(root, 'miniapp-manifest.json'), 'utf8'))
  const archive = join(root, 'release', `${manifest.id}-${manifest.version}.miniapp`)
  const archiveFiles = unzipSync(new Uint8Array(await readFile(archive)))
  assert.equal(JSON.parse(new TextDecoder().decode(archiveFiles['miniapp-manifest.json'])).id, manifest.id)
  assert(!Object.keys(archiveFiles).some(name => /node_modules|scripts\/|verification\/|README/.test(name)))
  const longArchive = join(temp, 'long-description.miniapp')
  const longManifest = { ...manifest, name:'VeryLongMiniappName'.repeat(4), description:'说明小程序的用途与权限。'.repeat(45).slice(0,500) }
  await writeFile(longArchive, zipSync({ ...archiveFiles, 'miniapp-manifest.json':new TextEncoder().encode(JSON.stringify(longManifest)) }))
  await promisify(execFile)(process.execPath, [resolve(workbench, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', join(temp, 'workbench')], { cwd: workbench, timeout: 30000 })
  await build({ stdin: { contents: entry, resolveDir: harness, loader: 'ts' }, outfile: join(temp, 'platform.cjs'), bundle: true, platform: 'node', format: 'cjs', external: ['electron'], plugins: [{ name: 'sqlite', setup: builder => builder.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: require.resolve('better-sqlite3'), external: true })) }] })
  await writeFile(join(temp, 'main.cjs'), main)
  const env = { ...process.env, NODE_PATH: join(harness, 'node_modules'), WORKBENCH_DIST: join(temp, 'workbench'), APP_PRELOAD: join(harness, 'electron/preload/appHost.cjs'), MINIAPP_ARCHIVE: archive, MINIAPP_LONG_ARCHIVE: longArchive, MINIAPP_DISTRIBUTION: join(root, 'site/manifest.json'), ARTIFACTS: join(root, 'verification') }
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS
  await mkdir(env.ARTIFACTS, { recursive: true })
  const { stdout, stderr } = await promisify(execFile)(require('electron'), [join(temp, 'main.cjs')], { env, timeout: 120000, maxBuffer: 2 * 1024 * 1024 })
  if (!stdout.includes('PLAYGROUND_PASS')) throw new Error(stdout + stderr)
  console.log(stdout.trim())
} finally { await rm(temp, { recursive: true, force: true }) }
}

const entry = `
export { AppRuntime } from './electron/services/appRuntime'
export { AppSdkDispatcher } from './electron/services/appSdkDispatcher'
export { AppViewManager } from './electron/services/appViewManager'
export { AppWebService } from './electron/services/appWebService'
export { createMiraMainWindow } from './electron/bootstrap/miraMainWindow'
export { LocalMicroAppServer } from './electron/adapters/localMicroAppServer'
export { MiraApps } from './electron/services/miraApps'
export { MiraPaths } from './electron/storage/miraPaths'
export { AppFiles } from './electron/services/appFiles'
export { fetchWorkbenchMiniappResource } from './electron/services/workbenchMiniappResource'
export { electronWebRequest } from './electron/adapters/electronWebRequest'
`

const main = String.raw`
const { app, ipcMain, webContents, BrowserWindow, session } = require('electron')
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { AppRuntime, AppSdkDispatcher, AppViewManager, AppWebService, createMiraMainWindow, LocalMicroAppServer, MiraApps, MiraPaths, AppFiles, fetchWorkbenchMiniappResource, electronWebRequest } = require('./platform.cjs')
console.log('VERIFY_BOOT')
app.setPath('userData', path.join(__dirname, 'profile'))
app.whenReady().then(async () => {
 let owner, server, runtime, views
 try {
  const paths = new MiraPaths(path.join(__dirname, 'data')).ensure(), dataRoot = path.join(__dirname, 'app-data')
  fs.cpSync(process.env.WORKBENCH_DIST, path.join(paths.apps, 'mira-workbench'), { recursive: true })
  const snapshot = { mainMenus: [], microApps: [], preferences: {} }, approvals = new Map()
  const database = { getSnapshot: () => structuredClone(snapshot), savePreference: (key, value) => { snapshot.preferences[key] = value } }
  server = new LocalMicroAppServer()
  const apps = new MiraApps(paths, database, server, '0.1.0-beta.1', fetch)
  apps.scan(); await server.start(apps.snapshot().microApps); apps.scan()
  runtime = new AppRuntime(dataRoot, { get: id => approvals.get(id), set: (id, value) => approvals.set(id, value), delete: id => approvals.delete(id) }, id => apps.resolvePlatformApp(id))
  const files = new AppFiles(dataRoot), selectedDirectory = path.join(__dirname, 'selected')
  fs.mkdirSync(selectedDirectory)
  let theme = 'light', notifications = 0, failChat = false, tamperPackage = true
  const live = process.env.MINIAPP_LIVE === '1'
  if (live && process.env.MINIAPP_PROXY) await session.defaultSession.setProxy({ proxyRules: process.env.MINIAPP_PROXY })
  const distribution = JSON.parse(fs.readFileSync(process.env.MINIAPP_DISTRIBUTION, 'utf8'))
  const installationUrl = distribution.update.url
  const download = async (url, options) => {
   assert.equal(options.redirect, 'manual')
   if (url === installationUrl) return new Response(JSON.stringify(distribution))
   assert.equal(url, distribution.package.url)
   const data = new Uint8Array(fs.readFileSync(process.env.MINIAPP_ARCHIVE))
   if (tamperPackage) data[data.length - 1] ^= 1
   return new Response(data)
  }
  const calls = [], searches = []
  const web = new AppWebService(async url => { searches.push(url); return new Response('<li class="b_algo"><h2><a href="https://www.typescriptlang.org/">TypeScript 官方文档</a></h2><p>Official TypeScript docs</p></li>') })
  const dispatcher = new AppSdkDispatcher(runtime, {
   workbenchMiniappResource: (url, kind) => fetchWorkbenchMiniappResource(url, kind, live ? electronWebRequest : download),
   getTheme: () => theme, notify: async () => { notifications++ }, readLegacyWorkbenchSites: async () => null,
   generate: async input => { calls.push(input); return { text: 'SDK 是调用宿主能力的客户端。' } },
   listProviders: () => [{ id: 'p', name: 'Fixture Provider' }],
   listModels: id => { assert.equal(id, 'p'); return [{ id: 'm', name: 'Fixture Model' }, { id: 'm2', name: 'Second Model' }] },
   chat: async input => {
    calls.push(input); assert.equal(input.providerId, 'p'); assert.ok(['m', 'm2'].includes(input.modelId))
    if (failChat) throw Error('fixture retry error')
    return input.webSearch ? { text: 'TypeScript 官方文档 [[source:1]]', sources: [{ index: 1, title: 'TypeScript', url: 'https://www.typescriptlang.org/' }] }
     : { text: input.messages.length === 1 ? '你好，小明。' : '你叫小明。' }
   },
   search: input => web.search(input), workbenchBrowser: (id, input) => views.workbenchBrowser(id, input), legacyMiniapps: () => [],
   files: (appId, ownerId, method, input) => {
    if (method === 'files.read') return files.read(appId, input)
    if (method === 'files.write') return files.write(appId, input)
    if (method === 'files.list') return files.list(appId, input)
    if (method === 'files.remove') return files.remove(appId, input)
    if (method === 'files.revoke') return files.revoke(appId, input.id)
    if (method === 'files.selectDirectory') return files.grant(appId, selectedDirectory, input.access)
    throw Error('unexpected method')
   },
   views: (appId, id, input) => views.ownedView(id, input, { mount: (key, directory, entry) => server.mountResource(key, directory, entry), unmount: key => server.unmountResource(key) }, input.type === 'open' ? files.resolve(appId, input.directory) : undefined),
  })
  views = new AppViewManager(runtime, dispatcher, id => apps.resolvePlatformEntry(id), process.env.APP_PRELOAD)
  ipcMain.on('mira-app:ready', event => views.ready(event.sender, event.senderFrame))
  owner = createMiraMainWindow({ show: false, width: 1360, height: 1000, minWidth: 1024, minHeight: 680 })
  await owner.loadURL('about:blank')
  const id = views.open(owner, 'mira-workbench'); views.setBounds(owner, id, { x: 0, y: 0, width: 1280, height: 920 })
  const parent = webContents.fromId(id); parent.setBackgroundThrottling(false); owner.show()
  parent.on('console-message', (_event, _level, message) => console.log('WORKBENCH: ' + message))
  // Render the actual DOM and styles offscreen: native WebContentsView capture can
  // be unavailable on macOS. This checks layout, while SDK assertions use the live view.
  const capture = async target => {
   const snapshot = () => {
    const html = document.documentElement.cloneNode(true), style = document.createElement('style')
    style.textContent = [...document.styleSheets].map(s => [...s.cssRules].map(r => r.cssText).join('\n')).join('\n')
    html.querySelector('head').replaceChildren(style)
    const scrollers = [...document.querySelectorAll('.review-permission-content, .review-description-full')]
    html.querySelectorAll('.review-permission-content, .review-description-full').forEach((node, i) => node.setAttribute('data-snapshot-scroll', scrollers[i].scrollTop))
    return { html:'<!doctype html>' + html.outerHTML, width:innerWidth, height:innerHeight }
   }
   const { html, width, height } = await target.executeJavaScript('(' + snapshot.toString() + ')()')
   const image = new BrowserWindow({ show:false, width, height, useContentSize:true, webPreferences:{ offscreen:true, contextIsolation:true, nodeIntegration:false, sandbox:true } })
   try {
    await image.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await image.webContents.executeJavaScript('[...document.querySelectorAll("[data-snapshot-scroll]")].forEach(node => node.scrollTop = Number(node.dataset.snapshotScroll))')
    await new Promise(resolve => setTimeout(resolve, 250))
    return (await image.webContents.capturePage()).toPNG()
   } finally { image.destroy() }
  }
  const inspect = code => parent.executeJavaScript(code, true)
  const wait = async (fn, label) => { const deadline = Date.now() + 12000; while (Date.now() < deadline) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 20)) } throw Error('timeout: ' + label) }
  const click = (selector, target = parent) => target.executeJavaScript('document.querySelector(' + JSON.stringify(selector) + ').click()', true)
  await wait(() => inspect('!!document.querySelector("[aria-label=添加]")'), 'workbench ready')
  await wait(() => fs.existsSync(path.join(dataRoot, 'files/mira-workbench/miniapps/registry.json')), 'manager initialized')
  await click('[aria-label="添加"]'); await click('#add-miniapp-tab')
  await wait(() => inspect('document.querySelector(".miniapp-upload button")?.disabled === false'), 'install enabled')
  const bytes = fs.readFileSync(process.env.MINIAPP_LONG_ARCHIVE).toString('base64')
  await inspect('(() => { const data = Uint8Array.from(atob(' + JSON.stringify(bytes) + '), c => c.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([data], "playground.miniapp")); const input = document.querySelector("[aria-label=选择小程序安装包]"); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles:true })); })()')
  await wait(() => inspect('!!document.querySelector(".review-dialog")'), 'install review')
  views.setBounds(owner, id, { x:0, y:0, width:1024, height:680 })
  await inspect('document.querySelector(".review-app-icon img").dispatchEvent(new Event("error"))')
  await wait(() => inspect('!!document.querySelector(".review-app-icon svg")'), 'icon fallback')
  const layout = () => inspect('(() => { const panel=document.querySelector(".review-dialog"), body=document.querySelector(".review-body"), list=document.querySelector(".review-permission-content"), description=document.querySelector(".review-description"), footer=document.querySelector(".review-actions").getBoundingClientRect(); return { panelScrollable:panel.scrollHeight > panel.clientHeight, bodyScrollable:body.scrollHeight > body.clientHeight, listScrollable:list.scrollHeight > list.clientHeight, descriptionHeight:description.clientHeight, lineHeight:parseFloat(getComputedStyle(description).lineHeight), descriptionTop:description.getBoundingClientRect().top, footerTop:footer.top, footerBottom:footer.bottom, viewport:innerHeight }; })()')
  await new Promise(resolve => setTimeout(resolve, 250))
  const beforeScroll = await layout()
  assert.equal(beforeScroll.panelScrollable, false); assert.equal(beforeScroll.bodyScrollable, false); assert.equal(beforeScroll.listScrollable, true)
  assert(beforeScroll.descriptionHeight <= beforeScroll.lineHeight * 2 + 1)
  assert(beforeScroll.footerBottom <= beforeScroll.viewport)
  await new Promise(resolve => setTimeout(resolve, 250))
  await fs.promises.writeFile(path.join(process.env.ARTIFACTS, 'install-review-compact.png'), await capture(parent))
  const descriptionPoint = await inspect('(() => { const r=document.querySelector(".review-description").getBoundingClientRect(); return { x:Math.round(r.x + r.width / 2), y:Math.round(r.y + r.height / 2) }; })()')
  parent.sendInputEvent({ type:'mouseMove', ...descriptionPoint })
  await wait(() => inspect('!!document.querySelector(".review-description-full")'), 'description hover opens full text')
  assert.equal(await inspect('document.querySelector(".review-description-full").textContent'), '说明小程序的用途与权限。'.repeat(45).slice(0,500))
  assert.equal((await layout()).descriptionHeight, beforeScroll.descriptionHeight)
  theme = 'dark'; views.themeChanged(theme)
  await wait(() => inspect('document.documentElement.dataset.theme === "dark"'), 'tooltip dark theme')
  await fs.promises.writeFile(path.join(process.env.ARTIFACTS, 'install-description-hover.png'), await capture(parent))
  const tooltipPoint = await inspect('(() => { const r=document.querySelector(".review-description-full").getBoundingClientRect(); return { x:Math.round(r.x + 20), y:Math.round(r.y + 20) }; })()')
  parent.sendInputEvent({ type:'mouseMove', ...tooltipPoint })
  assert.equal(await inspect('!!document.querySelector(".review-description-full")'), true)
  parent.sendInputEvent({ type:'mouseMove', x:20, y:20 })
  await wait(() => inspect('!document.querySelector(".review-description-full")'), 'description mouse leave closes full text')
  parent.focus()
  await inspect('document.querySelector(".review-actions .cancel-button").focus(); document.querySelector(".review-description").focus()')
  await wait(() => inspect('!!document.querySelector(".review-description-full")'), 'description keyboard focus')
  await inspect('document.querySelector(".review-permission-content").focus()')
  await wait(() => inspect('!document.querySelector(".review-description-full")'), 'description blur closes full text')
  assert.equal(await inspect('document.activeElement === document.querySelector(".review-permission-content")'), true)
  await inspect('const list = document.querySelector(".review-permission-content"); list.scrollTo(0, list.scrollHeight)')
  await wait(() => inspect('document.querySelector(".review-permission-content").scrollTop > 0'), 'permissions scroll independently')
  const afterScroll = await layout()
  assert.equal(afterScroll.descriptionTop, beforeScroll.descriptionTop); assert.equal(afterScroll.footerTop, beforeScroll.footerTop)
  await fs.promises.writeFile(path.join(process.env.ARTIFACTS, 'install-permissions-scrolled.png'), await capture(parent))
  parent.focus()
  await inspect('document.querySelector(".review-actions .add-button").focus()')
  await inspect('document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key:"Tab", bubbles:true, cancelable:true }))')
  await wait(() => inspect('document.activeElement?.getAttribute("aria-label") === "关闭权限确认"'), 'review focus trap')
  views.setBounds(owner, id, { x:0, y:0, width:1280, height:920 })
  theme = 'light'; views.themeChanged(theme)
  // The local upload path still reaches real package review; cancel before online installation.
  assert.equal(await inspect('document.querySelector(".review-source").textContent.includes("本地安装包")'), true)
  await click('.review-dialog [aria-label="关闭权限确认"]')
  await wait(() => inspect('!document.querySelector(".review-dialog") && !document.querySelector(".miniapp-upload button").disabled'), 'cancel local install')
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataRoot, 'files/mira-workbench/miniapps/registry.json'), 'utf8')).items.length, 0)
  const submitUrl = async () => {
   await inspect('(() => { const field = document.querySelector(".miniapp-url input"); field.value = ' + JSON.stringify(installationUrl) + '; field.dispatchEvent(new Event("input", { bubbles:true })); })()')
   await click('#add-miniapp-panel .add-button')
  }
  if (!live) {
   await submitUrl()
   await wait(() => inspect('document.querySelector(".form-error")?.textContent.includes("SHA-256")'), 'tamper rejected')
   await new Promise(resolve => setTimeout(resolve, 250))
   await fs.promises.writeFile(path.join(process.env.ARTIFACTS, 'install-url-error.png'), await capture(parent))
   assert.equal(JSON.parse(fs.readFileSync(path.join(dataRoot, 'files/mira-workbench/miniapps/registry.json'), 'utf8')).items.length, 0)
   tamperPackage = false
  }
  await submitUrl()
  await wait(() => inspect('!!document.querySelector(".review-dialog")'), 'online review')
  assert.equal(await inspect('document.querySelector(".review-source").textContent.includes(' + JSON.stringify(installationUrl) + ')'), true)
  assert.equal(await inspect('document.querySelector(".review-description").textContent'), distribution.description)
  assert.equal(await inspect('document.querySelector(".review-app-id").textContent'), distribution.id)
  assert.equal(await inspect('document.querySelector(".review-app-icon img").complete'), true)
  assert.equal(await inspect('document.querySelectorAll(".review-permission-group li").length'), distribution.requiredCapabilities.length)
  await wait(() => inspect('getComputedStyle(document.querySelector("#add-miniapp-panel").closest(".dialog-backdrop")).display === "none"'), 'add dialog hidden after transition')
  const reviewCapture = async name => {
   await new Promise(resolve => setTimeout(resolve, 250))
   const geometry = await inspect('(() => { const panel = document.querySelector(".review-dialog"), body = document.querySelector(".review-body"), footer = document.querySelector(".review-actions").getBoundingClientRect(), r = panel.getBoundingClientRect(); return { viewport:innerHeight, bottom:r.bottom, top:r.top, width:panel.clientWidth, scrollWidth:panel.scrollWidth, footerBottom:footer.bottom, bodyScrollable:body.scrollHeight > body.clientHeight }; })()')
   assert(geometry.top >= 0 && geometry.bottom <= geometry.viewport && geometry.footerBottom <= geometry.viewport)
   assert.equal(geometry.width, geometry.scrollWidth)
   await fs.promises.writeFile(path.join(process.env.ARTIFACTS, name), await capture(parent))
   return geometry
  }
  await reviewCapture('install-url-review.png')
  theme = 'dark'; views.themeChanged(theme)
  await wait(() => inspect('document.documentElement.dataset.theme === "dark"'), 'review dark theme')
  await reviewCapture('install-review-dark.png')
  theme = 'light'; views.themeChanged(theme)
  await click('.review-dialog .cancel-button')
  await wait(() => inspect('!document.querySelector(".review-dialog") && document.activeElement === document.querySelector(".miniapp-url input")'), 'cancel and focus URL')
  await submitUrl()
  await wait(() => inspect('!!document.querySelector(".review-dialog")'), 'review retry')
  await click('.review-dialog .add-button')
  await wait(() => inspect('[...document.querySelectorAll(".site-card")].some(e => e.textContent.includes("SDK 能力演示台"))'), 'installed card')
  console.log(live ? 'LIVE_HTTPS_INSTALL_PASS ' + installationUrl : 'FIXTURE_URL_INSTALL_PASS: tamper, source review, cancel, retry, install')
  // Authorize an isolated fixture directory through Workbench's real permission UI.
  const openPermissions = async () => {
   await click('[aria-label="设置"]')
   await wait(() => inspect('!!document.querySelector(".manage-miniapp-menu button")'), 'manage menu')
   await click('.manage-miniapp-menu button')
   await wait(() => inspect('!!document.querySelector("#permissions-title")'), 'permissions')
  }
  await openPermissions()
  await inspect('[...document.querySelectorAll("button")].find(e => e.textContent === "添加读写目录").click()')
  await wait(() => inspect('!!document.querySelector(".directory-item")'), 'grant')
  await click('[aria-label="关闭权限设置"]')
  let child
  const openChild = async () => {
   if (await inspect('!!document.querySelector(".manage-dialog")')) await click('.manage-dialog [aria-label="关闭"]')
   await inspect('[...document.querySelectorAll(".site-card")].find(e => e.textContent.includes("SDK 能力演示台")).click()')
   await wait(() => { child = webContents.getAllWebContents().find(c => c.getURL().includes('/apps/resource-')); return Boolean(child) }, 'child')
   child.setBackgroundThrottling(false)
   await wait(() => child.executeJavaScript('document.querySelector("#connection")?.textContent === "已连接 Workbench"'), 'handshake')
  }
  await openChild(); console.log('INSTALLED_AND_CONNECTED')
  const check = code => child.executeJavaScript(code, true)
  const setParams = value => check('document.querySelector("#params").value = ' + JSON.stringify(JSON.stringify(value, null, 2)) + '; document.querySelector("#params").dispatchEvent(new Event("input", { bubbles:true }))')
  const run = async (example, params) => {
   console.log('EXAMPLE ' + example)
   await click('[data-example="' + example + '"]', child)
   if (params) await setParams(params)
   if (await check('!document.querySelector("#confirm-label").hidden')) await check('document.querySelector("#confirm").checked = true; document.querySelector("#confirm").dispatchEvent(new Event("change"))')
   await click('#run', child)
   await wait(() => check('/执行成功|执行失败/.test(document.querySelector("#run-status").textContent)'), example)
   return check('document.querySelector("#result").textContent')
  }
  assert.equal(calls.length, 0); assert.equal(searches.length, 0)
  assert.match(await run('context.get'), /workbench-sdk-playground/)
  await run('storage.migrate'); await run('storage.insert')
  assert.match(await run('storage.select'), /来自 SDK/)
  await run('storage.update'); assert.match(await run('storage.select'), /已通过 SDK 修改/)
  assert.match(await run('storage.rollback'), /APPLICATION_DENIED/)
  assert.doesNotMatch(await run('storage.select'), /rollback-probe/)
  await run('files.write'); assert.match(await run('files.read'), /你好，Workbench SDK/)
  assert.match(await run('files.list'), /sdk-playground/)
  const grants = JSON.parse(await run('files.directories')); assert.equal(grants.length, 1)
  await run('files.directoryWrite', { path:'sdk-playground-demo.txt', grant:grants[0].id, text:'fixture directory write' })
  assert.equal(fs.readFileSync(path.join(selectedDirectory, 'sdk-playground-demo.txt'), 'utf8'), 'fixture directory write')
  assert.match(await run('files.directoryRead', { path:'sdk-playground-demo.txt', grant:grants[0].id }), /fixture directory write/)
  assert.match(await run('files.directoryList', { path:'', grant:grants[0].id }), /sdk-playground-demo/)
  await run('models.listProviders'); await run('models.listModels')
  await run('models.generate'); assert.equal(calls.at(-1).modelId, 'm')
  await run('models.chat'); assert.equal(calls.at(-1).messages.length, 1)
  await check('document.querySelector("#followup").value = "我叫什么？"'); await click('#append-turn', child)
  const historyParams = JSON.parse(await check('document.querySelector("#params").value'))
  assert.equal(historyParams.messages.length, 3); assert.equal(historyParams.messages[1].role, 'assistant')
  failChat = true; assert.match(await run('models.chat'), /APPLICATION_DENIED/)
  assert.deepEqual(JSON.parse(await check('document.querySelector("#params").value')), historyParams)
  failChat = false; assert.match(await run('models.chat'), /你叫小明/)
  await check('document.querySelector("#model").value = "m2"; document.querySelector("#model").dispatchEvent(new Event("change"))')
  assert.equal(JSON.parse(await check('document.querySelector("#params").value')).messages.length, 1)
  assert.match(await run('models.webChat'), /sources/); assert.equal(calls.at(-1).webSearch, true)
  assert.match(await run('web.search'), /typescriptlang/); assert(searches.length > 0)
  assert.match(await run('errors.invalidParams'), /APPLICATION_DENIED/)
  assert.match(await run('errors.unsupported'), /Workbench 不支持/)
  await run('notifications.send'); assert.equal(notifications, 1)
  await run('appearance.get'); await run('appearance.subscribe')
  theme = 'dark'; views.themeChanged(theme)
  await wait(() => check('document.documentElement.dataset.theme === "dark"'), 'theme event')
  const eventLog = await check('document.querySelector("#events").textContent')
  await click('#unsubscribe', child); theme = 'light'; views.themeChanged(theme)
  // The later SDK response acts as a barrier after the event on the same channel.
  await run('context.get'); assert.equal(await check('document.querySelector("#events").textContent'), eventLog)
  await run('appearance.get')
  await fs.promises.writeFile(path.join(process.env.ARTIFACTS, 'light.png'), await capture(child))
  theme = 'dark'; await run('appearance.get')
  await fs.promises.writeFile(path.join(process.env.ARTIFACTS, 'dark.png'), await capture(child))
  await run('models.chat'); await setParams({ invalid: undefined })
  await check('document.querySelector("#params").value = "{"; document.querySelector("#params").dispatchEvent(new Event("input"))')
  assert.equal(await check('document.querySelector("#run").disabled'), true)
  await click('#reset', child)
  assert.match(await run('connection.disconnected'), /DISCONNECTED/)
  assert.match(await run('context.get'), /workbench-sdk-playground/)
  await click('[data-example="connection.dispose"]', child)
  await check('document.querySelector("#confirm").checked = true; document.querySelector("#confirm").dispatchEvent(new Event("change"))')
  // Sending disconnect closes the live view; do not wait for an evaluation result from that view.
  void click('#run', child).catch(() => {})
  await wait(() => child.isDestroyed(), 'dispose closes page')
  await openChild()
  assert.match(await run('storage.select'), /已通过 SDK 修改/)
  assert.match(await run('files.read'), /你好，Workbench SDK/)
  // Workbench actually closes the page on permission change; reopening re-reads capabilities.
  await openPermissions()
  await inspect('(() => { const input = [...document.querySelectorAll(".permission-list input")].find(e => e.value === "models:generate"); input.checked=false; input.dispatchEvent(new Event("change", { bubbles:true })); })()')
  await inspect('[...document.querySelectorAll("button")].find(e => e.textContent === "保存权限").click()')
  await wait(() => child.isDestroyed(), 'revocation closes page')
  await click('[aria-label="关闭权限设置"]'); await openChild()
  assert.match(await run('errors.permission'), /APPLICATION_DENIED/)
  assert.match(await check('document.querySelector("#permissions").textContent'), /未授权/)
  assert.match(await run('storage.select'), /已通过 SDK 修改/)
  await run('storage.delete'); assert.doesNotMatch(await run('storage.select'), /demo-1/)
  const bare = new BrowserWindow({ show:false, webPreferences:{ contextIsolation:true, nodeIntegration:false, sandbox:true } })
  await bare.loadURL(child.getURL())
  await wait(() => bare.webContents.executeJavaScript('document.querySelector("#connection")?.textContent === "未连接 Workbench"'), 'standalone unavailable')
  assert.equal(await bare.webContents.executeJavaScript('document.querySelector("#run").disabled'), true); bare.destroy()
  console.log('PLAYGROUND_PASS: real package install/review, isolated SDK, 28 examples, SQLite CRUD/rollback/persistence, private and granted files, model selection/history/retry, web flags/sources, subscription/unsubscribe, invalid JSON, disconnected/client dispose/reopen, permission revocation.')
  console.log('Model responses, remote search HTTP, notifications and native directory choice used fixtures. No paid models, live search or OS notification acceptance.')
 } catch (error) { console.error(error.stack); process.exitCode = 1 }
 finally { views?.closeAll(); owner?.destroy(); runtime?.close(); await server?.stop(); app.quit() }
})
`

await verify()
