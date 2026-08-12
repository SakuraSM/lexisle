# Lexisle · 知屿英语双端原型

“知屿英语”把在线英文文章变成可持续的词汇学习路径：PC 端用于沉浸阅读、语境释义与记忆轨迹，移动端用于短回合练习、即时反馈和每日计划。

## 原型入口

- `desktop/`：PC 阅读工作台，默认本地端口 `4173`
- `mobile/`：移动端学习应用，默认本地端口 `4174`

## Docker Compose

同时构建并启动 PC 与移动端生产镜像：

```bash
docker compose up --build -d
```

- PC：`http://localhost:4173`
- 移动端：`http://localhost:4174`
- 健康检查：两个服务均提供 `/healthz`

可通过环境变量覆盖端口和 PocketBase 地址：

```bash
DESKTOP_PORT=5173 MOBILE_PORT=5174 \
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

工作流会分别安装、构建、测试 PC 与移动端，执行 Docker Compose 双镜像构建，并上传：

- `lexisle-desktop.tar.gz`
- `lexisle-mobile.tar.gz`

构建产物保留 14 天。推送版本标签（例如 `v1.0.0`）时，还会自动创建 GitHub Release 并附带两个压缩包。

## 已实现

- 在线文章式沉浸阅读和生词语境释义
- 新词 / 学习中 / 待复习三种统一状态
- PC 选词、发音、加入词汇本、继续阅读、稍后读
- 移动端四选一练习、正确/错误反馈、每日进度推进
- PocketBase 邮箱密码登录、注册、退出与会话恢复
- 登录服务连接到 `https://pocket.nings.top` 的 `users` 认证集合
- 使用浏览器本地存储保存未登录学习进度；登录后具备接入 PocketBase 云端学习数据的结构
- 间隔复习时间提示和记忆轨迹
- PC / 移动端统一主题与设计令牌

## 验证

两端均已通过生产构建和 Sites Worker 测试；移动端运行时完整性检查通过。视觉对照和交互验证记录见 `design-qa.md`。

PocketBase 学习数据集合、字段、权限规则与索引建议见 `pocketbase-schema.md`。前端支持通过 `VITE_POCKETBASE_URL` 覆盖默认服务地址。
