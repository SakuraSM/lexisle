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

## 验证

响应式 Web 已通过生产构建、学习算法单元测试和 Sites Worker 测试。视觉对照和交互验证记录见 `design-qa.md`。

PocketBase 学习数据集合、字段、权限规则与索引建议见 `pocketbase-schema.md`。前端支持通过 `VITE_POCKETBASE_URL` 覆盖默认服务地址。

## AI 模型配置

在“设置 → AI 单词识别”中填写兼容 OpenAI Chat Completions 的 API Base URL、模型 ID 和 API Key。接口地址既可填写 `https://provider.example/v1`，也可填写完整的 `/chat/completions` 地址。

- API Key 仅保存在当前浏览器的 Local Storage 或 Session Storage，不写入源码、构建产物或 PocketBase。
- 英文文章只在用户启用 AI 且执行导入分析时发送到所配置的模型服务。
- 静态 Web 会从浏览器直接调用模型接口，因此供应商必须允许当前站点跨域访问。
- 未启用 AI、连接失败、超时或模型输出校验失败时，会自动使用本地规则识别。
