# Security Assessment Report — PDFify

**Date:** 2026-06-13  
**Scope:** [PDFify](https://c2p-cmd.github.io/img2pdfify/) — client-side React/Vite SPA hosted on GitHub Pages  
**Methods:** security-review, web-security-testing (OWASP Top 10), security-best-practices (React/JS frontend)

---

## Executive Summary

PDFify’s **client-only architecture is its strongest security control**: files never leave the browser, there is no backend, no authentication, and no user data stored on a server. A full code review found **no high-confidence exploitable web vulnerabilities** (no XSS sinks, no secrets in the bundle, no server-side attack surface).

The main gaps are **defense-in-depth items** typical of static GitHub Pages apps: missing Content-Security-Policy and related headers, no dependency lockfile/audit pipeline, and no client-side resource limits for maliciously large PDFs. These are worth addressing but do not indicate an actively exploitable site today.

**Overall risk level:** Low  
**Confidence:** High (for code findings); Mixed (for edge/header controls not configurable in-repo on GitHub Pages)

---

## Application Profile

| Attribute | Value |
|-----------|-------|
| Stack | React 18, TypeScript, Vite 5, PWA (Workbox) |
| Hosting | GitHub Pages (`/img2pdfify/`) |
| Backend | None |
| Auth / sessions | None |
| Third-party runtime scripts | None (all assets self-hosted) |
| User input | Local file uploads only (images, PDFs, passwords typed locally) |

---

## OWASP Top 10 Checklist

| ID | Category | Status | Notes |
|----|----------|--------|-------|
| A01 | Broken Access Control | ✅ N/A | No auth, no server resources |
| A02 | Cryptographic Failures | ⚠️ Low | jsPDF PDF encryption is weak by design; passwords exist only in browser memory |
| A03 | Injection | ✅ Pass | React auto-escaping; no `dangerouslySetInnerHTML`, `eval`, or SQL |
| A04 | Insecure Design | ✅ Strong | Privacy-first local processing is appropriate |
| A05 | Security Misconfiguration | ⚠️ Medium | Missing CSP, `X-Content-Type-Options`, clickjacking headers on live site |
| A06 | Vulnerable Components | ⚠️ Medium | No lockfile; no automated dependency audit in repo |
| A07 | Authentication Failures | ✅ N/A | No authentication |
| A08 | Software/Data Integrity | ⚠️ Low | PWA `autoUpdate` service worker; trust depends on GitHub repo integrity |
| A09 | Logging/Monitoring | ✅ N/A | No server-side logging surface |
| A10 | SSRF | ✅ N/A | No server; `fetch()` used only for local `data:` URLs from canvas |

---

## Findings

### Critical — None

No high-confidence critical vulnerabilities identified.

---

### High — None

No high-confidence exploitable vulnerabilities identified after tracing data flows.

**Reviewed and cleared:**

- **XSS:** User-controlled filenames and error messages render via JSX (`{file.name}`, `{message}`) — React escapes by default. No `dangerouslySetInnerHTML` or DOM injection sinks in source.
- **Secrets exposure:** No hardcoded API keys, tokens, or env secrets. `VITE_BASE_URL` is declared but unused.
- **Open redirect / URL injection:** No URL query params, redirects, or user-controlled `href`/`src`.
- **CSRF / auth:** Not applicable without cookies or server state changes.

---

### Medium

#### [SEC-001] Missing security headers (CSP, nosniff, clickjacking)

- **Rule:** REACT-HEADERS-001 / JS-CSP-001
- **Severity:** Medium
- **Location:** Live deployment — `https://c2p-cmd.github.io/img2pdfify/`
- **Evidence:** HTTP response headers (2026-06-13) include `strict-transport-security` and `access-control-allow-origin: *` only. No `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or `Permissions-Policy`.
- **Impact:** Reduces defense-in-depth against XSS if a future code change introduces a sink; site can be embedded in iframes (clickjacking) unless blocked elsewhere.
- **Fix:**
  1. Add a CSP `<meta>` tag early in `frontend/index.html` (GitHub Pages cannot set response headers in-repo):
     ```html
     <meta http-equiv="Content-Security-Policy"
       content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';" />
     ```
     Note: `style-src 'unsafe-inline'` is often required for Vite/React inline styles; tighten if possible.
  2. For `frame-ancestors` / `X-Frame-Options` (not supported in meta CSP), put Cloudflare or another reverse proxy in front of a custom domain, or accept GitHub Pages limitation.
- **Mitigation:** Keep avoiding XSS sinks in React code (current practice is good).

---

#### [SEC-002] No dependency lockfile or audit pipeline

- **Rule:** REACT-SUPPLY-001 / JS-SUPPLY-001
- **Severity:** Medium
- **Location:** Repository root — no `bun.lock`, `package-lock.json`, or `pnpm-lock.yaml`
- **Evidence:** `npm audit` fails with `ENOLOCK`; only `skills-lock.json` exists (unrelated).
- **Impact:** Non-reproducible installs; harder to detect known CVEs in `pdfjs-dist`, `jspdf`, `pdf-lib`, etc.
- **Fix:**
  1. Commit a lockfile: `bun install` → commit `bun.lockb` (or generate `package-lock.json`).
  2. Enable GitHub Dependabot for the repo.
  3. Add CI step: `bun audit` or `npm audit --audit-level=high`.
- **Mitigation:** Pin dependency versions in `package.json` (already using semver ranges; lockfile is better).

---

#### [SEC-003] No client-side file size / page limits (self-DoS)

- **Rule:** REACT-FILE-001
- **Severity:** Medium (self-impact only)
- **Location:** `frontend/src/components/SplitPdf.tsx:113-148`, `UnlockPdf.tsx:263-330`, `MergePdf.tsx:126-160`
- **Evidence:** PDFs are loaded fully into memory (`file.arrayBuffer()`) with no size or page-count guard before processing.
- **Impact:** A user (or social-engineered user) opening a decompression bomb or multi-GB PDF can freeze/crash their own tab. Does not affect other users or your server.
- **Fix:** Before processing, reject files above a threshold (e.g. 100–250 MB) and PDFs above a page limit (e.g. 500 pages) with a clear UI message.
- **Mitigation:** Document recommended max file size in the UI.

---

### Low

#### [SEC-004] PWA service worker auto-updates without user confirmation

- **Rule:** REACT-SW-001
- **Severity:** Low
- **Location:** `frontend/vite.config.ts:11` (`registerType: "autoUpdate"`), `docs/sw.js` (`skipWaiting`, `clientsClaim`)
- **Impact:** If the GitHub repo or build pipeline were compromised, malicious JS could propagate quickly via SW. Normal PWA tradeoff.
- **Fix:** Consider `registerType: "prompt"` for user-confirmed updates on a security-sensitive tool, or document trust model.
- **Mitigation:** Protect repo with 2FA, branch protection, and signed commits.

---

#### [SEC-005] PDF “Lock” uses rasterization + jsPDF encryption (weak protection)

- **Severity:** Low (product/security expectation, not a web vuln)
- **Location:** `frontend/src/components/UnlockPdf.tsx:140-209`
- **Evidence:** Lock flow re-renders pages to JPEG images and encrypts with jsPDF; unlock strips protection by re-rasterizing.
- **Impact:** Output PDFs are not equivalent to native PDF encryption; passwords can be bypassed by screenshot/OCR. Users may overestimate protection.
- **Fix:** Document in UI that lock/unlock is convenience-grade, not forensic-grade encryption.

---

#### [SEC-006] Passwords held in React component state

- **Severity:** Low
- **Location:** `frontend/src/components/UnlockPdf.tsx:217-218`
- **Impact:** Passwords visible in DevTools/memory; expected for client-only tools. Malware or extensions on the user’s machine could read them — same as any local PDF tool.
- **Fix:** Clear password state on unmount/navigation (`useEffect` cleanup); optional `autocomplete="off"`.

---

## Positive Security Observations

1. **No file uploads to server** — eliminates entire classes of server-side file and data breaches.
2. **No third-party analytics or tag managers** — reduced supply-chain and tracking surface.
3. **No source maps published** in `docs/` — code structure not exposed in production.
4. **React escaping used consistently** for filenames, status messages, and UI text.
5. **Blob URLs revoked** after download in most paths (`URL.revokeObjectURL`).
6. **HSTS enabled** by GitHub Pages on the live site.

---

## Recommended Additions (Priority Order)

| Priority | Action | Effort |
|----------|--------|--------|
| 1 | Add CSP meta tag to `frontend/index.html` | Low |
| 2 | Commit lockfile + enable Dependabot + CI audit | Low |
| 3 | Add file size / page-count limits before PDF processing | Low |
| 4 | Add UI disclaimer for lock/unlock encryption strength | Low |
| 5 | Put custom domain behind Cloudflare (or similar) for full HTTP security headers including `X-Frame-Options` | Medium |
| 6 | (Optional) Switch PWA to prompt-based updates | Low |

---

## What You Do **Not** Need (for this app)

- Server-side auth, CSRF tokens, or session management
- WAF / rate limiting (no backend)
- SQL/NoSQL injection protections
- SSRF protections on a server
- HSTS configuration (already provided by GitHub Pages — do not duplicate in a way that could cause outages on other hosts)

---

## Conclusion

**You do not need a major security overhaul.** PDFify is already well-designed for privacy and has a minimal attack surface. The worthwhile additions are **CSP**, **dependency hygiene (lockfile + audits)**, and **client-side resource limits** — all defense-in-depth, not urgent firefighting.

If you want help implementing any of the recommendations above, say which items to tackle first.
