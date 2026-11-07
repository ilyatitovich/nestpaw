export type TipTapMarkType = "bold" | "italic" | "link";

export type TipTapMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string; target?: string | null } };

export type TipTapTextNode = {
  type: "text";
  text: string;
  marks?: TipTapMark[];
};

export type TipTapHardBreak = { type: "hardBreak" };

export type TipTapInline = TipTapTextNode | TipTapHardBreak;

export type TipTapParagraph = {
  type: "paragraph";
  content?: TipTapInline[];
};

export type TipTapHeading = {
  type: "heading";
  attrs: { level: 2 | 3 };
  content?: TipTapInline[];
};

export type TipTapListItem = {
  type: "listItem";
  content?: Array<TipTapParagraph | TipTapBulletList | TipTapOrderedList>;
};

export type TipTapBulletList = {
  type: "bulletList";
  content?: TipTapListItem[];
};

export type TipTapOrderedList = {
  type: "orderedList";
  content?: TipTapListItem[];
};

export type TipTapBlock =
  | TipTapParagraph
  | TipTapHeading
  | TipTapBulletList
  | TipTapOrderedList;

export type TipTapDoc = {
  type: "doc";
  content?: TipTapBlock[];
};
