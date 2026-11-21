[![Powered by Caelara Labs](https://benchmarks.caelaralabs.com/verify/powered-by.svg)](https://caelaralabs.com)

# AI Search Readiness Auditor (white-label starter)

A small Cloudflare Pages site that audits any public website for AI search readiness (`/llms.txt`, AI crawler access, structured data) and domain trust (SPF and DMARC, security headers, certificates). Put your own name on it and run it for clients, or as the front end of your own paid service.

It is a static page plus two Pages Functions. Your Caelara key stays in the Function environment and is never sent to the browser.

## One-click deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kingefman1-cmyk/ai-seo-auditor-kit)

The button opens Cloudflare's deploy flow for this repository. When it finishes, add your key as the `CAELARA_API_KEY` secret (step 4 below); the site shows an error until it is set. If the button does not suit your account, follow the manual steps.

## Set up in about five minutes

1. Get a key. A free trial key (50 calls, no card) is at https://caelaralabs.com/shield/#trial. Each audit makes **two** calls, so a trial key covers about 25 audits. For more volume, email ops@caelaralabs.com.
2. Install and log in to Cloudflare:
   ```bash
   npm install
   npx wrangler login
   ```
3. Set your brand name in `wrangler.toml` (`NEXT_PUBLIC_BRAND_NAME`).
4. Deploy and add the key as a secret:
   ```bash
   npm run deploy
   npx wrangler pages secret put CAELARA_API_KEY --project-name ai-seo-auditor
   ```
5. Open the `*.pages.dev` address Wrangler prints. Add your own domain under Pages > Custom domains.

Local run: copy `.dev.vars.example` to `.dev.vars`, fill in the key, then `npm run dev`.

## What an audit costs

One audit calls two composite endpoints at 0.025 USDC each, so **0.05 USDC per audit** at the published per-call price. The site has no billing of its own: add a login and payment step in front of `/api/audit` before you charge anyone, and set a Cloudflare rate-limiting rule on `/api/*` so a crawler cannot use up your credit. Requests are only accepted from pages served by your own site (see `callerAllowed` in `lib/proxy.js`).

## Endpoints used

| Call | Purpose |
|---|---|
| `GET https://seo.caelaralabs.com/v1/geo-readiness-composite` | AI-search readiness score and recommendations |
| `GET https://compliance.caelaralabs.com/v1/domain-trust-composite` | SPF and DMARC, security headers, certificates |

Both results are heuristic. A clean result is not a guarantee of anything, and the page says so.

## Live badges for your users

The page includes an "Embed a live badge" box that generates Markdown and HTML for two public badges. Each snippet links back to https://caelaralabs.com.

```markdown
[![AI Ready](https://benchmarks.caelaralabs.com/verify/ai-ready.svg?domain=example.com)](https://caelaralabs.com)
[![Domain Trust](https://benchmarks.caelaralabs.com/verify/domain-trust.svg?domain=example.com)](https://caelaralabs.com)
```

```html
<a href="https://caelaralabs.com"><img src="https://benchmarks.caelaralabs.com/verify/ai-ready.svg?domain=example.com" alt="AI Ready" height="20"></a>
```

Badges need no key and are cached for an hour. How they are graded: AI Ready is "Grade A" when `/llms.txt` exists and no checked AI crawler is blocked from the whole site, "Grade B" when it exists but a crawler is blocked, and "Missing /llms.txt" otherwise. Domain Trust reports whether SPF and DMARC records are present; it does not validate them.

## Files

```
public/        the page (index.html, app.js, style.css, _headers)
functions/api/ audit.js and config.js (Pages Functions)
lib/proxy.js   input checks, caller check, upstream calls
test/          node --test test/
```

## License

MIT. See `LICENSE`.
