# Tissuelock website — handoff brief

## What this is
Multi-page marketing site for Tissuelock (soft-tissue biomaterials, pre-clinical), built as one Design Component: `Tissuelock.dc.html`. Home / Technology / Team / About / Investors are client-side "pages" in one file (a page state switches which `<main>` renders — no real routing).

Design direction: 8VC.com as reference — fluid, minimal, dark-blue/white, motion-heavy. Real 3D (three.js via `tl-3d.js`) drives the hero glass form, an ambient background shape, and the product model. Sans-serif only, no italics — user explicitly rejected serif/italic as "AI-generated-feeling."

## Files
- `Tissuelock.dc.html` — the whole site (template + logic class).
- `tl-3d.js` — three.js module: builds/manages WebGL scenes (lattice = hero glass form woven from the logo's 3 waves, panels = product model as clear outline, waves = ambient background shape). Exposes `window.TL3D` with `attach()`, `count()`, `playIntro()`, `settle()`.
- `stl-map.html` — dark Leaflet map of the Cortex Innovation District, embedded via iframe.
- `assets/` — logo variants, team headshots (color + blue-graded versions), partner/experience logos, St. Louis place photos.
- `support.js` — DC runtime, don't edit.

## Copy status — IMPORTANT
Most copy is best-effort draft, not confirmed fact — the user never fully answered questions about the real product mechanism/stage.

- Product/technology copy ("Conform/Hold/Resorb", 3-layer mechanism, pre-clinical roadmap) is inferred from a tape diagram and drain-complication image in their uploads. Verify with the user before treating as final.
- All claims hedged ("designed to", "in development") with investigational-device disclaimers — keep that posture.
- Bracketed placeholders remain: 3 news items, a second advisor slot, 2 image slots.
- All email addresses were removed per request (none exists yet) — CTAs read "Contact details coming soon." Don't add a mailto until given a real address.

## Known-fragile areas / bug history
- WebGL context churn froze the page once already. Cause: the 3D attach loop rebuilt renderers + PMREM env maps on every poll tick. Fixed by sharing one env source, only binding unbound canvases (`data-gl-bound`), and a hard 4-scene cap with disposal. If it hangs again, check `window.TL3D.count()` stays ≤ 4.
- Entrance animations must use `el.animate()` (Web Animations API), never inline-style CSS transitions. React re-applies the template's inline style object every render, restarting an inline transition and stranding content at `opacity:0` forever — this caused a real "empty page" bug.
- Animations must no-op while `document.visibilityState === 'hidden'` — the animation clock freezes when backgrounded.
- Splash screen: only raise `[data-hero-art]`'s z-index above the veil, never the whole `[data-hero]` section — raising the section paints its own bg over the veil. Session-gated via `sessionStorage('tl-splash-v5')`.
- Font is Schibsted Grotesk loaded with `wght@400..900` — that axis does NOT start at 300; an out-of-range weight silently drops the whole font load.

## Open threads with the user
- Waiting on real product/layer geometry to correct the 3-panel model and mechanism copy.
- Waiting on real news content, a second advisor, and real photography for the two marked image slots.
- No design system or GitHub repo attached.

## How to edit
This is a Design Component — use DC tools (`dc_html_str_replace` / `dc_js_str_replace`), not raw `write_file`, so changes stream live. `tl-3d.js` and `stl-map.html` are plain files.
