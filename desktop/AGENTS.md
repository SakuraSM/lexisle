# Prototype Instructions

## Product decision (2026-08-12)

- Desktop uses immersive article reading and memory trails while mobile uses short contextual vocabulary challenges.
- Both surfaces share electric violet `#5B3FF2`, deep indigo `#171B3A`, amber `#F59E0B`, success teal `#16A085`, mist gray `#F6F7FB`, and the states `新词 / 学习中 / 待复习`.
- Authentication uses PocketBase at `https://pocket.nings.top`, the `users` auth collection, and email/password. Keep login, registration, logout, session restoration, and service errors consistent across desktop and mobile.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
