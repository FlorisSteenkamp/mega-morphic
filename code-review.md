# Code review: simplifications in `src/`

Reviewed 2026-10-16. About 10k lines in 185 files.

Completed items are removed from this list as they're done.

**How it was checked:**
- Every "unused" claim was grepped across `src/` and `__tests__/`.
- Line numbers are from the day of the review and may have shifted since.

**Contents**
1. Kept on purpose (don't re-suggest)
2. Duplication worth merging
3. Smaller logic simplifications
4. Medium confidence: check before doing
5. Low-value cleanups

---

## 1. Kept on purpose (don't re-suggest)

These are unused, but kept for possible future use:
- [mutable.ts](src/utils/mutable.ts) and [mean.ts](src/utils/mean.ts).
- [fast-pluck.ts](src/utils/fast-pluck.ts), together with `_lenOfs`/`_lenOfs$`/`lenOfs$` and the Quokka block in [len-of.ts](src/morph/segment-tree/len-of.ts).
- [log-some-stuff.ts](src/page/log/log-some-stuff.ts) (`timingsOther` etc.).
- `getFatBranchNaive` in [get-fat-branch.ts](src/page/log/fat-branch/get-fat-branch.ts).
- The kink code in [log-morph-bezier.ts](src/page/log/log-morph-bezier.ts) (`kinks`, `kinkEls`, the clicked-joint `jointKink` calls) is temporarily commented out; leave it that way.
- `colors` in [draw-elems.ts](src/page/fs-consts-types/draw-elems.ts).
- The `event` parameter in [simple-button-group.tsx](src/components/simple-button-group.tsx).
- The unused `gA` and `gB` parameters of `subDtwOf` ([sub-dtw-of.ts](src/morph/segment-tree/match-seg-trees/sub-dtw-of.ts)), and `buildPair`'s `gA`/`gB` that pass them along.
- `sampleSegTree`'s `rootV` stays a required parameter (no optional parameters); callers pass `undefined` explicitly.

## 2. Duplication worth merging

### Matching and segment tree

- **Two hand-written caches with the same key** in [match-seg-trees.ts:88-127, 169-184](src/morph/segment-tree/match-seg-trees/match-seg-trees.ts#L88-L127).
  - `routeOf` is a factory with one caller.
  - `childrenFor` repeats its key and its get/set pattern.
  - The `g` parameter is redundant with `tag`.
  - Fix: use `getOrInsertComputed`, as `build-pair.ts:57` already does. About 15 lines.
- **The adjacency map is built twice.**
  - [collect-subtree.ts:13-20](src/morph/segment-tree/match-seg-trees/collect-subtree.ts#L13-L20) rebuilds the map that [children-of.ts:26-33](src/morph/segment-tree/match-seg-trees/children-of.ts#L26-L33) has just built: same scope order, same exclusions.
  - Fix: pass `adj` in. This also stops rebuilding a map for every child, and `scopeSet` then has no use.
  - Other copies of the same vertex → segments map: `route-segments.ts:16-26` and `sample-seg-tree.ts:109-114`. A memoized `adjOf$(segs)` could replace some of them.
- **Picking the best candidate.**
  - The same take-leaders-by-rank-then-recurse loop is in [build-pair.ts:79-94](src/morph/segment-tree/match-seg-trees/build-pair.ts#L79-L94) and [match-seg-trees.ts:145-162](src/morph/segment-tree/match-seg-trees/match-seg-trees.ts#L145-L162). A `pickBest(...)` helper could serve both. Medium confidence.
  - Similarly, the side loop with `alignSeq(seqOf(chA, side), ...)` appears in `cheap-child-cost.ts:49-57` and `build-pair.ts:114-118`.
- **The step-cost formula.**
  - `calcCost` in `product-dtw.ts:324-342` is the same formula as the `cost` lambda in `align-profiles.ts:41-47`.
  - Fix: share a `stepCost(rA, rB, tA, tB)` helper.

### Page and app

- **The ToDraw key list exists three times**: `emptyDebugElems` in [create-empty-generated-svgs.ts:9-24](src/page/fs-consts-types/create-empty-generated-svgs.ts#L9-L24), `to-draw-key-to-text.ts`, and the branches in `draw-elems.ts`.
  - Five keys are leftovers from the deleted draw-elems: `looseBoundingBox`, `tightBoundingBox`, `boundingHull`, `maxVertex` and `cpNode`. `page.tsx:292` filters them out of the UI, but `drawElements` still clears them on every draw.
  - Fix:
    - Make `toDrawKeyToText` the single source, with `type ToDraw = Record<keyof typeof toDrawKeyToText, boolean>`.
    - Build `defaultToDraw` and the empty svgs from its keys. This removes the `@ts-ignore` and `as ToDraw` casts in `default-state.ts`.
  - Edge case: a `toDraw` saved in localStorage may still carry the old keys, so `drawElements` should loop over the key list rather than `toDraws`.
  - About 25 lines.
  - Also: the svgs type is written out three times. Use the exported `GeneratedSvgs` in `transient-state.ts`, `draw-elems.ts` and `create-empty-generated-svgs.ts`.
- **Four identical `createCp*` factories.**
  - `createCpNext`, `createCpPrev`, `createCpNextOnCircle` and `createCpPrevOnCircle` in [create-more-functions.ts:99-164](src/page/fs-consts-types/create-more-functions.ts#L99-L164) differ only in which field they follow.
  - Fix: one `step(sc, key)` helper, which `use` and `createNextAndAround` can reuse too.
  - Behaviour change: the `*OnCircle` helpers would also return the node. These are debug console helpers, so that is harmless.
  - About 60 lines.
- **`page.tsx` handlers.**
  - Eight are `upd(pageState, X); lazyLoadDeduced(...)`, so one `updAndReload(patch, changeViewbox)` covers them.
  - Three are `upd + drawMorph(...)`, so one `updAndRedrawMorph(patch)` covers them.
  - `toDrawChanged` (141-157) repeats the two `drawElements` calls of `lazyLoadDeduced` (665-670); extract `redrawElements`.
  - About 40 lines.
- **`page.tsx` styles.**
  - `showChangedStyles` is a copy of `toDrawCheckboxStyles`.
  - The toggle-button style is written out four times (475-485, 493-503, 532-543, 549-560) and duplicates `btnStyleBlue`.
  - Fix: a `toggleBtnStyle(on, small?)` helper. Border and padding differ slightly, so keep them as parameters (medium confidence).
  - About 40 lines.
  - Also: the close-button style in `needle-window.tsx` is `btnStyleBlue` plus position and shadow.
- **Viewbox selection in the mouse handlers.**
  - The `shapeIdx === 1 ? ...viewbox1 : ...` chains are in `mouse-move.ts:21-23`, `mouse-up.ts:33-35, 66-75` and `on-click.ts:101-105, 120-126`.
  - Fix: use computed keys, e.g. `` `viewbox${shapeIdx}` ``. About 20 lines.
- **Nearest prong lookups.**
  - [get-nearest-two-prong.ts](src/page/get-nearest/get-nearest-two-prong.ts) and [get-nearest-three-prong.ts](src/page/get-nearest/get-nearest-three-prong.ts) differ only in the predicate (`=== 2` vs `>= 3`).
  - Fix: one `getNearestVertex(mats, p, pred)`. About 25 lines.
  - The same filter also appears in `draw-elems.ts:110-121`.
- **Closest bezier.**
  - [get-closest-bezier-in-mats.ts](src/utils/get-closest-bezier-in-mats.ts) is the `getNearest` pattern written out by hand.
  - Fix: `getNearest((p, ps) => closestPointOnBezier(ps, p).d, mats.flatMap(m => m.meta.loops.flatMap(l => l.beziers)), p).t`. About 12 lines.
  - Also: `logCurve` and `logNearestBezier` overlap, but merging them drops a `ClickFor` option, which is a UI decision.

## 3. Smaller logic simplifications

### Morph core
- [build-morph-entries.ts:68, 94, 142](src/morph/build-morph-entries/build-morph-entries.ts#L68):
  - `pairIdx` always equals `idx`, because exactly one entry is pushed before recursing.
  - Fix: use `matchColors[idx % n]`.
- [get-morphed-skeleton.ts:30-32, 132-173](src/morph/resolve-morph-at/get-morphed-skeleton.ts#L30-L32):
  - `parentPsi`, `staticPsiA` and `staticPsiB` are curried factories, each called once.
  - They are also built for the trunk, which never uses them.
  - Fix: make them plain functions. About 10 lines.
- [align-entries-b-to-a.ts:51-65](src/morph/procrustes/align-entries-b-to-a.ts#L51-L65):
  - `bToAFrame` equals `poseCorrectionAt({ poseA, poseB }, 0, poseB)`; the maths is identical.
  - Deleting it saves about 16 lines. Add a one-line comment, since it reads a little indirectly.
- [anchored-sleeves.ts:149-174](src/morph/anchored-sleeves.ts#L149-L174): the two branches of `unifySeamAnchors` mirror each other; collapse them with `[p, n] = isOut ? [j-1, j] : [j, j-1]`. About 9 lines.
- [anchored-sleeves.ts:282-285](src/morph/anchored-sleeves.ts#L282-L285): `polarAnchor`'s θ is `tangentAngle([ux, uy], T)`.
- [anchored-sleeves.ts:113-124](src/morph/anchored-sleeves.ts#L113-L124): the anchor rows for A and B come from the same 6-line block; use a local `row(...)` lambda (medium).
- `reconstruct-side.ts:120-125` and `:248-251`: both compute `cos θ·T + sin θ·N`. A `fromTN(θ, T)` helper covers both; it is the inverse of `tangentAngle`.
- [draw-morph.ts:68](src/morph/draw-morph/draw-morph.ts#L68): `.replace('fill25', 'nofill')` never matches, because entry classes are always `nofill`.
- [place-topology.ts:145](src/morph/place-topology.ts#L145): `pushCollapsedEntry` recomputes `getLastP(bz)`, which the caller already has.
- [place-topology.ts:116-117](src/morph/place-topology.ts#L116-L117) and [nearest-idx.ts:14-16](src/morph/nearest-idx.ts#L14-L16): use flo-vector2d `squaredDistanceBetween`. The argmin is unchanged.
- [get-morphed-skeleton.ts:230-232](src/morph/resolve-morph-at/get-morphed-skeleton.ts#L230-L232): `meanPoint` repeats `chordLen` inline.

### Segment tree
- [compose-segs.ts](src/morph/segment-tree/compose-segs.ts):
  - `composeSegs` is only ever called with one segment.
  - Fix: make it `composeSeg(seg, reversed)`, keeping the array copies. About 10 lines.
- [children-of.ts:83-87](src/morph/segment-tree/match-seg-trees/children-of.ts#L83-L87):
  - The `v === endV` and `v === startV` checks always hold whenever their index checks do.
  - Fix: drop them, along with `startV` and `endV`.
- [build-pair.ts:129-135](src/morph/segment-tree/match-seg-trees/build-pair.ts#L129-L135): the delete and insert branches merge into `cost += drop(op.type === 'delete' ? op.a : op.b)`.
- [product-dtw.ts](src/morph/segment-tree/product-dtw.ts):
  - `getMaterial` and `calcCost` are factories used once; inline them.
  - Lines 153-157 become `rA0 = max(0, s - nB + 1); rA1 = min(s, nA - 1)`.
  - In the gap branches (177-181, 194-199), `open`, `g` and the `altsWithin(...)` result don't depend on the loop variables, so compute them once before each loop.
- [geom-of.ts](src/morph/segment-tree/geom-of.ts): `pss[pss.length - 1].at(-1)!` is `getLastP(pss)`. Same for `chord-dir.ts:12-14`.

### Page, log and app
- [simple-slider.tsx](src/components/simple-slider.tsx):
  - `onChange(event, value, activeThumb)` always receives a single number.
  - Fix: change it to `onChange(value)`, and the four page handlers lose their `value as number`.
- [mouse-up.ts:46-54](src/page/mouse/mouse-up.ts#L46-L54): the swap-if-needed block becomes `[[min(a0,b0), min(a1,b1)], [max(a0,b0), max(a1,b1)]]`.
- [mouse-move.ts:52](src/page/mouse/mouse-move.ts#L52): a local `XMLNS` duplicates `src/draw/xmlns.ts`.
- [on-click.ts:59-63](src/page/mouse/on-click.ts#L59-L63): `getViewboxXY(svgRef.current!...)` runs before the null check; move the check up.
- [viewbox.ts:17-40](src/page/fs-consts-types/viewbox.ts#L17-L40):
  - Four identical margins collapse to one `m`.
  - The bounds can be computed in one pass.
  - About 15 lines.
- [page.tsx:672-676](src/page/page.tsx#L672-L676): three spreads on the same condition become one.
- [page.tsx](src/page/page.tsx) `toDrawChanged`: uses `pageState.satScale` although `satScale` is already destructured.
- [load-path.ts:10-15](src/page/fs-consts-types/load-path.ts#L10-L15): `loadPath` wraps its result in `{ pathStr }` for its single caller; return the string directly.
- [log-child-dtw.ts](src/page/log/log-child-dtw.ts):
  - `anchorsOf` (210-226): use `flatMap` instead of `filter` + cast.
  - `logTrunkPair` and `evaluate` re-read `_debug_.elems.pathMatchResult[0]`; pass `pm` in.
- [get-fattest-of-chains.ts:23-47](src/page/log/fat-branch/get-fattest-of-chains.ts#L23-L47): track `best` directly instead of `bestChain`/`bestPss!`.
- `getFatBranchOfSector` (`get-fat-branches-from.ts:51-58`) has one caller; inline it.
- `log-morph-bezier.ts:66-88`: the hand-built control polygon and dots become `drawFs.polyline` plus `drawFs.circle`, which handle the delay themselves (medium; the `d` string differs, not the picture).
- `needle-window.tsx`:
  - `?? undefined` at line 158 does nothing.
  - Hoist `vertexIds$(...)` at line 104 out of the per-dp loop.
- [eval-child-pair.ts](src/debug/eval-child-pair.ts):
  - `totalCost + swayCost` (181, 187) is computed twice.
  - `dropCostOf(weights)` (189-190) is built twice.
  - `getSampleSpacing` repeats code that also appears in `match-seg-trees.ts:53-54`.
- `log-nearest-loop-set.ts:24`: `evalDeCasteljau(ps, 0/1)` is `[ps[0], ps.at(-1)!]`.

## 4. Medium confidence: check before doing

- **`productDtw`'s winner is `candidates[0]`** ([product-dtw.ts:204-254](src/morph/segment-tree/product-dtw.ts#L204-L254)).
  - Today `bVal`, `bAlt`, `bEndA` and `bEndB` re-track the first minimal candidate.
  - `candidates` is stably sorted by `totalCost`, so `candidates[0]` is that same candidate.
  - Risk: two costs that differ only in the last bit could round to a tie after a constant is added, and then the push order decides.
  - `covered` and `states` are only read by `product-dtw-diagnostic.spec.ts`. About 15 lines.
- **`reverseRoute(routeSegments(sub, a, b))` → `routeSegments(sub, b, a)`** ([build-pair.ts:68-71](src/morph/segment-tree/match-seg-trees/build-pair.ts#L68-L71), `eval-child-pair.ts:107-108`).
  - This would delete `reverse-route.ts`.
  - It only holds if the segment graph really is a tree, as `routeSegments`' doc says. If shapes with holes can create a cycle, the reverse search could tie-break onto a different route.
- **`setEndTangent` via the reversed `setStartTangent`** ([reconstruct-side.ts:131-149](src/morph/resolve-morph-at/get-morphed-boundary/reconstruct-side.ts#L131-L149)) is identical apart from `-0` signs, but less direct to read.
- **`toBreakpoints`' A- and B-side loops** ([align-branches.ts:265-277](src/morph/align-branches.ts#L265-L277)) could share one `insertKnots` helper, but swapping arguments eats most of the gain.

### Near-duplicates that are not drop-in (merging would change behaviour)
- **Feature sampling.** `align-branches.ts:129-163` (`sampleCount` + `sampleFeatures`) and `sample-features.ts:34-62`:
  - The sample count and the turning loop are identical, and those parts can be shared.
  - The φ interpolation and the u-range differ, so merging those changes the alignment.
- **Angle interpolation.** `angleAt` in `align-branches.ts:166-184` works in u/knot space, while `profileAngleAt` in `get-morphed-skeleton.ts:181-191` works in index space.
- **Splitting at breakpoints.** `resampleAt` in `align-branches.ts:318-352` and `splitAtBreakpoints` in `distribute-beziers-evenly.ts:33-58`:
  - For zero-length intervals the former emits point-cubics, while the latter skips them.
  - Only the section cut is cleanly shared, and that is now `cubicSection` in `src/morph/fs/`.

## 5. Low-value cleanups
- `cap-arc-pts.ts:31`: `max(1, …)` is redundant.
- `draw-pose-gizmo.ts:58-60`: `svg?.` is redundant after the `vb` guard.
- `draw-pose-gizmo.ts`: `tisserand` could be required, since its only caller always passes it.
- `assemble-loop.ts:32`: a stale commented-out `console.log`.
- `MIN_LEN = 1e-6` is declared separately in `assemble-loop.ts`, `cap-arc-pts.ts` and `reconstruct-side.ts`.
- `draw-elems.ts:109`: a stale comment.
- `children-of.ts:74-75`: hand-written cross and dot products; flo-vector2d has `cross` and `dot`.
- `intrinsic-skeleton.ts:30-35`: repeats the unwrapping from `unwrappedChordAngles`.
- `cap-arc-pts.ts:27`: `((a1 - a0) % 2π + 2π) % 2π` is `wrapAngle`-like.
- `boundaryTangents`' forward/backward zero-fill is the same pattern as `chords.ts:34-42`.
