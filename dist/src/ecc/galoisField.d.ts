/** Exponentiation lookup table for GF(256) arithmetic. */
export declare const EXP_TABLE: Uint8Array<ArrayBuffer>;
/** Logarithm lookup table for GF(256) arithmetic. */
export declare const LOG_TABLE: Uint8Array<ArrayBuffer>;
/** Multiplies two elements in GF(256). */
export declare function gfMul(a: number, b: number): number;
/** Divides two elements in GF(256). */
export declare function gfDiv(a: number, b: number): number;
/** Raises a GF(256) element to the given power. */
export declare function gfPow(a: number, n: number): number;
/** Returns the multiplicative inverse of a GF(256) element. */
export declare function gfInverse(a: number): number;
/** Multiplies two polynomials over GF(256). */
export declare function gfPolyMul(p: number[], q: number[]): number[];
/** Evaluates a GF(256) polynomial at a given point using Horner's method. */
export declare function gfPolyEval(poly: number[], x: number): number;
/** Scales all coefficients of a GF(256) polynomial by a scalar. */
export declare function gfPolyScale(poly: number[], scalar: number): number[];
/** Adds two polynomials over GF(256) via XOR. */
export declare function gfPolyAdd(p: number[], q: number[]): number[];
/** Builds the Reed-Solomon generator polynomial for a given number of ECC symbols. */
export declare function generatorPoly(nsym: number): number[];
