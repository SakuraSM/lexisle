# PocketBase migrations

Lexisle targets PocketBase `0.39.x`. Copy this directory next to the PocketBase executable or start PocketBase with `--migrationsDir` pointing here. Unapplied migrations run automatically on `serve`; they can also be applied with `pocketbase migrate up`.

The six user-owned collections use API rules that only expose records whose `user` relation matches the authenticated user. `articles` is the single source of reading progress. Article analysis is stored in `analysis_json`; `reader_json` stores segmented reading progress and contextual caches. Every synced collection has `created`, `updated`, and `client_updated_at` fields for incremental pull and conflict resolution.

AI provider settings live in `user_settings`. The provider key is stored only in the hidden `ai_api_key_encrypted` field after AES-256-GCM encryption by `pb_hooks/lexisle_ai.pb.js`. Start PocketBase with an exactly 32-character `LEXISLE_AI_ENCRYPTION_KEY` and an exact-host `LEXISLE_AI_ALLOWED_HOSTS` list; the same encryption key must be retained across restarts. The browser never receives the encrypted field or plaintext key.

The collection migration and `pb_hooks/` must be deployed together. The PocketBase collection administration API can apply the field migration, but it cannot upload hook files.
