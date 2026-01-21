const fetch = require('node-fetch');
const { exec } = require('child_process');

function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return defaultValue;
  return hit.slice(prefix.length);
}

function openExternal(url) {
  // Windows: use `start` to open default browser/player
  const cmd = `cmd /c start "" "${url}"`;
  exec(cmd, (err) => {
    if (err) console.error('[openExternal error]', err);
  });
}

async function main() {
  const base = getArg('base', 'http://127.0.0.1:30488').replace(/\/$/, '');
  const keywords = getArg('keywords', '海陆风');
  const type = Number(getArg('type', '1'));
  const limit = Number(getArg('limit', '20'));
  const offset = Number(getArg('offset', '0'));
  const level = getArg('level', 'higher'); // standard/higher/exhigh/lossless/hires/jyeffect/jymaster

  const searchUrl = `${base}/cloudsearch?${new URLSearchParams({
    keywords,
    type: String(type),
    limit: String(limit),
    offset: String(offset)
  }).toString()}`;

  console.log('[REQUEST]', searchUrl);
  const searchRes = await fetch(searchUrl);
  const searchJson = await searchRes.json();
  console.log('[STATUS]', searchRes.status);

  const songs = searchJson?.result?.songs;
  if (!Array.isArray(songs) || songs.length === 0) {
    console.log('[SEARCH RESULT] empty');
    return;
  }

  const first = songs[0];
  const id = first.id;
  const artist = Array.isArray(first?.ar)
    ? first.ar
        .map((a) => a?.name)
        .filter(Boolean)
        .join(' / ')
    : '';
  console.log(`\n[FIRST SONG] id=${id} name=${first?.name} artist=${artist}`);

  const urlApi = `${base}/song/url/v1?${new URLSearchParams({
    id: String(id),
    level
  }).toString()}`;

  console.log('\n[REQUEST]', urlApi);
  const urlRes = await fetch(urlApi);
  const urlJson = await urlRes.json();
  console.log('[STATUS]', urlRes.status);

  const playUrl = urlJson?.data?.[0]?.url;
  if (!playUrl) {
    console.log('[PLAY URL] not found in response:');
    console.log(JSON.stringify(urlJson, null, 2));
    return;
  }

  console.log(`\n[PLAY URL] ${playUrl}`);
  console.log('[ACTION] opening with system default app...');
  openExternal(playUrl);
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
