# KanjutGede API — Resource-Based Pricing & Cost Model

**Document Version:** 1.0.0  
**Repository:** `/home/zorafaiz/api-service`  
**Base Domain:** `api.itsfaiz.my.id`  
**Authoritative Plan:** `PLAN.md` (Section 6)

---

## 1. VPS Infrastructure Cost Attribution Model

Kapasitas server host:
- **Processor:** 12 vCPU AMD EPYC-Milan @ 2.0GHz
- **Memory:** 31 GiB RAM
- **Storage:** 968 GiB NVMe SSD
- **Network:** 1 Gbps port unmetered
- **Estimasi Biaya Operasional Host Bulanan:** Rp 600.000 / bulan (setara ~$38 USD)

### Formula Alokasi Biaya Sumber Daya:
Dengan asumsi 30 hari kalender = 2.592.000 detik:
- **Total vCPU-seconds bulanan:** 12 core × 2.592.000s = **31.104.000 core-seconds**
- **Total RAM GB-seconds bulanan:** 31 GB × 2.592.000s = **80.352.000 GB-seconds**
- **Bobot Biaya:** 60% CPU (Rp 360.000) + 30% RAM (Rp 180.000) + 10% Egress/Disk (Rp 60.000)
- **Unit Cost CPU:** Rp 360.000 / 31.104.000s ≈ **Rp 0,0115 per core-second**
- **Unit Cost RAM:** Rp 180.000 / 80.352.000 GB-s ≈ **Rp 0,0022 per GB-second**

Target Gross Margin Platform: **75%** (`target_price = estimated_cost / (1 - 0.75) = estimated_cost * 4`).  
Nilai Konversi Kredit: **1 Credit = Rp 10,- IDR**.

---

## 2. Benchmark Resource Consumption & Pricing Matrix

| Kelas Sumber Daya | Contoh Endpoint | Rata-rata CPU Time | Rata-rata RAM Occupancy | Estimasi Biaya Riil | Harga Target (IDR) | Harga Final (Credits) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Minimal / Cached** | `info.gempa`, `info.sholat`, `util.shortlink` | 5ms (0.005s) | 20 MB (0.02 GB) | Rp 0,0001 | Rp 5 | **1 Credit** (Rp 10) |
| **Network Scraper** | `dl.tiktok`, `dl.facebook`, `dl.mediafire` | 80ms (0.08s) | 45 MB (0.045 GB) | Rp 0,0010 | Rp 8 | **1 Credit** (Rp 10) |
| **Decrypted Video** | `dl.youtube`, `dl.spotify` | 180ms (0.18s) | 60 MB (0.06 GB) | Rp 0,0022 | Rp 10 | **1 Credit** (Rp 10) |
| **AI LLM Inference** | `ai.chat` | 400ms (0.40s) | 80 MB (0.08 GB) | Rp 0,0048 | Rp 20 | **2 Credits** (Rp 20) |
| **Heavy CPU Image** | `media.hd` (Sharp CLAHE) | 650ms (0.65s) | 180 MB (0.18 GB) | Rp 0,0079 | Rp 25 | **2 Credits** (Rp 20) |
| **Heavy UHD 4x** | `media.uhd` (Sharp Lanczos3) | 1.800ms (1.80s) | 450 MB (0.45 GB) | Rp 0,0217 | Rp 40 | **4 Credits** (Rp 40) |
| **Headless WAF Solver**| `solve.waf`, `solve.turnstile` | 3.500ms (3.50s) | 650 MB (0.65 GB) | Rp 0,0452 | Rp 50 | **5 Credits** (Rp 50) |

---

## 3. Aturan Reservasi Kredit (Accounting Invariants)

1. **Integer Money & Credits:** Seluruh saldo dan transaksi dicatat dalam integer `BIGINT` untuk mencegah precision error floating-point.
2. **Reserve -> Execute -> Capture / Release:**
   - Sebelum pemanggilan endpoint berat atau berbayar, sistem melakukan **kondisional UPDATE** pada tabel `wallets` untuk memindahkan saldo dari `balance_credits` ke `reserved_credits`.
   - `UPDATE wallets SET balance_credits = balance_credits - $amount, reserved_credits = reserved_credits + $amount WHERE account_id = $id AND balance_credits >= $amount`.
   - Jika eksekusi berhasil: `CAPTURE` -> `reserved_credits = reserved_credits - $amount`, dan entri dicatat ke `credit_ledger`.
   - Jika eksekusi gagal dari hulu / timeout: `RELEASE` -> `balance_credits = balance_credits + $amount, reserved_credits = reserved_credits - $amount`. Pengguna TIDAK dirugikan jika server eksternal offline.
3. **Double Entry Balance Invariant:**
   - `available_balance = sum(credits_in) - sum(credits_out) - sum(reserved_credits) >= 0`.
