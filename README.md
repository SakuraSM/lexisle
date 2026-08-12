# Lexisle · 响应式英语学习 Web

“知屿英语”把在线英文文章变成可持续的词汇学习路径：宽屏用于沉浸阅读、语境释义与记忆轨迹，窄屏用于短回合练习、即时反馈和每日计划。

## Web 应用

`web/` 是唯一客户端工程。相同 URL 会根据视口宽度自动切换：

- 宽度大于 820px：PC 阅读工作台
- 宽度不大于 820px：移动学习界面

两种布局共用 React、PocketBase 认证、依赖、构建和部署产物。

## Docker Compose

构建并启动响应式 Web 生产镜像：

```bash
docker compose up --build -d
```

- 访问：`http://localhost:4173`
- 健康检查：`http://localhost:4173/healthz`

可通过环境变量覆盖端口和 PocketBase 地址：

```bash
WEB_PORT=5173 \
VITE_POCKETBASE_URL=https://pocket.nings.top \
docker compose up --build -d
```

停止服务：

```bash
docker compose down
```

## GitHub CI

`.github/workflows/build.yml` 会在以下场景自动运行：

- 推送到 `main`
- Pull Request
- 手动触发
- 推送 `v*` 标签

工作流会安装、构建和测试唯一 Web 工程，执行 Docker Compose 镜像构建，并上传：

- `lexisle-web.tar.gz`

构建产物保留 14 天。推送版本标签（例如 `v1.0.0`）时，还会自动创建 GitHub Release 并附带响应式 Web 压缩包。

## 已实现

- URL 在线文章读取与英文原文粘贴导入
- 基于词频、词长与内置学习词典的重点词汇分析
- 可选 AI 语境识词：自定义任意 OpenAI 兼容接口、模型、API Key、词数和分析指令
- AI 输出经过结构与原文校验；请求失败或跨域受限时自动回退本地分析
- 重点词汇穿插在原文中，支持语境释义、发音和收藏
- “自由阅读 / 阅读记词”双模式：稳定语义分段、逐段推进、任意单词查词和关键词高亮
- 阅读记词模式支持 AI 段落翻译、语境丰富词义、手动加入生词本及桌面/移动端上下文详情面板
- 逐段进度、翻译和同词不同语境详情会本地缓存，并通过 PocketBase `reader_json` 跨设备合并
- 图书馆筛选、收藏、阅读进度与继续阅读
- 新词 / 学习中 / 待复习 / 已掌握四种学习状态
- SM-2 风格间隔复习、四档评分与复习事件记录
- 可搜索筛选的词汇本和词汇记忆数据
- 每日计划编辑、任务进度、连续学习与学习报告
- 笔记创建、编辑、删除、搜索与标签
- 浏览器定时复习提醒和学习偏好设置
- PocketBase 邮箱密码登录、注册、退出与会话恢复
- 登录服务连接到 `https://pocket.nings.top` 的 `users` 认证集合
- 文章、进度、词汇、复习事件、计划、笔记和设置的 PocketBase 同步适配器
- 版本化本地存储；云端集合不可用时仍可完整离线使用
- 同一 Web 客户端内的响应式 PC / 移动导航与统一设计令牌

PocketBase migration 位于 `pb_migrations/`，并已部署到 `https://pocket.nings.top`。界面会在集合不可用时明确显示“同步服务未配置”，不会把 404 或部分失败误报为成功；当前线上支持按更新时间合并、AI 分析同步、阅读记词缓存和跨设备软删除。

## 验证

响应式 Web 已通过生产构建、31 项核心/同步测试、6 项 React 页面测试、4 项 Sites Worker 测试和 8 项桌面/移动端 Playwright 流程。构建预算为 5 MB，当前静态产物约 1.89 MB。视觉对照和交互验证记录见 `design-qa.md`。

PocketBase 学习数据集合由 `pb_migrations/1786464000_lexisle_learning_collections.js` 创建，阅读记词缓存字段由 `pb_migrations/1786550400_add_article_reader_json.js` 添加。前端支持通过 `VITE_POCKETBASE_URL` 覆盖默认服务地址。

服务器不能直接运行 PocketBase CLI 时，可使用 Superuser Token 通过管理 API 幂等迁移：

```bash
POCKETBASE_SUPERUSER_TOKEN="..." \
POCKETBASE_URL="https://pocket.nings.top" \
npm --prefix web run migrate:pocketbase
```

Token 只通过环境变量传入，不要提交到仓库或打入 Web 构建产物。

## AI 模型配置

在“设置 → AI 单词识别”中填写兼容 OpenAI Chat Completions 的 API Base URL、模型 ID 和 API Key。接口地址既可填写 `https://provider.example/v1`，也可填写完整的 `/chat/completions` 地址。

- API Key 仅保存在当前浏览器的 Local Storage 或 Session Storage，不写入源码、构建产物或 PocketBase。
- 英文文章只在用户启用 AI 并执行导入分析时发送全文；阅读记词模式只按需发送当前段落、相邻短上下文和目标词。
- 静态 Web 会从浏览器直接调用模型接口，因此供应商必须允许当前站点跨域访问。
- 未启用 AI、连接失败、超时或模型输出校验失败时，会自动使用本地规则识别。
