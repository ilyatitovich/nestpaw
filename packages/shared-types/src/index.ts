import { TipTapDocSchema } from "@online-store/rich-text";
import { z } from "zod";

export const LocaleSchema = z.enum(["en", "de"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const CurrencySchema = z.enum(["EUR", "USD", "GBP"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const UserRoleSchema = z.enum(["owner", "staff"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const OrderStatusSchema = z.enum([
  "pending_payment",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const StockPolicySchema = z.enum(["deny", "continue"]);
export type StockPolicy = z.infer<typeof StockPolicySchema>;

export const DiscountTypeSchema = z.enum([
  "percentage",
  "fixed_amount",
  "free_shipping",
]);
export type DiscountType = z.infer<typeof DiscountTypeSchema>;

export const MoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: CurrencySchema,
});
export type Money = z.infer<typeof MoneySchema>;

export const ProductTranslationSchema = z.object({
  locale: LocaleSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(10000).default(""),
  body: TipTapDocSchema.nullable().optional(),
  slug: z.string().min(1).max(200),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
});

export const ProductMediaInputSchema = z.object({
  url: z.string().url().max(2000),
  alt: z.string().max(200).default(""),
  position: z.number().int().nonnegative().default(0),
});

export const CreateProductSchema = z.object({
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  option1Name: z.string().max(50).optional(),
  option2Name: z.string().max(50).optional(),
  option3Name: z.string().max(50).optional(),
  translations: z.array(ProductTranslationSchema).min(1),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1).max(100),
        barcode: z.string().max(100).optional(),
        price: z.number().int().nonnegative(),
        compareAtPrice: z.number().int().nonnegative().optional(),
        option1: z.string().max(100).optional(),
        option2: z.string().max(100).optional(),
        option3: z.string().max(100).optional(),
        weightGrams: z.number().int().nonnegative().default(0),
        stock: z.number().int().nonnegative().default(0),
        stockPolicy: StockPolicySchema.default("deny"),
      }),
    )
    .min(1),
  metafields: z
    .array(
      z.object({
        namespace: z.string().min(1).max(50),
        key: z.string().min(1).max(50),
        type: z.enum(["string", "number", "boolean", "json"]),
        value: z.unknown(),
      }),
    )
    .optional(),
  collectionIds: z.array(z.string().cuid()).optional(),
  media: z.array(ProductMediaInputSchema).optional(),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  id: z.string().cuid().optional(),
});

export const AddToCartSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().positive().max(99).default(1),
});
export type AddToCartInput = z.infer<typeof AddToCartSchema>;

export const UpdateCartLineSchema = z.object({
  quantity: z.number().int().nonnegative().max(99),
});

export const ApplyDiscountSchema = z.object({
  code: z.string().min(1).max(50),
});

export const CheckoutAddressSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
  state: z.string().max(100).optional(),
});

export const CreateCheckoutSchema = z.object({
  shippingAddress: CheckoutAddressSchema,
  shippingRateId: z.string().cuid().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  locale: LocaleSchema.default("en"),
  currency: CurrencySchema.default("EUR"),
});
export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const CreateDiscountSchema = z.object({
  code: z.string().min(1).max(50),
  type: DiscountTypeSchema,
  value: z.number().int().nonnegative(),
  minSubtotal: z.number().int().nonnegative().default(0),
  usageLimit: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
});

export const CollectionTranslationInputSchema = z.object({
  locale: LocaleSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  slug: z.string().min(1).max(200),
});

export const CreateCollectionSchema = z.object({
  parentId: z.string().cuid().nullable().optional(),
  translations: z.array(CollectionTranslationInputSchema).min(1),
  productIds: z.array(z.string().cuid()).default([]),
});
export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>;

export const UpdateCollectionSchema = z.object({
  parentId: z.string().cuid().nullable().optional(),
  translations: z.array(CollectionTranslationInputSchema).min(1).optional(),
});
export type UpdateCollectionInput = z.infer<typeof UpdateCollectionSchema>;

export const SetCollectionProductsSchema = z.object({
  productIds: z.array(z.string().cuid()),
});
export type SetCollectionProductsInput = z.infer<
  typeof SetCollectionProductsSchema
>;

export const CreatePageSchema = z.object({
  status: z.enum(["draft", "published"]).default("draft"),
  translations: z
    .array(
      z.object({
        locale: LocaleSchema,
        title: z.string().min(1).max(200),
        slug: z.string().min(1).max(200),
        body: z.string().max(50000).default(""),
        seoTitle: z.string().max(200).optional(),
        seoDescription: z.string().max(500).optional(),
      }),
    )
    .min(1),
  blocks: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const CreateReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  authorName: z.string().min(1).max(100),
  authorEmail: z.string().email(),
});

export const SubscribeNewsletterSchema = z.object({
  email: z.string().email().max(320),
  locale: LocaleSchema.default("en"),
  turnstileToken: z.string().min(1).max(2048),
  /** Honeypot — must be empty when filled by bots. */
  company: z.string().max(200).optional().default(""),
});
export type SubscribeNewsletterInput = z.infer<
  typeof SubscribeNewsletterSchema
>;

export const CreateNewsletterCampaignSchema = z.object({
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(100_000),
  bodyText: z.string().max(100_000).optional(),
});
export type CreateNewsletterCampaignInput = z.infer<
  typeof CreateNewsletterCampaignSchema
>;

export const CustomerAuthIntentSchema = z.enum(["sign_in", "sign_up"]);
export type CustomerAuthIntent = z.infer<typeof CustomerAuthIntentSchema>;

export const CustomerOtpRequestSchema = z.object({
  email: z.string().email().max(320),
  turnstileToken: z.string().min(1).max(2048),
  locale: LocaleSchema.default("en"),
  intent: CustomerAuthIntentSchema.default("sign_in"),
});
export type CustomerOtpRequestInput = z.infer<typeof CustomerOtpRequestSchema>;

export const CustomerOtpVerifySchema = z.object({
  email: z.string().email().max(320),
  code: z.string().regex(/^\d{6}$/),
  marketingOptIn: z.boolean().optional().default(false),
  locale: LocaleSchema.default("en"),
});
export type CustomerOtpVerifyInput = z.infer<typeof CustomerOtpVerifySchema>;

const PersonNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[\p{L}]+(?:[\s'.-][\p{L}]+)*$/u);

export const CustomerProfileUpdateSchema = z.object({
  firstName: PersonNameSchema.optional(),
  lastName: PersonNameSchema.optional(),
});
export type CustomerProfileUpdateInput = z.infer<
  typeof CustomerProfileUpdateSchema
>;

export const AnalyticsEventSchema = z.object({
  name: z.enum([
    "view_item",
    "add_to_cart",
    "begin_checkout",
    "purchase",
    "search",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
  locale: LocaleSchema.optional(),
  sessionId: z.string().max(100).optional(),
});

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  code: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
