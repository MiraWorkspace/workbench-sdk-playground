import { connectMiraApp } from './vendor/mira-app-sdk.js'
import context from './examples/context.js'
import models from './examples/models.js'
import web from './examples/web.js'
import storage from './examples/storage.js'
import files from './examples/files.js'
import appearance from './examples/appearance.js'
import notifications from './examples/notifications.js'
import errors from './examples/errors.js'

const modules = { context, models, web, storage, files, appearance, notifications, errors }
const examples = Object.entries(modules).flatMap(([file, items]) => items.map(item => ({ ...item, source: `src/examples/${file}.js` })))
const $ = id => document.getElementById(id)
const format = value => value === undefined ? 'undefined（此方法没有返回值）' : JSON.stringify(value, (_key, item) => item instanceof Uint8Array ? { type: 'Uint8Array', length: item.length, bytes: [...item] } : item, 2)
const drafts = new Map(), results = new Map(), history = [], events = []
let sdk, host, selected = examples[0], busy = false, connected = false, unsubscribe
let providers = [], modelList = [], providerId = '', modelId = ''

for (const group of [...new Set(examples.map(item => item.group))]) {
  const heading = document.createElement('h2'); heading.textContent = group; $('navigation').append(heading)
  for (const item of examples.filter(item => item.group === group)) {
    const button = document.createElement('button')
    button.type = 'button'; button.textContent = item.title; button.dataset.example = item.id
    button.addEventListener('click', () => select(item.id)); $('navigation').append(button)
  }
}

function connection(text, state) { $('connection').textContent = text; $('connection').dataset.state = state }
function modelExample(item) { return item.group === '模型' || item.id === 'models.webChat' }
function defaultParams(item) {
  const params = structuredClone(item.params)
  if (item.id === 'models.listModels') params.providerId = providerId
  if (item.id === 'models.generate') { if (providerId && modelId) Object.assign(params, { providerId, modelId }) }
  if (item.chat) Object.assign(params, { providerId, modelId })
  return params
}
function paramsValue() {
  const params = JSON.parse($('params').value)
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error('示例参数必须是 JSON 对象。')
  return params
}
function snippet(item, params) {
  return `import { connectMiraApp${item.id === 'connection.disconnected' ? ', MiraAppSdk' : ''} } from '@mira/app-sdk'\n\n// 一个页面共用一个连接；退出页面时 sdk.dispose()。\nconst sdk = await connectMiraApp()\nconst params = ${format(params)}\n\n// 以下函数即此示例实际执行的实现。\nconst run = ${item.run.toString()}\nconst result = await run(sdk, params, console.log)\nconsole.log(result)${item.id === 'appearance.subscribe' ? '\n\n// result 是取消订阅函数：\n// result()' : ''}`
}
function refreshCode() {
  drafts.set(selected.id, $('params').value)
  $('params').rows = Math.min(18, Math.max(3, $('params').value.split('\n').length + 1))
  try { $('code').textContent = snippet(selected, paramsValue()); $('param-error').textContent = '' }
  catch (error) { $('param-error').textContent = error.message; $('code').textContent = '请先修正参数 JSON。' }
  syncControls()
}
function syncControls() {
  $('run').disabled = !connected || busy || Boolean($('param-error').textContent) || Boolean(selected.confirm && !$('confirm').checked)
  $('run').textContent = busy ? '请求执行中…' : '执行此示例'
  for (const id of ['load-providers', 'load-models', 'provider', 'model', 'reset', 'params']) $(id).disabled = busy
  $('load-providers').disabled = !connected || busy
  $('load-models').disabled = !connected || busy || !providerId
  $('append-turn').disabled = busy || !connected
  $('reload').disabled = busy || !connected
  $('unsubscribe').hidden = !unsubscribe
}
function select(id) {
  selected = examples.find(item => item.id === id)
  for (const button of $('navigation').querySelectorAll('button')) {
    if (button.dataset.example === id) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }
  $('group').textContent = selected.group; $('title').textContent = selected.title; $('source').textContent = selected.source
  $('description').textContent = selected.description; $('check').textContent = `验证方法：${selected.check}`
  $('model-picker').hidden = !modelExample(selected)
  $('permissions').replaceChildren()
  for (const cap of selected.permissions.length ? selected.permissions : ['无需额外权限']) {
    const chip = document.createElement('span'); chip.className = 'badge'
    const granted = host?.capabilities.includes(cap)
    chip.textContent = cap === '无需额外权限' ? cap : `${cap} · ${host ? (granted ? '已授权' : '未授权') : '尚未连接'}`
    if (host && !granted && selected.permissions.length) chip.classList.add('denied')
    $('permissions').append(chip)
  }
  $('compatibility').textContent = selected.minor && host && (host.apiVersion.major !== 1 || host.apiVersion.minor < selected.minor)
    ? `当前 Workbench 小程序 API 不满足 1.${selected.minor}，需更新 Workbench。仍可执行以观察实际错误。`
    : '未授权时也可执行以验证拒绝结果。参数和结果仅保留在当前页面，不会自动发给模型。'
  $('params').value = drafts.get(id) ?? format(defaultParams(selected))
  $('confirm-label').hidden = !selected.confirm; $('confirm').checked = false; $('confirm-text').textContent = selected.confirm || ''
  $('run-status').textContent = ''; $('followup').value = ''
  refreshCode(); showResult(results.get(id))
}
function showResult(record) {
  $('result').dataset.state = record?.state || ''
  $('result').textContent = record ? record.output : '尚未执行此示例。'
  $('result-meta').textContent = record ? `${record.state === 'error' ? '失败' : '成功'} · ${record.duration} ms · ${record.time}` : ''
  $('chat-followup').hidden = !selected.chat || !results.get(selected.id)?.answer
}
function recordCall(item, params, value, error, started, code = snippet(item, params)) {
  const record = { id: item.id, title: item.title, params: structuredClone(params), value, code,
    output: error ? format({ name: error.name, code: error.code || 'LOCAL_ERROR', message: error.message }) : format(value),
    state: error ? 'error' : 'ok', duration: Math.round(performance.now() - started), time: new Date().toLocaleTimeString(),
    answer: !error && item.chat && value?.text ? { params: structuredClone(params), text: value.text } : null }
  results.set(item.id, record); history.unshift(record); if (history.length > 30) history.pop()
  renderHistory()
  if (selected.id === item.id) showResult(record)
  return record
}
function renderHistory() {
  $('history').replaceChildren()
  for (const record of history) {
    const li = document.createElement('li'), button = document.createElement('button'), name = document.createElement('span'), meta = document.createElement('small')
    name.textContent = `${record.state === 'error' ? '失败' : '成功'} · ${record.id}`; name.dataset.state = record.state
    meta.textContent = `${record.time} · ${record.duration} ms`; button.type = 'button'; button.append(name, meta)
    button.addEventListener('click', () => {
      select(record.id); $('params').value = format(record.params); refreshCode(); $('code').textContent = record.code; showResult(record)
      $('chat-followup').hidden = true; $('run-status').textContent = '正在查看历史调用。'
    })
    li.append(button); $('history').append(li)
  }
}
function options(selectId, items, selectedId, placeholder) {
  const element = $(selectId); element.replaceChildren()
  const empty = new Option(placeholder, ''); element.add(empty)
  for (const item of items) element.add(new Option(`${item.name} (${item.id})`, item.id))
  element.value = items.some(item => item.id === selectedId) ? selectedId : ''
}
function updateModelDrafts() {
  for (const item of examples.filter(item => item.chat || ['models.listModels', 'models.generate'].includes(item.id))) {
    const params = defaultParams(item)
    drafts.set(item.id, format(params)); results.delete(item.id)
  }
  if (selected.chat || ['models.listModels', 'models.generate'].includes(selected.id)) {
    $('params').value = drafts.get(selected.id); refreshCode(); showResult(undefined)
  }
}
function onEvent(event) {
  events.unshift({ at: new Date().toLocaleTimeString(), ...event }); if (events.length > 30) events.pop()
  $('events').textContent = format(events)
  if (event.event === 'appearance.changed') document.documentElement.dataset.theme = event.value
}
function stopSubscription() {
  if (!unsubscribe) return
  unsubscribe(); unsubscribe = undefined
  $('subscription-status').textContent = '已执行 unsubscribe()。后续主题变化不再记录；页面保留最后收到的主题。'
  $('subscription-status').hidden = false; syncControls()
}
async function execute() {
  if (!sdk || !connected || busy || (selected.confirm && !$('confirm').checked)) return
  let params
  try { params = paramsValue() } catch { refreshCode(); return }
  const item = selected, started = performance.now(), code = snippet(item, params)
  busy = true; syncControls(); $('run-status').textContent = '等待实际 SDK 返回…'
  try {
    if (item.id === 'appearance.subscribe') stopSubscription()
    const value = await item.run(sdk, params, onEvent)
    if (item.id === 'appearance.subscribe') {
      unsubscribe = value
      $('subscription-status').hidden = false; $('subscription-status').textContent = '已注册订阅。请在 Mira 切换主题；下方记录实际收到的事件。'
    }
    if (item.id === 'context.get') { host = value; connected = true }
    if (item.id === 'appearance.get') document.documentElement.dataset.theme = value
    if (item.id === 'models.listProviders') {
      providers = value; providerId = providers.some(p => p.id === providerId) ? providerId : providers[0]?.id || ''
      modelList = []; modelId = ''
      options('provider', providers, providerId, providers.length ? '选择供应商' : '没有可用供应商')
      options('model', [], '', '先获取模型'); updateModelDrafts()
    }
    if (item.id === 'models.listModels') {
      modelList = value; providerId = params.providerId; modelId = modelList[0]?.id || ''
      $('provider').value = providerId; options('model', modelList, modelId, modelList.length ? '选择模型' : '没有可用模型'); updateModelDrafts()
    }
    const output = typeof value === 'function' ? '返回值：取消订阅函数（本地函数，不是 JSON）。点击“取消主题订阅”执行它。' : value
    recordCall(item, params, output, null, started, code)
    if (selected.id === item.id) $('run-status').textContent = '执行成功。'
  } catch (error) {
    recordCall(item, params, undefined, error, started, code)
    if (error.code === 'DISCONNECTED' && item.id !== 'connection.disconnected') { connected = false; unsubscribe = undefined; connection('连接已断开，请关闭重开', 'error') }
    if (selected.id === item.id) $('run-status').textContent = '执行失败，见实际错误。'
  } finally { busy = false; syncControls() }
}

$('params').addEventListener('input', refreshCode)
$('confirm').addEventListener('change', syncControls)
$('run').addEventListener('click', execute)
$('reset').addEventListener('click', () => { drafts.delete(selected.id); results.delete(selected.id); select(selected.id) })
$('load-providers').addEventListener('click', () => { select('models.listProviders'); void execute() })
$('load-models').addEventListener('click', () => { select('models.listModels'); void execute() })
$('provider').addEventListener('change', () => { providerId = $('provider').value; modelId = ''; modelList = []; options('model', [], '', '先获取模型'); updateModelDrafts(); syncControls() })
$('model').addEventListener('change', () => { modelId = $('model').value; updateModelDrafts() })
$('unsubscribe').addEventListener('click', stopSubscription)
$('reload').addEventListener('click', () => { select('context.get'); void execute() })
$('clear-history').addEventListener('click', () => { history.length = 0; renderHistory() })
$('append-turn').addEventListener('click', () => {
  const answer = results.get(selected.id)?.answer, followup = $('followup').value.trim()
  if (!answer || !followup) return
  const params = structuredClone(answer.params)
  params.messages.push({ role: 'assistant', content: answer.text }, { role: 'user', content: followup })
  $('params').value = format(params); refreshCode(); $('followup').value = ''; $('chat-followup').hidden = true
  $('run-status').textContent = '已填入完整历史。点击执行才会发送下一轮。'
})
$('copy-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('code').textContent); $('run-status').textContent = '调用代码已复制。' }
  catch { const selection = window.getSelection(), range = document.createRange(); range.selectNodeContents($('code')); selection.removeAllRanges(); selection.addRange(range); $('run-status').textContent = '已选中代码，请按系统复制快捷键。' }
})
window.addEventListener('pagehide', () => { unsubscribe?.(); sdk?.dispose() }, { once: true })
select('context.get')
try {
  sdk = await connectMiraApp()
  const started = performance.now()
  host = await sdk.context.get()
  if (host.host !== 'workbench') throw new Error('请作为 Workbench 小程序安装运行；当前连接不是 Workbench。')
  connected = true; connection('已连接 Workbench', 'ok')
  $('connection-detail').textContent = `${host.appId} · Workbench 小程序 API ${host.apiVersion.major}.${host.apiVersion.minor} · ${host.capabilities.length} 项已授权能力。模型和搜索不会自动调用。`
  recordCall(examples[0], {}, host, null, started)
  select(selected.id)
} catch (error) {
  sdk?.dispose(); connected = false; connection('未连接 Workbench', 'error')
  $('connection-detail').textContent = `${error.code || error.name}: ${error.message}。请在 Workbench 中安装 .miniapp；普通浏览器只可阅读代码，不模拟成功。`
  syncControls()
}
