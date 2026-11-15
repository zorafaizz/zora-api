# QA final — 2026-11-15

Implementasi dan regresi lokal selesai. Bukti berada di `evidence/final/`. Ini bukan klaim bahwa produksi telah diuji atau persetujuan visual product owner.

| Pemeriksaan | Hasil dan bukti |
| --- | --- |
| Build produksi frontend | PASS, `build.log`; warning URL font/artwork runtime tetap ada, aset tersedia |
| TypeScript dan git diff --check | PASS pada source final |
| Suite terisolasi | PASS 80/80, `tests.log`; Postgres/Redis sementara dan memory mail, tanpa provider produksi |
| Keyboard, modal, picker, Execute mock, clipboard error | PASS desktop/mobile, `browser-regression.log` |
| Stale response, cancel akibat pergantian endpoint, timeout body | PASS pada Explorer dan landing, `browser-regression.log` |
| Responsive dan tema | 24 kombinasi: 4 route × 390/820/1440 × dark/light; tanpa pageerror atau document overflow, `matrix.json` |
| Aksesibilitas otomatis | Nol temuan axe 4.10.3 WCAG A/AA pada 24 kombinasi tersebut setelah perbaikan; bukan sertifikasi WCAG atau pengganti screen reader |
| Reflow tambahan | 320/768, semua route tanpa document overflow, `extra.json`; bukan pengujian browser zoom penuh |
| Scalar | Rendering bundle aktual 1.78.1, pencarian query, navigasi endpoint, kode, toggle tema/reload/lintas route; `scalar-*.png`, `extra.json`, `interactions.json` |
| Auth UI | Email → OTP → signed-in dan error 429 memakai respons fixture berlabel, `signin-authenticated.png`, `signin-error.png` |
| Media dan motion | Playback, pause, mute/unmute melalui klik diperiksa; reduced-motion tidak autoplay; masking/reveal/scroll/page transitions direkam di `final-motion.webm` |
| Aset | Font loaded di seluruh matrix. Resource timing lokal ada di `extra.json`; tidak mewakili internet/perangkat lambat |

Masalah yang ditutup: Scalar gelap pada preferensi light; mount ganda akibat ID legacy; tema hilang ketika updateConfiguration mengganti seluruh konfigurasi; kontras teks/syntax; area scroll tanpa fokus keyboard; nav docs overflow 320 px; cleanup timeline tema; skip links Explorer/sign-in; reduced-motion tap sign-in.

Tes boundary auth lama mengharapkan HTML statis 200 pada `/signin.html`. Server existing sudah memakai redirect 308 ke `/signin`. Tes kini memeriksa keduanya dan metadata entry React; server/auth tidak diubah. Satu percobaan regresi gagal karena fixture 43873 berhenti (connection refused); sesudah fixture dijalankan ulang, tes berhasil. Ini keterbatasan fixture, bukan defect aplikasi.

Batas verifikasi: Chromium lokal; Safari/Firefox, screen reader nyata, audio melalui speaker, jaringan produksi, mail delivery dan transaksi tidak diuji. Browser recording tidak membawa audio. Screenshot baseline memakai poster/reduced motion; rekaman memakai video aktual. Scalar CDN diuji memakai salinan lokal identik SHA256 `db9d00b7ee9259ef90554cbf8b6b0f671c9e0fe8540a33d845630fee68cbb966`, dan URL aplikasi dipin ke versi yang sama. Tidak ada request produksi.

Performa: build menyatakan shared chunk sekitar 288 kB sebelum gzip, 94 kB gzip; artwork existing sekitar 2 MB, icon existing sekitar 1.36 MB. Timing loopback tidak dijadikan skor performa produksi. Optimasi turunan gambar dan pengujian jaringan lambat tetap rekomendasi lanjutan, bukan defect fungsional baru. Original media/icon tidak diubah.
