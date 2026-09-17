import type { CpNode } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import {
    getAllOnCircle, getMatCurveToNext, getRealProngCount, isOnSameCircle
} from "flo-mat";
import { length } from "flo-bezier3";
import { getShapeArea } from "flo-boolean";
import { getFatBranch } from "./get-fat-branch.js";
import { getFatBranchesFrom } from "./get-fat-branches-from.js";
import { getChainPss } from "./get-fat-salience.js";


/**
 * The 2-prong CpNode on the MAT's largest maximal disk - a canonical,
 * rotation-invariant rooting for `getFatBranchTree`: the largest disk is the
 * shape's most interior point (its radius is its boundary distance), so the
 * trunk passes through the core rather than whatever peripheral branch the
 * MAT traversal happened to start on.
 */
function getFattestCpNode(start: CpNode): CpNode {
    let best: CpNode | undefined;
    let cp = start;
    do {
        if (getRealProngCount(cp) === 2 &&
            (best === undefined ||
                cp.pointOnShape.circle.radius >
                best.pointOnShape.circle.radius)) {
            best = cp;
        }
        cp = cp.next;
    } while (cp !== start);

    return best ?? start;
}


/**
 * Returns the fat branch through the given `CpNode` as the trunk of a fully
 * recursive tree - each node's `children` edges store the child branch, its
 * skeleton distance and partial round salience from the parent's leaf tip,
 * and its signed emanating angle relative to the parent.
 */
function getFatBranchTree(
        cpNode: CpNode): FatBranch | undefined {

    // getFatBranch requires a plain 2-prong; walk to the nearest one.
    const cpStart = cpNode;
    while (getRealProngCount(cpNode) !== 2) {
        cpNode = cpNode.next;
        if (cpNode === cpStart) { return undefined; }
    }

    const fatTrunk = getFatBranch(cpNode);
    if (fatTrunk === undefined) { return undefined; }

    addChildren(fatTrunk);

    return fatTrunk;
}


function addChildren(
        parent: FatBranch): void {

    const branches = getFatBranchesFrom(parent);
    parent.children = [];
    if (branches.length === 0) { return; }

    // Rotate the (closed) chain to start at the leaf tip so each node's
    // skeleton depth is its distance from the tip.
    const rotated = rotateAtTip(closeChain(parent.cpChain));
    const depths = getSkeletonDepths(rotated);

    for (const branch of branches) {
        const s = branch.cpChain[0];  // contact on the fork circle

        // First/last encounters of the fork circle enclose the tip piece.
        let kF = -1;
        let mF = -1;
        for (let i = 0; i < rotated.length; i++) {
            if (isOnSameCircle(rotated[i], s)) {
                if (kF < 0) { kF = i; }
                mF = i;
            }
        }
        if (kF < 0 || mF === kF) { continue; }

        const distanceFromLeaf = depths[kF];

        // Tip piece: both boundary sides from the fork around the tip
        // (the rotation seam at the tip is an original chain transition),
        // closed by a chord across the fork disk.
        const tipChain = [...rotated.slice(mF), ...rotated.slice(1, kF + 1)];
        const chord = [
            rotated[kF].pointOnShape.p,
            rotated[mF].pointOnShape.p
        ];
        const roundSalienceFromLeaf = Math.abs(
            getShapeArea([...getChainPss(tipChain), chord])
        );

        // Parent travel direction (tip -> fork -> beyond) at the fork center
        // vs the child's emanating MAT direction from that same center.
        const parentDir = dirAtEnd(getMatCurveToNext(rotated[kF - 1]));
        const childDir = dirAtStart(getMatCurveToNext(s));
        const angle = Math.atan2(
            parentDir[0]*childDir[1] - parentDir[1]*childDir[0],
            parentDir[0]*childDir[0] + parentDir[1]*childDir[1]
        );

        parent.children.push({
            branch, distanceFromLeaf, roundSalienceFromLeaf, angle,
            side: childSide(rotated, kF, s)
        });

        addChildren(branch);
    }
}


/**
 * The side of the parent's MAT a child emanates from: +1 if its sector is
 * skipped (jumped over) within the parent chain's FIRST run over the fork
 * circle (the outbound sleeve), -1 if within the return run.
 */
function childSide(rotated: CpNode[], kF: number, s: CpNode): 1 | -1 {
    for (let q = kF;
            q < rotated.length - 1 && isOnSameCircle(rotated[q], s);
            q++) {
        const next = rotated[q + 1];
        if (next === rotated[q].next || !isOnSameCircle(rotated[q], next)) {
            continue;  // boundary step or pass-through, not a jump
        }
        for (let c = rotated[q]; c !== next; c = c.nextOnCircle) {
            if (c === s) { return 1; }
        }
    }

    return -1;
}


/**
 * Closes an open (child) chain via its fork-circle seam jump.
 */
function closeChain(
        cpChain: CpNode[]): CpNode[] {

    return cpChain[0] === cpChain[cpChain.length - 1]
        ? cpChain
        : [...cpChain, cpChain[0]];
}


/**
 * Rotates a closed chain so it starts (and ends) at the branch's leaf tip:
 * the node farthest from the chain start by skeleton arc - a leaf tip, since
 * depth peaks where the boundary walk turns around. Skeleton depths measured
 * on the result are then distances from that tip.
 */
function rotateAtTip(
        closedChain: CpNode[]): CpNode[] {

    const depths = getSkeletonDepths(closedChain);

    let t = 0;
    for (let i = 1; i < depths.length; i++) {
        if (depths[i] > depths[t]) {
            t = i;
        }
    }
    if (t === 0) { return closedChain; }

    return [
        ...closedChain.slice(t),
        ...closedChain.slice(1, t + 1)
    ];
}


/**
 * Returns per-node skeleton arc distances from the chain start. Every
 * skeleton edge occurs exactly twice (once per boundary side): the first
 * occurrence walks away from the start, the second walks back.
 */
function getSkeletonDepths(cpChain: CpNode[]): number[] {
    const depths: number[] = [0];
    const seen = new Set<string>();
    let d = 0;

    for (let i=0; i<cpChain.length - 1; i++) {
        const cp = cpChain[i];

        if (cpChain[i+1] === cp.next) {
            const key = getEdgeKey(cp, cp.next);
            if (seen.has(key)) {
                d -= length([0, 1], getMatCurveToNext(cp));
            } else {
                seen.add(key);
                d += length([0, 1], getMatCurveToNext(cp));
            }
        }

        depths.push(d);
    }

    return depths;
}


/**
 * The CpNodes whose mat curves form the fat branch's linear skeleton path,
 * ordered from its leaf tip to its other end (each skeleton edge exactly
 * once).
 */
function getSkeletonEdgeCps(fatBranch: FatBranch): CpNode[] {
    return getSkeletonEdgeCpPairs(fatBranch).map(pair => pair.out);
}


/**
 * Per skeleton edge of the fat branch's linear path (tip → other end): the
 * chain CpNode walking it on the outbound boundary side (`out`, in skeleton
 * direction) and the one walking it back on the other side (`back`, in
 * REVERSE skeleton direction).
 */
function getSkeletonEdgeCpPairs(
        fatBranch: FatBranch): { out: CpNode; back: CpNode }[] {

    const cpChain = rotateAtTip(closeChain(fatBranch.cpChain));
    const pairs: { out: CpNode; back: CpNode }[] = [];
    const edgeIdx = new Map<string, number>();

    for (let i = 0; i < cpChain.length - 1; i++) {
        const cp = cpChain[i];

        if (cpChain[i+1] === cp.next) {
            // Skip self-edges: steps between two contacts on the SAME circle
            // (leaf-tip caps) — boundary walks them once, and they are not
            // skeleton edges (zero-length mat curves).
            if (getCircleId(cp) === getCircleId(cp.next)) { continue; }

            const key = getEdgeKey(cp, cp.next);
            const idx = edgeIdx.get(key);
            if (idx === undefined) {
                edgeIdx.set(key, pairs.length);
                pairs.push({ out: cp, back: undefined! });
            } else {
                pairs[idx].back = cp;
            }
        }
    }

    return pairs;
}


/**
 * The fat branch's linear skeleton path as mat-curve beziers, ordered from
 * its leaf tip to its other end (each skeleton edge exactly once).
 */
function getSkeletonBeziers(fatBranch: FatBranch): number[][][] {
    return getSkeletonEdgeCps(fatBranch).map(cp => getMatCurveToNext(cp));
}


/**
 * The maximal-disk radius at each skeleton segment boundary of the fat
 * branch's linear skeleton path (`getSkeletonBeziers` order; length =
 * segment count + 1).
 */
function getSkeletonRadii(fatBranch: FatBranch): number[] {
    const cps = getSkeletonEdgeCps(fatBranch);
    if (cps.length === 0) { return []; }

    return [
        cps[0].pointOnShape.circle.radius,
        ...cps.map(cp => cp.next.pointOnShape.circle.radius)
    ];
}


/** Total skeleton length of a fat branch chain (each edge counted once). */
function getSkeletonLength(cpChain: CpNode[]): number {
    const seen = new Set<string>();
    let total = 0;

    for (let i = 0; i < cpChain.length - 1; i++) {
        const cp = cpChain[i];

        if (cpChain[i+1] === cp.next) {
            const key = getEdgeKey(cp, cp.next);
            if (!seen.has(key)) {
                seen.add(key);
                total += length([0, 1], getMatCurveToNext(cp));
            }
        }
    }

    return total;
}


/**
 * Direction-independent key of the skeleton edge between adjacent disks.
 */
function getEdgeKey(
        cp1: CpNode,
        cp2: CpNode): string {

    const id1 = getCircleId(cp1);
    const id2 = getCircleId(cp2);

    return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
}


function getCircleId(cp: CpNode): number {
    return Math.min(...getAllOnCircle(cp).map(c => c.id));
}


function dirAtStart(
        ps: number[][]): number[] {

    const p0 = ps[0];
    for (let i = 1; i < ps.length; i++) {
        const [x, y] = [ps[i][0] - p0[0], ps[i][1] - p0[1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];
}


function dirAtEnd(ps: number[][]): number[] {
    const pE = ps[ps.length - 1];
    for (let i = ps.length - 2; i >= 0; i--) {
        const [x, y] = [pE[0] - ps[i][0], pE[1] - ps[i][1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];
}


export {
    getFatBranchTree,
    getFattestCpNode,
    getSkeletonLength,
    getSkeletonBeziers,
    getSkeletonRadii,
    getSkeletonEdgeCpPairs
}
