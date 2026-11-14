# KanjutGede API — Deployment & Rollback Runbook

**Document Version:** 1.0.0  
**Repository:** `/home/zorafaiz/api-service`  
**Base Domain:** `api.itsfaiz.my.id`  
**Port:** `3095`  
**Service Name:** `zora-api.service`

---

## 1. Konfigurasi Environment (`.env.example`)

Salin atau pastikan file `.env` memuat variabel berikut:

```env
NODE_ENV=production
PORT=3095
DATABASE_URL=postgresql://kanjutgede_user:kanjutgede_secure_pass_2026_x9@127.0.0.1:5432/kanjutgede_db
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
API_KEY_PEPPER=kanjutgede_api_production_pepper_secret_9998127391
ENABLE_MOCK_PAYMENT=false
```

---

## 2. Prosedur Deployment Standar

### Langkah 1: Migrasi Database
Jalankan migrasi PostgreSQL sebelum me-restart service:
```bash
node -e "import('./src/core/migrator.js').then(m => m.runMigrations('up')).then(() => { console.log('Migration OK'); process.exit(0); });"
```

### Langkah 2: Menjalankan Automated Verification Suite
Pastikan seluruh 48 test suite lulus:
```bash
npm test
```

### Langkah 3: Restart Service Systemd
Restart service production tanpa downtime berkepanjangan:
```bash
systemctl restart zora-api
systemctl status zora-api --no-pager
```

### Langkah 4: Verifikasi Layanan Live
Periksa endpoint kesehatan dan dokumentasi via cURL:
```bash
curl -I https://api.itsfaiz.my.id/health
curl -s https://api.itsfaiz.my.id/health | jq .
curl -I https://api.itsfaiz.my.id/docs
curl -I https://api.itsfaiz.my.id/api/v1/openapi.json
```

---

## 3. Prosedur Rollback Cepat (Emergency Rollback)

Jika terjadi anomali kritis pasca-deployment:

### Rollback Kode Aplikasi:
```bash
cd /home/zorafaiz/api-service
git checkout <previous_stable_commit>
systemctl restart zora-api
```

### Rollback Skema Database (Reversible Migration DOWN):
Jika diperlukan pembatalan tabel database:
```bash
node -e "import('./src/core/migrator.js').then(m => m.runMigrations('down')).then(() => { console.log('Rollback OK'); process.exit(0); });"
```
