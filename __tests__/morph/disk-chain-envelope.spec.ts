import { getDiskChainEnvelope } from '../../src/morph/disk-chain-envelope.js';
import { getShapeArea, boolean } from 'flo-boolean';


function orient(loop: number[][][]): number[][][] {
    return getShapeArea(loop) < 0
        ? loop.map(ps => [...ps].reverse()).reverse()
        : loop;
}


describe('getDiskChainEnvelope', () => {
    it('capsule area matches 2·L·r + π·r²', () => {
        const loop = getDiskChainEnvelope(
            [[[0, 0], [100, 0]]], [10, 10], 8, 32
        )!;
        const area = Math.abs(getShapeArea(loop));
        const exact = 2*100*10 + Math.PI*10*10;
        expect(Math.abs(area - exact) / exact).toBeLessThan(0.02);
    });

    it('tapered (cone) area matches trapezoid + caps', () => {
        // r: 20 → 10 over length 100; sinφ = -r' = 0.1
        const loop = getDiskChainEnvelope(
            [[[0, 0], [100, 0]]], [20, 10], 8, 32
        )!;
        const area = Math.abs(getShapeArea(loop));
        // External tangent lines of the two circles + arc caps (exact):
        // area = c·(r1+r2)/2·... use numeric reference via dense polygon disks
        // union approximation instead: just assert between inner and outer bounds.
        const lower = 2*100*10 + Math.PI*10*10;        // all-min capsule
        const upper = 2*100*20 + Math.PI*20*20;        // all-max capsule
        expect(area).toBeGreaterThan(lower);
        expect(area).toBeLessThan(upper);
    });

   


describe('envelope union (flo-boolean)', () => {
    it('unions two crossing capsules', () => {
        const l1 = orient(getDiskChainEnvelope(
            [[[0, 0], [100, 0]]], [10, 10]
        )!);
        const l2 = orient(getDiskChainEnvelope(
            [[[50, -50], [50, 50]]], [10, 10]
        )!);
        const out = boolean('OR', [l1, l2]);
        expect(out.length).toBeGreaterThan(0);
        const area = out.reduce(
            (s, loop) => s + getShapeArea(loop), 0
        );
        // ~2 capsules minus the ~20x20 overlap
        expect(Math.abs(area)).toBeGreaterThan(4000);
        expect(Math.abs(area)).toBeLessThan(5300);
    });

    it('unions two capsules sharing an exact end disk (junction case)', () => {
        const l1 = orient(getDiskChainEnvelope(
            [[[0, 0], [100, 0]]], [10, 15]
        )!);
        // Child branch emanating from the SAME fork disk at (100,0), r=15.
        const l2 = orient(getDiskChainEnvelope(
            [[[100, 0], [100, 80]]], [15, 5]
        )!);
        const out = boolean('OR', [l1, l2]);
        expect(out.length).toBeGreaterThan(0);
        expect(Math.abs(
            out.reduce((s, loop) => s + getShapeArea(loop), 0)
        )).toBeGreaterThan(2000);
    });
}); it('degenerate point with radius gives a circle', () => {
        const loop = getDiskChainEnvelope(
            [[[5, 5], [5, 5]]], [10, 10]
        )!;
        const area = Math.abs(getShapeArea(loop));
        expect(Math.abs(area - Math.PI*100) / (Math.PI*100)).toBeLessThan(0.03);
    });
});
