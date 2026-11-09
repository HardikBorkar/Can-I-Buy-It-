import { Channel3 } from "@channel3/sdk";
import type {
  Brand,
  CategorySummary,
  PriceHistoryResponse,
  Product,
  ProductOffer,
  SearchFilters,
  Website,
  OfferAvailabilityStatus,
} from "@channel3/sdk/resources";

const apiKey = process.env.CHANNEL3_API_KEY || "";
const hasLiveKey = Boolean(apiKey && !apiKey.toLowerCase().includes("your_"));

export const channel3Client = hasLiveKey ? new Channel3({ apiKey }) : null;

// Mock catalog with full Channel3 schema fidelity
const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod_sony_a7iv",
    title: "Sony Alpha 7 IV Full-Frame Mirrorless Camera",
    description: "33MP Exmor R CMOS sensor, 4K 60p 10-bit 4:2:2 video, Real-time Eye AF for human, animal, and bird.",
    brands: [{ id: "brand_sony", name: "Sony" }],
    category: { slug: "cameras", title: "Mirrorless Cameras", has_children: false },
    images: [
      { url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800", cleaned_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800" },
      { url: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800" },
      { url: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800" }
    ],
    structured_attributes: {
      color: ["Black"],
      resolution: ["33MP"],
      mount: ["Sony E-mount"]
    },
    variants: {
      options: [
        {
          name: "Kit",
          values: [
            { label: "Body Only", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "with 28-70mm Lens", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        },
        {
          name: "Color",
          values: [
            { label: "Black", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        }
      ],
      selected: [
        { name: "Kit", label: "Body Only" },
        { name: "Color", label: "Black" }
      ]
    },
    offers: [
      {
        domain: "bhphotovideo.com",
        url: "https://www.bhphotovideo.com/c/product/1668833-REG/sony_ilce_7m4_b_alpha_a7_iv_mirrorless.html?tracking_id=channel3_affiliate_paypal",
        price: { price: 2298.00, compare_at_price: 2499.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.045,
      },
      {
        domain: "bestbuy.com",
        url: "https://www.bestbuy.com/site/sony-alpha-7-iv/6487140.p?tracking_id=channel3_affiliate_paypal",
        price: { price: 2399.99, compare_at_price: 2499.99, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.035,
      },
      {
        domain: "amazon.com",
        url: "https://www.amazon.com/dp/B09JZT6YK5?tag=channel3_affiliate_paypal-20",
        price: { price: 2498.00, compare_at_price: 2498.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.03,
      }
    ]
  },
  {
    id: "prod_macbook_air_m3",
    title: 'Apple MacBook Air 13" Laptop - M3 Chip, 16GB RAM, 512GB SSD',
    description: "Blazing-fast M3 chip with 8-core CPU and 10-core GPU, up to 18 hours of battery life, Liquid Retina display.",
    brands: [{ id: "brand_apple", name: "Apple" }],
    category: { slug: "laptops", title: "Laptops & Computers", has_children: false },
    images: [
      { url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800", cleaned_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800" },
      { url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800" }
    ],
    structured_attributes: {
      color: ["Midnight", "Starlight", "Space Gray", "Silver"],
      screen_size: ['13.6"'],
      storage: ["512GB"]
    },
    variants: {
      options: [
        {
          name: "Color",
          values: [
            { label: "Midnight", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Starlight", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Space Gray", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Silver", exists: true, available: "OutOfStock" as OfferAvailabilityStatus }
          ]
        },
        {
          name: "Memory",
          values: [
            { label: "16GB", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "24GB", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        }
      ],
      selected: [
        { name: "Color", label: "Midnight" },
        { name: "Memory", label: "16GB" }
      ]
    },
    offers: [
      {
        domain: "apple.com",
        url: "https://www.apple.com/shop/buy-mac/macbook-air/13-inch-m3?tracking_id=channel3_affiliate_paypal",
        price: { price: 1299.00, compare_at_price: 1299.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.02,
      },
      {
        domain: "bhphotovideo.com",
        url: "https://www.bhphotovideo.com/c/product/1815000-REG?tracking_id=channel3_affiliate_paypal",
        price: { price: 1199.00, compare_at_price: 1299.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.04,
      },
      {
        domain: "bestbuy.com",
        url: "https://www.bestbuy.com/site/apple-macbook-air-13/6565860.p?tracking_id=channel3_affiliate_paypal",
        price: { price: 1199.00, compare_at_price: 1299.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.035,
      }
    ]
  },
  {
    id: "prod_nike_pegasus_41",
    title: "Nike Pegasus 41 Road Running Shoes",
    description: "Responsive cushioning with dual Air Zoom units and all-new ReactX foam midsole for energized miles.",
    brands: [{ id: "brand_nike", name: "Nike" }],
    category: { slug: "shoes", title: "Running Shoes", has_children: false },
    images: [
      { url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800", cleaned_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800" },
      { url: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800" }
    ],
    structured_attributes: {
      color: ["Red", "White", "Black"],
      gender: ["Men", "Unisex"]
    },
    variants: {
      options: [
        {
          name: "Size",
          values: [
            { label: "8", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "9", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "10", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "11", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "12", exists: true, available: "OutOfStock" as OfferAvailabilityStatus }
          ]
        },
        {
          name: "Color",
          values: [
            { label: "Red / White", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Triple Black", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        }
      ],
      selected: [
        { name: "Size", label: "10" },
        { name: "Color", label: "Red / White" }
      ]
    },
    offers: [
      {
        domain: "nike.com",
        url: "https://www.nike.com/t/pegasus-41-road-running-shoes-6g1m1d?tracking_id=channel3_affiliate_paypal",
        price: { price: 140.00, compare_at_price: 140.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.07,
      },
      {
        domain: "dickssportinggoods.com",
        url: "https://www.dickssportinggoods.com/p/nike-pegasus-41?tracking_id=channel3_affiliate_paypal",
        price: { price: 119.99, compare_at_price: 140.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.05,
      }
    ]
  },
  {
    id: "prod_bose_qc_ultra",
    title: "Bose QuietComfort Ultra Wireless Headphones with Spatial Audio",
    description: "World-class noise cancellation, groundbreaking spatialized audio, and CustomTune technology for personalized sound.",
    brands: [{ id: "brand_bose", name: "Bose" }],
    category: { slug: "audio", title: "Over-Ear Headphones", has_children: false },
    images: [
      { url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800", cleaned_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800" },
      { url: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800" }
    ],
    structured_attributes: {
      color: ["Black", "White Smoke", "Sandstone"],
      connectivity: ["Bluetooth 5.3", "3.5mm Aux"]
    },
    variants: {
      options: [
        {
          name: "Color",
          values: [
            { label: "Black", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "White Smoke", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Sandstone", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        }
      ],
      selected: [
        { name: "Color", label: "Black" }
      ]
    },
    offers: [
      {
        domain: "target.com",
        url: "https://www.target.com/p/bose-quietcomfort-ultra?tracking_id=channel3_affiliate_paypal",
        price: { price: 379.00, compare_at_price: 429.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.04,
      },
      {
        domain: "amazon.com",
        url: "https://www.amazon.com/dp/B0CCZ17CV9?tag=channel3_affiliate_paypal-20",
        price: { price: 379.00, compare_at_price: 429.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.03,
      }
    ]
  },
  {
    id: "prod_dyson_v12",
    title: "Dyson V12 Detect Slim Cordless Vacuum",
    description: "Dyson's lightest intelligent cordless vacuum with laser illumination revealing invisible dust on hard floors.",
    brands: [{ id: "brand_dyson", name: "Dyson" }],
    category: { slug: "appliances", title: "Vacuum Cleaners", has_children: false },
    images: [
      { url: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800", cleaned_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800" }
    ],
    structured_attributes: {
      color: ["Yellow / Iron"],
      weight: ["5.2 lbs"]
    },
    variants: {
      options: [
        {
          name: "Model",
          values: [
            { label: "Standard", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Absolute (Extra Tools)", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        }
      ],
      selected: [
        { name: "Model", label: "Standard" }
      ]
    },
    offers: [
      {
        domain: "dyson.com",
        url: "https://www.dyson.com/vacuum-cleaners/cordless/v12?tracking_id=channel3_affiliate_paypal",
        price: { price: 549.99, compare_at_price: 649.99, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.06,
      },
      {
        domain: "bestbuy.com",
        url: "https://www.bestbuy.com/site/dyson-v12/6504285.p?tracking_id=channel3_affiliate_paypal",
        price: { price: 549.99, compare_at_price: 649.99, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.035,
      }
    ]
  },
  {
    id: "prod_herman_miller_aeron",
    title: "Herman Miller Aeron Ergonomic Office Chair",
    description: "The benchmark for ergonomic seating with 8Z Pellicle breathable suspension and PostureFit SL adjustable back support.",
    brands: [{ id: "brand_hm", name: "Herman Miller" }],
    category: { slug: "furniture", title: "Office Furniture", has_children: false },
    images: [
      { url: "https://images.unsplash.com/photo-1580481077195-c3a8b0069e26?w=800", cleaned_url: "https://images.unsplash.com/photo-1580481077195-c3a8b0069e26?w=800" }
    ],
    structured_attributes: {
      color: ["Graphite", "Mineral", "Carbon", "Onyx"],
      size: ["Size B (Medium)"]
    },
    variants: {
      options: [
        {
          name: "Size",
          values: [
            { label: "Size A (Small)", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Size B (Medium)", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Size C (Large)", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        },
        {
          name: "Color",
          values: [
            { label: "Graphite", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Mineral", exists: true, available: "InStock" as OfferAvailabilityStatus },
            { label: "Onyx Ultra Matte", exists: true, available: "InStock" as OfferAvailabilityStatus }
          ]
        }
      ],
      selected: [
        { name: "Size", label: "Size B (Medium)" },
        { name: "Color", label: "Graphite" }
      ]
    },
    offers: [
      {
        domain: "hermanmiller.com",
        url: "https://store.hermanmiller.com/office-chairs/aeron-chair/2195368.html?tracking_id=channel3_affiliate_paypal",
        price: { price: 1495.00, compare_at_price: 1720.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.08,
      },
      {
        domain: "dwr.com",
        url: "https://www.dwr.com/workspace-chairs/aeron-chair/2195368.html?tracking_id=channel3_affiliate_paypal",
        price: { price: 1495.00, compare_at_price: 1720.00, currency: "USD" },
        availability: "InStock" as OfferAvailabilityStatus,
        max_commission_rate: 0.06,
      }
    ]
  }
];

export async function searchChannel3Products(input: {
  query?: string;
  imageUrl?: string;
  base64Image?: string;
  filters?: SearchFilters;
  pageToken?: string;
  limit?: number;
}): Promise<{ products: Product[]; nextPageToken?: string | null }> {
  const { query = "", filters = {}, limit = 12 } = input;

  if (channel3Client) {
    try {
      if (input.base64Image || input.imageUrl) {
        const page = await (channel3Client.products as any).searchByImage({
          ...(input.base64Image ? { image_data: input.base64Image } : { image_url: input.imageUrl }),
          query: query || undefined,
          filters: Object.keys(filters).length ? filters : undefined,
          limit,
        });
        return {
          products: page.data || (page as any).items || [],
          nextPageToken: (page as any).next_page_token || null,
        };
      }

      const page = await channel3Client.products.search({
        query: query || "popular trending products",
        filters: Object.keys(filters).length ? filters : undefined,
        limit,
      });

      return {
        products: page.data || (page as any).items || [],
        nextPageToken: (page as any).next_page_token || null,
      };
    } catch (err) {
      console.warn("Live Channel3 API call failed; falling back to simulated catalog:", err);
    }
  }

  // Fallback filtering over mock catalog
  let results = [...MOCK_PRODUCTS];

  if (query.trim()) {
    const q = query.toLowerCase();
    results = results.filter((p) => {
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchBrand = (p.brands ?? []).some((b) => b.name?.toLowerCase().includes(q));
      const matchDesc = p.description?.toLowerCase().includes(q);
      const matchCat = p.category?.title.toLowerCase().includes(q);
      return matchTitle || matchBrand || matchDesc || matchCat;
    });
  }

  // Price filter
  if (filters.price?.min_price !== undefined && filters.price?.min_price !== null) {
    const min = filters.price.min_price;
    results = results.filter((p) => ((p.offers?.[0]?.price.price) ?? 0) >= min);
  }
  if (filters.price?.max_price !== undefined && filters.price?.max_price !== null) {
    const max = filters.price.max_price;
    results = results.filter((p) => ((p.offers?.[0]?.price.price) ?? 0) <= max);
  }

  // Sale filter
  if (filters.sale === "on_sale") {
    results = results.filter((p) => {
      const lead = p.offers?.[0];
      return Boolean(lead?.price.compare_at_price && lead.price.compare_at_price > lead.price.price);
    });
  }

  return {
    products: results.length > 0 ? results : MOCK_PRODUCTS.slice(0, limit),
    nextPageToken: null,
  };
}

export async function getChannel3Product(
  productId: string,
  selectedOptions?: Record<string, string>
): Promise<Product | null> {
  if (channel3Client) {
    try {
      const prod = await channel3Client.products.retrieve({
        product_id: productId,
        ...(selectedOptions ? { selected_options: selectedOptions } : {}),
      });
      return prod;
    } catch (err) {
      console.warn("Live Channel3 retrieve failed, searching fallback:", err);
    }
  }

  const found = MOCK_PRODUCTS.find((p) => p.id === productId);
  if (!found) return null;

  // Clone and update selected options if provided
  if (selectedOptions && found.variants) {
    const clone = JSON.parse(JSON.stringify(found)) as Product;
    clone.variants!.selected = Object.entries(selectedOptions).map(([name, label]) => ({
      name,
      label,
    }));
    return clone;
  }

  return found;
}

// In-memory 15-minute TTL cache for similar products to eliminate 10s latency
const similarProductsCache = new Map<string, { data: Product[]; expiresAt: number }>();

export async function getChannel3Similar(productId: string, limit: number = 6): Promise<Product[]> {
  const cacheKey = `${productId}_${limit}`;
  const cached = similarProductsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  if (channel3Client) {
    try {
      // Race findSimilar with a 3.5s timeout to guarantee instant UI rendering
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Channel3 findSimilar timed out")), 3500)
      );

      const fetchPromise = channel3Client.products.findSimilar({
        product_id: productId,
        limit,
      });

      const res = await Promise.race([fetchPromise, timeoutPromise]);
      const data = (res.data as Product[]) || (res as any).items || [];
      if (data.length > 0) {
        similarProductsCache.set(cacheKey, { data, expiresAt: Date.now() + 15 * 60 * 1000 });
        return data;
      }
    } catch (err) {
      console.warn("Live Channel3 findSimilar timed out or failed, fallback to mock:", err);
    }
  }

  const fallback = MOCK_PRODUCTS.filter((p) => p.id !== productId).slice(0, limit);
  similarProductsCache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 15 * 60 * 1000 });
  return fallback;
}

export async function getChannel3PriceHistory(productId: string, days: number = 90): Promise<PriceHistoryResponse> {
  if (channel3Client) {
    try {
      return await channel3Client.priceTracking.retrieveHistory({
        canonical_product_id: productId,
        days,
      });
    } catch (err) {
      console.warn("Live Channel3 price history failed, using mock data:", err);
    }
  }

  const prod = MOCK_PRODUCTS.find((p) => p.id === productId) || MOCK_PRODUCTS[0];
  const basePrice = prod.offers?.[0]?.price.price ?? 500;

  return {
    canonical_product_id: productId,
    days,
    currency: "USD",
    data_points: [
      { date: "2026-08-01", price: basePrice + 40 },
      { date: "2026-08-15", price: basePrice + 30 },
      { date: "2026-09-01", price: basePrice + 15 },
      { date: "2026-09-15", price: basePrice + 20 },
      { date: "2026-10-01", price: basePrice },
      { date: "2026-10-15", price: basePrice - 10 },
      { date: "2026-10-31", price: basePrice },
    ],
    statistics: {
      current_price: basePrice,
      current_status: "typical",
      mean: basePrice + 10,
      min: basePrice - 10,
      max: basePrice + 40,
      min_price: basePrice - 10,
      max_price: basePrice + 40,
      currency: "USD",
      std_dev: 15,
    },
  } as unknown as PriceHistoryResponse;
}

export async function searchChannel3Categories(query: string): Promise<CategorySummary[]> {
  if (channel3Client) {
    try {
      const res = await channel3Client.categories.search({ query, limit: 10 });
      return res.categories || [];
    } catch (e) {
      console.warn("Category search failed:", e);
    }
  }

  const defaultCats: CategorySummary[] = [
    { slug: "shoes", title: "Shoes & Footwear", has_children: false },
    { slug: "electronics", title: "Electronics & Tech", has_children: false },
    { slug: "cameras", title: "Cameras & Photography", has_children: false },
    { slug: "audio", title: "Headphones & Audio", has_children: false },
    { slug: "furniture", title: "Home & Office Furniture", has_children: false },
    { slug: "appliances", title: "Appliances & Smart Home", has_children: false },
  ];

  if (!query) return defaultCats;
  return defaultCats.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));
}

export async function searchChannel3Brands(query: string): Promise<Brand[]> {
  if (channel3Client) {
    try {
      const res = await channel3Client.brands.search({ query, limit: 10 });
      return res.brands || [];
    } catch (e) {
      console.warn("Brand search failed:", e);
    }
  }

  const defaultBrands: Brand[] = [
    { id: "brand_sony", name: "Sony" },
    { id: "brand_apple", name: "Apple" },
    { id: "brand_nike", name: "Nike" },
    { id: "brand_bose", name: "Bose" },
    { id: "brand_dyson", name: "Dyson" },
    { id: "brand_hm", name: "Herman Miller" },
  ];

  if (!query) return defaultBrands;
  return defaultBrands.filter((b) => b.name?.toLowerCase().includes(query.toLowerCase()));
}

export async function searchChannel3Websites(query: string): Promise<Website[]> {
  if (channel3Client) {
    try {
      const res = await channel3Client.websites.search({ query });
      return res.websites || [];
    } catch (e) {
      console.warn("Website search failed:", e);
    }
  }

  const defaultWebsites: Website[] = [
    { id: "web_bh", name: "B&H Photo Video", url: "https://bhphotovideo.com", best_commission_rate: 4.5 },
    { id: "web_bestbuy", name: "Best Buy", url: "https://bestbuy.com", best_commission_rate: 3.5 },
    { id: "web_nike", name: "Nike Official", url: "https://nike.com", best_commission_rate: 7.0 },
    { id: "web_target", name: "Target", url: "https://target.com", best_commission_rate: 4.0 },
    { id: "web_apple", name: "Apple Store", url: "https://apple.com", best_commission_rate: 2.0 },
    { id: "web_amazon", name: "Amazon", url: "https://amazon.com", best_commission_rate: 3.0 },
  ];

  if (!query) return defaultWebsites;
  return defaultWebsites.filter((w) =>
    (w.name?.toLowerCase().includes(query.toLowerCase()) || w.url.toLowerCase().includes(query.toLowerCase()))
  );
}
