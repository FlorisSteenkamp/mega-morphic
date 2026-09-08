import type { Debug } from '../../debug.js';
import type { BranchTree } from '../../morph/branch-tree/branch-tree.js';
import type { PageData } from '../page-data.js';
import { getLargestVertex, getMatCurveToNext } from 'flo-mat';
import { getBranchTree } from '../../morph/branch-tree/get-branch-tree.js';
import { matchTrees } from '../../morph/match-trees/match-trees-old.js';
import { procrustes, applySimilarity } from '../../morph/procrustes-analysis.js';
import { distributeBeziersEvenly } from '../../morph/distribute-beziers-evenly.js';
import { matchColors } from './match-colors.js';
import { drawMorph } from '../draw-morph.js';


function onMorphClicked(
        refPageData: React.RefObject<PageData | null>) {

    return 'temp disabled while trying new method';

    const { props, morphRef, morphT } = refPageData.current!;
    const { pageState } = props;
    const { deduced } = pageState;
    const { mats1, mats2 } = deduced;

    const tree1 = getBranchTree(getLargestVertex(mats1[0].cpNode));
    const tree2 = getBranchTree(getLargestVertex(mats2[0].cpNode));

    // const pose1 = procrustes(bezierLoops1[0], mats1);
    // const pose2 = procrustes(bezierLoops2[0], mats2);

    // const r = matchTrees(tree1, tree2, { pose1, pose2 });
    const r = matchTrees(tree1, tree2);
    const T2 = r.transform;

    // Map a branch's beziers into glyph 1's frame (identity if unaligned).
    const toFrame = (beziers: number[][][]) =>
        T2 ? beziers.map(ps => ps.map(p => applySimilarity(T2, p))) : beziers;
    // Every control point replaced by `pt` — a branch collapsed to a point.
    const collapseTo = (beziers: number[][][], pt: number[]) =>
        beziers.map(ps => ps.map(() => [pt[0], pt[1]]));
    const branchBeziers = (node: BranchTree) =>
        node.branch.map(cpNode => getMatCurveToNext(cpNode));

    const entries: { a: number[][][]; b: number[][][]; classes: string }[] = [];

    const firstPt = (bz: number[][][]) => bz[0][0];
    const lastPt = (bz: number[][][]) => {
        const seg = bz[bz.length - 1];
        return seg[seg.length - 1];
    };
    const dist2 = (p: number[], q: number[]) =>
        (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;

    // Matched-pair endpoints, in both frames, so a topology branch's
    // collapse point can track its junction as that junction moves over t.
    const anchors: { a: number[]; b: number[] }[] = [];

    // Matched pairs: resample for correspondence, morph glyph1 → glyph2.
    r.pairs.forEach(([a, b], i) => {
        const [m1, m2] = distributeBeziersEvenly(a.branch, b.branch);
        const g1 = m1.beziers;
        const g2 = toFrame(m2.beziers);
        entries.push({
            a: g1,
            b: g2,
            classes: `${matchColors[i % matchColors.length]} thin35 nofill`,
        });
        anchors.push({ a: firstPt(g1), b: firstPt(g2) });
        anchors.push({ a: lastPt(g1), b: lastPt(g2) });
    });

    // Where a topology branch's junction travels to in the OTHER frame, so
    // the collapsed end stays glued to the skeleton it hangs off. `key` is
    // the branch's own frame ('a' = glyph 1 for deleted, 'b' = glyph 2 for
    // inserted). Returns null if the branch isn't (yet) attached to a known
    // anchor.
    const junctionTarget = (bz: number[][][], key: 'a' | 'b') => {
        const other = key === 'a' ? 'b' : 'a';
        const ends = [firstPt(bz), lastPt(bz)];
        let best: { a: number[]; b: number[] } | null = null;
        let bestD = Infinity;
        for (const e of ends) {
            for (const an of anchors) {
                const d = dist2(an[key], e);
                if (d < bestD) { bestD = d; best = an; }
            }
        }
        return best && bestD <= 1 ? best[other] : null;
    };

    // Place deleted/inserted branches, collapsing them onto their junction's
    // moving target. A branch may hang off another topology branch, so we
    // repeat passes: each placed branch registers its endpoints as anchors
    // (both endpoints share the collapse target) letting chained branches
    // then attach. `key` is the branch's own frame.
    const placeTopology = (
            branches: number[][][][], key: 'a' | 'b', classes: string) => {
        const mkAnchor = (own: number[], oth: number[]) =>
            key === 'a' ? { a: own, b: oth } : { a: oth, b: own };
        const push = (bz: number[][][], collapsed: number[][][]) =>
            entries.push(key === 'a'
                ? { a: bz, b: collapsed, classes }
                : { a: collapsed, b: bz, classes });

        const pending = [...branches];
        let progress = true;
        while (progress) {
            progress = false;
            for (let i = pending.length - 1; i >= 0; i--) {
                const bz = pending[i];
                const target = junctionTarget(bz, key);
                if (target === null) { continue; }
                push(bz, collapseTo(bz, target));
                anchors.push(mkAnchor(firstPt(bz), target));
                anchors.push(mkAnchor(lastPt(bz), target));
                pending.splice(i, 1);
                progress = true;
            }
        }
        // Unattached leftovers: collapse to their own junction (in place).
        for (const bz of pending) {
            push(bz, collapseTo(bz, lastPt(bz)));
        }
    };

    // Deleted branches (glyph 1 only): retract into their attachment as t→1.
    placeTopology(
        r.deleted.map(node => branchBeziers(node)),
        'a', 'red thin35 nofill');

    // Inserted branches (glyph 2 only): grow out of their attachment as t→0.
    placeTopology(
        r.inserted.map(node => toFrame(branchBeziers(node))),
        'b', 'green thin35 nofill');

    morphRef.current = entries;

    drawMorph(refPageData, morphT / 100);
}


export { onMorphClicked }
