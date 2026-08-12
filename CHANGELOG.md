# Changelog

## 2026-08-12

### Added

- Responsive Lexisle learning workflows for desktop and mobile web.
- PocketBase authentication and cross-device learning-data synchronization.
- Configurable OpenAI-compatible vocabulary analysis with custom endpoint, model, API key, word limit, and learning prompt.
- Validation of AI vocabulary against the source article, with automatic local-analysis fallback when the configured provider is unavailable.
- Docker Compose packaging and GitHub Actions production builds.

### Security

- Third-party model API keys remain in browser storage and are not synchronized to PocketBase or included in build artifacts.
