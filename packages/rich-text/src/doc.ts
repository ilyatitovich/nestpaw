import type { TipTapDoc } from "./types.js";
import { TipTapDocSchema } from "./schema.js";

export const emptyDoc: TipTapDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function plainTextToDoc(text: string, title?: string): TipTapDoc {
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: line }],
    }));

  const content: TipTapDoc["content"] = [];
  if (title?.trim()) {
    content.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: title.trim() }],
    });
  }
  if (paragraphs.length) content.push(...paragraphs);
  else content.push({ type: "paragraph" });

  return { type: "doc", content };
}

function collectText(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") {
    out.push(n.text);
    return;
  }
  if (n.type === "hardBreak") {
    out.push("\n");
    return;
  }
  if (Array.isArray(n.content)) {
    for (const child of n.content) collectText(child, out);
    if (n.type === "paragraph" || n.type === "heading" || n.type === "listItem") {
      out.push("\n");
    }
  }
}

export function docToPlainText(doc: unknown): string {
  const parsed = TipTapDocSchema.safeParse(doc);
  if (!parsed.success) return "";
  const parts: string[] = [];
  collectText(parsed.data, parts);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function isEmptyDoc(doc: unknown): boolean {
  if (!doc) return true;
  const text = docToPlainText(doc);
  return text.length === 0;
}

export function parseTipTapDoc(value: unknown): TipTapDoc | null {
  const parsed = TipTapDocSchema.safeParse(value);
  return parsed.success ? (parsed.data as TipTapDoc) : null;
}
