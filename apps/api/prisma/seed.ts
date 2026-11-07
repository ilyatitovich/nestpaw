import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: process.env.ADMIN_NAME ?? "Store Owner",
      role: "owner",
    },
    update: { passwordHash, role: "owner" },
  });

  await prisma.taxRate.upsert({
    where: { country: "DE" },
    create: { country: "DE", name: "Germany VAT", rateBps: 1900 },
    update: {},
  });
  await prisma.taxRate.upsert({
    where: { country: "AT" },
    create: { country: "AT", name: "Austria VAT", rateBps: 2000 },
    update: {},
  });

  const zone = await prisma.shippingZone.upsert({
    where: { id: "seed-eu-zone" },
    create: {
      id: "seed-eu-zone",
      name: "EU",
      countries: ["DE", "AT", "FR", "NL", "BE"],
      rates: {
        create: [
          { name: "Standard", price: 499, minWeightGrams: 0 },
          { name: "Express", price: 999, minWeightGrams: 0 },
        ],
      },
    },
    update: {},
    include: { rates: true },
  });

  await prisma.discountCode.upsert({
    where: { code: "WELCOME10" },
    create: {
      code: "WELCOME10",
      type: "percentage",
      value: 10,
      minSubtotal: 0,
      active: true,
    },
    update: {},
  });

  await prisma.currencyRate.upsert({
    where: { code: "USD" },
    create: { code: "USD", rateToEur: 1.08 },
    update: { rateToEur: 1.08 },
  });
  await prisma.currencyRate.upsert({
    where: { code: "GBP" },
    create: { code: "GBP", rateToEur: 0.86 },
    update: { rateToEur: 0.86 },
  });

  const existing = await prisma.product.findFirst({
    where: { translations: { some: { slug: "ceramic-mug" } } },
  });

  if (!existing) {
    const product = await prisma.product.create({
      data: {
        status: "active",
        option1Name: "Color",
        translations: {
          create: [
            {
              locale: "en",
              title: "Ceramic Mug",
              description: "A sturdy everyday mug with a matte glaze.",
              slug: "ceramic-mug",
              seoTitle: "Ceramic Mug",
              seoDescription: "Buy our ceramic mug",
            },
            {
              locale: "de",
              title: "Keramiktasse",
              description: "Eine robuste Tasse mit matter Glasur.",
              slug: "keramiktasse",
              seoTitle: "Keramiktasse",
              seoDescription: "Kaufen Sie unsere Keramiktasse",
            },
          ],
        },
        variants: {
          create: [
            {
              sku: "MUG-WHT",
              price: 1899,
              option1: "White",
              weightGrams: 350,
              inventory: { create: { quantity: 50, policy: "deny" } },
            },
            {
              sku: "MUG-BLK",
              price: 1899,
              option1: "Black",
              weightGrams: 350,
              inventory: { create: { quantity: 40, policy: "deny" } },
            },
          ],
        },
        metafields: {
          create: [
            {
              namespace: "details",
              key: "material",
              type: "string",
              value: "stoneware",
            },
          ],
        },
        media: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1514228742587-6b1554078585?w=800",
              alt: "Ceramic mug",
              position: 0,
            },
          ],
        },
      },
    });

    const collection = await prisma.collection.create({
      data: {
        translations: {
          create: [
            {
              locale: "en",
              title: "Home",
              slug: "home",
              description: "Everyday essentials",
            },
            {
              locale: "de",
              title: "Zuhause",
              slug: "zuhause",
              description: "Alltagsessentials",
            },
          ],
        },
        products: { create: [{ productId: product.id, position: 0 }] },
      },
    });

    await prisma.page.create({
      data: {
        status: "published",
        blocks: [
          {
            type: "hero",
            headline: "Quiet goods for daily rituals",
            cta: { label: "Shop now", href: "/en/collections/home" },
          },
          { type: "featured_collection", collectionId: collection.id },
        ],
        translations: {
          create: [
            {
              locale: "en",
              title: "Home",
              slug: "home",
              body: "Welcome to our store.",
              seoTitle: "Online Store",
              seoDescription: "Small-batch goods for everyday life",
            },
            {
              locale: "de",
              title: "Startseite",
              slug: "home",
              body: "Willkommen in unserem Shop.",
              seoTitle: "Online Store",
              seoDescription: "Kleine Serien für den Alltag",
            },
          ],
        },
      },
    });

    await prisma.menu.upsert({
      where: { handle: "main" },
      create: {
        handle: "main",
        title: "Main",
        items: {
          create: [
            { title: "Shop", url: "/en/collections/home", position: 0 },
            { title: "About", url: "/en/pages/about", position: 1 },
          ],
        },
      },
      update: {},
    });

    await prisma.page.create({
      data: {
        status: "published",
        blocks: [],
        translations: {
          create: [
            {
              locale: "en",
              title: "About",
              slug: "about",
              body: "We make durable goods for everyday use.",
            },
            {
              locale: "de",
              title: "Über uns",
              slug: "about",
              body: "Wir fertigen langlebige Alltagsprodukte.",
            },
          ],
        },
      },
    });

    await prisma.page.create({
      data: {
        status: "published",
        blocks: [],
        translations: {
          create: [
            {
              locale: "en",
              title: "Privacy",
              slug: "privacy",
              body: "We process order data to fulfill purchases. Contact us to export or delete your data.",
            },
            {
              locale: "de",
              title: "Datenschutz",
              slug: "privacy",
              body: "Wir verarbeiten Bestelldaten zur Abwicklung. Kontaktieren Sie uns für Auskunft oder Löschung.",
            },
          ],
        },
      },
    });
  }

  console.log("Seed complete. Admin:", email, "Shipping zone:", zone.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
