import sharp from 'sharp';
import axios from 'axios';

export async function enhanceHD(imageUrl) {
  if (!imageUrl) throw new Error('Parameter URL gambar wajib diisi');

  const res = await axios.get(imageUrl.trim(), { responseType: 'arraybuffer', timeout: 15000 });
  const buffer = Buffer.from(res.data);

  if (!buffer || buffer.length === 0) throw new Error('Buffer gambar kosong atau tidak dapat diunduh');

  const meta = await sharp(buffer).metadata();
  if (!meta || !meta.width || !meta.height) throw new Error('Format gambar tidak didukung');

  // CLAHE + Unsharp Masking + Vibrance Boost (Teknik Remini/HD)
  const enhanced = await sharp(buffer)
    .clahe({ width: 10, height: 10, maxSlope: 3 })
    .sharpen({ sigma: 1.3, m1: 1.5, m2: 0.6 })
    .modulate({ saturation: 1.05, brightness: 1.02 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const outMeta = await sharp(enhanced).metadata();
  return {
    status: true,
    engine: 'Sharp CLAHE & Unsharp Mask',
    original_size: { width: meta.width, height: meta.height },
    enhanced_size: { width: outMeta.width, height: outMeta.height },
    bytes: enhanced.length,
    base64: `data:image/jpeg;base64,${enhanced.toString('base64')}`
  };
}

export async function enhanceUHD(imageUrl, scale = 2) {
  if (!imageUrl) throw new Error('Parameter URL gambar wajib diisi');

  const res = await axios.get(imageUrl.trim(), { responseType: 'arraybuffer', timeout: 15000 });
  const buffer = Buffer.from(res.data);

  if (!buffer || buffer.length === 0) throw new Error('Buffer gambar kosong atau tidak dapat diunduh');

  const meta = await sharp(buffer).metadata();
  if (!meta || !meta.width || !meta.height) throw new Error('Format gambar tidak didukung');

  const targetScale = Math.min(Math.max(Number(scale) || 2, 2), 4);
  const targetWidth = Math.round(meta.width * targetScale);
  const targetHeight = Math.round(meta.height * targetScale);

  // Lanczos3 Super-Resolution Interpolation + Deep Edge Sharpening
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
    status: true,
    engine: `Sharp Lanczos3 Super-Resolution (${targetScale}x)`,
    scale: targetScale,
    original_size: { width: meta.width, height: meta.height },
    upscaled_size: { width: outMeta.width, height: outMeta.height },
    bytes: upscaled.length,
    base64: `data:image/jpeg;base64,${upscaled.toString('base64')}`
  };
}
