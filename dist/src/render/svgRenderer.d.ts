import type { EncodedCode } from "../types";
/** Options for customizing SVG rendering of a circular code. */
export type SVGRenderOptions = {
    size?: number;
    primary?: string;
    secondary?: string;
};
/** Renders an encoded circular code as an SVG string. */
export declare function renderSVG(code: EncodedCode, opts?: SVGRenderOptions | number): string;
