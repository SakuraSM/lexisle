# Design QA — Lexisle 响应式 Web

## Responsive consolidation

- 单一工程：`web/`
- 单一 URL：宽屏呈现阅读工作台，窄屏呈现移动学习任务
- 单一认证状态：两种布局共用同一个 PocketBase client 和 auth store
- 单一构建产物：`lexisle-web.tar.gz`
- 断点：`820px`
- 原有 PC 与移动视觉目标均保留，变化仅限实现架构与真实响应式容器

## Comparison targets

### Desktop

- Source visual truth: `web/reference-desktop-normalized.png`
- Browser-rendered responsive implementation: `web/qa-responsive-desktop.png`
- Source pixels: 1487 × 1058; normalized to 1440 × 1024.
- Implementation viewport and pixels: 1440 × 1024 CSS px, deviceScaleFactor 1, 1440 × 1024 screenshot.
- State: Today / reading workspace / `cortex` expanded / 28% article progress.

### Mobile

- Source visual truth: `web/reference-mobile-normalized.png`
- Browser-rendered responsive implementation: `web/qa-responsive-mobile.png`
- Source pixels: 853 × 1844; normalized to 393 × 852 to match the app viewport.
- Implementation viewport and pixels: `[data-testid="device-screen"]` measured 393 × 852 CSS px, deviceScaleFactor 1, content screenshot 393 × 852.
- State: Today / lesson 1 of 5 / contextual multiple-choice question. Correct-feedback state was tested separately through the live interaction.

## Full-view comparison evidence

- Desktop preserves the source hierarchy and proportions: persistent left navigation, weekly plan bar, dominant article, inline word detail, compact memory trail, and footer action row.
- Mobile preserves the selected concept’s lesson hierarchy: habit progress, focused prompt, article context, highlighted word, four answer choices, immediate feedback, and a single primary action.
- The generated article photography is present at the intended crop and sharpness on both surfaces; no placeholder or code-drawn imagery is used.

## Focused region comparison evidence

- Desktop article header and inline `cortex` panel were checked at native 1440 × 1024 density. Font pairing, word-state colors, action placement, and image crop align with the source.
- Mobile article card and answer stack were checked at native 393 × 852 app-screen density. All four answer targets remain visible above the first scroll boundary and each is at least 48px high.
- No further crop was required because the paired native-size comparisons keep headings, body copy, status labels, controls, and image treatment readable.

## Required fidelity surfaces

- Fonts and typography: Noto Sans SC is used for product UI and Source Serif 4 for article content on both surfaces. Weight, line height, wrapping, and hierarchy follow the selected mocks; no truncation was found.
- Spacing and layout rhythm: 14px primary radii, 10px secondary radii, restrained borders, and consistent surface spacing are shared across responsive layouts. The mobile first pass was too loose and was compacted before the final comparison.
- Colors and visual tokens: electric violet `#5B3FF2`, deep indigo `#171B3A`, amber `#F59E0B`, success teal `#16A085`, mist gray `#F6F7FB`, and divider `#E5E7F0` are consistent across both implementations.
- Image quality and asset fidelity: both article images are purpose-generated raster assets with matching editorial art direction, correct subject, sharp crop, and no transparency artifacts. Standard controls use Radix outline icons.
- Copy and content: article titles, sentences, Chinese meanings, statuses, daily plan, dates, and review timing match the selected concepts and August 12, 2026 anchor.

## Browser interaction verification

- Desktop: selected multiple article words, updated the inline definition, added a word to the vocabulary book, advanced reading progress from 28% to 36%, opened the PocketBase login dialog, switched between login and registration, and verified client and server error states.
- Mobile: selected the correct answer, received the correct-feedback state, saved the word for tomorrow’s review, advanced the daily goal from 1/5 to 2/5, opened the PocketBase account sheet, switched between login and registration, and verified the keyboard-aware error state.
- Browser console: no warning or error entries on either surface.
- Authentication: `/api/health` returned 200, the `users` auth-methods endpoint reported email/password enabled, CORS allowed the local prototype origin, and an intentionally nonexistent account produced the designed “邮箱或密码不正确” response.
- Persistence: PocketBase SDK auth-store restoration is wired on both surfaces; existing anonymous lesson and article state continues to use local storage until the learning collections in `pocketbase-schema.md` are provisioned.

## Comparison history

### Pass 1 — blocked

- [P2] Mobile vertical density hid most answers below the first viewport.
  - Fix: reduced header, lesson-intro, article, word-row, answer, feedback, and primary-action spacing while preserving readable type and 48px answer targets.
- [P2] Desktop article line length was wider than the source, producing a visibly flatter reading rhythm.
  - Fix: reduced article copy width to 650px and the inline definition width to 720px.

### Pass 2 — passed

- Post-fix evidence: `qa-comparison-desktop.png` and `qa-comparison-mobile.png`.
- No actionable P0, P1, or P2 mismatch remains.

### Pass 3 — PocketBase authentication extension passed

- Desktop login and registration stay inside the centered modal pattern, preserve the violet primary action, and keep the article workspace visible as context.
- Mobile login and registration use the protected runtime’s `BottomSheet` and `KeyboardInput`, remain inside the device frame, and preserve safe-area and simulated-keyboard behavior.
- Both surfaces show the same service state, validation copy, logged-in account anatomy, and logout action.
- Source and implementation were inspected together in the live `/qa-auth.html` comparison pages.
- No actionable P0, P1, or P2 mismatch remains.

## Follow-up polish

- [P3] The mobile runtime’s protected status bar reduces vertical space compared with the frame-free generated mock, so the correct-feedback panel appears after the answer action rather than in the initial static viewport.
- [P3] The desktop implementation keeps slightly more white space below the final paragraph than the generated source; this improves reading calm without changing the task hierarchy.

## Responsive fidelity ledger

- Copy: learning prompt, article context, word definition and answer choices remain unchanged; only the product mark changes from “知屿英语” to “Lexisle”.
- Layout: wide screens retain sidebar + article + memory trail; narrow screens retain daily goal + contextual question + answer stack.
- Typography: Noto Sans SC remains the product font and Source Serif 4 remains the article font.
- Palette: violet, deep indigo, amber, teal and mist gray tokens remain shared.
- Assets: the same bedroom and raccoon raster assets are reused without new cropping or placeholders.
- Interaction: article word selection, reading progress, mobile answer feedback and the shared PocketBase login flow were verified in the in-app browser.
- Native-width check: mobile layout was inspected at 393px content width. The browser surface exposed a 720px-high capture rather than the 852px source height; vertical continuation was verified by scrolling.
- Above-the-fold copy diff: only the intentional brand rename to Lexisle remains.
- Intentional deviation: the phone simulator frame and simulated keyboard were removed because this is now a real responsive website rather than an app mock.

No actionable P0, P1 or P2 visual mismatch remains.

final result: passed

## Complete product pass — 2026-08-12

- New design spec: `web/library-concept.png`.
- Latest browser renders: `web/qa-complete-desktop.png` and `web/qa-complete-mobile.png`.
- Browser method: production Docker image at `http://127.0.0.1:4173`, controlled with the in-app Browser; mobile viewport override set to 393 × 852 and reset after verification.
- `view_image` comparison inspected the generated library concept, final desktop render, and final 393 × 852 mobile render in one QA pass.

### Fidelity ledger

- Copy: “图书馆 / 导入英文文章 / 粘贴文章链接 / 粘贴英文原文 / 开始分析 / 最近阅读 / 难度 / 继续阅读” is preserved. The right-side concept label “导入历史” intentionally became “分析能力” because file-import history is not part of the approved URL/text workflow.
- Layout: sidebar, weekly header, open primary workspace, article rail, and narrow right panel match the concept structure; the mobile render collapses these into one readable column.
- Typography: Noto Sans SC remains the UI font and Source Serif 4 remains exclusive to English reading content; no browser-default control typography is visible.
- Palette: true white surfaces, mist gray canvas, `#5B3FF2` violet, deep indigo, amber, teal, and `#E5E7F0` borders match the concept and original reading screen.
- Components and spacing: 14px panels, restrained one-pixel borders, 10px controls, open lists, and continuous rails are reused across all seven destinations without generic card-grid drift.
- Responsive behavior: at 393 × 852 the desktop sidebar/topbar are hidden, the mobile header and six-item bottom navigation are visible, primary controls are full-width, and no horizontal overflow was found.
- Above-the-fold copy diff: no unplanned headline, navigation, or CTA changes remain; the product mark is intentionally Lexisle.

### Interaction verification

- All seven navigation destinations rendered their matching level-one heading; browser console errors: 0.
- Pasted a 60-word article, analyzed 11 highlighted words, opened the contextual inspector, and saved `photosynthesis` to the vocabulary book.
- Revealed a review answer, submitted a memory grade, and observed today’s review count increment.
- Changed the word target from 5 to 7 in the daily plan and observed the topbar update.
- Created and saved the note “语境学习方法”, then verified it appeared in the notes rail.
- Existing login/registration/session flow remains connected to PocketBase; anonymous data remained available across a production-page reload.

Intentional implementation limit: third-party article URL extraction uses the public Jina Reader endpoint and therefore depends on that service and the source site allowing access. Direct English-text paste remains fully local and is the reliable fallback.

No actionable P0, P1 or P2 visual or interaction mismatch remains. The implementation was faithfully verified against the accepted Lexisle design system and the generated library design spec.

## AI vocabulary extension — 2026-08-12

- Visual reference: `web/library-concept.png`; latest production-browser evidence: `web/qa-ai-settings-desktop.png`.
- The settings extension reuses the accepted violet token, open white panel, compact labels, 10px controls, one-pixel borders, and existing typography. It introduces no unrelated layout or copy drift.
- Desktop uses a two-column provider form inside the full-width settings rail. The 820px breakpoint collapses settings and AI fields to one column, stacks connection feedback below the action, and retains the mobile header, bottom navigation, and independent content scroll.
- Provider endpoint, exact model ID, word limit, optional prompt, masked API Key, persistence choice, connection test, and browser CORS guidance are all visible in the product hierarchy. The API Key remains visually masked and is described as browser-only.
- Live browser verification saved a custom OpenAI-compatible configuration, showed a friendly connection error for an unavailable endpoint, imported a 60-word article through automatic local fallback, opened the reader, and rendered 12 inline vocabulary highlights. The final toast preserved both the successful local result and the AI fallback reason.
- Output validation was verified separately: malformed items, duplicates, words absent from the article, and entries without a Chinese definition are rejected before storage.

No actionable P0, P1 or P2 visual or interaction mismatch was introduced by the AI configuration extension.
