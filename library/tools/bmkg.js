import axios from 'axios';

export async function getGempa() {
  try {
    const res = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', { timeout: 10000 });
    const gempa = res.data?.Infogempa?.gempa;
    if (!gempa) throw new Error('Format respons BMKG tidak sesuai');

    return {
      status: true,
      tanggal: gempa.Tanggal,
      jam: gempa.Jam,
      coordinates: gempa.Coordinates,
      lintang: gempa.Lintang,
      bujur: gempa.Bujur,
      magnitude: gempa.Magnitude,
      kedalaman: gempa.Kedalaman,
      wilayah: gempa.Wilayah,
      potensi: gempa.Potensi,
      dirasakan: gempa.Dirasakan || '-',
      shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`
    };
  } catch (err) {
    throw new Error(`BMKG Error: ${err.message}`);
  }
}

export async function getGempaTerkini() {
  try {
    const res = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', { timeout: 10000 });
    const list = res.data?.Infogempa?.gempa;
    if (!list || !Array.isArray(list)) throw new Error('Format list BMKG tidak sesuai');

    return {
      status: true,
      total: list.length,
      data: list.map(g => ({
        tanggal: g.Tanggal,
        jam: g.Jam,
        coordinates: g.Coordinates,
        magnitude: g.Magnitude,
        kedalaman: g.Kedalaman,
        wilayah: g.Wilayah,
        potensi: g.Potensi
      }))
    };
  } catch (err) {
    throw new Error(`BMKG Error: ${err.message}`);
  }
}
