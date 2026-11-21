// GET /api/audit?url=https://example.com
// One audit = two Caelara composite calls: AI-search readiness (seo) and domain trust (compliance).
import { COMPLIANCE_HOST, SEO_HOST, callCaelara, callerAllowed, json, normaliseDomain, normaliseUrl } from '../../lib/proxy.js'

export async function handleAudit(request, env, fetcher = fetch) {
  if (!callerAllowed(request, env)) return json({ error: 'This endpoint is only available from the site itself.' }, 403)
  if (!env.CAELARA_API_KEY) return json({ error: 'CAELARA_API_KEY is not set. Add it as a secret in your Cloudflare project.' }, 503)
  const url = normaliseUrl(new URL(request.url).searchParams.get('url'))
  if (!url) return json({ error: 'Enter a public website address such as https://example.com.' }, 400)
  const domain = normaliseDomain(new URL(url).hostname)
  const key = env.CAELARA_API_KEY
  const [geo, trust] = await Promise.all([
    callCaelara(fetcher, `${SEO_HOST}/v1/geo-readiness-composite?url=${encodeURIComponent(url)}`, key),
    callCaelara(fetcher, `${COMPLIANCE_HOST}/v1/domain-trust-composite?domain=${encodeURIComponent(domain)}`, key),
  ])
  if (!geo.ok && !trust.ok) return json({ error: geo.error }, geo.status)
  const g = geo.ok && geo.body.partial !== true ? geo.body : null
  const t = trust.ok && trust.body.partial !== true ? trust.body : null
  return json({
    url,
    domain,
    geo: g && { score: g.geo_score, grade: g.grade, breakdown: g.breakdown, llms_txt: g.llms_txt, ai_crawlers: g.ai_crawlers, structured_data: g.structured_data, recommendations: g.recommendations },
    trust: t && { trust_score: t.trust_score, verdict: t.verdict, email_auth: t.email_auth, security_headers: t.security_headers, certificates: t.certificates },
    unavailable: [!g && 'AI-search readiness', !t && 'domain trust'].filter(Boolean),
  })
}

export const onRequestGet = ({ request, env }) => handleAudit(request, env)
