/* tslint:disable */
/* eslint-disable */

export function transform(src: string, opts?: Options): Promise<TransformOutput>;
export function transformSync(src: string, opts?: Options): TransformOutput;



interface Options {
    module?: boolean;
    filename?: string;
    mode?: Mode;
    sourceMap?: boolean;
}



type Mode = "strip-only" | "transform";



interface TransformOutput {
    code: string;
    map?: string;
}


