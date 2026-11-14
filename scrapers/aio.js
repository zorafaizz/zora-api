import { scrapeTikTok } from './tiktok.js';
import { scrapeTwitter } from './twitter.js';
import { scrapeFacebook } from './facebook.js';
import { scrapeInstagram } from './instagram.js';
import { scrapeYouTube } from './youtube.js';
import { scrapeSpotify } from './spotify.js';
import { scrapePinterest } from './pinterest.js';
import { scrapeMediafire } from './mediafire.js';
import { scrapeSfile } from '../src/scrapers/sfile.js';
import { scrapeSoundCloud } from '../src/scrapers/soundcloud.js';
import { scrapePixeldrain } from '../src/scrapers/pixeldrain.js';
import { ValidationError } from '../src/core/errors.js';
import { validateSSRF } from '../src/core/security.js';

export async function scrapeAIO(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter URL wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());
  const lower = safeUrl.toLowerCase();

  if (lower.includes('tiktok.com')) {
    const data = await scrapeTikTok(safeUrl);
    return { platform: 'tiktok', ...data };
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    const data = await scrapeTwitter(safeUrl);
    return { platform: 'twitter', ...data };
  }
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) {
    const data = await scrapeFacebook(safeUrl);
    return { platform: 'facebook', ...data };
  }
  if (lower.includes('instagram.com')) {
    const data = await scrapeInstagram(safeUrl);
    return { platform: 'instagram', ...data };
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const data = await scrapeYouTube(safeUrl);
    return { platform: 'youtube', ...data };
  }
  if (lower.includes('spotify.com')) {
    const data = await scrapeSpotify(safeUrl);
    return { platform: 'spotify', ...data };
  }
  if (lower.includes('pinterest.com') || lower.includes('pin.it')) {
    const data = await scrapePinterest(safeUrl);
    return { platform: 'pinterest', ...data };
  }
  if (lower.includes('soundcloud.com')) {
    const data = await scrapeSoundCloud(safeUrl);
    return { platform: 'soundcloud', ...data };
  }
  if (lower.includes('mediafire.com')) {
    const data = await scrapeMediafire(safeUrl);
    return { platform: 'mediafire', ...data };
  }
  if (lower.includes('sfile.mobi') || lower.includes('sfile.co')) {
    const data = await scrapeSfile(safeUrl);
    return { platform: 'sfile', ...data };
  }
  if (lower.includes('pixeldrain.com')) {
    const data = await scrapePixeldrain(safeUrl);
    return { platform: 'pixeldrain', ...data };
  }

  throw new ValidationError(
    'Platform URL belum didukung oleh AIO Downloader (mendukung: TikTok, Twitter/X, Facebook, Instagram, YouTube, Spotify, Pinterest, SoundCloud, MediaFire, Sfile, Pixeldrain)'
  );
}
