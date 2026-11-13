# Raw Scraper Library Catalog & Method Analysis

Seluruh file di bawah ini adalah kode mentah (*raw implementation*) yang diekstrak dan direkayasa balik langsung dari berbagai sumber bot & REST API (`Neoxr`, `JereMD`, `Ourin Deluxe`, `Furina v19`, `TurnstileX`, `Izz AM`).

Penamaan mengikuti format:
`{kategori}/{nama_layanan}-{sumber}{nomor_versi}.js`

---

## 1. Kategori: Downloader (`library/raw/downloader/`)

### A. YouTube
* **`youtube-furina1.js` (Metode: Savetube VIP CDN Decryption + Invidious API)**
  * *Mekanisme:* Mengambil CDN acak dari `https://media.savetube.vip/api/random-cdn`, lalu mendekripsi metadata menggunakan kunci rahasia **AES-128-CBC** (`C5D58EF67A7584E4A29F6C35BBC4EB12`). Mengembalikan link langsung MP4 dan MP3 tanpa membebani CPU server.
* **`youtube-ourin1.js` (Metode: YTDL + FFmpeg Buffer Transcoding)**
  * *Mekanisme:* Menembak stream langsung lalu mengonversinya secara lokal menggunakan flag FFmpeg `-c:a libmp3lame -b:a 192k`.
* **`youtube-jere1.js` (Metode: JereMD YouTube Streamer)**
  * *Mekanisme:* Modul parsing stream YouTube terintegrasi pada arsitektur bot Jere.

### B. TikTok
* **`tiktok-ourin1.js` (Metode: TikWM API)**
  * *Mekanisme:* Melakukan query ke `https://www.tikwm.com/api/` untuk mengekstrak URL HD MP4 (no watermark), sound MP3, avatar author, serta array album foto slide.

### C. Instagram
* **`instagram-furina1.js` (Metode: Polaris Graph Media + Embed Captioning)**
  * *Mekanisme:* Menembak `https://www.instagram.com/reel/{code}/embed/captioned/` dan membaca objek `xig_polaris_media` atau `s.handle` untuk mengambil CDN link MP4 dan multi-slide carousel tanpa login.
* **`instagram-ourin1.js` (Metode: Azbry API Wrapper)**
  * *Mekanisme:* Memanggil bursa perantara `https://api.azbry.com/api/download/instagramv2`.
* **`instagram-ourin2.js` (Metode: ReelsVideo.io Salt Hash Scraper)**
  * *Mekanisme:* Melakukan hashing timestamp dengan salt MD5 `X-Fc-Pp-Ty-eZ` lalu menembak backend AJAX `https://reelsvideo.io/`.

### D. Twitter / X
* **`twitter-ourin1.js` (Metode: X2Twitter Ajax + CF Token Generator)**
  * *Mekanisme:* Mengenerate string acak CF token dan session cookie, lalu menembak `https://x2twitter.com/api/ajaxSearch` untuk mengambil MP4 resolusi 720p/480p/360p.

### E. Facebook
* **`facebook-ourin1.js` (Metode: FDown Parser)**
  * *Mekanisme:* Mengirim URL ke `https://fdown.net/download.php` dan mem-parsing tag HTML `#hdlink` dan `#sdlink` menggunakan Cheerio.

### F. Spotify & Audio
* **`spotify-ourin1.js` (Metode: Spotyloader API)**
  * *Mekanisme:* Melakukan POST ke `https://spotyloader.com/api/spotify/track`.
* **`soundcloud-ourin1.js` (Metode: SoundCloud Scraper)**
  * *Mekanisme:* Ekstraksi stream link lagu dari SoundCloud.

### G. File Storage & Image Sharing
* **`mediafire-ourin1.js` (Metode: MediaFire HTML Scraper)**
  * *Mekanisme:* Ekstraksi tombol `#downloadButton` langsung dari DOM MediaFire.
* **`sfile-ourin1.js` (Metode: Sfile.mobi Direct Download)**
  * *Mekanisme:* Bypass halaman download bertingkat di Sfile.mobi.
* **`terabox-ourin1.js` (Metode: TeraBox Cloud Extractor)**
  * *Mekanisme:* Bypass link sharing TeraBox untuk mendapatkan file asli.
* **`pinterest-ourin1.js` (Metode: ILovePin Proxy Scraper)**
  * *Mekanisme:* Mengambil cookie sesi `ilovepin.net` dan melakukan POST proxy untuk mengunduh pin video & gambar.

---

## 2. Kategori: Artificial Intelligence (`library/raw/ai/`)

* **`brainshop-neoxr1.js` (Neoxr BrainShop AI)**
  * *Mekanisme:* Diekstrak langsung dari biner WASM Neoxr (`dump_unpacked.js`), menembak API `http://api.brainshop.ai/get`.
* **`gemini-ourin1.js` (Gemini Reverse)**
  * *Mekanisme:* Reverse API Google Gemini untuk percakapan teks.
* **`gpt-ourin1.js` (GPT Reverse)**
  * *Mekanisme:* Reverse API model OpenAI GPT.
* **`qwen-ourin1.js` (Qwen3 AI Reverse)**
  * *Mekanisme:* Reverse API model Qwen Alibaba Cloud.
* **`unlimitedai-ourin1.js` (Unlimited AI)**
  * *Mekanisme:* Multi-provider AI chat tanpa batas kuota.

---

## 3. Kategori: Tools & Enhancer (`library/raw/tools/`)

* **`scrapers-furina1.js` (Furina Core Tools - 66 KB)**
  * *Mekanisme:* Berisi puluhan fungsi manipulasi media, stiker WhatsApp, dan konversi buffer.
* **`converter-ffmpeg-jere1.js` (Jere FFmpeg Converter)**
  * *Mekanisme:* Perintah FFmpeg lokal untuk convert audio/video/stiker.
* **`webp2mp4-jere1.js` (WebP to MP4 Converter)**
  * *Mekanisme:* Mengonversi stiker animasi WebP menjadi video MP4.
* **`uploader-jere1.js` (Jere Multi-Uploader)**
  * *Mekanisme:* Upload file ke berbagai image hosting (Telegra.ph, Catbox, Pomf, Top4top).
* **`telegraph-neoxr1.js` (Neoxr Telegra.ph Uploader)**
  * *Mekanisme:* Script upload gambar Telegra.ph asli milik Neoxr.
* **`imglarger-ourin1.js` (ImgLarger API)**
  * *Mekanisme:* Scraper penjernih foto ImgLarger.
* **`removebg-ourin1.js` (Remove Background)**
  * *Mekanisme:* Scraper penghapus latar belakang gambar otomatis.
* **`tempmail-ourin1.js` (TempMail Disposable Inbox)**
  * *Mekanisme:* Pembuat email sementara dan penerima kode OTP email instan.

---

## 4. Kategori: Search (`library/raw/search/`)

* **`anime-ourin1.js` (Kusonime Anime Scraper)**
  * *Mekanisme:* Pencarian judul anime, detail batch download, dan link Google Drive / Mega.
* **`gsmarena-ourin1.js` (GSMArena Phone Specs)**
  * *Mekanisme:* Spesifikasi lengkap smartphone dari GSMArena.
