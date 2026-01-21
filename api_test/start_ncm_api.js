const server = require('netease-cloud-music-api-alger/server');

function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return defaultValue;
  return hit.slice(prefix.length);
}

async function main() {
  const port = Number(getArg('port', process.env.PORT || '30488'));

  await server.serveNcmApi({ port });

  console.log(`MUSIC API STARTED on port ${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
