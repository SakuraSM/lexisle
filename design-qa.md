# Design QA — 知屿英语双端原型

## Comparison targets

### Desktop

- Source visual truth: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/desktop/reference-desktop.png`
- Normalized source: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/desktop/reference-desktop-normalized.png`
- Browser-rendered implementation: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/desktop/implementation-desktop.jpg`
- Side-by-side evidence: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/desktop/qa-comparison-desktop.png`
- Source pixels: 1487 × 1058; normalized to 1440 × 1024.
- Implementation viewport and pixels: 1440 × 1024 CSS px, deviceScaleFactor 1, 1440 × 1024 screenshot.
- State: Today / reading workspace / `cortex` expanded / 28% article progress.

### Mobile

- Source visual truth: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/mobile/reference-mobile.png`
- Normalized source: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/mobile/reference-mobile-normalized.png`
- Browser-rendered implementation: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/mobile/implementation-mobile.jpg`
- Side-by-side evidence: `/Users/zhengningning/Documents/Codex/2026-08-12/product-design-plugin-product-design-openai/outputs/zhiyu-english/mobile/qa-comparison-mobile.png`
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
- Spacing and layout rhythm: 14px primary radii, 10px secondary radii, restrained borders, and consistent surface spacing are shared across both apps. The mobile first pass was too loose and was compacted before the final comparison.
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

final result: passed
