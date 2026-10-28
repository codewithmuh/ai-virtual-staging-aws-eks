# Threat model

Lightweight [STRIDE](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) review.
Revisit it when you add an external integration, a data store, or a new trust boundary.

## Assets

- Room photos, which can show the inside of someone's home
- AI provider API keys (they cost money if leaked)
- Service availability
- Build and release pipeline (images, signing identity)

## Threats and mitigations

| STRIDE | Threat | Mitigation | Status |
|---|---|---|---|
| Spoofing | Forged release images | Keyless cosign signatures tied to this repo's workflow | ✅ |
| Tampering | Compromised GitHub Action or dependency | Actions pinned to SHAs, Dependabot, Trivy scans, SBOM | ✅ |
| Repudiation | Unknown who changed what | Protected `main`, required reviews, signed release provenance | ✅ |
| Information disclosure | Secrets committed to git | gitleaks in pre-commit and CI; `.env` ignored | ✅ |
| Elevation of privilege | Container breakout | Non-root, read-only, no capabilities, minimal base image | ✅ |
| Denial of service | Request floods exhaust the service | Per visitor, IP and site in the API ✅; AWS WAF rate rules on the ALB (phase 1) | ⚠️ partly |
| Denial of service | Abuse runs up the AI or GPU bill ("denial of wallet") | Daily limits per visitor, IP and site, counted before any paid call ✅; spend alerts at 80% (phase 2) | ⚠️ partly |
| Tampering | Prompt injection through uploaded content | Claude output is parsed into fixed schemas and only ever shown as text; it triggers nothing | ✅ |
| Information disclosure | Photo metadata (EXIF GPS) reveals where a home is | Photos re-encoded from pixels on upload, so no EXIF survives (tested) | ✅ |
| Information disclosure | Photos readable by anyone with the bucket name | Private bucket, short-lived presigned URLs, Block Public Access | ⏳ planned |
| Tampering | A staged photo hides a defect (a crack, a damaged floor) | Rule R2: furniture-only prompt, and a structure check that flags changed walls and windows | ✅ |
| Spoofing | Pods use long-lived AWS keys | EKS Pod Identity; no AWS access keys in the cluster | ⏳ planned |
| Tampering | Script injection through AI-written or user-typed text | React renders it as text; no raw HTML anywhere in the web app | ✅ |
| Tampering | The site framed by another page (clickjacking) | `X-Frame-Options: DENY`; a Content-Security-Policy once the domain is fixed (phase 1) | ⚠️ partly |
| Information disclosure | Share pages found by people they weren't sent to | 128-bit random ids, `noindex`, photo links that expire after an hour | ✅ |

## Open risks

List accepted risks with an owner and a review date.
