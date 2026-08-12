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

- 在线文章式沉浸阅读和生词语境释义
- 新词 / 学习中 / 待复习三种统一状态
- PC 选词、发音、加入词汇本、继续阅读、稍后读
- 移动端四选一练习、正确/错误反馈、每日进度推进
- PocketBase 邮箱密码登录、注册、退出与会话恢复
- 登录服务连接到 `https://pocket.nings.top` 的 `users` 认证集合
- 使用浏览器本地存储保存未登录学习进度；登录后具备接入 PocketBase 云端学习数据的结构
- 间隔复习时间提示和记忆轨迹
- 同一 Web 客户端内的响应式 PC / 移动布局与统一设计令牌

## 验证

响应式 Web 已通过生产构建和 Sites Worker 测试。视觉对照和交互验证记录见 `design-qa.md`。

PocketBase 学习数据集合、字段、权限规则与索引建议见 `pocketbase-schema.md`。前端支持通过 `VITE_POCKETBASE_URL` 覆盖默认服务地址。
