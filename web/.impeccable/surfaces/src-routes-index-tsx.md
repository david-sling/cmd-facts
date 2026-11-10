---
version: 1
slug: "src-routes-index-tsx"
primary_target: "src/routes/index.tsx"
related_targets: []
---

## Direction contract

THESIS: The page is one lit card on a black field, and the light is the product's own mist. It refuses the
category arrangement — centred headline over a terminal window over three feature cards — and it refuses to
make the command being explained look like something the visitor should copy and run. The only runnable
command on the page is the install.

OWN-WORLD: Pure black ground. One hero card, 28px radius, whose entire surface is the Mist animated gradient
(`@spell/animated-gradient`, preset Mist, WebGL) — near-black with pink filaments. Mist appears nowhere else;
every other section is flat black. Single accent `#ff66b8`, taken from the preset itself, used for the active
tab, the copy confirmation, inline emphasis and focus rings, never for a value that could read as a severity.
Manrope 300 for display at clamp(2.5rem, 5.6vw, 5rem), Manrope 400 for body, Spline Sans Mono for every
command, field name and field value. Surfaces are black at 55% with a hairline white border and a blur; no
glass, no shadows doing the work of structure.

STORY: An engineer wiring an approval surface arrives, sees in one line that this answers "what happens if
this runs", and leaves having run `npm i cmd-facts`. Secondary path is the playground, where they paste a
command of their own.

FIRST VIEWPORT: Black header — wordmark left, Fields / Packs / Schema centre, GitHub right. Below it the hero
card spans the viewport minus a 56px margin and stands 620px tall. Headline sits top-left at 14ch, light
weight, white on mist, with the lead paragraph at 44ch under it. The bottom row of the card carries the
primary action bottom-left — a terminal block with npm / pnpm / yarn / bun tabs, a `$` prompt, the command in
mono and a copy button — and the playground link bottom-right as an underlined text link, not a button. Below
the card, flat black: "What is cmd-facts?" over two columns, one pink phrase in the left column.

FORM: Built from the user's own pinned reference (`explorations/references/01-web3mine-storage-daemon.webp`):
the rounded panel inset in black, the split primary action, the inline accent highlight in the body copy. A
pinned direction beats the roll, so the hand's assigned candidate was not built; the roll it displaced is
seed:1565e76c2bf7ba92. The sculpted object from the original reading was cut at the user's instruction and the
mist took its place as the card's subject.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict,
DESIGN.md, and every shipping raster carrying its provenance
