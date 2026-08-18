# Prototype Instructions

## Product decision (2026-08-12)

- This is one responsive Web client: wide screens use immersive article reading and memory trails, while narrow screens use short contextual vocabulary challenges.
- All navigation destinations are functional product pages in the same client: Today, Library, Review, Vocabulary, Notes, Insights, and Settings. Mobile uses the same data and workflows through a compact header and bottom navigation.
- Article ingestion supports URL reading through the public Jina Reader endpoint plus a fully local pasted-text fallback. Vocabulary analysis and spaced repetition remain deterministic and usable offline.
- Optional AI vocabulary analysis uses a user-configured OpenAI-compatible Chat Completions endpoint. Persist provider settings in the authenticated user's PocketBase `user_settings` record. The browser must call only authenticated `/api/lexisle/ai/*` PocketBase routes; never call a model provider directly. Encrypt the provider API key on the PocketBase server, never return it to the browser, and preserve deterministic local fallback on every provider error.
- Both surfaces share electric violet `#5B3FF2`, deep indigo `#171B3A`, amber `#F59E0B`, success teal `#16A085`, mist gray `#F6F7FB`, and the states `新词 / 学习中 / 待复习`.
- Authentication uses PocketBase at `https://pocket.nings.top`, the `users` auth collection, and email/password. Keep login, registration, logout, session restoration, and service errors shared across all responsive layouts.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
