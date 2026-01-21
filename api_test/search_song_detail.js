const fetch = require('node-fetch');
const apiConfig = require('./set.json');
const API_BASE = apiConfig.apiBase || 'http://127.0.0.1:30488';

function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return defaultValue;
  return hit.slice(prefix.length);
}

async function main() {
  const base = getArg('base', API_BASE);
  const keywords = getArg('keywords', '海陆风');
  const type = Number(getArg('type', '1'));
  const limit = Number(getArg('limit', '20'));
  const offset = Number(getArg('offset', '0'));
  const detail = getArg('detail', '1') !== '0';

  const searchParams = new URLSearchParams({
    keywords,
    type: String(type),
    limit: String(limit),
    offset: String(offset)
  });

  const searchUrl = `${base.replace(/\/$/, '')}/cloudsearch?${searchParams.toString()}`;

  console.log('[REQUEST]', searchUrl);

  const searchRes = await fetch(searchUrl);
  const searchJson = await searchRes.json();

  console.log('[STATUS]', searchRes.status);

  const songs =
    searchJson?.result?.songs ||
    searchJson?.data?.result?.songs ||
    searchJson?.data?.result?.song?.songs;
  const songList = Array.isArray(songs) ? songs : searchJson?.result?.songs;

  const items = Array.isArray(songList) ? songList : [];

  console.log(`\n[SEARCH RESULT] count=${items.length}`);

  items.slice(0, 5).forEach((s, idx) => {
    const artist = Array.isArray(s?.ar)
      ? s.ar
          .map((a) => a?.name)
          .filter(Boolean)
          .join(' / ')
      : '';
    const album = s?.al?.name || '';
    console.log(`${idx + 1}. id=${s?.id} name=${s?.name} artist=${artist} album=${album}`);
  });

  if (!detail) return;

  const firstId = items?.[0]?.id;
  if (!firstId) {
    console.log('\n[SONG DETAIL] skipped: no song id found in search result');
    return;
  }

  const detailUrl = `${base.replace(/\/$/, '')}/song/detail?${new URLSearchParams({ ids: String(firstId) }).toString()}`;

  console.log('\n[REQUEST]', detailUrl);

  const detailRes = await fetch(detailUrl);
  const detailJson = await detailRes.json();

  console.log('[STATUS]', detailRes.status);

  const firstSong = Array.isArray(detailJson?.songs) ? detailJson.songs[0] : null;
  if (!firstSong) {
    console.log('[SONG DETAIL] response:', JSON.stringify(detailJson, null, 2));
    return;
  }

  const artist = Array.isArray(firstSong?.ar)
    ? firstSong.ar
        .map((a) => a?.name)
        .filter(Boolean)
        .join(' / ')
    : '';

  console.log('\n[SONG DETAIL]');
  console.log(`id=${firstSong.id}`);
  console.log(`name=${firstSong.name}`);
  console.log(`artist=${artist}`);
  console.log(`album=${firstSong?.al?.name || ''}`);
  console.log(`duration_ms=${firstSong?.dt || ''}`);
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
