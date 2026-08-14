# Design QA — オリにゃん起動ボタン

- Source visual truth: `C:\Users\SHOHEI\AppData\Local\Temp\codex-clipboard-3aa03ebf-9481-4295-932a-186a5b0085a7.png`
- Implementation screenshot: `C:\Users\SHOHEI\AppData\Local\Temp\orient-launcher-after.png`
- Focused comparison: `C:\Users\SHOHEI\AppData\Local\Temp\orient-launcher-comparison.png`
- Browser viewport: 1920 × 889 CSS px
- Device pixel ratio: 1
- Source pixels: 166 × 154
- Implementation full-view pixels: 1920 × 889
- Focused implementation crop: 166 × 154 (1:1; no density scaling)
- State: chat closed; launcher idle animation running

## Full-view comparison evidence

The launcher remains fixed at the lower-right of the page without overlap or clipping. The white circular border, orange background, shadow, and dark label preserve the reference hierarchy. The requested character is now visible within the circle while the surrounding page layout is unchanged.

## Focused region comparison evidence

The side-by-side focused comparison uses equal 166 × 154 regions. It confirms that the circle and label retain the reference proportions and alignment, with the supplied existing Orinyan artwork intentionally added inside the orange circle. A focused comparison was sufficient because the requested change is isolated to the launcher.

## Required fidelity surfaces

- Fonts and typography: the existing Japanese system-font stack, label weight, size, line height, and wrapping match the current launcher treatment.
- Spacing and layout rhythm: circle size, border, label overlap, lower-right placement, radius, and shadow remain consistent; the character is centered and clipped by the circle.
- Colors and visual tokens: the existing orange primary, white border, and dark ink label are unchanged.
- Image quality and asset fidelity: the existing `orinyan-states.png` asset is reused at native sprite scale with transparent edges; no substitute drawing or placeholder is used.
- Copy and content: `オリにゃんに相談` is unchanged.

## Findings

No actionable P0, P1, or P2 differences remain. The added character is an intentional deviation requested by the user.

## Comparison history

1. Initial production evidence showed the orange circle without the character. Computed styles identified the sprite span as inline, so its visible background area collapsed despite width and height declarations.
2. The sprite was changed to a block element and given a dedicated gentle idle animation.
3. Post-fix browser evidence shows the character inside the circle. Three sampled animation frames produced different transform matrices, confirming active movement. Clicking the launcher opened the chat dialog, and the browser console reported no warnings or errors.

## Follow-up polish

No P3 follow-up is required for this scoped change.

final result: passed
