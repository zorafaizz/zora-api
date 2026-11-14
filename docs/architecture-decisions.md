# KanjutGede API — Architecture Decisions & Design Records

**Document Version:** 1.0.0  
**Repository:** `/home/zorafaiz/api-service`  
**Base Domain:** `api.itsfaiz.my.id`  
**Authoritative Plan:** `PLAN.md` (Sections 1 & 2)

---

## 1. Modular Monolith Architecture

1. **Express 5 (ESM):**
   - Tetap menggunakan Node.js ESM natif dengan Express 5 yang sudah terpasang.
   - Pola modular terisolasi: modul `account`, `api-keys`, `billing`, `anti-abuse`, `scrapers`, dan `solvers`.
2. **Dedicated Background Queue (BullMQ + Redis):**
   - Permintaan HTTP yang ringan (BMKG, jadwal sholat, info) dieksekusi sinkron langsung melalui Express.
   - Permintaan berat (Sharp Lanczos 4x UHD, FlareSolverr scraping berdurasi >10 detik, transcoding) menggunakan BullMQ worker pool agar event-loop Express tidak terblokir.

---

## 2. PostgreSQL sebagai Durable Source of Truth

1. **PostgreSQL 16.15:**
   - Menjadi basis data utama yang menyimpan data akun, API keys, kuota, ledger saldo kredit, dan reservasi.
   - Semua saldo disimpan dalam format integer `BIGINT` (misal 1 credit = 1 unit integer; saldo rupiah dalam integer Rupiah, misal Rp 10.000 = 10000). **Tidak ada floating-point untuk uang atau kredit.**
   - Snapshot zona waktu konsisten dalam UTC, sedangkan reset kuota harian dihitung dalam zona waktu **Asia/Jakarta** (`UTC+07:00`).
2. **Double-Entry Ledger Invariant:**
   - Saldo wallet dihitung dari mutasi append-only pada tabel `credit_ledger`.
   - Invariant: `available_balance = sum(credits_in) - sum(credits_out) - sum(reserved_credits) >= 0`.
   - Pola: **Reserve -> Execute -> Capture / Release**.
     - Jika request gagal dari provider, reservasi dibatalkan (`RELEASE`).
     - Jika request sukses, kredit dipotong permanen (`CAPTURE`).

---

## 3. Redis Caching & Ephemeral Coordination

1. **Redis 7.0.15:**
   - **L2 Cache:** Cache-aside pattern dengan TTL spesifik per kategori data.
   - **Singleflight / Stampede Protection:** Menghindari *thundering herd* saat cache kadaluarsa bersamaan.
   - **Token Bucket Rate Limiter:** Per IP, per Key, dan per Account.
   - **PENTING:** Redis BUKAN penyimpan saldo atau transaksi permanen. Jika Redis restart atau flush, integritas saldo tetap aman di PostgreSQL.

---

## 4. Quota Engine & Aturan Inaktivitas 120 Jam

1. **Test Key:**
   - Tepat **50 request sukses seumur hidup** per akun.
   - Rotasi atau pembuatan key baru TIDAK menambah kuota 50 ini.
2. **Live Key:**
   - **20 request gratis per hari** (Asia/Jakarta, reset 00:00 WIB), dibagi bersama ke seluruh live key milik akun tersebut.
   - Tidak ada rollover kuota gratis ke hari berikutnya.
   - Saldo kredit berbayar terpisah secara independen.
3. **Inactivity Freeze (120 Jam / 5 Hari):**
   - Jika akun tidak melakukan request API live yang sukses dan sah selama 120 jam berturut-turut, maka fasilitas 20 request gratis harian dibekukan sementara.
   - **Kredit berbayar TIDAK dibekukan**.
   - Akun dapat mengaktifkan kembali benefit gratis melalui dashboard (`/api/v1/account/reactivate`) dengan verifikasi sesi akun.

---

## 5. Keamanan & Anti-SSRF (Server-Side Request Forgery)

1. Semua URL eksternal yang diinputkan pengguna ke endpoint (seperti downloader, upscaler, WAF solver) WAJIB lolos validasi SSRF:
   - Skema hanya `http:` atau `https:`.
   - DNS resolution dilakukan terlebih dahulu.
   - Menolak alamat IP internal/private:
     - `127.0.0.0/8` (Loopback)
     - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Private)
     - `169.254.0.0/16` (Link Local / Cloud Metadata seperti AWS 169.254.169.254)
     - `::1` dan link-local IPv6
   - Validasi setiap redirect chain.

---

## 6. Payment Environment — Sandbox Only

1. Membangun interface `PaymentProvider` yang netral terhadap vendor (Midtrans, Tripay, Pakasir, Xendit).
2. Menggunakan `MockPaymentProvider` untuk pengujian unit & integration test sandbox.
3. Di environment production: Endpoint top-up publik menolak pemanggilan riil dan merespons `PAYMENT_PROVIDER_NOT_CONFIGURED` sampai gateway berizin resmi disetujui pengguna.
