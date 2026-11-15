# Release — 2026-11-15

Owner mengotorisasi finishing, push GitHub dan deployment ke api.itsfaiz.my.id. Release mencakup frontend final, creative polish landing, renderer Scalar, dan regresi boundary yang mengikuti redirect existing. Backend contracts, auth service, billing, database dan environment tidak diubah.

Build frontend, TypeScript dan 80 tes pada Postgres/Redis sementara lulus sebelum push. Evidence visual dan regression yang relevan disertakan. Aset hasil build yang aktif disertakan; hashed assets historis yang tidak dipakai tetap ada lokal dan tidak dihapus.

Target existing: systemd zora-api.service, port 3095, reverse proxy Nginx api.itsfaiz.my.id. Deployment cukup restart service untuk memuat renderer Scalar terbaru. Tidak menjalankan migrasi atau mengubah proxy/TLS. Pemeriksaan live dibatasi pada halaman statis, aset, docs dan health tanpa auth/provider/billing/email.

Branch GitHub: v0/cobalt-cinematic-redesign (PR #2). Push branch tidak melakukan merge otomatis ke main. Instruksi dan studi historis yang tidak terkait release tetap dipertahankan lokal.

Rollback snapshot VPS: /tmp/kg-release-backup-20261115-232153/public-and-docs.tar.gz. Arsip berisi public dan renderer docs tepat sebelum restart. Ini snapshot pre-restart dari hasil build final, bukan baseline versi sebelum redesign. Baseline source tersedia pada commit f714ac41af26b2156c300a87b5202dea5add6358; rollback ke baseline harus disiapkan di direktori terpisah dan disalin selektif agar perubahan lokal pengguna tetap aman.
