/** samples per glyph at the trunk level (sub-DTWs keep the same spacing) */
const TARGET_SAMPLES = 200;

/** sub-route candidates re-ranked by RECURSIVE cost (within margin of the
 *  DP-optimal) - a straight route + matched children can beat a zig-zag
 *  that merely covers more single-path material */
const MAX_RECURSE_CANDS = 4;
/** the cheap child-consistency estimate mis-ranks by up to ~0.5, and the
 *  DP keeps every tied route start (symmetric shapes), so the margin is
 *  wide enough that near-duplicates can't crowd the true winner out */
const CAND_MARGIN = 1.0;

/** trunk candidates given a full recursive evaluation (beam width) */
const TRUNK_RECURSE_CANDS = 16;

/** DP leaders given the cheap child-consistency re-rank, per level */
const TRUNK_CHEAP_CANDS = 64;
const SUB_CHEAP_CANDS = 16;


export {
    TARGET_SAMPLES, MAX_RECURSE_CANDS, CAND_MARGIN, TRUNK_RECURSE_CANDS,
    TRUNK_CHEAP_CANDS, SUB_CHEAP_CANDS
}
