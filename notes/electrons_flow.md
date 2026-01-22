
# Electron 搜索 → 播放链路说明

本文档描述 Electron 版本从“搜索歌曲”到“播放该歌曲”的完整链路，包含 Unblock 兜底逻辑。

## 1. 搜索入口（SearchBar）

**文件**：`src/renderer/layout/components/SearchBar.vue`

用户在搜索框输入关键词后按回车或点击搜索：

1. `search()` 读取 `searchValue`。
2. 将关键词写入 `searchStore.searchValue`。
3. 跳转路由 `/search?keyword=...&type=...`。

相关位置：`SearchBar.vue` 中 `search()`。

## 2. 搜索页加载与请求

**文件**：`src/renderer/views/search/index.vue`

1. 监听 `searchStore.searchValue`。
2. 调用 `loadSearch(value)`。
3. 根据搜索类型决定调用：
   - B站：`searchBilibili(...)`
   - 音乐/专辑/歌单/MV：`getSearch(...)`

相关位置：`loadSearch()` 与 `watch(searchStore.searchValue)`。

## 3. 搜索 API 封装

**文件**：`src/renderer/api/search.ts`

`getSearch(params)` 是对 `/cloudsearch` 的封装：

```
request.get('/cloudsearch', { params })
```

## 4. 请求参数注入

**文件**：`src/renderer/utils/request.ts`

Electron 环境下，`request` 会自动注入：

- `timestamp`
- `device=pc`
- `cookie`（若本地存在 token）

并使用本地 API：

```
http://127.0.0.1:${setData.musicApiPort}
```

## 5. 搜索结果映射

**文件**：`src/renderer/views/search/index.vue`

搜索返回后会统一处理字段：

- `songs`：补 `picUrl / artists`
- `albums`：补 `desc`
- `mvs / playlists`：统一字段结构

## 6. 点击播放（进入播放链路）

**文件**：`src/renderer/views/search/index.vue`

用户点击搜索结果中的歌曲，触发 `playerStore.setPlay(song)`：

- 进入播放队列
- 触发播放核心逻辑

## 7. 播放核心（playerCore）

**文件**：`src/renderer/store/modules/playerCore.ts`

`setPlay()` → `handlePlayMusic()`：

1. 取消旧请求 / 处理播放队列
2. 请求歌曲 URL
3. 交给 `audioService.play(...)` 播放

## 8. 获取播放 URL

**文件**：`src/renderer/api/music.ts`

`getMusicUrl(...)` 会调用：

```
/song/url/v1
```

如果官方 URL 无效/试听，则进入兜底解析。

## 9. Unblock 兜底解析

**文件**：

- `src/renderer/api/musicParser.ts`
- `src/main/server.ts`

逻辑：

1. `musicParser` 使用 `unblockMusic` 策略。
2. 通过 IPC 调用主进程 `unblock-music`。
3. 主进程调用 `@unblockneteasemusic/server` 获取可用音源。

## 10. 播放执行

**文件**：`src/renderer/services/audioService.ts`

`audioService.play(...)` 使用 Howler 播放，并同步：

- MediaSession
- EQ
- 进度、状态

---

## 总结

**搜索阶段**只涉及 `/cloudsearch`。

**播放阶段**才会触发 `/song/url/v1`，若不可用则进入 **Unblock 兜底解析**，最终交由 `audioService` 播放。

