# KanjutGede API — Anti-Farming & Account Routing Defense Specification

**Document Version:** 1.0.0  
**Repository:** `/home/zorafaiz/api-service`  
**Base Domain:** `api.itsfaiz.my.id`  
**Authoritative Plan:** `PLAN.md` (Section 4)

---

## 1. Filosofi & Batasan Etika

1. **Prinsip Anti-False-Positive:**
   - **Satu IP Bukan Satu Orang.** Di ekosistem bot WhatsApp, banyak pengguna menjalankan bot mereka dari hosting bersama (shared hosting, Carrier Grade NAT seluler Telkomsel/Indosat, atau node panel Pterodactyl).
   - **DILARANG KERAS** memblokir IP bersama hanya karena ada puluhan akun yang mengakses dari IP tersebut. 100 bot pengguna sah yang berjalan di satu server Pterodactyl wajib tetap dapat beroperasi normal.
2. **Tidak Melakukan Invasive Surveillance:**
   - Tidak melakukan fingerprinting browser invasif, tidak mengumpulkan data pribadi atau kontak, dan tidak menyimpan payload query sensitif.
   - Hanya mengumpulkan sinyal keamanan proporsional (frekuensi pergantian key, korelasi waktu habisnya kuota, umur akun).

---

## 2. Multi-Signal Correlation & Risk Scoring

Skor risiko dihitung dari keluarga sinyal independen, BUKAN dari IP semata:

| Sinyal | Bobot Risiko | Penjelasan & Pencegahan False Positive |
| :--- | :--- | :--- |
| **Rapid Key Switching** | +30 | Kuota akun A habis, lalu dalam <5 detik berganti request dengan pola endpoint identik dari akun B secara berulang. |
| **Burst Registration Pattern** | +25 | Pendaftaran massal beruntun dalam rentang milidetik dengan provider subject yang berkorelasi. |
| **Coordinated Timing Sequence** | +20 | Pemanggilan berurutan yang identik secara mekanis (*lock-step calls*). |
| **Shared Network Context (Weak)** | +5 (Maksimal) | IP bersama / ASN data center hanya dianggap konteks lemah. Bobot sangat kecil agar hosting bot tidak terblokir. |

### Tangga Penegakan Bertahap (Enforcement Ladder):
1. **Level 0 (Observe / Shadow Mode):** Catat log korelasi dan skor risiko tanpa mengganggu traffic pengguna.
2. **Level 1 (Rate Throttle):** Pembatasan laju pendaftaran atau delay kecil pada pengeluaran benefit gratis.
3. **Level 2 (Step-up Verification):** Meminta verifikasi sesi dashboard sebelum benefit gratis hari itu dicairkan.
4. **Level 3 (Free-benefit Hold):** Membekukan benefit gratis sementara bagi klaster yang terkonfirmasi abusive; **traffic kredit berbayar tetap diperbolehkan**.
5. **Level 4 (Manual Review & Sanction):** Pencabutan key abusive setelah verifikasi manual oleh administrator dengan pencatatan audit reason code.
