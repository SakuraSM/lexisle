# PocketBase migrations

Lexisle targets PocketBase `0.39.x`. Copy this directory next to the PocketBase executable or start PocketBase with `--migrationsDir` pointing here. Unapplied migrations run automatically on `serve`; they can also be applied with `pocketbase migrate up`.

The six user-owned collections use API rules that only expose records whose `user` relation matches the authenticated user. `articles` is the single source of reading progress. Article analysis is stored in `analysis_json`; API keys are deliberately absent from the schema.
