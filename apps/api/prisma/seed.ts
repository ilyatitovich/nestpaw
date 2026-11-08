import { plainTextToDoc } from "@online-store/rich-text";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type LocalePair = {
  en: { title: string; slug: string; description: string };
  de: { title: string; slug: string; description: string };
};

type SeedProduct = {
  sku: string;
  price: number;
  stock: number;
  option1Name?: string;
  variants?: {
    sku: string;
    price: number;
    stock: number;
    option1: string;
    weightGrams?: number;
  }[];
  weightGrams?: number;
  image: string;
  alt: string;
  species: "dog" | "cat" | "small_pet";
  lifeStage: "puppy_kitten" | "adult" | "senior" | "all";
  productType: string;
  sizeClass: string;
  collections: string[];
  translations: LocalePair;
};

const IMG = {
  dogFood:
    "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=800&q=80",
  dogTreats:
    "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&q=80",
  dogToy:
    "https://images.unsplash.com/photo-1535294435445-d7249524ef2e?w=800&q=80",
  dogBed:
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80",
  dogCare:
    "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&q=80",
  dogBowl:
    "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&q=80",
  catFood:
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&q=80",
  catTreats:
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80",
  catToy:
    "https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=800&q=80",
  litter:
    "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800&q=80",
  catCare:
    "https://images.unsplash.com/photo-1495360010541-f023898ee6e0?w=800&q=80",
  smallFood:
    "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800&q=80",
  habitat:
    "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=800&q=80",
  leash:
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80",
  scratch:
    "https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=800&q=80",
  heroDog:
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1600&q=80",
};

const IMG_POOL = Object.values(IMG).filter((url) => !url.includes("w=1600"));

function mediaForProduct(primary: string, alt: string) {
  const extras = IMG_POOL.filter((url) => url !== primary).slice(0, 2);
  return [primary, ...extras].map((url, position) => ({
    url,
    alt: position === 0 ? alt : `${alt} (${position + 1})`,
    position,
  }));
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: process.env.ADMIN_NAME ?? "Nestpaw Owner",
      role: "owner",
    },
    update: {
      passwordHash,
      role: "owner",
      name: process.env.ADMIN_NAME ?? "Nestpaw Owner",
    },
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

  // Ensure free-shipping-friendly standard rate exists if zone already seeded
  if (zone.rates.length === 0) {
    await prisma.shippingRate.createMany({
      data: [
        { zoneId: zone.id, name: "Standard", price: 499, minWeightGrams: 0 },
        { zoneId: zone.id, name: "Express", price: 999, minWeightGrams: 0 },
      ],
    });
  }

  await prisma.discountCode.upsert({
    where: { code: "WELCOME10" },
    create: {
      code: "WELCOME10",
      type: "percentage",
      value: 10,
      minSubtotal: 0,
      active: true,
    },
    update: { active: true },
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

  // Clear demo catalog for idempotent re-seed of Nestpaw assortment
  await prisma.review.deleteMany({});
  await prisma.collectionProduct.deleteMany({});
  await prisma.productMedia.deleteMany({});
  await prisma.metafield.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.cartLine.deleteMany({});
  await prisma.orderLine.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productTranslation.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.collectionTranslation.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.pageTranslation.deleteMany({});
  await prisma.page.deleteMany({});

  async function createCollection(parentId: string | null, pair: LocalePair) {
    return prisma.collection.create({
      data: {
        parentId,
        translations: {
          create: [
            {
              locale: "en",
              title: pair.en.title,
              slug: pair.en.slug,
              description: pair.en.description,
            },
            {
              locale: "de",
              title: pair.de.title,
              slug: pair.de.slug,
              description: pair.de.description,
            },
          ],
        },
      },
    });
  }

  const dogs = await createCollection(null, {
    en: {
      title: "Dogs",
      slug: "dogs",
      description: "Food, toys, and care for dogs.",
    },
    de: {
      title: "Hunde",
      slug: "hunde",
      description: "Futter, Spielzeug und Pflege für Hunde.",
    },
  });
  const cats = await createCollection(null, {
    en: {
      title: "Cats",
      slug: "cats",
      description: "Food, litter, and play for cats.",
    },
    de: {
      title: "Katzen",
      slug: "katzen",
      description: "Futter, Streu und Spiel für Katzen.",
    },
  });
  const smallPets = await createCollection(null, {
    en: {
      title: "Small pets",
      slug: "small-pets",
      description: "Essentials for rabbits, guinea pigs, and more.",
    },
    de: {
      title: "Kleintiere",
      slug: "kleintiere",
      description: "Essentials für Kaninchen, Meerschweinchen und mehr.",
    },
  });

  const childDefs: { parentId: string; pair: LocalePair; key: string }[] = [
    {
      key: "dog-food",
      parentId: dogs.id,
      pair: {
        en: {
          title: "Dog food",
          slug: "dog-food",
          description: "Dry and wet food for every life stage.",
        },
        de: {
          title: "Hundefutter",
          slug: "hundefutter",
          description: "Trocken- und Nassfutter für jede Lebensphase.",
        },
      },
    },
    {
      key: "dog-treats",
      parentId: dogs.id,
      pair: {
        en: {
          title: "Dog treats",
          slug: "dog-treats",
          description: "Training rewards and everyday snacks.",
        },
        de: {
          title: "Hundeleckerlis",
          slug: "hundeleckerlis",
          description: "Trainingssnacks und Alltagslleckerleis.",
        },
      },
    },
    {
      key: "dog-toys",
      parentId: dogs.id,
      pair: {
        en: {
          title: "Dog toys",
          slug: "dog-toys",
          description: "Fetch, chew, and enrichment toys.",
        },
        de: {
          title: "Hundespielzeug",
          slug: "hundespielzeug",
          description: "Apportier-, Kau- und Beschäftigungsspielzeug.",
        },
      },
    },
    {
      key: "dog-care",
      parentId: dogs.id,
      pair: {
        en: {
          title: "Dog care",
          slug: "dog-care",
          description: "Grooming and everyday care.",
        },
        de: {
          title: "Hundepflege",
          slug: "hundepflege",
          description: "Fellpflege und Alltagsversorgung.",
        },
      },
    },
    {
      key: "dog-beds-travel",
      parentId: dogs.id,
      pair: {
        en: {
          title: "Beds & travel",
          slug: "dog-beds-travel",
          description: "Beds, leashes, and on-the-go gear.",
        },
        de: {
          title: "Betten & Reisen",
          slug: "hundebetten-reisen",
          description: "Betten, Leinen und Reisezubehör.",
        },
      },
    },
    {
      key: "cat-food",
      parentId: cats.id,
      pair: {
        en: {
          title: "Cat food",
          slug: "cat-food",
          description: "Wet and dry nutrition for cats.",
        },
        de: {
          title: "Katzenfutter",
          slug: "katzenfutter",
          description: "Nass- und Trockennahrung für Katzen.",
        },
      },
    },
    {
      key: "cat-treats",
      parentId: cats.id,
      pair: {
        en: {
          title: "Cat treats",
          slug: "cat-treats",
          description: "Lickables and crunchy rewards.",
        },
        de: {
          title: "Katzenleckerlis",
          slug: "katzenleckerlis",
          description: "Creme-Snacks und knusprige Belohnungen.",
        },
      },
    },
    {
      key: "cat-toys",
      parentId: cats.id,
      pair: {
        en: {
          title: "Cat toys",
          slug: "cat-toys",
          description: "Wands, balls, and scratchers.",
        },
        de: {
          title: "Katzenspielzeug",
          slug: "katzenspielzeug",
          description: "Angel, Bälle und Kratzmöbel.",
        },
      },
    },
    {
      key: "litter-toilets",
      parentId: cats.id,
      pair: {
        en: {
          title: "Litter & toilets",
          slug: "litter-toilets",
          description: "Litter and litter boxes.",
        },
        de: {
          title: "Streu & Toiletten",
          slug: "streu-toiletten",
          description: "Katzenstreu und Katzenklos.",
        },
      },
    },
    {
      key: "cat-care",
      parentId: cats.id,
      pair: {
        en: {
          title: "Cat care",
          slug: "cat-care",
          description: "Brushes, shampoo, and wellness basics.",
        },
        de: {
          title: "Katzenpflege",
          slug: "katzenpflege",
          description: "Bürsten, Shampoo und Wellness-Basics.",
        },
      },
    },
    {
      key: "small-pet-food",
      parentId: smallPets.id,
      pair: {
        en: {
          title: "Small pet food",
          slug: "small-pet-food",
          description: "Pellets, hay, and fresh mixes.",
        },
        de: {
          title: "Kleintierfutter",
          slug: "kleintierfutter",
          description: "Pellets, Heu und Frischmischungen.",
        },
      },
    },
    {
      key: "small-pet-habitat",
      parentId: smallPets.id,
      pair: {
        en: {
          title: "Habitat",
          slug: "small-pet-habitat",
          description: "Bedding, hideouts, and cages.",
        },
        de: {
          title: "Habitat",
          slug: "kleintier-habitat",
          description: "Einstreu, Verstecke und Gehege.",
        },
      },
    },
  ];

  const collectionByKey: Record<string, string> = {
    dogs: dogs.id,
    cats: cats.id,
    "small-pets": smallPets.id,
  };
  for (const child of childDefs) {
    const c = await createCollection(child.parentId, child.pair);
    collectionByKey[child.key] = c.id;
  }

  const products: SeedProduct[] = [
    {
      sku: "DOG-DRY-2KG",
      price: 2499,
      stock: 40,
      option1Name: "Size",
      variants: [
        {
          sku: "DOG-DRY-2KG",
          price: 2499,
          stock: 40,
          option1: "2 kg",
          weightGrams: 2000,
        },
        {
          sku: "DOG-DRY-5KG",
          price: 4999,
          stock: 25,
          option1: "5 kg",
          weightGrams: 5000,
        },
      ],
      image: IMG.dogFood,
      alt: "Dog dry food bag",
      species: "dog",
      lifeStage: "adult",
      productType: "food",
      sizeClass: "m",
      collections: ["dogs", "dog-food"],
      translations: {
        en: {
          title: "Meadow Adult Dry Food",
          slug: "meadow-adult-dry-food",
          description:
            "Balanced chicken & rice kibble for adult dogs. Complete daily nutrition with omega oils for coat health.",
        },
        de: {
          title: "Wiesen Adult Trockenfutter",
          slug: "wiesen-adult-trockenfutter",
          description:
            "Ausgewogenes Huhn-Reis-Krokettenfutter für ausgewachsene Hunde. Mit Omega-Ölen für das Fell.",
        },
      },
    },
    {
      sku: "DOG-PUP-2KG",
      price: 2699,
      stock: 30,
      image: IMG.dogFood,
      alt: "Puppy dry food",
      species: "dog",
      lifeStage: "puppy_kitten",
      productType: "food",
      sizeClass: "s",
      collections: ["dogs", "dog-food"],
      translations: {
        en: {
          title: "Meadow Puppy Starter",
          slug: "meadow-puppy-starter",
          description:
            "Small-bite puppy formula with DHA for growing dogs from weaning to 12 months.",
        },
        de: {
          title: "Wiesen Welpen Starter",
          slug: "wiesen-welpen-starter",
          description:
            "Welpenformel mit kleinen Kroketten und DHA — vom Absetzen bis 12 Monate.",
        },
      },
    },
    {
      sku: "DOG-WET-6",
      price: 1599,
      stock: 50,
      image: IMG.dogFood,
      alt: "Dog wet food trays",
      species: "dog",
      lifeStage: "all",
      productType: "food",
      sizeClass: "na",
      collections: ["dogs", "dog-food"],
      translations: {
        en: {
          title: "River Pack Wet Food (6×)",
          slug: "river-pack-wet-food",
          description:
            "Grain-free wet trays with salmon and vegetables. Ideal as a complete meal or mixer.",
        },
        de: {
          title: "Fluss Pack Nassfutter (6×)",
          slug: "fluss-pack-nassfutter",
          description:
            "Getreidefreie Schalen mit Lachs und Gemüse. Als Alleinfutter oder Mixer.",
        },
      },
    },
    {
      sku: "DOG-TRT-CHICK",
      price: 799,
      stock: 80,
      image: IMG.dogTreats,
      alt: "Dog training treats",
      species: "dog",
      lifeStage: "all",
      productType: "treats",
      sizeClass: "na",
      collections: ["dogs", "dog-treats"],
      translations: {
        en: {
          title: "Click Soft Training Bites",
          slug: "click-soft-training-bites",
          description:
            "Soft chicken bites sized for pocket training. Low calorie, high motivation.",
        },
        de: {
          title: "Click Soft Trainingshappen",
          slug: "click-soft-trainingshappen",
          description:
            "Weiche Hühnerhappen für die Hosentasche. Kalorienarm, stark motivierend.",
        },
      },
    },
    {
      sku: "DOG-TRT-CHEW",
      price: 1299,
      stock: 45,
      image: IMG.dogTreats,
      alt: "Natural dog chew",
      species: "dog",
      lifeStage: "adult",
      productType: "treats",
      sizeClass: "l",
      collections: ["dogs", "dog-treats"],
      translations: {
        en: {
          title: "Long Chew Antler Slice",
          slug: "long-chew-antler-slice",
          description:
            "Naturally shed antler slice for long-lasting chewing sessions.",
        },
        de: {
          title: "Long Chew Geweihscheibe",
          slug: "long-chew-geweihscheibe",
          description: "Natürlich abgeworfenes Geweih für lange Kausessions.",
        },
      },
    },
    {
      sku: "DOG-TOY-BALL",
      price: 999,
      stock: 60,
      image: IMG.dogToy,
      alt: "Rubber fetch ball",
      species: "dog",
      lifeStage: "all",
      productType: "toys",
      sizeClass: "m",
      collections: ["dogs", "dog-toys"],
      translations: {
        en: {
          title: "Bounce Fetch Ball",
          slug: "bounce-fetch-ball",
          description:
            "Natural rubber ball with grippy texture for park fetch and tug.",
        },
        de: {
          title: "Bounce Apportierball",
          slug: "bounce-apportierball",
          description: "Naturgummiball mit Grip für Park und Zerrspiele.",
        },
      },
    },
    {
      sku: "DOG-TOY-ROPE",
      price: 1199,
      stock: 55,
      image: IMG.dogToy,
      alt: "Dog rope toy",
      species: "dog",
      lifeStage: "all",
      productType: "toys",
      sizeClass: "m",
      collections: ["dogs", "dog-toys"],
      translations: {
        en: {
          title: "Knot Rope Tug",
          slug: "knot-rope-tug",
          description:
            "Cotton rope tug that doubles as a gentle teeth cleaner.",
        },
        de: {
          title: "Knoten-Seil Zerrspielzeug",
          slug: "knoten-seil-zerrspielzeug",
          description: "Baumwollseil zum Ziehen — pflegt nebenbei die Zähne.",
        },
      },
    },
    {
      sku: "DOG-BRUSH",
      price: 1499,
      stock: 35,
      image: IMG.dogCare,
      alt: "Dog grooming brush",
      species: "dog",
      lifeStage: "all",
      productType: "care",
      sizeClass: "na",
      collections: ["dogs", "dog-care"],
      translations: {
        en: {
          title: "Coat Calm Deshedding Brush",
          slug: "coat-calm-deshedding-brush",
          description:
            "Gentle undercoat rake for seasonal sheds without scratching skin.",
        },
        de: {
          title: "Coat Calm Entfilzungsbürste",
          slug: "coat-calm-entfilzungsbuerste",
          description:
            "Sanfter Unterwollkamm für den Fellwechsel ohne Hautkratzen.",
        },
      },
    },
    {
      sku: "DOG-SHAMPOO",
      price: 1099,
      stock: 40,
      image: IMG.dogCare,
      alt: "Dog shampoo bottle",
      species: "dog",
      lifeStage: "all",
      productType: "care",
      sizeClass: "na",
      collections: ["dogs", "dog-care"],
      translations: {
        en: {
          title: "Soft Paw Oatmeal Shampoo",
          slug: "soft-paw-oatmeal-shampoo",
          description:
            "Tear-free oatmeal wash for sensitive skin. Light meadow scent.",
        },
        de: {
          title: "Soft Paw Hafer-Shampoo",
          slug: "soft-paw-hafer-shampoo",
          description:
            "Tränenfreies Hafer-Shampoo für empfindliche Haut. Leichter Wiesenduft.",
        },
      },
    },
    {
      sku: "DOG-BED-M",
      price: 5999,
      stock: 20,
      option1Name: "Size",
      variants: [
        {
          sku: "DOG-BED-M",
          price: 5999,
          stock: 20,
          option1: "M",
          weightGrams: 2200,
        },
        {
          sku: "DOG-BED-L",
          price: 7499,
          stock: 15,
          option1: "L",
          weightGrams: 2800,
        },
      ],
      image: IMG.dogBed,
      alt: "Dog bed",
      species: "dog",
      lifeStage: "all",
      productType: "beds_travel",
      sizeClass: "m",
      collections: ["dogs", "dog-beds-travel"],
      translations: {
        en: {
          title: "Nest Ortho Dog Bed",
          slug: "nest-ortho-dog-bed",
          description:
            "Orthopedic foam bed with washable cover. Low-entry sides for seniors and puppies.",
        },
        de: {
          title: "Nest Ortho Hundebett",
          slug: "nest-ortho-hundebett",
          description:
            "Orthopädisches Schaumstoffbett mit waschbarem Bezug. Niedriger Einstieg.",
        },
      },
    },
    {
      sku: "DOG-LEASH",
      price: 1899,
      stock: 40,
      image: IMG.leash,
      alt: "Dog walking leash",
      species: "dog",
      lifeStage: "all",
      productType: "beds_travel",
      sizeClass: "na",
      collections: ["dogs", "dog-beds-travel"],
      translations: {
        en: {
          title: "City Walk Lead 1.5m",
          slug: "city-walk-lead",
          description:
            "Weatherproof webbing leash with padded handle for daily city walks.",
        },
        de: {
          title: "City Walk Leine 1,5 m",
          slug: "city-walk-leine",
          description:
            "Wetterfeste Gurtleine mit gepolstertem Griff für den Stadtspaziergang.",
        },
      },
    },
    {
      sku: "DOG-BOWL",
      price: 1699,
      stock: 50,
      image: IMG.dogBowl,
      alt: "Stainless dog bowl",
      species: "dog",
      lifeStage: "all",
      productType: "bowls",
      sizeClass: "m",
      collections: ["dogs", "dog-care"],
      translations: {
        en: {
          title: "Steady Steel Bowl Set",
          slug: "steady-steel-bowl-set",
          description:
            "Two non-slip stainless bowls for food and water. Dishwasher safe.",
        },
        de: {
          title: "Steady Steel Napf-Set",
          slug: "steady-steel-napf-set",
          description:
            "Zwei rutschfeste Edelstahlnäpfe für Futter und Wasser. Spülmaschinenfest.",
        },
      },
    },
    {
      sku: "CAT-DRY-2KG",
      price: 2299,
      stock: 35,
      image: IMG.catFood,
      alt: "Cat dry food",
      species: "cat",
      lifeStage: "adult",
      productType: "food",
      sizeClass: "na",
      collections: ["cats", "cat-food"],
      translations: {
        en: {
          title: "Whisk Adult Indoor Dry",
          slug: "whisk-adult-indoor-dry",
          description:
            "Indoor formula with hairball support and controlled calories for less-active cats.",
        },
        de: {
          title: "Whisk Adult Indoor Trocken",
          slug: "whisk-adult-indoor-trocken",
          description:
            "Indoor-Formel mit Haarballen-Unterstützung und kontrollierten Kalorien.",
        },
      },
    },
    {
      sku: "CAT-KIT-1KG",
      price: 1899,
      stock: 30,
      image: IMG.catFood,
      alt: "Kitten food",
      species: "cat",
      lifeStage: "puppy_kitten",
      productType: "food",
      sizeClass: "na",
      collections: ["cats", "cat-food"],
      translations: {
        en: {
          title: "Whisk Kitten Growth",
          slug: "whisk-kitten-growth",
          description:
            "High-protein kitten kibble with DHA for brain and vision development.",
        },
        de: {
          title: "Whisk Kitten Growth",
          slug: "whisk-kitten-growth-de",
          description:
            "Proteinreiches Kittenfutter mit DHA für Gehirn und Sehkraft.",
        },
      },
    },
    {
      sku: "CAT-WET-8",
      price: 1499,
      stock: 55,
      image: IMG.catFood,
      alt: "Cat wet food pouches",
      species: "cat",
      lifeStage: "all",
      productType: "food",
      sizeClass: "na",
      collections: ["cats", "cat-food"],
      translations: {
        en: {
          title: "Purr Pouch Multipack (8×)",
          slug: "purr-pouch-multipack",
          description:
            "Mixed gravy pouches — chicken, turkey, and fish recipes cats finish.",
        },
        de: {
          title: "Purr Pouch Multipack (8×)",
          slug: "purr-pouch-multipack-de",
          description:
            "Soßenbeutel-Mix — Huhn, Pute und Fisch, die Katzen leerfuttern.",
        },
      },
    },
    {
      sku: "CAT-TRT-CREAM",
      price: 599,
      stock: 90,
      image: IMG.catTreats,
      alt: "Cat cream treats",
      species: "cat",
      lifeStage: "all",
      productType: "treats",
      sizeClass: "na",
      collections: ["cats", "cat-treats"],
      translations: {
        en: {
          title: "Lick Tube Cream Treats",
          slug: "lick-tube-cream-treats",
          description:
            "Squeeze cream tubes for bonding moments and pill wrapping.",
        },
        de: {
          title: "Lick Tube Cream Snacks",
          slug: "lick-tube-cream-snacks",
          description:
            "Creme-Tuben für Kuschelzeit und zum Verstecken von Tabletten.",
        },
      },
    },
    {
      sku: "CAT-TOY-WAND",
      price: 899,
      stock: 70,
      image: IMG.catToy,
      alt: "Cat wand toy",
      species: "cat",
      lifeStage: "all",
      productType: "toys",
      sizeClass: "na",
      collections: ["cats", "cat-toys"],
      translations: {
        en: {
          title: "Feather Flick Wand",
          slug: "feather-flick-wand",
          description:
            "Replaceable feather head wand that wakes up the hunter instinct.",
        },
        de: {
          title: "Feather Flick Angel",
          slug: "feather-flick-angel",
          description:
            "Katzenangel mit wechselbarem Federkopf — weckt den Jagdtrieb.",
        },
      },
    },
    {
      sku: "CAT-SCRATCH",
      price: 3499,
      stock: 18,
      image: IMG.scratch,
      alt: "Cat scratching post",
      species: "cat",
      lifeStage: "all",
      productType: "toys",
      sizeClass: "na",
      collections: ["cats", "cat-toys"],
      translations: {
        en: {
          title: "Tower Scratch Post 80cm",
          slug: "tower-scratch-post",
          description:
            "Sisal-wrapped post with plush perch. Stable base for vigorous scratchers.",
        },
        de: {
          title: "Tower Kratzstamm 80 cm",
          slug: "tower-kratzstamm",
          description:
            "Sisal-Stamm mit Plüschliegefläche. Stabiler Fuß für ambitionierte Kratzer.",
        },
      },
    },
    {
      sku: "CAT-LITTER-10",
      price: 1599,
      stock: 40,
      image: IMG.litter,
      alt: "Cat litter bag",
      species: "cat",
      lifeStage: "all",
      productType: "litter",
      sizeClass: "na",
      collections: ["cats", "litter-toilets"],
      translations: {
        en: {
          title: "Cloud Clump Litter 10L",
          slug: "cloud-clump-litter",
          description:
            "Low-dust clumping clay with light charcoal odor control.",
        },
        de: {
          title: "Cloud Clump Streu 10 L",
          slug: "cloud-clump-streu",
          description:
            "Staubarme klumpende Tonerde mit leichter Aktivkohle-Geruchskontrolle.",
        },
      },
    },
    {
      sku: "CAT-BOX",
      price: 2999,
      stock: 22,
      image: IMG.litter,
      alt: "Covered litter box",
      species: "cat",
      lifeStage: "all",
      productType: "litter",
      sizeClass: "na",
      collections: ["cats", "litter-toilets"],
      translations: {
        en: {
          title: "Quiet Hood Litter Box",
          slug: "quiet-hood-litter-box",
          description:
            "Hooded box with carbon filter door. Easy-lift top for quick scooping.",
        },
        de: {
          title: "Quiet Hood Katzenklo",
          slug: "quiet-hood-katzenklo",
          description:
            "Haubenklosett mit Aktivkohlefilter. Abnehmbarer Deckel zum schnellen Schaufeln.",
        },
      },
    },
    {
      sku: "CAT-BRUSH",
      price: 1299,
      stock: 40,
      image: IMG.catCare,
      alt: "Cat grooming glove",
      species: "cat",
      lifeStage: "all",
      productType: "care",
      sizeClass: "na",
      collections: ["cats", "cat-care"],
      translations: {
        en: {
          title: "Palm Groom Glove",
          slug: "palm-groom-glove",
          description:
            "Massage glove that collects loose fur while your cat leans in.",
        },
        de: {
          title: "Palm Groom Handschuh",
          slug: "palm-groom-handschuh",
          description:
            "Massagehandschuh, der loses Fell auffängt — während die Katze mitmacht.",
        },
      },
    },
    {
      sku: "SP-HAY-1KG",
      price: 999,
      stock: 45,
      image: IMG.smallFood,
      alt: "Pet hay bale",
      species: "small_pet",
      lifeStage: "all",
      productType: "food",
      sizeClass: "na",
      collections: ["small-pets", "small-pet-food"],
      translations: {
        en: {
          title: "Alpine Timothy Hay 1kg",
          slug: "alpine-timothy-hay",
          description:
            "Dust-extracted timothy hay for rabbits and guinea pigs. Daily staple fibre.",
        },
        de: {
          title: "Alpen Timothy Heu 1 kg",
          slug: "alpen-timothy-heu",
          description:
            "Entstaubtes Timothy-Heu für Kaninchen und Meerschweinchen.",
        },
      },
    },
    {
      sku: "SP-PELLETS",
      price: 1199,
      stock: 40,
      image: IMG.smallFood,
      alt: "Small pet pellets",
      species: "small_pet",
      lifeStage: "adult",
      productType: "food",
      sizeClass: "na",
      collections: ["small-pets", "small-pet-food"],
      translations: {
        en: {
          title: "Garden Mix Pellets",
          slug: "garden-mix-pellets",
          description:
            "Vitamin-fortified pellets for adult rabbits. No colourful sugary bits.",
        },
        de: {
          title: "Garten Mix Pellets",
          slug: "garten-mix-pellets",
          description:
            "Vitaminisierte Pellets für ausgewachsene Kaninchen. Ohne bunte Zuckerbits.",
        },
      },
    },
    {
      sku: "SP-BEDDING",
      price: 1399,
      stock: 35,
      image: IMG.habitat,
      alt: "Small pet bedding",
      species: "small_pet",
      lifeStage: "all",
      productType: "beds_travel",
      sizeClass: "na",
      collections: ["small-pets", "small-pet-habitat"],
      translations: {
        en: {
          title: "SoftNest Paper Bedding",
          slug: "softnest-paper-bedding",
          description:
            "Dust-free paper bedding that composts easily and controls odor.",
        },
        de: {
          title: "SoftNest Papier-Einstreu",
          slug: "softnest-papier-einstreu",
          description:
            "Staubfreie Papiereinstreu — kompostierbar und geruchsbindend.",
        },
      },
    },
    {
      sku: "SP-HIDE",
      price: 1599,
      stock: 28,
      image: IMG.habitat,
      alt: "Wooden pet hideout",
      species: "small_pet",
      lifeStage: "all",
      productType: "beds_travel",
      sizeClass: "s",
      collections: ["small-pets", "small-pet-habitat"],
      translations: {
        en: {
          title: "Willow Hide House",
          slug: "willow-hide-house",
          description:
            "Chewable willow hide for rabbits and guinea pigs. Natural shelter for rest.",
        },
        de: {
          title: "Weiden Versteckhaus",
          slug: "weiden-versteckhaus",
          description:
            "Knabberbares Weidenhaus für Kaninchen und Meerschweinchen.",
        },
      },
    },
    {
      sku: "DOG-SENIOR",
      price: 2799,
      stock: 25,
      image: IMG.dogFood,
      alt: "Senior dog food",
      species: "dog",
      lifeStage: "senior",
      productType: "food",
      sizeClass: "m",
      collections: ["dogs", "dog-food"],
      translations: {
        en: {
          title: "Meadow Senior Joint Care",
          slug: "meadow-senior-joint-care",
          description:
            "Senior kibble with glucosamine support and easy-chew kibbles for older dogs.",
        },
        de: {
          title: "Wiesen Senior Gelenkpflege",
          slug: "wiesen-senior-gelenkpflege",
          description:
            "Senior-Kroketten mit Glucosamin und leicht zu kauenden Stücken.",
        },
      },
    },
  ];

  const createdProductIds: string[] = [];

  for (const p of products) {
    const variants = p.variants ?? [
      {
        sku: p.sku,
        price: p.price,
        stock: p.stock,
        option1: undefined as string | undefined,
        weightGrams: p.weightGrams ?? 500,
      },
    ];

    const product = await prisma.product.create({
      data: {
        status: "active",
        option1Name: p.option1Name,
        translations: {
          create: [
            {
              locale: "en",
              title: p.translations.en.title,
              description: p.translations.en.description,
              body: plainTextToDoc(
                p.translations.en.description,
                p.translations.en.title,
              ),
              slug: p.translations.en.slug,
              seoTitle: `${p.translations.en.title} | Nestpaw`,
              seoDescription: p.translations.en.description.slice(0, 150),
            },
            {
              locale: "de",
              title: p.translations.de.title,
              description: p.translations.de.description,
              body: plainTextToDoc(
                p.translations.de.description,
                p.translations.de.title,
              ),
              slug: p.translations.de.slug,
              seoTitle: `${p.translations.de.title} | Nestpaw`,
              seoDescription: p.translations.de.description.slice(0, 150),
            },
          ],
        },
        variants: {
          create: variants.map((v) => ({
            sku: v.sku,
            price: v.price,
            option1: v.option1,
            weightGrams: v.weightGrams ?? 500,
            inventory: { create: { quantity: v.stock, policy: "deny" } },
          })),
        },
        media: {
          create: mediaForProduct(p.image, p.alt),
        },
        metafields: {
          create: [
            {
              namespace: "pet",
              key: "species",
              type: "string",
              value: p.species,
            },
            {
              namespace: "pet",
              key: "life_stage",
              type: "string",
              value: p.lifeStage,
            },
            {
              namespace: "pet",
              key: "product_type",
              type: "string",
              value: p.productType,
            },
            {
              namespace: "pet",
              key: "size_class",
              type: "string",
              value: p.sizeClass,
            },
          ],
        },
        collections: {
          create: p.collections.map((key, position) => ({
            collectionId: collectionByKey[key],
            position,
          })),
        },
      },
    });
    createdProductIds.push(product.id);
  }

  // Sample reviews on first few products
  const reviewSeeds = [
    {
      idx: 0,
      rating: 5,
      name: "Anna K.",
      email: "anna@example.com",
      title: "Our lab loves it",
      body: "Coat looks shinier after two weeks. Bag reseals well.",
    },
    {
      idx: 0,
      rating: 4,
      name: "Markus W.",
      email: "markus@example.com",
      title: "Solid everyday food",
      body: "Good value. Dog finishes every bowl.",
    },
    {
      idx: 5,
      rating: 5,
      name: "Lea S.",
      email: "lea@example.com",
      title: "Park favourite",
      body: "Bounces true and survived serious chewing so far.",
    },
    {
      idx: 12,
      rating: 5,
      name: "Sofia R.",
      email: "sofia@example.com",
      title: "Indoor cats approve",
      body: "Less grazing overnight. Litter box visits stayed normal.",
    },
    {
      idx: 18,
      rating: 4,
      name: "Jan P.",
      email: "jan@example.com",
      title: "Clumps cleanly",
      body: "Low dust — important in a small flat.",
    },
  ];
  for (const r of reviewSeeds) {
    const productId = createdProductIds[r.idx];
    if (!productId) continue;
    await prisma.review.create({
      data: {
        productId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: r.name,
        authorEmail: r.email,
        status: "approved",
      },
    });
  }

  async function upsertPage(
    slugEn: string,
    en: {
      title: string;
      body: string;
      seoTitle?: string;
      seoDescription?: string;
    },
    de: { title: string; body: string },
    blocks: unknown[] = [],
  ) {
    await prisma.page.create({
      data: {
        status: "published",
        blocks: blocks as object[],
        translations: {
          create: [
            {
              locale: "en",
              title: en.title,
              slug: slugEn,
              body: en.body,
              seoTitle: en.seoTitle ?? `${en.title} | Nestpaw`,
              seoDescription: en.seoDescription ?? en.body.slice(0, 150),
            },
            {
              locale: "de",
              title: de.title,
              slug: slugEn,
              body: de.body,
              seoTitle: `${de.title} | Nestpaw`,
              seoDescription: de.body.slice(0, 150),
            },
          ],
        },
      },
    });
  }

  await upsertPage(
    "home",
    {
      title: "Home",
      body: "Welcome to Nestpaw — curated pet essentials for dogs, cats, and small pets.",
      seoTitle: "Nestpaw | Pet essentials for DACH homes",
      seoDescription:
        "Shop food, toys, care, and more for dogs, cats, and small pets. Free shipping from €49.",
    },
    {
      title: "Startseite",
      body: "Willkommen bei Nestpaw — kuratierte Essentials für Hunde, Katzen und Kleintiere.",
    },
    [
      {
        type: "hero",
        headline: "Care that feels like home",
        image: IMG.heroDog,
        cta: { label: "Shop for dogs", href: "/en/collections/dogs" },
      },
      { type: "featured_collection", collectionSlug: "dogs" },
    ],
  );

  await upsertPage(
    "about",
    {
      title: "About",
      body: "Nestpaw is a specialty pet shop for everyday essentials. We stock food, treats, toys, care, and habitat basics for dogs, cats, and small pets — chosen for quality you can trust at home in Germany and Austria.",
    },
    {
      title: "Über uns",
      body: "Nestpaw ist ein Fachshop für Alltagsessentials. Wir führen Futter, Leckerlis, Spielzeug, Pflege und Habitat-Basics für Hunde, Katzen und Kleintiere — ausgewählt für Zuhause in Deutschland und Österreich.",
    },
  );

  await upsertPage(
    "shipping",
    {
      title: "Shipping",
      body: "We ship to DE, AT, and selected EU countries. Standard delivery 2–4 business days. Free standard shipping on orders from €49. Express available at checkout.",
    },
    {
      title: "Versand",
      body: "Wir liefern nach DE, AT und ausgewählte EU-Länder. Standardlieferung 2–4 Werktage. Kostenloser Standardversand ab 49 €. Express an der Kasse verfügbar.",
    },
  );

  await upsertPage(
    "returns",
    {
      title: "Returns",
      body: "You may withdraw within 14 days of receiving unopened goods. Food and hygiene items that were opened cannot be returned for safety reasons. Contact hello@nestpaw.example to start a return.",
    },
    {
      title: "Rückgabe",
      body: "Sie können innerhalb von 14 Tagen nach Erhalt ungeöffneter Ware widerrufen. Geöffnete Lebensmittel und Hygieneartikel sind aus Sicherheitsgründen vom Umtausch ausgeschlossen. Schreiben Sie an hello@nestpaw.example.",
    },
  );

  await upsertPage(
    "privacy",
    {
      title: "Privacy",
      body: "We process order and account data to fulfill purchases and support. Contact hello@nestpaw.example to export or delete your personal data. Analytics use privacy-friendly defaults where configured. See our Cookie policy for consent details.",
    },
    {
      title: "Datenschutz",
      body: "Wir verarbeiten Bestell- und Kontodaten zur Abwicklung und zum Support. Kontaktieren Sie hello@nestpaw.example für Auskunft oder Löschung. Analytics nutzen datenschutzfreundliche Defaults, sofern konfiguriert. Details zur Einwilligung finden Sie in der Cookie-Richtlinie.",
    },
  );

  await upsertPage(
    "cookies",
    {
      title: "Cookie policy",
      body: "Nestpaw uses essential storage for cart and signed-in account sessions. Your analytics choice is remembered in localStorage under nestpaw-cookie-consent (accepted or rejected). Optional analytics scripts (Plausible by default, or Google Analytics 4 when configured) stay disabled in the page until you accept; rejecting keeps them off. First-party server events for purchases may still be recorded for order operations. To change your mind later, clear this site’s data in your browser and reload — the consent bar will appear again. Contact hello@nestpaw.example with privacy questions.",
    },
    {
      title: "Cookie-Richtlinie",
      body: "Nestpaw nutzt essenziellen Speicher für Warenkorb und Konto-Sessions. Ihre Analyse-Entscheidung speichern wir in localStorage unter nestpaw-cookie-consent (accepted oder rejected). Optionale Analyse-Skripte (standardmäßig Plausible, oder Google Analytics 4 je nach Konfiguration) bleiben deaktiviert, bis Sie zustimmen; bei Ablehnung bleiben sie aus. Serverseitige Bestell-Events können für den Betrieb weiterhin erfasst werden. Zum Ändern der Wahl löschen Sie die Websitedaten im Browser und laden neu — die Leiste erscheint erneut. Fragen an hello@nestpaw.example.",
    },
  );

  await upsertPage(
    "terms",
    {
      title: "Terms",
      body: "Nestpaw sells pet products to consumers in the EU. Prices include VAT where applicable. Contract language is English or German matching your storefront locale. Full merchant details are provided on the invoice.",
    },
    {
      title: "AGB",
      body: "Nestpaw verkauft Tierbedarf an Verbraucher in der EU. Preise inkl. MwSt. wo zutreffend. Vertragssprache ist Englisch oder Deutsch je nach Shop-Locale. Händlerangaben stehen auf der Rechnung.",
    },
  );

  await upsertPage(
    "contact",
    {
      title: "Contact",
      body: "Email hello@nestpaw.example — we reply within one business day. For order updates, include your order number.",
    },
    {
      title: "Kontakt",
      body: "E-Mail hello@nestpaw.example — Antwort innerhalb eines Werktags. Bei Bestellungen bitte die Bestellnummer angeben.",
    },
  );

  await prisma.menu.create({
    data: {
      handle: "main",
      title: "Main",
      items: {
        create: [
          { title: "Dogs", url: "/en/collections/dogs", position: 0 },
          { title: "Cats", url: "/en/collections/cats", position: 1 },
          {
            title: "Small pets",
            url: "/en/collections/small-pets",
            position: 2,
          },
          { title: "About", url: "/en/pages/about", position: 3 },
        ],
      },
    },
  });

  console.log(
    `Nestpaw seed complete. Admin: ${email}. Products: ${createdProductIds.length}. Shipping zone: ${zone.name}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
