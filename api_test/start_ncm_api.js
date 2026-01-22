const server = require('netease-cloud-music-api-alger/server');
const match = require('@unblockneteasemusic/server');
const path = require('path');

// 加载配置文件
const apiConfig = require('./set.json');

function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return defaultValue;
  return hit.slice(prefix.length);
}

// 辅助函数：获取歌曲详情
// 我们需要复用 Netease API 里的 song_detail 模块，或者直接发请求。
// 这里最简单的方式是使用 server 内部已经加载的 module。
// 但因为我们是在 construct 前拦截，所以得自己 require 那个模块。
const songHash = {
  // 简单缓存一下详情，避免重复查询
};

async function getSongDetail(id, query, request) {
  try {
    const detailModule = require('netease-cloud-music-api-alger/module/song_detail');
    const res = await detailModule({ ids: id }, request);
    if (res.body && res.body.songs && res.body.songs[0]) {
      return res.body.songs[0];
    }
  } catch (e) {
    console.error('Fetch detail failed', e);
  }
  return null;
}

async function main() {
  const port = Number(getArg('port', process.env.PORT || '30488'));
  const basePath = path.join(require.resolve('netease-cloud-music-api-alger/server'), '../module');

  // 1. 获取所有默认模块定义
  const special = {
    'daily_signin.js': '/daily_signin',
    'fm_trash.js': '/fm_trash',
    'personal_fm.js': '/personal_fm'
  };
  const modules = await server.getModulesDefinitions(basePath, special);

  // 2. 找到 song_url_v1 并劫持它
  const targetRoute = '/song/url/v1';
  const originalModuleDef = modules.find((m) => m.route === targetRoute);

  if (originalModuleDef) {
    console.log('[Hack] Injecting Unblock logic into /song/url/v1');
    const originalHandler = originalModuleDef.module;

    // 定义新的 Handler
    originalModuleDef.module = async (query, request) => {
      // 1. 尝试调用原生 API
      // 注意：这里的 request 是由 server.js 注入的，具有 cookie 处理能力
      // 关键：注入 os=pc Cookie，模拟 Electron 客户端请求
      const enhancedQuery = {
        ...query,
        cookie: (query.cookie || '') + ' os=pc;'
      };
      console.log('[Native API] Enhanced query with os=pc');

      let result = null;
      try {
        result = await originalHandler(enhancedQuery, request);
      } catch {
        // 原生调用失败，继续尝试 Unblock
        console.log('[Native] Failed, trying Unblock...');
      }

      // 检查原生结果是否满意 (有链接且非试听)
      // code 200, data[0].url exists, and maybe check fee/freeTrialInfo?
      const songFn = (result && result.body && result.body.data && result.body.data[0]) || {};

      // ===== DEBUG: 打印原生 API 返回的关键字段 =====
      console.log(
        '[Native API] Result:',
        JSON.stringify({
          url: songFn.url ? songFn.url.substring(0, 50) + '...' : null,
          freeTrialInfo: songFn.freeTrialInfo,
          fee: songFn.fee,
          code: songFn.code
        })
      );

      const isValid = songFn.url && !songFn.freeTrialInfo;
      console.log('[Native API] isValid:', isValid);

      // 如果原生结果OK，直接返回
      if (isValid) {
        console.log('[Native API] Using native result, skipping Unblock');
        return result;
      }

      // 2. 如果原生不行，启动 Unblock 流程
      const id = query.id;
      console.log(`[Unblock] Triggered for song ${id}`);

      // 需要先查详情
      const songDetail = await getSongDetail(id, query, request);
      if (!songDetail) {
        return result || { status: 404, body: { code: 404, msg: 'Detail not found' } };
      }

      // 构造 Unblock 需要的数据结构 - 关键：必须包含 id！
      const songData = {
        id: parseInt(id), // 关键！Unblock 插件需要 id 来从官方源获取链接
        name: songDetail.name,
        artists: (songDetail.ar || []).map((a) => ({ name: a?.name || '' })),
        album: { name: songDetail.al?.name || '' },
        dt: songDetail.dt
      };

      const buildUnblockResponse = (matchResult) => ({
        status: 200,
        body: {
          code: 200,
          data: [
            {
              id: Number(id),
              url: matchResult.url,
              br: 320000,
              size: matchResult.size || 0,
              md5: null,
              code: 200,
              expi: 1200,
              type: 'mp3',
              gain: 0,
              fee: 0,
              payed: 0,
              flag: 0,
              canExtend: false,
              freeTrialInfo: null,
              level: 'standard',
              encodeType: 'mp3'
            }
          ]
        },
        cookie: result ? result.cookie : []
      });

      try {
        // 从配置文件读取音源设置
        const sources = apiConfig.enabledMusicSources || ['kugou', 'migu', 'pyncmd'];
        console.log(`[Unblock] Searching sources: ${sources.join(', ')} with id: ${songData.id}`);

        let matchResult = await match(parseInt(id), sources, songData);

        if (!matchResult || !matchResult.url) {
          const retrySources = apiConfig.retryMusicSources || sources.filter((s) => s !== 'kugou');
          if (retrySources.length > 0) {
            console.log(`[Unblock] Retry with sources: ${retrySources.join(', ')}`);
            matchResult = await match(parseInt(id), retrySources, songData);
          }
        }

        if (matchResult && matchResult.url) {
          console.log(`[Unblock] Success URL: ${matchResult.url}`);

          if (matchResult.url.includes('126.net'))
            console.log('✅ [Unblock] GOT NETEASE LINK (likely Pyncmd)!');
          else if (matchResult.url.includes('migu')) console.log('⚠️ [Unblock] Got Migu link');
          else console.log('⚠️ [Unblock] Got other link');

          console.log(`[Unblock] Meta - Size: ${matchResult.size}`);
          return buildUnblockResponse(matchResult);
        }
      } catch (e) {
        console.error('[Unblock] Failed:', e);
      }

      // 如果 Unblock 也失败，返回原生的（哪怕是空的或试听的）
      return result;
    };
  }

  // 3. 启动 Server，传入修改后的 modules
  await server.serveNcmApi({
    port,
    host: '0.0.0.0',  // 明确只监听 IPv4，避免云端 IPv6 冲突
    moduleDefs: modules
  });

  console.log(`MUSIC API STARTED (Enhanced) on port ${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
