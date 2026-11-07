import { z } from "zod";

const MarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      href: z.string().min(1).max(2000),
      target: z.string().max(50).nullable().optional(),
    }),
  }),
]);

const TextNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(20000),
  marks: z.array(MarkSchema).max(8).optional(),
});

const HardBreakSchema = z.object({ type: z.literal("hardBreak") });

const InlineSchema = z.union([TextNodeSchema, HardBreakSchema]);

const ParagraphSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.literal("paragraph"),
    content: z.array(InlineSchema).max(500).optional(),
  }),
);

const HeadingSchema = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: z.array(InlineSchema).max(200).optional(),
});

const ListItemSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.literal("listItem"),
    content: z
      .array(z.union([ParagraphSchema, BulletListSchema, OrderedListSchema]))
      .max(50)
      .optional(),
  }),
);

const BulletListSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.literal("bulletList"),
    content: z.array(ListItemSchema).max(100).optional(),
  }),
);

const OrderedListSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.literal("orderedList"),
    content: z.array(ListItemSchema).max(100).optional(),
  }),
);

const BlockSchema = z.union([
  ParagraphSchema,
  HeadingSchema,
  BulletListSchema,
  OrderedListSchema,
]);

export const TipTapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(BlockSchema).max(200).optional(),
});

export type TipTapDocInput = z.infer<typeof TipTapDocSchema>;
