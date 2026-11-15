# Release — 2026-11-15

Owner mengotorisasi finishing, push GitHub dan deployment ke api.itsfaiz.my.id. Release mencakup frontend final, creative polish landing, renderer Scalar, dan regresi boundary yang mengikuti redirect existing. Backend contracts, auth service, billing, database dan environment tidak diubah.

Build frontend, TypeScript dan 80 tes pada Postgres/Redis sementara lulus sebelum push. Evidence visual dan regression yang relevan disertakan. Aset hasil build yang aktif disertakan; hashed assets historis yang tidak dipakai tetap ada lokal dan tidak dihapus.

Target existing: systemd zora-api.service, port 3095, reverse proxy Nginx api.itsfaiz.my.id. Deployment cukup restart service untuk memuat renderer Scalar terbaru. Tidak menjalankan migrasi atau mengubah proxy/TLS. Pemeriksaan live dibatasi pada halaman statis, aset, docs dan health tanpa auth/provider/billing/email.

Branch GitHub: v0/cobalt-cinematic-redesign (PR #2). Push branch tidak melakukan merge otomatis ke main. Instruksi dan studi historis yang tidak terkait release tetap dipertahankan lokal.

Rollback snapshot VPS: /tmp/kg-release-backup-20261115-232153/public-and-docs.tar.gz. Arsip berisi public dan renderer docs tepat sebelum restart. Ini snapshot pre-restart dari hasil build final, bukan baseline versi sebelum redesign. Baseline source tersedia pada commit f714ac41af26b2156c300a87b5202dea5add6358; rollback ke baseline harus disiapkan di direktori terpisah dan disalin selektif agar perubahan lokal pengguna tetap aman.

## Hasil aktivasi

Commit aplikasi `6169f8383020080094e2bcfeabca605e8e22deaf` berhasil dipush ke origin branch existing. Service direstart pada 2026-11-15 23:22:48 UTC dan aktif dengan PID 3050764. HTTPS `/`, `/explorer`, `/docs`, `/signin`, `/health` merespons 200 melalui curl. Health origin 127.0.0.1:3095 juga 200. Entry landing `index-dgrz8HrJ.js`, seluruh enam aset yang ditautkan landing, serta konfigurasi `forceDarkModeState` Scalar terverifikasi pada response live. Pemeriksaan Python urllib awal mendapat 403 pada health, sedangkan curl domain dan origin berhasil 200; ini perbedaan respons jalur/client dan tidak dijadikan kegagalan service.

Tidak melakukan Execute API/provider, sign-in/email, billing, migrasi, perubahan environment atau proxy. PR #2 tetap terbuka; tidak merge ke main. Instruksi lokal/studi yang sudah dirty sebelum release tidak dimasukkan ke commit release dan tetap tersedia di workspace.
