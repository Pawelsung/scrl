# Design QA

- source visual truth path: `/Users/paulsung/Codex/scrl/新功能參考圖/IMG_9204.PNG` (supported by IMG_9205–IMG_9208)
- implementation screenshot path: `/Users/paulsung/Codex/scrl/qa-implementation-desktop.png`, `/Users/paulsung/Codex/scrl/qa-implementation-mobile.png`
- comparison evidence: `/Users/paulsung/Codex/scrl/qa-comparison.png`
- viewport: desktop 1280×720; mobile 390×844
- state: `中心方形置換` template applied, three 4:5 slides, empty image slots

**Full-view comparison evidence**

- The implementation reproduces the reference composition: two edge-to-edge half-height image regions with one centered square in each half.
- The squares use the opposite region's image source, remain above both base regions, sit symmetrically close to the middle seam, and repeat independently for each carousel slide.
- Desktop and mobile editor layouts remain usable without clipping the canvas controls or template guidance.

**Focused region comparison evidence**

- Focused comparison used the first slide's two half-height regions and center squares. The reference square is roughly one-third of the post width; the implementation uses 34%. Both squares are horizontally centered and use the same short gap from the middle seam, leaving substantially more space toward the outer top and bottom edges.
- The exact photographic crop is intentionally user-controlled, so asset-specific crop fidelity is not applicable in the empty-template state.

**Required fidelity surfaces**

- Fonts and typography: no new output typography is introduced; editor guidance inherits the existing Inter/system stack and hierarchy.
- Spacing and layout rhythm: both halves meet without a gap; both squares are equally sized and centered; the pattern scales with 1:1, 4:5, 9:16, and 16:9 canvases.
- Colors and visual tokens: editor guidance reuses the existing blue, muted text, border, and panel tokens.
- Image quality and asset fidelity: image slots retain the editor's cover-crop pipeline and original export resolution. No placeholder is included in exported output.
- Copy and content: template name, description, and two-step usage guidance are present on desktop and mobile.

**Findings**

- No actionable P0/P1/P2 visual or interaction mismatch remains for the requested feature.

**Patches made since the previous QA pass**

- Moved both square overlays toward the middle seam with an equal responsive gap, increasing the outer top and bottom spacing.
- Added a linked two-source/four-slot swap model for each slide.
- Added automatic next-slot selection to make two-image setup sequential.
- Propagated image replacement and clearing across linked source slots.
- Detached swap metadata when a linked slot is duplicated, preventing accidental three-way linking.
- Added desktop and mobile usage guidance using the existing design tokens.

**Follow-up Polish**

- [P3] A future optional control could expose square size as a single linked setting for users who want a larger or smaller center crop.

final result: passed
