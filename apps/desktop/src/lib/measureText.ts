/** The font the text layer is set in; measuring and drawing must use the same one. */
export const TEXT_LAYER_FONT = "sans-serif";

let context: CanvasRenderingContext2D | null | undefined;

/** The width of `text` set at 100 px in {@link TEXT_LAYER_FONT}, or null if it can't be measured. */
export function textWidthAt100px(text: string): number | null {
  if (context === undefined) {
    context = document.createElement("canvas").getContext("2d");
    if (context) context.font = `100px ${TEXT_LAYER_FONT}`;
  }
  if (!context) return null;
  const width = context.measureText(text).width;
  return width > 0 ? width : null;
}
