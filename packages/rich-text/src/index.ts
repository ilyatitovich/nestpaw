export type {
  TipTapBlock,
  TipTapBulletList,
  TipTapDoc,
  TipTapHardBreak,
  TipTapHeading,
  TipTapInline,
  TipTapListItem,
  TipTapMark,
  TipTapMarkType,
  TipTapOrderedList,
  TipTapParagraph,
  TipTapTextNode,
} from "./types.js";

export { TipTapDocSchema, type TipTapDocInput } from "./schema.js";
export {
  docToPlainText,
  emptyDoc,
  isEmptyDoc,
  parseTipTapDoc,
  plainTextToDoc,
} from "./doc.js";
