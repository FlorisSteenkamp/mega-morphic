
// Colors (from style.css) cycled through to give each matched branch pair the
// same colour on both shapes. 'red' and 'green' are reserved for the morph's
// deleted (retracting) and inserted (growing) branches respectively - so no
// red-looking (reddish) or light green colors here.
const matchColors = [
    'purple', 'orange', 'blue', 'pink', 'cyan', 'deeppink', 'brown',
    'darkgreen', 'yellow', 'navy', 'olive', 'skyblue', 'pinker', 'blueviolet',
    'slate',
];


/**
 * Returns the color of the matched pair with the given DFS-preorder index
 * (`pairsOf`) in the match and morph views.
 *
 * * the trunk (index `0`) alone gets the first color - the others cycle
 *   through the rest, so no branch is ever mistaken for the trunk
 */
function getMatchColor(idx: number): string {
    return idx === 0
        ? matchColors[0]
        : matchColors[1 + (idx - 1) % (matchColors.length - 1)];
}


export { getMatchColor }
