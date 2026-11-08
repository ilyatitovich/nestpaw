import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AnalyticsModule } from "./modules/analytics/analytics.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CartModule } from "./modules/cart/cart.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { CheckoutModule } from "./modules/checkout/checkout.module.js";
import { CmsModule } from "./modules/cms/cms.module.js";
import { CustomerAuthModule } from "./modules/customer-auth/customer-auth.module.js";
import { CustomersModule } from "./modules/customers/customers.module.js";
import { DiscountsModule } from "./modules/discounts/discounts.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { NewsletterModule } from "./modules/newsletter/newsletter.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";
import { PaymentsModule } from "./modules/payments/payments.module.js";
import { ReturnsModule } from "./modules/returns/returns.module.js";
import { ReviewsModule } from "./modules/reviews/reviews.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { ShippingModule } from "./modules/shipping/shipping.module.js";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module.js";
import { TaxModule } from "./modules/tax/tax.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo: nest may start from apps/api; env lives at repo root.
      envFilePath: [".env", "../../.env"],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    InventoryModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    CustomersModule,
    CustomerAuthModule,
    DiscountsModule,
    ShippingModule,
    TaxModule,
    PaymentsModule,
    MediaModule,
    CmsModule,
    SettingsModule,
    NotificationsModule,
    NewsletterModule,
    AnalyticsModule,
    ReviewsModule,
    ReturnsModule,
    SubscriptionsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
