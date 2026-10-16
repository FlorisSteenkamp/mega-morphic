// Copied (and modified a bit) from Ramda.js (https://ramdajs.com/)

const { isInteger } = Number;
const { isArray } = Array;


function assoc(
        key: string | number,
        val: any,
        obj: { [index: (string | number)]: any }) {

    if (isInteger(key) && isArray(obj)) {
        const arr = [...obj];
        arr[key as number] = val;

        return arr;
    }

    const result: { [index: (string | number)]: any } = {};
    for (const k in obj) {
        result[k] = obj[k];
    }

    result[key] = val;

    return result;
}


export { assoc }


// Quokka tests
// assoc('c', 5, { a: 1, b: 2 });
// assoc(0, 5, [1,2]);