type CachedCanvas = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
};
/** Returns a cached canvas and context of the given size, creating one if needed. */
export declare function getOrCreateCanvas(size: number, key?: string, ctxOptions?: CanvasRenderingContext2DSettings): CachedCanvas;
export {};
