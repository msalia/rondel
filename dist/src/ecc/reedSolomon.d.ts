/** Encodes data with Reed-Solomon error correction parity bytes. */
export declare function rsEncode(data: Uint8Array, eccBytes?: number): Uint8Array;
/** Decodes and corrects errors in a Reed-Solomon encoded message. */
export declare function rsDecode(received: Uint8Array, eccBytes?: number): Uint8Array;
