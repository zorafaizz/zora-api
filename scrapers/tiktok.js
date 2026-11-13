import axios from 'axios';

export async function scrapeTikTok(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  try {
    const res = await axios.post(
      'https://www.tikwm.com/api/',
      new URLSearchParams({ url: url.trim(), count: 12, cursor: 0, web: 1, hd: 1 }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json, text/javascript, */*; q=0.01'
        },
        timeout: 15000
      }
    );

    const json = res.data;
    if (json.code !== 0 || !json.data) {
      throw new Error(json.msg || 'Gagal mengekstrak video TikTok');
    }

    const d = json.data;
    const isSlide = Array.isArray(d.images) && d.images.length > 0;

    return {
      status: true,
      type: isSlide ? 'slide' : 'video',
      title: d.title || '',
      author: {
        nickname: d.author?.nickname || '',
        username: d.author?.unique_id || '',
        avatar: d.author?.avatar || ''
      },
      stats: {
        views: d.play_count || 0,
        likes: d.digg_count || 0,
        comments: d.comment_count || 0,
        shares: d.share_count || 0
      },
      duration: d.duration || 0,
      video: !isSlide ? (d.hdplay || d.play || d.wmplay) : null,
      audio: d.music || d.music_info?.play_url || null,
      images: isSlide ? d.images : []
    };
  } catch (err) {
    throw new Error(`TikTok Scraper Error: ${err.message}`);
  }
}
