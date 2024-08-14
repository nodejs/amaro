/* tslint:disable */
/* eslint-disable */

export declare function transform(src: string, opts?: Options): Promise<TransformOutput>;
export declare function transformSync(src: string, opts?: Options): TransformOutput;
export type { Options, TransformOutput };



interface Options {
    module?: boolean;
    filename?: string;
    mode?: Mode;
    transform?; TransformConfig;
    sourceMap?: boolean;
}

interface TransformConfig {
    verbatimModuleSyntax?: boolean;
    importNotUsedAsValues?: "remove" | "preserve";
    noEmptyExport?: boolean;
    importExportAssignConfig?: "Classic" | "Preserve" | "NodeNext" | "EsNext";
    tsEnumIsMutable?: boolean;
}



type Mode = "strip-only" | "transform";



interface TransformOutput {
    code: string;
    map?: string;
}


