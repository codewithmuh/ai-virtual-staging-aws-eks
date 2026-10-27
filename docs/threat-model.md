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
| Denial of service | Request floods exhaust the service | Rate limits at the edge (AWS WAF on the ALB) and per user in the API | ⏳ planned |
| Denial of service | Abuse runs up the AI or GPU bill ("denial of wallet") | Per-user daily limits, a global daily budget, alerts at 80% | ⏳ planned |
| Tampering | Prompt injection through uploaded content | Model output is schema-validated and never triggers an action on its own | ⏳ planned |
| Information disclosure | Photo metadata (EXIF GPS) reveals where a home is | EXIF stripped on upload, before storage | ⏳ planned |
| Information disclosure | Photos readable by anyone with the bucket name | Private bucket, short-lived presigned URLs, Block Public Access | ⏳ planned |
| Tampering | A staged photo hides a defect (a crack, a damaged floor) | Rule R2: furniture only; a structure check flags changed walls, windows or floors | ⏳ planned |
| Spoofing | Pods use long-lived AWS keys | EKS Pod Identity; no AWS access keys in the cluster | ⏳ planned |

## Open risks

List accepted risks with an owner and a review date.
