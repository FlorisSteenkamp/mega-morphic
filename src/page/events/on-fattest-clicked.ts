// import type { PageData } from '../page-data.js';
// import { drawFs } from 'flo-draw';
// import { getFattestBranch } from '../../morph/fat-branch/get-fattest-branch.js';
// import { getChainMatCurves } from '../../morph/fat-branch/get-chain-mat-curves.js';


// function onFattestClicked(
//         refPageData: React.RefObject<PageData | null>) {

//     const { props, svgRef1 } = refPageData.current!;
//     const { pageState } = props;
//     const { showDelay } = pageState;
//     const { mats1 } = pageState.deduced;

//     const fattest = getFattestBranch(mats1[0].cpNode);
//     if (fattest === undefined) { return; }

//     const g = svgRef1.current!.getElementsByTagName('g')[0];
//     fattest.pss.forEach(ps => {
//         drawFs.bezier(g, ps, 'thin20 red nofill', showDelay);
//     });
//     getChainMatCurves(fattest.cpChain).forEach(ps => {
//         drawFs.bezier(g, ps, 'thin2 blue nofill', showDelay);
//     });
// }


// export { onFattestClicked }
