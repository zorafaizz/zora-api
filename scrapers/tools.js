import axios from 'axios';
import * as cheerio from 'cheerio';

export async function getJadwalSholat(kota = 'jakarta') {
  try {
    const searchRes = await axios.get(`https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(kota.trim())}`, { timeout: 10000 });
    const kotaData = searchRes.data?.data?.[0];
    if (!kotaData) throw new Error(`Kota "${kota}" tidak ditemukan`);

    const today = new Date().toISOString().split('T')[0].split('-');
    const [year, month, day] = today;

    const jadwalRes = await axios.get(`https://api.myquran.com/v2/sholat/jadwal/${kotaData.id}/${year}/${month}/${day}`, { timeout: 10000 });
    const jadwal = jadwalRes.data?.data?.jadwal;

    return {
      status: true,
      kota: kotaData.lokasi,
      tanggal: jadwal?.tanggal || `${day}/${month}/${year}`,
      imsak: jadwal?.imsak,
      subuh: jadwal?.subuh,
      terbit: jadwal?.terbit,
      dhuha: jadwal?.dhuha,
      dzuhur: jadwal?.dzuhur,
      ashar: jadwal?.ashar,
      maghrib: jadwal?.maghrib,
      isya: jadwal?.isya
    };
  } catch (err) {
    throw new Error(`Jadwal Sholat Error: ${err.message}`);
  }
}

export async function githubStalk(username) {
  if (!username) throw new Error('Parameter username wajib diisi');

  try {
    const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(username.trim())}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const d = res.data;
    return {
      status: true,
      username: d.login,
      name: d.name || '-',
      bio: d.bio || '-',
      company: d.company || '-',
      location: d.location || '-',
      avatar_url: d.avatar_url,
      public_repos: d.public_repos,
      followers: d.followers,
      following: d.following,
      created_at: d.created_at,
      html_url: d.html_url
    };
  } catch (err) {
    throw new Error(`GitHub Stalk Error: ${err.message}`);
  }
}

export async function ipLookup(ip = '') {
  try {
    const res = await axios.get(`https://ipwho.is/${encodeURIComponent(ip.trim())}`, { timeout: 10000 });
    if (!res.data.success) throw new Error(res.data.message || 'IP tidak valid');

    const d = res.data;
    return {
      status: true,
      ip: d.ip,
      type: d.type,
      continent: d.continent,
      country: d.country,
      region: d.region,
      city: d.city,
      isp: d.connection?.isp,
      org: d.connection?.org,
      timezone: d.timezone?.id
    };
  } catch (err) {
    throw new Error(`IP Lookup Error: ${err.message}`);
  }
}
