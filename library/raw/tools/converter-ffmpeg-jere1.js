import { promises } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
  return new Promise(async (resolve, reject) => {
    try {
      const tmpDir = join(__dirname, '../tmp');
      await promises.mkdir(tmpDir, { recursive: true }).catch(() => {});
      let tmp = join(tmpDir, +new Date() + '.' + ext);
      let out = tmp + '.' + ext2;
      await promises.writeFile(tmp, buffer);
      const ffmpegProcess = spawn('ffmpeg', [
        '-y',
        '-i', tmp,
        ...args,
        out
      ]);
      ffmpegProcess.on('error', (err) => {
        console.error('Error spawning ffmpeg:', err);
        reject(err);
      });
      ffmpegProcess.on('close', async (code) => {
        try {
          await promises.unlink(tmp).catch(() => {});
          if (code !== 0) return reject(new Error(`FFmpeg exited with code ${code}`));
          if (!await promises.access(out).then(() => true).catch(() => false)) {
            return reject(new Error('Output file not found'));
          }
          const outData = await promises.readFile(out);
          await promises.unlink(out).catch(() => {});
          resolve({
            data: outData,
            filename: out,
            delete() {
              return promises.unlink(out).catch(() => {});
            }
          });
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Convert Audio to Playable WhatsApp Audio
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension 
 * @returns {Promise<{data: Buffer, filename: String, delete: Function}>}
 */
function toPTT(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '64k',
    '-vbr', 'on',
    '-ar', '48000',
    '-ac', '1',
    '-avoid_negative_ts', 'make_zero'
  ], ext, 'opus');
}

/**
 * Convert Audio to Playable WhatsApp PTT
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension 
 * @returns {Promise<{data: Buffer, filename: String, delete: Function}>}
 */
function toAudio(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-vbr', 'on',
    '-compression_level', '10'
  ], ext, 'opus');
}

/**
 * Convert Audio to Playable WhatsApp Video
 * @param {Buffer} buffer Video Buffer
 * @param {String} ext File Extension 
 * @returns {Promise<{data: Buffer, filename: String, delete: Function}>}
 */
function toVideo(buffer, ext) {
  return ffmpeg(buffer, [
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-ab', '128k',
    '-ar', '44100',
    '-crf', '32',
    '-preset', 'slow'
  ], ext, 'mp4');
}

export {
  toAudio,
  toPTT,
  toVideo,
  ffmpeg
};
