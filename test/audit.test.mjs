// node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleAudit } from '../functions/api/audit.js'
import { callerAllowed, normaliseDomain, normaliseUrl } from '../lib/proxy.js'
import { onRequestGet as config } from '../functions/api/config.js'

const KEY = 'ck_test_value'
const same = { 'Sec-Fetch-Site': 'same-origin' }
const req = (qs, headers = same) => new Request('https://audit.example-site.com/api/audit' + qs, { headers })
const j = (o, status = 200) => new Response(JSON.stringify(o), { status })
const geo = { url: 'https://example.com/', geo_score: 72, grade: 'B', breakdown: {}, llms_txt: { llms_txt_found: false }, ai_crawlers: { blocked: [] }, structured_data: null, recommendations: ['Publish /llms.txt'] }
const trust = { trust_score: 80, verdict: 'trusted', email_auth: { grade: 'A' }, security_headers: { missing: [] }, certificates: { active_count: 2 } }
const upstream = (calls) => async (url, init) => {
  calls.push({ url: String(url), key: init.headers['X-Caelara-Key'] })
  return String(url).includes('geo-readiness') ? j(geo) : j(trust)
}

test('an audit makes two upstream calls with the server-side key and returns both results', async () => {
  const calls = []
  const r = await handleAudit(req('?url=example.com'), { CAELARA_API_KEY: KEY }, upstream(calls))
  const b = await r.json()
  assert.equal(r.status, 200); assert.equal(calls.length, 2); assert.ok(calls.every((c) => c.key === KEY))
  assert.equal(b.geo.grade, 'B'); assert.equal(b.trust.trust_score, 80); assert.deepEqual(b.unavailable, [])
  assert.ok(!JSON.stringify(b).includes(KEY), 'the key never appears in a response')
})

test('input is validated before any paid call', async () => {
  const calls = []
  const f = upstream(calls)
  for (const bad of ['', '?url=', '?url=http://127.0.0.1', '?url=http://localhost', '?url=file:///etc/passwd', '?url=ftp://a.com', '?url=http://10.0.0.1:8080/x']) {
    const r = await handleAudit(req(bad), { CAELARA_API_KEY: KEY }, f)
    assert.equal(r.status, 400, bad)
  }
  assert.equal(calls.length, 0)
})

test('callers outside the site are refused, and the key must be configured', async () => {
  const calls = []
  assert.equal((await handleAudit(req('?url=example.com', { Origin: 'https://evil.example' }), { CAELARA_API_KEY: KEY }, upstream(calls))).status, 403)
  assert.equal((await handleAudit(req('?url=example.com', {}), { CAELARA_API_KEY: KEY }, upstream(calls))).status, 403)
  assert.equal((await handleAudit(req('?url=example.com', {}), { CAELARA_API_KEY: KEY, ALLOW_DIRECT_CALLS: 'true' }, upstream(calls))).status, 200)
  assert.equal((await handleAudit(req('?url=example.com'), {}, upstream(calls))).status, 503)
  assert.equal(callerAllowed(req('?x', { Origin: 'https://audit.example-site.com' }), {}), true)
})

test('one failed or partial source is reported, not hidden; both failing is an error', async () => {
  const half = async (url) => (String(url).includes('geo-readiness') ? j({ partial: true }) : j(trust))
  const b = await (await handleAudit(req('?url=example.com'), { CAELARA_API_KEY: KEY }, half)).json()
  assert.equal(b.geo, null); assert.deepEqual(b.unavailable, ['AI-search readiness'])
  const down = await handleAudit(req('?url=example.com'), { CAELARA_API_KEY: KEY }, async () => { throw new Error('x') })
  assert.equal(down.status, 502)
  const unpaid = await handleAudit(req('?url=example.com'), { CAELARA_API_KEY: KEY }, async () => j({ error: 'Payment Required' }, 402))
  assert.equal(unpaid.status, 503); assert.match((await unpaid.json()).error, /CAELARA_API_KEY/)
})

test('validators and brand config', async () => {
  assert.equal(normaliseDomain('https://www.Example.com/a'), 'example.com')
  assert.equal(normaliseDomain('a.local'), null); assert.equal(normaliseUrl('http://[::1]/'), null)
  const c = await config({ env: { NEXT_PUBLIC_BRAND_NAME: 'Acme Audits' } }).json()
  assert.equal(c.brand, 'Acme Audits')
  assert.equal((await config({ env: {} }).json()).brand, 'AI Search Readiness Auditor')
})
