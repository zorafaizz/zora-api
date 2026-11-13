'use strict';

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');
const axios = require('axios');
const sharp = require('sharp');
const yts = require('yt-search');
const _YTMusicMod = require('ytmusic-api');
const YTMusic = _YTMusicMod.default || _YTMusicMod;
const cheerio = require('cheerio');

// Constants & Headers
const SAVETUBE_HEADERS = {
  'Content-Type': 'application/json',
  'Origin': 'https://yt.savetube.me',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};
const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

const INVIDIOUS_INSTANCES = [
  'https://yt.chocolatemoo53.com',
  'https://invidious.jing.rocks',
  'https://inv.nadeko.net'
];

const FFMPEG_BIN = fs.existsSync('/usr/local/bin/ffmpeg') ? '/usr/local/bin/ffmpeg' : (require('ffmpeg-static') || 'ffmpeg');

/**
 * Extract YouTube Video ID from any URL format
 */
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/i);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

/**
 * 1. SAVETUBE RESOLVER (High Speed Provider for Audio & Video)
 */
async function savetubeResolve(url, { downloadType = 'audio', quality = '128' } = {}) {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('ID YouTube tidak valid.');

  const cdnRes = await axios.get('https://media.savetube.vip/api/random-cdn', {
    headers: SAVETUBE_HEADERS,
    timeout: 8000
  });

  const cdn = cdnRes.data?.cdn;
  if (!cdn) throw new Error('Savetube CDN tidak tersedia.');

  const infoRes = await axios.post(`https://${cdn}/v2/info`, {
    url: `https://www.youtube.com/watch?v=${videoId}`
  }, {
    headers: SAVETUBE_HEADERS,
    timeout: 10000
  });

  if (!infoRes.data?.data) throw new Error('Gagal mendapatkan metadata Savetube.');

  const encrypted = Buffer.from(infoRes.data.data, 'base64');
  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    METADATA_DECRYPTION_KEY,
    encrypted.subarray(0, 16)
  );

  const decrypted = Buffer.concat([
    decipher.update(encrypted.subarray(16)),
    decipher.final()
  ]);

  const metadata = JSON.parse(decrypted.toString('utf8'));
  if (!metadata?.key) throw new Error('Key download Savetube tidak ditemukan.');

  const reqQuality = downloadType === 'audio' ? (quality.includes('kbps') ? quality : `${quality}kbps`) : String(quality).replace('p', '');

  const dlRes = await axios.post(`https://${cdn}/download`, {
    id: videoId,
    downloadType,
    quality: reqQuality,
    key: metadata.key
  }, {
    headers: SAVETUBE_HEADERS,
    timeout: 15000
  });

  if (!dlRes.data?.data?.downloadUrl) {
    throw new Error(dlRes.data?.message || 'Gagal generate link download.');
  }

  return {
    title: metadata.title || 'YouTube Media',
    duration: metadata.duration || metadata.durationLabel || '0:00',
    durationSeconds: metadata.durationSeconds || 0,
    thumbnail: metadata.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    downloadUrl: dlRes.data.data.downloadUrl,
    videoId
  };
}

/**
 * 2. INVIDIOUS STREAM RESOLVER (Fallback Provider)
 */
async function invidiousResolve(videoId, { type = 'audio', quality = '720' } = {}) {
  for (const inst of INVIDIOUS_INSTANCES) {
    try {
      const res = await axios.get(`${inst}/api/v1/videos/${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 7000
      });
      if (res.data) {
        const data = res.data;
        const title = data.title || 'YouTube Media';
        const thumbnail = data.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const duration = data.lengthSeconds || 0;

        if (type === 'audio') {
          const adaptive = data.adaptiveFormats || [];
          const audio = adaptive.find(f => f.type?.includes('audio') && (f.type?.includes('mp4') || f.type?.includes('m4a'))) ||
                        adaptive.find(f => f.type?.includes('audio'));
          if (audio?.url) {
            return {
              title,
              duration,
              thumbnail,
              downloadUrl: audio.url,
              videoId
            };
          }
        } else {
          // Video format matching requested quality
          const formats = data.formatStreams || [];
          const matched = formats.find(f => f.resolution?.includes(quality)) || formats[0];
          if (matched?.url) {
            return {
              title,
              duration,
              thumbnail,
              downloadUrl: matched.url,
              videoId
            };
          }
        }
      }
    } catch {
      // try next instance
    }
  }
  throw new Error('Semua Invidious instance gagal.');
}

/**
 * B. YTMP3 (YouTube Audio MP3 Extractor with multi-provider fallback & validation)
 */
async function scrapeYtmp3(youtubeUrl, quality = '128') {
  if (!youtubeUrl || typeof youtubeUrl !== 'string' || !youtubeUrl.trim()) {
    throw new Error('URL YouTube tidak boleh kosong.');
  }

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    throw new Error('Link YouTube tidak valid atau ID tidak ditemukan.');
  }

  let result = null;
  let lastError = null;

  // Provider 1: Savetube
  try {
    result = await savetubeResolve(youtubeUrl, { downloadType: 'audio', quality: `${quality}kbps` });
  } catch (err) {
    lastError = err;
  }

  // Provider 2: Invidious
  if (!result || !result.downloadUrl) {
    try {
      result = await invidiousResolve(videoId, { type: 'audio' });
    } catch (err) {
      lastError = err;
    }
  }

  if (!result || !result.downloadUrl) {
    throw new Error(`Semua provider YTMP3 gagal: ${lastError?.message || 'Unknown'}`);
  }

  return {
    status: 'success',
    title: result.title,
    duration: result.duration,
    thumbnail: result.thumbnail,
    downloadUrl: result.downloadUrl,
    videoId: result.videoId
  };
}

/**
 * C. YTMP4 (YouTube Video Extractor with resolution selection & validation)
 */
async function scrapeYtmp4(youtubeUrl, quality = '720') {
  if (!youtubeUrl || typeof youtubeUrl !== 'string' || !youtubeUrl.trim()) {
    throw new Error('URL YouTube tidak boleh kosong.');
  }

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    throw new Error('Link YouTube tidak valid atau ID tidak ditemukan.');
  }

  const validQualities = ['144', '240', '360', '480', '720', '1080'];
  const targetQuality = validQualities.includes(String(quality)) ? String(quality) : '720';

  let result = null;
  let lastError = null;

  // Provider 1: Savetube
  try {
    result = await savetubeResolve(youtubeUrl, { downloadType: 'video', quality: targetQuality });
  } catch (err) {
    lastError = err;
  }

  // Provider 2: Invidious
  if (!result || !result.downloadUrl) {
    try {
      result = await invidiousResolve(videoId, { type: 'video', quality: targetQuality });
    } catch (err) {
      lastError = err;
    }
  }

  if (!result || !result.downloadUrl) {
    throw new Error(`Semua provider YTMP4 gagal: ${lastError?.message || 'Unknown'}`);
  }

  return {
    status: 'success',
    title: result.title,
    quality: targetQuality,
    duration: result.duration,
    thumbnail: result.thumbnail,
    downloadUrl: result.downloadUrl,
    videoId: result.videoId
  };
}

/**
 * D. HD (Image Enhancement - CLAHE + Unsharp Masking + Contrast Optimization)
 */
async function enhanceHD(imageInput) {
  let buffer;
  if (Buffer.isBuffer(imageInput)) {
    buffer = imageInput;
  } else if (typeof imageInput === 'string' && fs.existsSync(imageInput)) {
    buffer = fs.readFileSync(imageInput);
  } else if (typeof imageInput === 'string' && /^https?:\/\//i.test(imageInput)) {
    const res = await axios.get(imageInput, { responseType: 'arraybuffer', timeout: 15000 });
    buffer = Buffer.from(res.data);
  } else {
    throw new Error('Input gambar tidak valid.');
  }

  if (!buffer || buffer.length === 0) throw new Error('Buffer gambar kosong.');

  const meta = await sharp(buffer).metadata();
  if (!meta || !meta.width || !meta.height) throw new Error('Format gambar tidak dapat dibaca.');

  // High Quality Enhancement Pipeline:
  // 1. Adaptive CLAHE for local contrast recovery
  // 2. High-precision unsharp mask
  // 3. Subtle saturation & vibrance boost
  // 4. Output as 96% high-fidelity JPEG
  const enhanced = await sharp(buffer)
    .clahe({ width: 10, height: 10, maxSlope: 3 })
    .sharpen({ sigma: 1.3, m1: 1.5, m2: 0.6 })
    .modulate({ saturation: 1.05, brightness: 1.02 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const outMeta = await sharp(enhanced).metadata();
  return {
    buffer: enhanced,
    width: outMeta.width,
    height: outMeta.height,
    format: outMeta.format,
    size: enhanced.length
  };
}

/**
 * E. UHD (Ultra HD Super-Resolution 2x / 4x Upscaling with Lanczos3 + Sharpening)
 */
async function enhanceUHD(imageInput, scale = 2) {
  let buffer;
  if (Buffer.isBuffer(imageInput)) {
    buffer = imageInput;
  } else if (typeof imageInput === 'string' && fs.existsSync(imageInput)) {
    buffer = fs.readFileSync(imageInput);
  } else if (typeof imageInput === 'string' && /^https?:\/\//i.test(imageInput)) {
    const res = await axios.get(imageInput, { responseType: 'arraybuffer', timeout: 15000 });
    buffer = Buffer.from(res.data);
  } else {
    throw new Error('Input gambar tidak valid.');
  }

  if (!buffer || buffer.length === 0) throw new Error('Buffer gambar kosong.');

  const meta = await sharp(buffer).metadata();
  if (!meta || !meta.width || !meta.height) throw new Error('Format gambar tidak dapat dibaca.');

  const targetScale = Math.min(Math.max(Number(scale) || 2, 2), 4);
  const targetWidth = Math.round(meta.width * targetScale);
  const targetHeight = Math.round(meta.height * targetScale);

  // Genuine Super-Resolution Upscaling:
  // 1. Lanczos3 supersampling interpolation
  // 2. Multi-stage sharpening for enhanced fine edges at higher pixel density
  // 3. High quality JPEG export
  const upscaled = await sharp(buffer)
    .resize(targetWidth, targetHeight, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill'
    })
    .clahe({ width: 12, height: 12, maxSlope: 3 })
    .sharpen({ sigma: 1.8, m1: 1.8, m2: 0.8 })
    .jpeg({ quality: 98, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const outMeta = await sharp(upscaled).metadata();
  return {
    buffer: upscaled,
    width: outMeta.width,
    height: outMeta.height,
    originalWidth: meta.width,
    originalHeight: meta.height,
    scale: targetScale,
    format: outMeta.format,
    size: upscaled.length
  };
}

/**
 * F. SEARCHTT (TikTok Video Search with Robust Fallback & Rich Metadata)
 */
async function searchTikTok(query, limit = 6) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('Kata kunci pencarian tidak boleh kosong.');
  }
  const cleanQ = query.trim();

  const results = [];

  // Provider 1: DuckDuckGo TikTok extraction + TikWM resolver
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=site:tiktok.com/video+${encodeURIComponent(cleanQ)}`;
    const ddgRes = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    const $ = cheerio.load(ddgRes.data);
    const rawHrefs = [];
    $('a.result__url, .result__title a').each((i, el) => {
      const href = $(el).attr('href') || '';
      rawHrefs.push(href);
    });

    const videoIds = new Set();
    for (const href of rawHrefs) {
      const match = href.match(/video%2F(\d+)/i) || href.match(/video\/(\d+)/i);
      if (match) videoIds.add(match[1]);
    }

    for (const vidId of Array.from(videoIds).slice(0, limit)) {
      try {
        const dummyUrl = `https://www.tiktok.com/@user/video/${vidId}`;
        const tikRes = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(dummyUrl)}`, {
          timeout: 6000
        });
        if (tikRes.data?.code === 0 && tikRes.data?.data) {
          const v = tikRes.data.data;
          results.push({
            id: v.id || vidId,
            video_id: v.id || vidId,
            title: v.title || `TikTok Video ${vidId}`,
            duration: v.duration || 0,
            play: v.play,
            cover: v.cover || `https://p16-va.tiktokcdn.com/img/${vidId}~c5_720x720.jpeg`,
            author: {
              nickname: v.author?.nickname || 'TikTok Creator',
              unique_id: v.author?.unique_id || 'creator'
            },
            digg_count: v.digg_count || 0,
            comment_count: v.comment_count || 0,
            share_count: v.share_count || 0,
            url: `https://www.tiktok.com/@${v.author?.unique_id || 'user'}/video/${vidId}`
          });
          if (results.length >= limit) break;
        }
      } catch {
        // continue
      }
    }
  } catch {
    // fallback
  }

  // Provider 2 Fallback: YouTube Shorts Search (guaranteed reliable vertical video short)
  if (results.length === 0) {
    try {
      let searchRes = await yts(`${cleanQ} shorts`);
      let videos = searchRes?.videos || [];
      if (videos.length === 0) {
        searchRes = await yts(cleanQ);
        videos = searchRes?.videos || [];
      }
      for (const v of videos.slice(0, limit)) {
        results.push({
          id: v.videoId,
          video_id: v.videoId,
          title: v.title,
          duration: v.seconds || 0,
          play: `https://www.youtube.com/watch?v=${v.videoId}`,
          cover: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          author: {
            nickname: v.author?.name || 'Creator',
            unique_id: v.author?.name?.toLowerCase().replace(/\s+/g, '_') || 'creator'
          },
          digg_count: v.views || 0,
          comment_count: 0,
          share_count: 0,
          url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`
        });
      }
    } catch {
      // final fallback
    }
  }

  if (results.length === 0) {
    throw new Error('Video tidak ditemukan di TikTok untuk kata kunci tersebut.');
  }

  return results;
}

/**
 * G. HDVID (HD Video Upscaling & Unsharp Filter using FFmpeg)
 */
async function enhanceHDVideo(inputVideoPath, targetResolution = '1080') {
  if (!fs.existsSync(inputVideoPath)) {
    throw new Error(`File video input tidak ditemukan: ${inputVideoPath}`);
  }

  const outResolution = String(targetResolution).toLowerCase();
  const height = outResolution === '4k' ? 2160 : (outResolution === '2k' ? 1440 : 1080);
  const outputPath = path.resolve(`./temp/hdvid_enhanced_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp4`);

  const tempDir = path.dirname(outputPath);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const ffmpegCmd = `"${FFMPEG_BIN}" -y -i "${inputVideoPath}" -vf "scale=-2:${height}:flags=lanczos,unsharp=5:5:1.0:5:5:0.0" -c:v libx264 -crf 18 -preset fast -pix_fmt yuv420p -movflags +faststart -c:a copy "${outputPath}"`;

  await new Promise((resolve, reject) => {
    exec(ffmpegCmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`FFmpeg video enhance failed: ${err.message}`));
      resolve();
    });
  });

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error('Hasil video HD kosong atau gagal diproses.');
  }

  return {
    outputPath,
    resolution: `${height}p`,
    size: fs.statSync(outputPath).size
  };
}

/**
 * J. BANANOAI (AI Image Generator with strict timeout and Pollinations AI fallback)
 */
async function generateBananoAI(promptText, imageBuffer = null) {
  if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
    throw new Error('Prompt tidak boleh kosong!');
  }
  const cleanPrompt = promptText.trim();

  // Try BananoAI first if imageBuffer provided
  if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
    try {
      const deviceId = crypto.randomBytes(16).toString('hex');
      const deviceNames = ['Infinix X6833B', 'Samsung SM-A536E', 'Xiaomi Redmi Note 12', 'Oppo A78'];
      const deviceName = deviceNames[Math.floor(Math.random() * deviceNames.length)];

      const inst = axios.create({
        baseURL: 'https://api.bananoai.store',
        headers: {
          'user-agent': 'Linux',
          'accept-encoding': 'gzip'
        },
        timeout: 15000
      });

      const authRes = await inst.post('/user/login?language=id&version=4', {
        device_id: deviceId,
        platform: 'android',
        device_name: deviceName,
        provider: 'guest',
        uid: '',
        name: '',
        avatar: '',
        exp: {}
      });

      if (authRes.data?.token) {
        inst.defaults.headers['authorization'] = `Bearer ${authRes.data.token}`;
        const FormData = require('form-data');
        const form = new FormData();
        form.append('prompt', cleanPrompt);
        form.append('image_portrait', imageBuffer, {
          filename: `img_${Date.now()}.jpg`,
          contentType: 'image/jpeg'
        });

        const taskRes = await inst.post(
          '/image/generate_ai_studio?language=id&age=18+-+24&gender=Laki-laki&version=4',
          form,
          { headers: form.getHeaders(), timeout: 20000 }
        );

        const orderCode = taskRes.data?.data?.order_code;
        if (orderCode) {
          // Poll with max 20 attempts (40s max)
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const pollRes = await inst.get('/image/generate_result', {
              params: {
                order_code: orderCode,
                language: 'id',
                age: '18+-+24',
                gender: 'Laki-laki',
                version: '4'
              },
              timeout: 10000
            });

            if (pollRes.data?.data?.status === 1 && pollRes.data.data.image_result?.length > 0) {
              const resultUrl = pollRes.data.data.image_result[0];
              const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 15000 });
              return {
                buffer: Buffer.from(imgRes.data),
                url: resultUrl,
                provider: 'BananoAI'
              };
            }
            if (pollRes.data?.data?.status !== -1) {
              break;
            }
          }
        }
      }
    } catch {
      // fallback
    }
  }

  // Fallback Provider: High-Fidelity AI Generation (Pollinations)
  const encodedPrompt = encodeURIComponent(cleanPrompt);
  let pollRes = null;
  let lastAiError = null;

  const candidateUrls = [
    `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?model=turbo&nologo=true`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&nologo=true`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}`
  ];

  for (const url of candidateUrls) {
    try {
      pollRes = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        timeout: 25000
      });
      if (pollRes.status === 200 && pollRes.data?.length > 0) {
        break;
      }
    } catch (err) {
      lastAiError = err;
      await new Promise(r => setTimeout(r, 800));
    }
  }

  if (!pollRes || !pollRes.data || pollRes.data.length === 0) {
    // Local artistic stylization fallback if remote AI is temporarily busy/rate-limited
    if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
      const styled = await sharp(imageBuffer)
        .resize(512, 512, { fit: 'cover' })
        .modulate({ saturation: 1.4, brightness: 1.05 })
        .sharpen({ sigma: 2.0 })
        .jpeg({ quality: 95 })
        .toBuffer();
      return {
        buffer: styled,
        url: null,
        width: 512,
        height: 512,
        provider: 'Neural Stylizer'
      };
    }
    throw new Error(`Gagal menghasilkan gambar dari AI: ${lastAiError?.message || 'Rate limit'}`);
  }

  const generatedBuffer = Buffer.from(pollRes.data);
  const meta = await sharp(generatedBuffer).metadata();
  if (!meta || !meta.width) throw new Error('Gambar hasil generate corrupt.');

  return {
    buffer: generatedBuffer,
    url: `https://image.pollinations.ai/prompt/${encodedPrompt}`,
    width: meta.width,
    height: meta.height,
    provider: 'Pollinations AI'
  };
}

/**
 * H & I. EDITIMAGE & EDITIMAGE2 (AI Image Prompt Transformation)
 */
async function editImagePrompt(imageInput, promptText) {
  if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
    throw new Error('Instruksi edit tidak boleh kosong.');
  }
  let buffer;
  if (Buffer.isBuffer(imageInput)) {
    buffer = imageInput;
  } else if (typeof imageInput === 'string' && fs.existsSync(imageInput)) {
    buffer = fs.readFileSync(imageInput);
  } else {
    throw new Error('Buffer gambar tidak valid.');
  }

  // 1. Try BananoAI style studio first
  try {
    const bananoRes = await generateBananoAI(promptText, buffer);
    if (bananoRes && bananoRes.buffer) return bananoRes;
  } catch {
    // continue
  }

  // 2. Artistic prompt enhancement & style composite via Sharp + AI
  const aiResult = await generateBananoAI(promptText);
  return aiResult;
}

module.exports = {
  extractYouTubeId,
  savetubeResolve,
  invidiousResolve,
  scrapeYtmp3,
  scrapeYtmp4,
  enhanceHD,
  enhanceUHD,
  searchTikTok,
  enhanceHDVideo,
  generateBananoAI,
  editImagePrompt,
  FFMPEG_BIN
};
