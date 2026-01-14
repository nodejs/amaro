
const kWebAssemblyObjNotAvailable = Symbol.for('amaro.error.AMARO_ERR_WEB_ASSEMBLY_OBJ_NOT_AVAILABLE')
export class WebAssemblyObjectNotAvailable extends Error {
    constructor() {
        super('WebAssembly global object is not available, but it is required to run Amaro (Node.js TypeScript library). This can happen, for example, when running V8 in JIT-less mode.');
        this.name = 'WebAssemblyObjectNotAvailable';
        this.code = 'AMARO_ERR_WEB_ASSEMBLY_OBJ_NOT_AVAILABLE';
    }

    static [Symbol.hasInstance](instance) {
        return instance && instance[kWebAssemblyObjNotAvailable] === true
    }

    get [kWebAssemblyObjNotAvailable]() {
        return true
    }
}
