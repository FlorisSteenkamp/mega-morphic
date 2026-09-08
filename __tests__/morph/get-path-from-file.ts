import * as fs from 'fs';
import { getPathsFromStr } from 'flo-boolean';


function getPathFromFile(
        fileName: string) {

    let fileStr = fs.readFileSync(
        `c:/projects/morph/html/vectors/${fileName}.svg`, 'utf8'
    );

    let svgStr = fileStr.match(/d="[^"]*"/)![0];
    svgStr = svgStr.substring(3, svgStr.length-1);

    return getPathsFromStr(svgStr);
}


export { getPathFromFile }
