# Mega-morphic

*Topology-aware shape morphing.*

**[▶ Live demo](https://florissteenkamp.github.io/mega-morphic/)**

> **Need this in your product?** I offer integration, custom features and
> support. Email me at
> [steenkampfloris@gmail.com](mailto:steenkampfloris@gmail.com?subject=Morphing).

A browser demo that morphs one vector shape into another: a letter into a
letter, a horse into a cat, or even a digit into a platypus. It works on the shapes'
*skeletons* rather than their outlines, so strokes bend, branches grow or
shrink away and holes open or close, instead of one outline sliding
sideways into the other.

This is a demo, not a library: there's no published package or API.


## Running it

Requires Node ≥ 26.

```
npm install
npm run dev
```

`npm run dev` watches and rebuilds the bundle, type-checks in the
background, and serves the page at <http://127.0.0.1:5501/index.html>.

Run the tests with `npx jest`.


## How it works

1. **Skeletons.** Each shape's medial axis is computed with
   [flo-mat](https://www.npmjs.com/package/flo-mat). It's then reduced to a
   *scale axis* so that small wiggles don't count as structure: the main
   strokes are matched at a coarse scale, and the details at a fine one.
2. **Matching.** The two skeletons are split into segment trees, and their
   strokes are paired up by dynamic time warping over each stroke's
   thickness and bending profile. Pairs are also priced on position and
   angle, and on how well their sub-branches match. A stroke with no
   partner is kept and collapses to a point in the other shape.
3. **Pose.** Shape 2 is scaled and moved onto shape 1. The true size and
   position are blended back in over the morph.
4. **Interpolation.** For each matched stroke, the skeleton's angles and
   lengths are interpolated, not its control points, so a stroke bends
   through natural in-between poses instead of cutting straight across.
   Branches stay glued to their parents, and the outline is rebuilt around
   the interpolated maximal disks.
5. **Drawing.** The rebuilt pieces are merged with a winding-number union
   from [flo-boolean](https://www.npmjs.com/package/flo-boolean) into one
   outline per frame.


## Things to try

- **Pick any two shapes.** The glyph menus hold 600+ test vectors: a
  few alphabets with digits, 54 script fonts (`kayla_A`, `butter_x`, …)
  and 100+ animal silhouettes (`zoo-…`).
- **Cross-species morphs:** `zoo-horse` → `zoo-cat`, or `zoo-t-rex` →
  `zoo-chicken` (evolution, more or less).
- **Topology changes:** `k` → `x` (a branch moves), `seven` → `three`, or a
  letter with a hole into one without (`O` → `C`, `B` → `E`).
- **Same letter, different fonts:** `kayla_A` → `the-boldstyle_A` →
  `kafutey_A`. Hairline to heavy weight is a good stress test.
- **Flip and rotate** a shape to see how the matching reacts.
- **Open the debug panel.** You can draw the skeleton and its parts, then
  click on a shape to inspect a stroke's match, its profile alignment or its
  sub-branch matching.
- **Toggle "Fill only" and "Pattern".** Turning on the pattern gives a
  texture that morphs along with the shape.


## Test vectors

All the shapes live in a single SVG font, `fonts-test/vectors.svg`.

The animal silhouettes come from [PhyloPic](https://www.phylopic.org/). Their
licenses vary (CC0, PDM, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA). Each
glyph's credit and license are in the comment above it in the file.


## License

The code is under the [Prosperity Public License 3.0.0](LICENSE.md):

- **Noncommercial use is free.** That includes personal projects, study,
  research, and use by charities, schools and government.
- **Commercial use** is free for a 30-day trial, one trial per company.
  After that, please
  [get in touch](mailto:steenkampfloris@gmail.com?subject=Morph%20commercial%20license)
  about a commercial license.

The test vectors keep their own licenses (see above).
