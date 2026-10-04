
/**
 * The type of the (possibly nested, dot-separated) property at path `K` of `T`.
 */
type PathValue<T, K extends string> =
    K extends `${infer H}.${infer R}`
        ? H extends keyof T ? PathValue<T[H], R> : never
        : K extends keyof T ? T[K] : never;


/**
 * An object type guaranteed to have the (possibly nested, dot-separated)
 * property path `K` (with value of type `V`).
 */
type HasPath<K extends string, V = unknown> =
    K extends `${infer H}.${infer R}`
        ? { [P in H]: HasPath<R, V> }
        : { [P in K]: V };


/**
 * Compiles a literal function 'obj => obj.propertyName' dynamically
 *
 * * `key` may be a dot-separated path, e.g. `'seg.skelPss'`
 * * use only once per key to optimize for speed, i.e. don't call
 *   `fastPluck('key')(obj)` each time, rather create the function once with
 *   `const f = fastPluck('key')` and call `f(obj)` as needed
 */
function fastPluck<K extends string>(
        key: K) {

    return new Function('obj', `return obj${key ? `.${key}` : ''};`) as
        <T extends HasPath<K>>(obj: T) => PathValue<T, K>;
}


export { fastPluck }
export type { HasPath, PathValue }
