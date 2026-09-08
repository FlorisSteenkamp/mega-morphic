
function mapObj<T extends Object>(
        f: (o: T) => any,
        o: T) {

    const o_ = {};
    for (const k in o) {
        // @ts-ignore
        o_[k] = f(o[k]);
    }

    return o_;
}


export { mapObj }
