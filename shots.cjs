const http = require('http')
const fs = require('fs')
const PORT = 9222
const APP = process.env.APP_URL || 'http://localhost:5174/'
function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const targets = await getJSON('/json/list')
  const page = targets.find((t) => t.type === 'page')
  const WebSocket = require('ws')
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false })
  let id = 0
  const pending = new Map()
  ws.on('message', (raw) => {
    const m = JSON.parse(raw)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })) })
  await new Promise((r) => ws.on('open', r))
  await send('Runtime.enable'); await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, userGesture: true })
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,400))
    return r.result?.result?.value
  }
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(`/tmp/shot-${name}.png`, Buffer.from(r.result.data, 'base64'))
    console.log('saved /tmp/shot-' + name + '.png')
  }

  await send('Page.navigate', { url: APP })
  await sleep(2800)
  if (await evalJs(`!!document.querySelector('input[type=password]')`)) {
    await evalJs(`(()=>{
      const setVal=(el,v)=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};
      const inputs=[...document.querySelectorAll('input')];
      setVal(inputs.find(i=>/手机|邮箱|账号/.test(i.placeholder||'')),'13900139000');
      setVal(document.querySelector('input[type=password]'),'Energy2026');
      return 'ok';
    })()`)
    await sleep(400)
    await evalJs(`[...document.querySelectorAll('button')].find(b=>/登录/.test(b.innerText.replace(/\\s+/g,''))).click()`)
    await sleep(3000)
    await evalJs(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/进入系统/.test(b.innerText.replace(/\\s+/g,'')));if(b)b.click();return !!b})()`)
    await sleep(2500)
  }
  await evalJs(`location.hash = '#/device/power/load-strategy'`)
  await sleep(3200)
  await shot('list')

  // 详情弹窗
  await evalJs(`(()=>{
    const btns=[...document.querySelectorAll('.lst-table button.device-cell__link')];
    btns.find(b=>/西部园区全产线限电/.test(b.innerText)).click(); return 'ok';
  })()`)
  await sleep(1800)
  await shot('detail')
  await evalJs(`(()=>{const m=document.querySelector('.lst-detail-modal .ant-modal-close'); if(m)m.click(); return 'ok'})()`)
  await sleep(900)

  // 抽屉
  await evalJs(`(()=>{
    const rows=[...document.querySelectorAll('.lst-table tbody tr')];
    const row=rows.find(r=>/西部园区全产线限电/.test(r.innerText));
    row.querySelector('.lst-scope-link').click(); return 'ok';
  })()`)
  await sleep(1800)
  await shot('drawer')
  await evalJs(`(()=>{const d=document.querySelector('.lst-scoped__head button'); if(d)d.click(); return 'ok'})()`)
  await sleep(900)

  // 执行记录
  await evalJs(`[...document.querySelectorAll('button')].find(b=>/执行记录/.test(b.innerText.replace(/\\s+/g,''))).click()`)
  await sleep(1800)
  await shot('record')
  // 展开一行
  await evalJs(`(()=>{const b=document.querySelector('.lst-record__table .ant-table-row-expand-icon'); if(b)b.click(); return !!b})()`)
  await sleep(1200)
  await shot('record-expanded')

  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
