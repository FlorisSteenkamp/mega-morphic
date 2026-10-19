
/**
 * A 'dual-map' in the sense that it needs two ordered keys to return one 
 * value.
 */
type DualMap<K,L,V> = Map<K,Map<L,V>>;


/**
 * Get a value from the dual-map.
 * @param map 
 * @param k 
 * @param l 
 */
function get<K,L,V>(
        map: DualMap<K,L,V>,
        k: K,
        l: L): V | undefined {

    let lMap = map.get(k);
    if (lMap === undefined) { return undefined; }

    return lMap.get(l);
}


/**
 * Set a value in the dual-map.
 * * destructively sets the value
 * @param map 
 * @param k 
 * @param l 
 * @param v 
 */
function set<K,L,V>(
        map: DualMap<K,L,V>,
        k: K,
        l: L,
        v: V): void {

    let lMap = map.get(k);
    if (lMap === undefined) {
        lMap = new Map();
        map.set(k, lMap);
    }
    lMap.set(l, v);
}


/**
 * Get a value from the dual-map; if absent, first set it to the given
 * default (which is evaluated eagerly - see `getOrInsertComputed` for
 * expensive defaults).
 * @param map
 * @param k
 * @param l
 * @param v
 */
function getOrInsert<K,L,V>(
        map: DualMap<K,L,V>,
        k: K,
        l: L,
        v: V): V {

    return map.getOrInsertComputed(k, () => new Map())
        .getOrInsert(l, v);
}


/**
 * Get a value from the dual-map; if absent, first compute it (calling
 * `f` only then) and set it.
 * @param map
 * @param k
 * @param l
 * @param f
 */
function getOrInsertComputed<K,L,V>(
        map: DualMap<K,L,V>,
        k: K,
        l: L,
        f: () => V): V {

    return map.getOrInsertComputed(k, () => new Map())
        .getOrInsertComputed(l, f);
}


const DualMapFs = {
    get, set, getOrInsert, getOrInsertComputed
}


export { DualMap, DualMapFs }
