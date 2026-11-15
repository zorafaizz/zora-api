# Landing creative polish — terbaru

Review terbaru khusus landing, dibandingkan dengan versi final sebelum polish (bukan PR #2):

- [Before/after desktop dark](evidence/landing-polish/comparison-dark-1440.jpg) · [light](evidence/landing-polish/comparison-light-1440.jpg)
- [Before/after mobile dark](evidence/landing-polish/comparison-dark-390.jpg) · [light](evidence/landing-polish/comparison-light-390.jpg)
- [Full landing desktop](evidence/landing-polish/after-dark-1440-full.png) · [mobile](evidence/landing-polish/after-dark-390-full.png)
- [Motion desktop](evidence/landing-polish/landing-motion-1440.webm) · [mobile](evidence/landing-polish/landing-motion-390.webm)
- [Catatan dan targeted regression](LANDING-POLISH.md)

Screenshot seluruh route di bawah tetap menjadi bukti sebelum polish untuk landing; route lain tidak didesain ulang.

---

# Visual review final — 2026-11-15

Render aplikasi aktual di fixture loopback; 4 route × 3 viewport × 2 tema. Scalar memakai bundle 1.78.1 yang sama dengan URL pin aplikasi. Dark/light pada nama file telah diverifikasi; bukan sekadar preferensi browser.

- [Before/after desktop seluruh route](evidence/final/comparison-1440.jpg)
- [Before/after mobile seluruh route](evidence/final/comparison-390.jpg)
- [Matrix board](evidence/final/matrix-board.jpg)
- [Landing penuh](evidence/final/home-full-1440.png)
- [Motion terbaru](evidence/final/final-motion.webm) — tanpa track audio; kontrol mute diuji lewat state media.
- [Frame motion](evidence/final/motion-contact.jpg)

| Route | Mobile 390 | Tablet 820 | Desktop 1440 |
| --- | --- | --- | --- |
| home | [dark](evidence/final/home-dark-390.png) / [light](evidence/final/home-light-390.png) | [dark](evidence/final/home-dark-820.png) / [light](evidence/final/home-light-820.png) | [dark](evidence/final/home-dark-1440.png) / [light](evidence/final/home-light-1440.png) |
| explorer | [dark](evidence/final/explorer-dark-390.png) / [light](evidence/final/explorer-light-390.png) | [dark](evidence/final/explorer-dark-820.png) / [light](evidence/final/explorer-light-820.png) | [dark](evidence/final/explorer-dark-1440.png) / [light](evidence/final/explorer-light-1440.png) |
| docs | [dark](evidence/final/docs-dark-390.png) / [light](evidence/final/docs-light-390.png) | [dark](evidence/final/docs-dark-820.png) / [light](evidence/final/docs-light-820.png) | [dark](evidence/final/docs-dark-1440.png) / [light](evidence/final/docs-light-1440.png) |
| signin | [dark](evidence/final/signin-dark-390.png) / [light](evidence/final/signin-light-390.png) | [dark](evidence/final/signin-dark-820.png) / [light](evidence/final/signin-light-820.png) | [dark](evidence/final/signin-dark-1440.png) / [light](evidence/final/signin-light-1440.png) |

State tambahan: [Scalar search](evidence/final/scalar-search-query.png), [endpoint](evidence/final/scalar-endpoint.png), [auth success](evidence/final/signin-authenticated.png), [auth error](evidence/final/signin-error.png). Semua auth menggunakan fixture.

Hasil: [matrix + axe](evidence/final/matrix.json), [interaksi](evidence/final/interactions.json), [reflow/theme/assets](evidence/final/extra.json), [regresi browser](evidence/final/browser-regression.log), [80 tes](evidence/final/tests.log), [build](evidence/final/build.log).

Baseline di `evidence/baseline/f714ac4/`; evidence agent sebelumnya di `evidence/surface-sprint/` dipertahankan. Perbandingan baseline adalah viewport yang sama, tetapi Scalar baseline belum termuat penuh; jangan menafsirkan ruang kosongnya sebagai fitur yang dihapus. Lihat [FINAL-QA](FINAL-QA.md) untuk batas verifikasi.
