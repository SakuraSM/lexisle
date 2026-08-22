# PocketBase 数据设计

服务地址：`https://pocket.nings.top`

前端当前使用 `users` 认证集合完成邮箱密码登录、注册、退出与会话恢复。以下集合用于把文章进度、单词记忆和每日计划从匿名本地状态迁移到登录账号。

## 1. users（Auth collection）

保留 PocketBase 认证字段。可选增加：

- `name`：text，显示昵称
- `timezone`：text，默认 `Asia/Shanghai`
- `daily_goal`：number，默认 `5`

不要在前端保存 PocketBase 超级管理员凭证。

## 2. vocabulary_items

- `user`：relation → users，required，单选
- `client_id`：text，required，用于离线记录去重
- `word`：text，required
- `phonetic`：text
- `part`：text
- `definition_zh`：text，required
- `context`：editor
- `article_id`：text
- `status`：select，`new / learning / review / mastered`
- `next_review_at`：date
- `repetition`：number，默认 0
- `interval_days`：number，默认 1
- `ease_factor`：number，默认 2.5
- `deleted_at`：date，离线软删除时间

唯一索引：`CREATE UNIQUE INDEX idx_vocab_user_client ON vocabulary_items (user, client_id)`

## 3. daily_plans

- `user`：relation → users，required，单选
- `date`：text，required，格式 `YYYY-MM-DD`
- `reading_target`：number，默认 1
- `word_target`：number，默认 5
- `review_target`：number，默认 8
- `reading_done`：number，默认 0
- `word_done`：number，默认 0
- `review_done`：number，默认 0

唯一索引：`CREATE UNIQUE INDEX idx_plan_user_date ON daily_plans (user, date)`

## 4. review_events

- `user`：relation → users，required，单选
- `client_id`：text，required，用于离线事件去重
- `vocabulary_client_id`：text，required，对应本地词汇 ID
- `result`：select，`again / hard / good / easy`
- `reviewed_at`：date，required
- `response_ms`：number

唯一索引：`CREATE UNIQUE INDEX idx_review_user_client ON review_events (user, client_id)`

## 5. articles

- `user`：relation → users，required，单选
- `client_id`：text，required
- `title`：text，required
- `source`：text
- `topic`：text
- `url`：url
- `image`：url
- `difficulty`：select，`初级 / 中级 / 中高级 / 高级`
- `saved`：bool
- `progress`：number，0–100
- `text`：editor，required
- `analysis_json`：json，导入时识别的重点词汇
- `reader_json`：json，阅读模式、稳定分段、完成段落、翻译和语境词义缓存
- `deleted_at`：date，离线软删除时间

唯一索引：`CREATE UNIQUE INDEX idx_article_user_client ON articles (user, client_id)`

## 6. notes

- `user`：relation → users，required，单选
- `client_id`：text，required
- `article_id`：text
- `title`：text，required
- `body`：editor
- `tags`：json
- `deleted_at`：date，离线软删除时间

唯一索引：`CREATE UNIQUE INDEX idx_note_user_client ON notes (user, client_id)`

## 7. user_settings

- `user`：relation → users，required，单选
- `daily_goal`：number
- `reminder_time`：text
- `notifications`：bool
- `auto_save_words`：bool
- `difficulty`：select，`初级 / 中级 / 中高级 / 高级`
- `ai_enabled`：bool
- `ai_endpoint`：url
- `ai_model`：text
- `ai_max_words`：number，3–30
- `ai_prompt`：editor
- `ai_api_key_encrypted`：hidden text，仅由服务端 Hook 读写

唯一索引：`CREATE UNIQUE INDEX idx_settings_user ON user_settings (user)`

## API Rules

对 `vocabulary_items`、`daily_plans`、`articles`、`notes`、`user_settings` 使用：

- List/View/Update/Delete：`@request.auth.id != "" && user = @request.auth.id`
- Create：`@request.auth.id != "" && @request.body.user = @request.auth.id`

对 `review_events` 使用同样的 List/View/Create 规则；如果不允许修改复习历史，将 Update/Delete 留空。

六个学习集合都包含 `created`、`updated` 自动时间戳和 `client_updated_at` 客户端更新时间。增量拉取使用服务端 `updated + id` 游标，冲突合并优先比较 `client_updated_at`。

## 接入顺序

1. 优先执行 `pb_migrations/` 中的版本化 migration 创建上述集合、索引和规则。
2. 使用当前登录用户 ID 写入每条记录的 `user` 字段。
3. 首次登录时把匿名本地进度合并到账号；同一文章或单词以唯一索引进行 upsert。
4. 单词作答后写入 `review_events`，同时更新 `vocabulary_items.next_review_at`。
