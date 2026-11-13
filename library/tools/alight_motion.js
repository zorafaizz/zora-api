import axios from 'axios';
import { scrapeTikTok } from '../downloader/tiktok.js';

const ALIGHT_LINK_REGEX = /https?:\/\/(?:alight\.link|alightcreative\.com\/[^\s"']+)/gi;
const XML_LINK_REGEX = /https?:\/\/(?:drive\.google\.com\/[^\s"']+|mediafire\.com\/[^\s"']+|sfile\.mobi\/[^\s"']+)/gi;

/**
 * REVERSE ENGINEERED FROM Izz AM (am.izzxd.my.id)
 * Ekstraksi link preset 5MB & XML dari deskripsi dan komentar media
 */
export async function findAlightMotionPreset(url) {
  if (!url) throw new Error('Parameter URL video wajib diisi');

  const presets = {
    five_mb: [],
    xml: []
  };

  let title = '';
  let author = '';
  let rawText = '';

  // 1. Jika sumber dari TikTok
  if (url.includes('tiktok.com')) {
    const tkData = await scrapeTikTok(url);
    title = tkData.title || '';
    author = tkData.author?.nickname || '';
    rawText += ' ' + title;

    // Cek komentar jika ada API komentar
    try {
      const vidIdMatch = url.match(/video\/(\d+)/) || tkData.video?.match(/(\d+)/);
      if (vidIdMatch) {
        const comRes = await axios.get(`https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(url)}&count=20`, { timeout: 8000 });
        const comments = comRes.data?.data?.comments || [];
        comments.forEach(c => {
          rawText += ' ' + (c.text || '');
        });
      }
    } catch {}
  }

  // 2. Ekstraksi link 5MB (alight.link)
  const matches5mb = rawText.match(ALIGHT_LINK_REGEX) || [];
  presets.five_mb = Array.from(new Set(matches5mb));

  // 3. Ekstraksi link XML (Drive / MediaFire / Sfile)
  const matchesXml = rawText.match(XML_LINK_REGEX) || [];
  presets.xml = Array.from(new Set(matchesXml));

  return {
    status: true,
    engine: 'Izz AM Algorithm (Reverse-Engineered)',
    video_title: title,
    author: author,
    total_presets: presets.five_mb.length + presets.xml.length,
    presets: {
      preset_5mb: presets.five_mb,
      preset_xml: presets.xml
    }
  };
}
