import { scrapeTikTok } from './tiktok.js';
import { scrapeYouTube } from './youtube.js';
import { scrapeFacebook } from './facebook.js';
import { scrapeTwitter } from './twitter.js';
import { scrapeSpotify } from './spotify.js';
import { scrapePinterest } from './pinterest.js';
import { scrapeMediafire } from './mediafire.js';

export async function scrapeAIO(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');
  const u = url.trim().toLowerCase();

  // 1. TikTok
  if (u.includes('tiktok.com')) {
    const data = await scrapeTikTok(url);
    return { platform: 'tiktok', ...data };
  }

  // 2. YouTube
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    const data = await scrapeYouTube(url);
    return { platform: 'youtube', ...data };
  }

  // 3. Facebook
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) {
    const data = await scrapeFacebook(url);
    return { platform: 'facebook', ...data };
  }

  // 4. Twitter / X
  if (u.includes('twitter.com') || u.includes('x.com')) {
    const data = await scrapeTwitter(url);
    return { platform: 'twitter', ...data };
  }

  // 5. Spotify
  if (u.includes('spotify.com')) {
    const data = await scrapeSpotify(url);
    return { platform: 'spotify', ...data };
  }

  // 6. Pinterest
  if (u.includes('pinterest.com') || u.includes('pin.it')) {
    const data = await scrapePinterest(url);
    return { platform: 'pinterest', ...data };
  }

  // 7. MediaFire
  if (u.includes('mediafire.com')) {
    const data = await scrapeMediafire(url);
    return { platform: 'mediafire', ...data };
  }

  // Fallback: coba YouTube / universal media via yt-dlp
  try {
    const data = await scrapeYouTube(url);
    return { platform: 'generic_video', ...data };
  } catch (err) {
    throw new Error(`Platform URL tidak dikenali atau tidak didukung: ${url}`);
  }
}
