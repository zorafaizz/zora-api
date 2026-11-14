# KanjutGede API — Persistent Implementation Tracker

**Repository:** `/home/zorafaiz/api-service`  
**Domain:** `api.itsfaiz.my.id`  
**Authoritative Plan:** `PLAN.md`  
**Last Updated:** 2026-11-14

---

## 1. Environment & Infrastructure Baseline Audit

| Komponen | Spesifikasi / Status Terdeteksi | Catatan & Konfigurasi |
| :--- | :--- | :--- |
| **OS & Kernel** | Ubuntu Linux 6.8.0-124-generic x86_64 | 12 Cores AMD EPYC-Milan @ 2.0GHz |
| **CPU & Memory** | 12 vCPU, 31 GiB RAM (19 GiB Available, Swap 0B) | Kapasitas sangat memadai untuk worker pool & Sharp concurrency |
| **Penyimpanan** | SSD `/dev/vda1` 968 GiB (273 GiB terpakai, 695 GiB free / 29%) | Sangat aman untuk database, cache, dan file buffer |
| **Runtime Node.js** | Node.js v22.23.3 (system `/usr/bin/node`), npm 10.9.9 | LTS modern, mendukung native fetch, crypto, node:test |
| **PostgreSQL** | PostgreSQL 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1) | Aktif di localhost:5432, Unix socket peer auth + local scram-sha-256 |
| **Redis** | Redis 7.0.15 | Aktif di localhost:6379, PONG verified, no password lokal |
| **FlareSolverr** | v3.5.2 aktif di port 8191 | Digunakan oleh WAF solver dan Turnstile bridge |
| **Reverse Proxy** | Nginx dengan Certbot Let's Encrypt SSL | Upstream ke `http://127.0.0.1:3095`, client_max_body_size 50M |
| **Service Manager**| Systemd (`zora-api.service`) | Berjalan di port 3095 dengan user root |
| **Git Status** | Branch `main`, tracking `origin/main`, clean working tree | Komitmen perubahan dilakukan terstruktur dan atomic |

---

## 2. Baseline Performance & Contract Verification

- **Endpoint Health:** `GET http://127.0.0.1:3095/health`
  - Response: `{"status":true,"creator":"Zora","uptime":"...","node_version":"v22.23.3","memory":{...}}`
- **Legacy Envelope Format:**
  - Sukses: `{ status: true, creator: "Zora", latency: "Xms", result: {...}, data: {...} }`
  - Error: `{ status: false, creator: "Zora", latency: "Xms", error: "...", message: "..." }`
- **Baseline Latency:**
  - `/health`: ~2ms
  - `/api/tools/gempa`: 118ms (menembak upstream BMKG)

---

## 3. Phase Execution Tracker

### Phase A: Audit, Baseline Tests, Inventory, Compatibility Contract (COMPLETED ✓)
- [x] Hardware, runtime, DB, Redis, and network audit.
- [x] Baseline HTTP health and contract verification.
- [x] Comprehensive Endpoint Inventory (`docs/endpoint-inventory.md`).
- [x] Central Machine-Readable Endpoint Registry (`src/registry/endpoints.js`).
- [x] Architecture Decisions Document (`docs/architecture-decisions.md`).
- [x] Automated Registry Integrity Test (`tests/registry.test.js` - 5/5 passing).

### Phase B: Core Resilience, Registry, Logger, Cache, Limits & Worker Isolation (COMPLETED ✓)
- [x] Structured logging (Pino) with secret redaction (`src/core/logger.js`).
- [x] In-memory LRU L1 cache + Redis L2 cache with stampede protection (`src/core/cache.js`).
- [x] Universal request ID injection (`src/middleware/request-id.js`).
- [x] SSRF protection filter with DNS rebinding prevention (`src/core/security.js`).
- [x] Circuit breaker & timeout guard for external scrapers (`src/core/resilience.js`).
- [x] Redis Token Bucket rate limiter per account/key/IP (`src/middleware/rate-limiter.js`).
- [x] Legacy envelope compatibility middleware (`src/middleware/legacy-compat.js`).
- [x] Automated Unit & Integration Tests (`tests/core-resilience.test.js` - 15/15 passing).

### Phase C: PostgreSQL Schema, Accounts, Identity, API Key Lifecycle & Quota Rules (COMPLETED ✓)
- [x] PostgreSQL database `kanjutgede_db` & `kanjutgede_test_db` setup with user `kanjutgede_user`.
- [x] Reversible migrations (Users, API Keys, Quota, Sessions, Audit Logs) (`migrations/001_initial_schema.sql`).
- [x] Database connection pool & transaction manager (`src/core/db.js`).
- [x] Migration runner (`src/core/migrator.js`).
- [x] Account service & 120-hour inactivity freeze engine (`src/modules/account/account.service.js`).
- [x] Zora API Key lifecycle system with HMAC-SHA256 peppered hash and CIDR allowlist (`src/modules/api-keys/api-keys.service.js`).
- [x] Quota rules: 50 test lifetime (immutable across key rotations), 20 daily live (Asia/Jakarta), inactivity freeze (`src/modules/account/quota.service.js`).
- [x] Auth middleware (`src/middleware/auth.js`).
- [x] Automated Unit & Integration Tests (`tests/auth-quota.test.js` - 25/25 passing).

### Phase D: Flexible Resource Pricing, Ledger, Reservations & Mock Payment Sandbox (COMPLETED ✓)
- [x] Double-entry style credit ledger & nonnegative balance invariants (`src/modules/billing/ledger.service.js`).
- [x] Reserve -> Execute -> Capture / Release atomic workflow (`src/middleware/quota-guard.js`).
- [x] Pricing model & cost model document (`docs/pricing-model.md`).
- [x] Provider-neutral payment interface with mock sandbox provider (`src/modules/billing/payment-provider.interface.js`).
- [x] Top-up disabled guard in production (`PAYMENT_PROVIDER_NOT_CONFIGURED`).
- [x] Idempotent payment webhook listener (`src/modules/billing/billing.service.js`).
- [x] Automated Integration Tests (`tests/billing-ledger.test.js` - 33/33 total passing).

### Phase E: Anti-Abuse Defense, Dashboard Branding & Endpoint Expansion (COMPLETED ✓)
- [x] Anti-farming correlation graph (multi-signal, no single-IP guilt, shadow mode) (`src/modules/anti-abuse/anti-abuse.service.js`).
- [x] Anti-abuse specification document (`docs/anti-abuse-defense.md`).
- [x] Audited & exposed new scrapers:
  - SoundCloud Stream & Search (`src/scrapers/soundcloud.js`)
  - Sfile.mobi Direct Link (`src/scrapers/sfile.js`)
  - GSMArena Device Specs (`src/scrapers/gsmarena.js`)
  - Kusonime Anime Search (`src/scrapers/anime.js`)
  - TempMail Disposable Email (`src/scrapers/tempmail.js`)
- [x] Dashboard & Docs re-branded to **KanjutGede API** (domain `api.itsfaiz.my.id` preserved) (`public/index.html`).
- [x] Interactive Scalar API Docs (`/docs`) & OpenAPI 3.1 Spec (`/api/v1/openapi.json`).
- [x] Automated HTTP Contract Test Suite (`tests/http-contract.test.js` - 43/43 total passing).

### Phase F: Comprehensive Testing, Hardening & Rollback Runbook (COMPLETED ✓)
- [x] Concurrent reservation test: 100 simultaneous requests against 20 quota verified (exactly 20 permitted, 80 rejected).
- [x] Advanced SSRF test suite (loopback, decimal notation, IPv4-mapped IPv6, metadata block).
- [x] Shared-IP multi-tenant bot panel test (100 accounts behind 1 IP evaluated as PASS, zero false positive blanket bans).
- [x] Mock payment webhook test (HMAC signed, duplicate replay idempotent).
- [x] Production payment disabled guard (`PAYMENT_PROVIDER_NOT_CONFIGURED`).
- [x] Deployment & Rollback runbook (`docs/deployment-runbook.md`).
- [x] Production service live & active (`systemctl status zora-api`).
- [x] Live HTTPS verified (`https://api.itsfaiz.my.id/health` & `https://api.itsfaiz.my.id/docs`).
- [x] All 48 automated tests passing (0 failures).

### Phase G: Scraper Discovery, Multi-Engine Failover & 42-Endpoint Expansion (COMPLETED ✓)
- [x] Exhaustive 12-source external scraper discovery (`529` candidates analyzed; `524` public artifacts isolated in `staging/`; `5` password-locked items respected; `xmz-scraper.my.id` documented dead).
- [x] Linear $O(N)$ 4-level deduplication (`12` exact, `39` structural clones across `36` clusters, `47` same-upstream, `99` independent providers, `296` unique capabilities) & policy/security gate (`docs/scraper-discovery/*`).
- [x] Empirical 3-round live staging benchmarks (`75` provider evaluations, bounded concurrency `4`, timeout `8500ms`).
- [x] Multi-Engine Provider Orchestrator (`src/core/resilience.js`: `executeMultiProvider`, EWMA health scoring $\alpha=0.3$, `FailureDomainTracker`, retry budgets with jitter, deadline propagation, bulkhead concurrency caps).
- [x] Upgraded 11 existing scraper modules (`tiktok`, `twitter`, `spotify`, `pinterest`, `youtube`, `tools`, `aio`, `soundcloud`, `tempmail`, `anime`, `gsmarena`) to true multi-provider failover chains.
- [x] Added 12 clean-room endpoints (`dl.pixeldrain`, `search.manga`, `search.wikipedia`, `search.pinterest`, `search.applemusic`, `search.steam`, `search.sticker`, `search.soundboard`, `stalk.npm`, `tool.translate`, `tool.dns`, `tool.ssweb`) expanding `ENDPOINT_REGISTRY` from `30` to `42` active endpoints.
- [x] Expanded automated test suite (`tests/multi-engine.test.js`, `tests/registry.test.js`, `tests/http-contract.test.js`) passing 100%.

---

## 4. Final Verification Summary

| Item Pengujian | Target / Kontrak | Hasil Terverifikasi | Status |
| :--- | :--- | :--- | :--- |
| **Backward Compatibility** | Creator `KanjutGede`, envelope `{ status, creator, latency, result, data }` | Teruji pada route `/api/tools/gempa` dan scraper lama | **PASS ✓** |
| **OpenAPI / Scalar Docs** | Scalar UI di `/docs`, JSON spec di `/api/v1/openapi.json` | Terverifikasi via cURL & browser HTTP 200 | **PASS ✓** |
| **Zora API Key Auth** | `zora_live_...` & `zora_test_...` (HMAC-SHA256, peppered) | Teruji create, verify, CIDR IP allowlist, revoke | **PASS ✓** |
| **Quota Invariants** | 50 seumur hidup (Test), 20 per hari (Live, Asia/Jakarta) | Teruji 100 simultaneous race condition (20 pass, 80 reject) | **PASS ✓** |
| **120h Inactivity Rule** | Freeze benefit gratis setelah 120 jam inaktif, explicit reactivation | Teruji via timestamp simulation & reaktivasi dashboard | **PASS ✓** |
| **Double-Entry Ledger** | Reserve -> Capture / Release, saldo non-negatif | Teruji via transaksi atomik PostgreSQL | **PASS ✓** |
| **Sandbox Payment Gate** | Sandbox mock top-up aktif untuk testing, real provider disabled | Teruji invoice mock QRIS & verifikasi webhook HMAC | **PASS ✓** |
| **Anti-Abuse Defense** | Multi-signal correlation graph, shadow mode | Teruji tanpa false-positive pada IP shared hosting | **PASS ✓** |
| **Automated Test Suite** | Node.js built-in test runner (`npm test`) | **48 / 48 Tests Passing (0 failures, 1.5s)** | **PASS ✓** |

