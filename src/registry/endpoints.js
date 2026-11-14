/**
 * KanjutGede API — Central Machine-Readable Endpoint Registry
 * Single Source of Truth untuk Routing, OpenAPI generation, Pricing, Caching, & Policy Enforcement.
 */

export const ENDPOINT_REGISTRY = [
  // ==========================================
  // SYSTEM & HEALTH
  // ==========================================
  {
    id: 'sys.health',
    category: 'System',
    subcategory: 'Monitoring',
    method: 'GET',
    path: '/health',
    aliases: ['/api/v1/health'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'no_quota', // Tidak memotong kuota atau saldo
      default_credits: 0,
      paid_credits: 0
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 3000,
    concurrency_limit: 100,
    execution_mode: 'sync',
    provider_list: ['local_process'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'System Health & Stats',
      summary: 'Periksa status kesehatan server, memory, uptime, dan Node runtime',
      tags: ['System']
    }
  },

  // ==========================================
  // DOWNLOADERS
  // ==========================================
  {
    id: 'dl.aio',
    category: 'Downloaders',
    subcategory: 'Universal',
    method: 'ALL',
    path: '/api/downloader/aio',
    aliases: ['/api/downloader/aiov2', '/api/v1/downloader/aio'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 25000,
    concurrency_limit: 20,
    execution_mode: 'sync',
    provider_list: ['tikwm', 'savetube', 'fdown', 'x2twitter', 'spotify', 'pinterest', 'mediafire'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'All-In-One Downloader',
      summary: 'Ekstraksi video/audio otomatis dari berbagai platform media sosial',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.tiktok',
    category: 'Downloaders',
    subcategory: 'Social',
    method: 'ALL',
    path: '/api/downloader/tiktok',
    aliases: ['/api/downloader/tt', '/api/v1/downloader/tiktok'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 600, vary_by_auth: false },
    deadline_ms: 15000,
    concurrency_limit: 25,
    execution_mode: 'sync',
    provider_list: ['tikwm', 'yt-dlp'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'TikTok HD & Slide Downloader',
      summary: 'Download video TikTok tanpa watermark, audio MP3, atau foto slide HD',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.youtube',
    category: 'Downloaders',
    subcategory: 'Video',
    method: 'ALL',
    path: '/api/downloader/youtube',
    aliases: ['/api/downloader/yt', '/api/downloader/ytmp4', '/api/downloader/ytmp3', '/api/v1/downloader/youtube'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 900, vary_by_auth: false },
    deadline_ms: 25000,
    concurrency_limit: 15,
    execution_mode: 'sync',
    provider_list: ['savetube_vip', 'yt-dlp'],
    resource_class: 'high',
    risk_class: 'low',
    metadata: {
      title: 'YouTube MP4 & MP3 Downloader',
      summary: 'Konversi dan download audio/video YouTube resolusi hingga 1080p',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.instagram',
    category: 'Downloaders',
    subcategory: 'Social',
    method: 'ALL',
    path: '/api/downloader/instagram',
    aliases: ['/api/downloader/ig', '/api/downloader/reelsvideo', '/api/v1/downloader/instagram'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 900, vary_by_auth: false },
    deadline_ms: 15000,
    concurrency_limit: 20,
    execution_mode: 'sync',
    provider_list: ['reelsvideo', 'yt-dlp'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'Instagram Reels & Post Downloader',
      summary: 'Ekstraksi media video reels, foto postingan, dan carousel Instagram',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.facebook',
    category: 'Downloaders',
    subcategory: 'Social',
    method: 'ALL',
    path: '/api/downloader/facebook',
    aliases: ['/api/downloader/fb', '/api/v1/downloader/facebook'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 900, vary_by_auth: false },
    deadline_ms: 15000,
    concurrency_limit: 20,
    execution_mode: 'sync',
    provider_list: ['fdown', 'yt-dlp'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'Facebook Video Downloader',
      summary: 'Download video publik Facebook resolusi HD dan SD',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.twitter',
    category: 'Downloaders',
    subcategory: 'Social',
    method: 'ALL',
    path: '/api/downloader/twitter',
    aliases: ['/api/downloader/x', '/api/v1/downloader/twitter'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 900, vary_by_auth: false },
    deadline_ms: 15000,
    concurrency_limit: 20,
    execution_mode: 'sync',
    provider_list: ['x2twitter', 'yt-dlp'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'Twitter / X Media Downloader',
      summary: 'Download video dan GIF dari cuitan Twitter / X',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.spotify',
    category: 'Downloaders',
    subcategory: 'Audio',
    method: 'ALL',
    path: '/api/downloader/spotify',
    aliases: ['/api/downloader/spotidownloader', '/api/v1/downloader/spotify'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 3600, vary_by_auth: false },
    deadline_ms: 25000,
    concurrency_limit: 15,
    execution_mode: 'sync',
    provider_list: ['spotify_oembed', 'itunes_search', 'yt-dlp'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'Spotify Track Downloader',
      summary: 'Metadata lagu Spotify dan ekstraksi audio stream 320kbps MP3',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.pinterest',
    category: 'Downloaders',
    subcategory: 'Media',
    method: 'ALL',
    path: '/api/downloader/pinterest',
    aliases: ['/api/downloader/pin', '/api/v1/downloader/pinterest'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 1800, vary_by_auth: false },
    deadline_ms: 15000,
    concurrency_limit: 25,
    execution_mode: 'sync',
    provider_list: ['direct_pin', 'yt-dlp'],
    resource_class: 'low',
    risk_class: 'low',
    metadata: {
      title: 'Pinterest Downloader',
      summary: 'Download video pin dan gambar resolusi penuh dari Pinterest',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.soundcloud',
    category: 'Downloaders',
    subcategory: 'Audio',
    method: 'ALL',
    path: '/api/downloader/soundcloud',
    aliases: ['/api/v1/downloader/soundcloud'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 3600, vary_by_auth: false },
    deadline_ms: 15000,
    concurrency_limit: 20,
    execution_mode: 'sync',
    provider_list: ['soundcloud_api'],
    resource_class: 'low',
    risk_class: 'low',
    metadata: {
      title: 'SoundCloud Music & Stream',
      summary: 'Pencarian track lagu SoundCloud dan metadata lengkap',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.sfile',
    category: 'Downloaders',
    subcategory: 'File',
    method: 'ALL',
    path: '/api/downloader/sfile',
    aliases: ['/api/v1/downloader/sfile'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 900, vary_by_auth: false },
    deadline_ms: 20000,
    concurrency_limit: 15,
    execution_mode: 'sync',
    provider_list: ['sfile_cheerio'],
    resource_class: 'low',
    risk_class: 'low',
    metadata: {
      title: 'Sfile.mobi Direct Downloader',
      summary: 'Bypass halaman download bertingkat Sfile.mobi ke direct download link',
      tags: ['Downloader']
    }
  },
  {
    id: 'dl.mediafire',
    category: 'Downloaders',
    subcategory: 'File',
    method: 'ALL',
    path: '/api/downloader/mediafire',
    aliases: ['/api/v1/downloader/mediafire'],
    scopes: ['read:media'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 900, vary_by_auth: false },
    deadline_ms: 12000,
    concurrency_limit: 30,
    execution_mode: 'sync',
    provider_list: ['mediafire_cheerio'],
    resource_class: 'low',
    risk_class: 'low',
    metadata: {
      title: 'MediaFire Direct Link',
      summary: 'Bypass halaman MediaFire untuk mendapatkan link unduhan langsung',
      tags: ['Downloader']
    }
  },

  // ==========================================
  // ARTIFICIAL INTELLIGENCE & LLM
  // ==========================================
  {
    id: 'ai.chat',
    category: 'AI & LLM',
    subcategory: 'Text Generation',
    method: 'ALL',
    path: '/api/ai/chat',
    aliases: ['/api/ai/aichat', '/api/ai/chatai', '/api/ai/chatcompletion', '/api/v1/ai/chat'],
    scopes: ['ai:generate'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 2,
      paid_credits: 2
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 30000,
    concurrency_limit: 15,
    execution_mode: 'sync',
    provider_list: ['pollinations_openai', 'pollinations_mistral', 'pollinations_qwen'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'AI Multi-Model Chat Completion',
      summary: 'Percakapan AI cerdas multi-provider dengan failover otomatis',
      tags: ['AI']
    }
  },

  // ==========================================
  // IMAGE & MEDIA TOOLS
  // ==========================================
  {
    id: 'media.hd',
    category: 'Image & Media',
    subcategory: 'Enhancement',
    method: 'ALL',
    path: '/api/tools/hd',
    aliases: ['/api/v1/tools/hd'],
    scopes: ['media:enhance'],
    status: 'active',
    billing_policy: {
      type: 'paid_only',
      default_credits: 2,
      paid_credits: 2
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 86400, vary_by_auth: false },
    deadline_ms: 20000,
    concurrency_limit: 8,
    execution_mode: 'sync',
    provider_list: ['sharp_clahe'],
    resource_class: 'heavy_cpu',
    risk_class: 'low',
    metadata: {
      title: 'Image Enhancer HD (Remini Style)',
      summary: 'Penjernih detail foto menggunakan algoritma C++ CLAHE & adaptive unsharp masking',
      tags: ['Media']
    }
  },
  {
    id: 'media.uhd',
    category: 'Image & Media',
    subcategory: 'Enhancement',
    method: 'ALL',
    path: '/api/tools/uhd',
    aliases: ['/api/v1/tools/uhd'],
    scopes: ['media:enhance'],
    status: 'active',
    billing_policy: {
      type: 'paid_only',
      default_credits: 4,
      paid_credits: 4
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 86400, vary_by_auth: false },
    deadline_ms: 30000,
    concurrency_limit: 4,
    execution_mode: 'sync',
    provider_list: ['sharp_lanczos3'],
    resource_class: 'heavy_cpu',
    risk_class: 'low',
    metadata: {
      title: 'Image Super-Resolution Ultra HD',
      summary: 'Upscaling resolusi gambar 2x hingga 4x dengan interpolasi Lanczos3',
      tags: ['Media']
    }
  },

  // ==========================================
  // INFORMATION & PUBLIC DATA
  // ==========================================
  {
    id: 'info.gempa',
    category: 'Information & Data',
    subcategory: 'Seismic',
    method: 'GET',
    path: '/api/tools/gempa',
    aliases: ['/api/search/bmkg', '/api/v1/tools/gempa'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 300, vary_by_auth: false },
    deadline_ms: 8000,
    concurrency_limit: 50,
    execution_mode: 'sync',
    provider_list: ['bmkg_tews'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'BMKG Gempa Terkini Realtime',
      summary: 'Data parameter gempa bumi terbaru di Indonesia dan shakemap',
      tags: ['Data']
    }
  },
  {
    id: 'info.gempa.terkini',
    category: 'Information & Data',
    subcategory: 'Seismic',
    method: 'GET',
    path: '/api/tools/gempa/terkini',
    aliases: ['/api/v1/tools/gempa/terkini'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 300, vary_by_auth: false },
    deadline_ms: 8000,
    concurrency_limit: 50,
    execution_mode: 'sync',
    provider_list: ['bmkg_tews'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'BMKG Daftar 15 Gempa Terbaru',
      summary: 'Daftar riwayat 15 gempa bumi signifikan terbaru dari BMKG',
      tags: ['Data']
    }
  },
  {
    id: 'info.sholat',
    category: 'Information & Data',
    subcategory: 'Religion',
    method: 'ALL',
    path: '/api/tools/jadwalsholat',
    aliases: ['/api/search/jadwalsholat', '/api/v1/tools/jadwalsholat'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 86400, vary_by_auth: false },
    deadline_ms: 8000,
    concurrency_limit: 50,
    execution_mode: 'sync',
    provider_list: ['myquran_api'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'Jadwal Sholat Seluruh Indonesia',
      summary: 'Jadwal waktu sholat harian per kabupaten/kota resmi Kemenag RI',
      tags: ['Data']
    }
  },

  // ==========================================
  // UTILITIES & SEARCH
  // ==========================================
  {
    id: 'util.lirik',
    category: 'Search & Discovery',
    subcategory: 'Music',
    method: 'ALL',
    path: '/api/tools/lirik',
    aliases: ['/api/search/lirik', '/api/v1/search/lirik'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 604800, vary_by_auth: false },
    deadline_ms: 10000,
    concurrency_limit: 40,
    execution_mode: 'sync',
    provider_list: ['lyrics_ovh'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'Lirik Lagu Lengkap',
      summary: 'Pencarian teks lirik lagu lokal dan mancanegara berdasarkan artis dan judul',
      tags: ['Search']
    }
  },
  {
    id: 'util.shortlink',
    category: 'Utilities',
    subcategory: 'URL',
    method: 'ALL',
    path: '/api/tools/shortlink',
    aliases: ['/api/v1/tools/shortlink'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 2592000, vary_by_auth: false },
    deadline_ms: 8000,
    concurrency_limit: 50,
    execution_mode: 'sync',
    provider_list: ['tinyurl'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'URL Shortener',
      summary: 'Pemendek tautan URL instan dan permanen',
      tags: ['Utilities']
    }
  },
  {
    id: 'search.gsmarena',
    category: 'Search & Discovery',
    subcategory: 'Devices',
    method: 'ALL',
    path: '/api/search/gsmarena',
    aliases: ['/api/v1/search/gsmarena'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 604800, vary_by_auth: false },
    deadline_ms: 12000,
    concurrency_limit: 30,
    execution_mode: 'sync',
    provider_list: ['gsmarena_cheerio'],
    resource_class: 'low',
    risk_class: 'low',
    metadata: {
      title: 'GSMArena Phone Specs',
      summary: 'Pencarian spesifikasi lengkap smartphone dan tablet dari GSMArena',
      tags: ['Search']
    }
  },
  {
    id: 'search.anime',
    category: 'Search & Discovery',
    subcategory: 'Anime',
    method: 'ALL',
    path: '/api/search/anime',
    aliases: ['/api/v1/search/anime'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 86400, vary_by_auth: false },
    deadline_ms: 12000,
    concurrency_limit: 30,
    execution_mode: 'sync',
    provider_list: ['kusonime_cheerio'],
    resource_class: 'low',
    risk_class: 'low',
    metadata: {
      title: 'Kusonime Anime Search',
      summary: 'Pencarian anime, detail episode dan link download dari Kusonime',
      tags: ['Search']
    }
  },
  {
    id: 'tool.tempmail',
    category: 'Utilities',
    subcategory: 'Email',
    method: 'GET',
    path: '/api/tools/tempmail',
    aliases: ['/api/v1/tools/tempmail'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 10000,
    concurrency_limit: 30,
    execution_mode: 'sync',
    provider_list: ['tempmail_io'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'Disposable TempMail Creator',
      summary: 'Buat alamat email sementara instan untuk penerimaan kode OTP',
      tags: ['Utilities']
    }
  },
  {
    id: 'tool.tempmail.inbox',
    category: 'Utilities',
    subcategory: 'Email',
    method: 'GET',
    path: '/api/tools/tempmail/inbox',
    aliases: ['/api/v1/tools/tempmail/inbox'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 10000,
    concurrency_limit: 30,
    execution_mode: 'sync',
    provider_list: ['tempmail_io'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'TempMail Inbox Reader',
      summary: 'Membaca daftar pesan masuk dan kode OTP pada email sementara',
      tags: ['Utilities']
    }
  },
  {
    id: 'stalk.github',
    category: 'Social & Public Profiles',
    subcategory: 'Developer',
    method: 'ALL',
    path: '/api/tools/github',
    aliases: ['/api/stalker/stalkgithub', '/api/v1/stalker/github'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 3600, vary_by_auth: false },
    deadline_ms: 8000,
    concurrency_limit: 30,
    execution_mode: 'sync',
    provider_list: ['github_api'],
    resource_class: 'low',
    risk_class: 'low',
    metadata: {
      title: 'GitHub Profile Stalker',
      summary: 'Informasi profil publik GitHub, follower, repository, dan bio',
      tags: ['Profiles']
    }
  },
  {
    id: 'util.iplookup',
    category: 'Utilities',
    subcategory: 'Network',
    method: 'ALL',
    path: '/api/tools/iplookup',
    aliases: ['/api/v1/tools/iplookup'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 86400, vary_by_auth: false },
    deadline_ms: 6000,
    concurrency_limit: 50,
    execution_mode: 'sync',
    provider_list: ['ip_api'],
    resource_class: 'minimal',
    risk_class: 'low',
    metadata: {
      title: 'IP Geolocation & ISP Lookup',
      summary: 'Deteksi negara, kota, ISP, ASN, dan koordinat alamat IP',
      tags: ['Utilities']
    }
  },
  {
    id: 'tool.presetam',
    category: 'Utilities',
    subcategory: 'Video Editor',
    method: 'ALL',
    path: '/api/tools/presetam',
    aliases: ['/api/tools/findpresetam', '/api/v1/tools/presetam'],
    scopes: ['public'],
    status: 'active',
    billing_policy: {
      type: 'free_eligible',
      default_credits: 1,
      paid_credits: 1
    },
    price_version: 'v1',
    cache_policy: { enabled: true, ttl_seconds: 3600, vary_by_auth: false },
    deadline_ms: 15000,
    concurrency_limit: 20,
    execution_mode: 'sync',
    provider_list: ['alight_finder'],
    resource_class: 'medium',
    risk_class: 'low',
    metadata: {
      title: 'Alight Motion Preset Finder',
      summary: 'Pencarian link preset AM 5MB dan file XML dari TikTok / Shorts',
      tags: ['Utilities']
    }
  },

  // ==========================================
  // SOLVERS & BYPASS
  // ==========================================
  {
    id: 'solve.waf',
    category: 'Solvers',
    subcategory: 'Cloudflare',
    method: 'ALL',
    path: '/api/solver/waf',
    aliases: ['/api/v1/solver/waf'],
    scopes: ['solver:waf'],
    status: 'active',
    billing_policy: {
      type: 'paid_only',
      default_credits: 5,
      paid_credits: 5
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 60000,
    concurrency_limit: 5,
    execution_mode: 'sync',
    provider_list: ['flaresolverr_local'],
    resource_class: 'heavy_io',
    risk_class: 'medium',
    metadata: {
      title: 'Cloudflare WAF Clearance Solver',
      summary: 'Bypass proteksi Cloudflare WAF JS challenge & dapatkan cookie cf_clearance',
      tags: ['Solvers']
    }
  },
  {
    id: 'solve.turnstile',
    category: 'Solvers',
    subcategory: 'Cloudflare',
    method: 'ALL',
    path: '/api/solver/turnstile',
    aliases: ['/api/v1/solver/turnstile'],
    scopes: ['solver:turnstile'],
    status: 'active',
    billing_policy: {
      type: 'paid_only',
      default_credits: 5,
      paid_credits: 5
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 60000,
    concurrency_limit: 5,
    execution_mode: 'sync',
    provider_list: ['flaresolverr_local'],
    resource_class: 'heavy_io',
    risk_class: 'medium',
    metadata: {
      title: 'Cloudflare Turnstile Token Solver',
      summary: 'Selesaikan Cloudflare Turnstile CAPTCHA dan hasilkan response token',
      tags: ['Solvers']
    }
  },
  {
    id: 'solve.bridge',
    category: 'Solvers',
    subcategory: 'Bridge',
    method: 'ALL',
    path: '/v1',
    aliases: ['/api/solver/flaresolverr'],
    scopes: ['solver:bridge'],
    status: 'active',
    billing_policy: {
      type: 'paid_only',
      default_credits: 5,
      paid_credits: 5
    },
    price_version: 'v1',
    cache_policy: { enabled: false, ttl_seconds: 0, vary_by_auth: false },
    deadline_ms: 60000,
    concurrency_limit: 5,
    execution_mode: 'sync',
    provider_list: ['flaresolverr_local'],
    resource_class: 'heavy_io',
    risk_class: 'medium',
    metadata: {
      title: 'FlareSolverr Native Bridge Protocol',
      summary: 'Protokol reverse kompatibel FlareSolverr v1 untuk scraping engine otomatis',
      tags: ['Solvers']
    }
  }
];

// Helper Indexing untuk pencarian cepat
export const ENDPOINT_MAP_BY_PATH = new Map();
export const ENDPOINT_MAP_BY_ID = new Map();

for (const ep of ENDPOINT_REGISTRY) {
  ENDPOINT_MAP_BY_ID.set(ep.id, ep);
  ENDPOINT_MAP_BY_PATH.set(ep.path, ep);
  if (Array.isArray(ep.aliases)) {
    for (const alias of ep.aliases) {
      ENDPOINT_MAP_BY_PATH.set(alias, ep);
    }
  }
}

export function findEndpointByPath(requestPath) {
  const clean = requestPath.split('?')[0].replace(/\/+$/, '') || '/';
  return ENDPOINT_MAP_BY_PATH.get(clean) || null;
}
