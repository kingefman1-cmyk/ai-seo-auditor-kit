// Front end. All text from the API is inserted with textContent, never as HTML.
const $ = (id) => document.getElementById(id)
const BADGE_HOST = 'https://benchmarks.caelaralabs.com'
const LINK = 'https://caelaralabs.com'

export function badgeSnippets(domain, kind) {
  const d = String(domain).trim().toLowerCase()
  const label = kind === 'domain-trust' ? 'Domain Trust' : 'AI Ready'
  const src = `${BADGE_HOST}/verify/${kind === 'domain-trust' ? 'domain-trust' : 'ai-ready'}.svg?domain=${encodeURIComponent(d)}`
  return { src, markdown: `[![${label}](${src})](${LINK})`, html: `<a href="${LINK}"><img src="${src}" alt="${label}" height="20"></a>` }
}

function el(tag, text, cls) {
  const n = document.createElement(tag)
  if (text !== undefined) n.textContent = text
  if (cls) n.className = cls
  return n
}
const tone = (ok, warn) => (ok ? 'pill ok' : warn ? 'pill warn' : 'pill bad')

function renderGeo(box, g) {
  box.replaceChildren()
  if (!g) return box.append(el('p', 'This check was unavailable. Try again shortly.', 'muted'))
  box.append(el('div', `${g.score ?? '?'} / 100  ·  grade ${g.grade ?? '?'}`, 'big'))
  const llms = g.llms_txt || {}
  const blocked = (g.ai_crawlers && g.ai_crawlers.blocked) || []
  box.append(el('span', llms.llms_txt_found ? '/llms.txt found' : '/llms.txt missing', tone(llms.llms_txt_found)))
  box.append(el('span', blocked.length ? `${blocked.length} AI crawler(s) blocked` : 'AI crawlers allowed', tone(!blocked.length, true)))
  const sd = g.structured_data
  box.append(el('span', sd && sd.json_ld_blocks ? 'JSON-LD present' : 'No JSON-LD', tone(sd && sd.json_ld_blocks, true)))
}

function renderTrust(box, t) {
  box.replaceChildren()
  if (!t) return box.append(el('p', 'This check was unavailable. Try again shortly.', 'muted'))
  box.append(el('div', `${t.trust_score ?? '?'} / 100  ·  ${t.verdict ?? ''}`, 'big'))
  const mail = t.email_auth || {}
  box.append(el('span', `SPF/DMARC grade ${mail.grade ?? 'n/a'}`, tone(mail.grade === 'A' || mail.grade === 'B', mail.grade === 'C')))
  const miss = (t.security_headers && t.security_headers.missing) || []
  box.append(el('span', miss.length ? `${miss.length} security header(s) missing` : 'Security headers present', tone(!miss.length, true)))
  const certs = t.certificates || {}
  if (typeof certs.active_count === 'number') box.append(el('span', certs.active_count ? 'Certificate active' : 'No active certificate seen', tone(certs.active_count > 0)))
}

function updateBadge() {
  const d = $('bd').value.trim()
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return
  const s = badgeSnippets(d, $('bk').value)
  $('bimg').src = s.src
  $('md').value = s.markdown
  $('ht').value = s.html
}

async function main() {
  try {
    const c = await (await fetch('/api/config')).json()
    if (c.brand) { $('brand').textContent = c.brand; document.title = c.brand }
  } catch { /* keep default */ }
  $('bd').addEventListener('input', updateBadge)
  $('bk').addEventListener('change', updateBadge)
  $('f').addEventListener('submit', async (e) => {
    e.preventDefault()
    const status = $('status'), go = $('go')
    status.className = 'status'; status.textContent = 'Running the audit. This usually takes a few seconds.'; go.disabled = true
    try {
      const r = await fetch('/api/audit?url=' + encodeURIComponent($('url').value))
      const j = await r.json()
      if (!r.ok) { status.className = 'status err'; status.textContent = j.error || 'The audit failed.'; return }
      status.textContent = j.unavailable.length ? 'Done, but ' + j.unavailable.join(' and ') + ' was unavailable.' : 'Done.'
      renderGeo($('geo'), j.geo); renderTrust($('trust'), j.trust)
      const recs = $('recs'); recs.replaceChildren()
      const list = (j.geo && j.geo.recommendations) || []
      for (const x of list.length ? list : ['No recommendations returned for this site.']) recs.append(el('li', x))
      $('out').hidden = false
      $('bd').value = j.domain; updateBadge()
    } catch {
      status.className = 'status err'; status.textContent = 'Could not reach the audit service.'
    } finally { go.disabled = false }
  })
}
if (typeof document !== 'undefined' && document.getElementById('f')) main()
