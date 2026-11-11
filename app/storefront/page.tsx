"use client";

import Link from "next/link";
import * as React from "react";
import type {
  Brand,
  CategorySummary,
  PriceHistoryResponse,
  Product,
  Website,
} from "@channel3/sdk/resources";
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  Wallet,
  Flame,
  Headphones,
  Footprints,
  Laptop,
  Camera,
  Watch,
  Home,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductSearch } from "@/components/product-search";
import { ProductDetails } from "@/components/product-details";
import { useVariantSelection, type VariantResolveInput } from "@/hooks/use-variant-selection";
import type { SearchFetcher, SearchFetchInput } from "@/hooks/use-product-search";
import type { SimilarFetcher, SimilarFetchInput } from "@/hooks/use-product-recommendations";

const CATEGORY_CHIPS = [
  { label: "Trending Picks", icon: Flame, query: "shoes" },
  { label: "Sneakers & Kicks", icon: Footprints, query: "sneakers" },
  { label: "Audio & Headphones", icon: Headphones, query: "headphones" },
  { label: "Cameras & Gear", icon: Camera, query: "camera" },
  { label: "Laptops & Tech", icon: Laptop, query: "laptop" },
  { label: "Smartwatches", icon: Watch, query: "watch" },
];

const EMPTY_PRODUCT = {} as Product;

export default function StorefrontPage() {
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = React.useState<PriceHistoryResponse | undefined>(undefined);
  const [paypalEvaluation, setPaypalEvaluation] = React.useState<Record<string, unknown> | null>(null);
  const [checkoutStatus, setCheckoutStatus] = React.useState<string | null>(null);
  const [activeCategoryQuery, setActiveCategoryQuery] = React.useState("shoes");

  // 1. Search fetcher connecting to server-side Channel3 API route
  const fetchSearch: SearchFetcher = React.useCallback(async (input: SearchFetchInput) => {
    const res = await fetch("/api/channel3/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("Search failed");
    return res.json();
  }, []);

  // 2. Discoverable Facets
  const searchCategories = React.useCallback(async (query: string): Promise<CategorySummary[]> => {
    const res = await fetch(`/api/channel3/categories?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.categories || [];
  }, []);

  const searchBrands = React.useCallback(async (query: string): Promise<Brand[]> => {
    const res = await fetch(`/api/channel3/brands?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.brands || [];
  }, []);

  const searchWebsites = React.useCallback(async (query: string): Promise<Website[]> => {
    const res = await fetch(`/api/channel3/websites?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.websites || [];
  }, []);

  // 3. Similar products recommendations fetcher for PDP
  const fetchSimilar: SimilarFetcher = React.useCallback(async (input: SimilarFetchInput) => {
    const res = await fetch("/api/channel3/similar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: input.productId,
        limit: input.limit || 6,
        filters: input.filters,
      }),
    });
    const data = await res.json();
    return data.products || [];
  }, []);

  // 4. Variant resolver for PDP
  const variantResolver = React.useCallback(async ({ product, selection }: VariantResolveInput): Promise<Product> => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(selection)) {
      params.set(`option_${key}`, val);
    }
    const res = await fetch(`/api/channel3/products/${product.id}?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to resolve variant");
    return res.json();
  }, []);

  // Wire variant selection hook
  const {
    product: resolvedProduct,
    selection,
    select: onSelectVariant,
    isResolving,
  } = useVariantSelection({
    product: selectedProduct || EMPTY_PRODUCT,
    resolve: variantResolver,
  });

  const handleCloseProduct = React.useCallback(() => {
    setSelectedProduct(null);
    setPriceHistory(undefined);
    setPaypalEvaluation(null);
    setCheckoutStatus(null);
  }, []);

  // Fetch price history and run PayPal Guardian simulation when a product is opened
  React.useEffect(() => {
    if (!selectedProduct?.id) {
      return;
    }

    let isCancelled = false;

    // Load price history
    fetch(`/api/channel3/price-history/${selectedProduct.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isCancelled && data) setPriceHistory(data);
      })
      .catch(() => {});

    // Run PayPal Guardian Cash Flow Evaluation
    const leadPrice = selectedProduct.offers?.[0]?.price.price || 150;
    fetch("/api/paypal/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: leadPrice,
        currency: "USD",
        item_name: selectedProduct.title,
      }),
    })
      .then((r) => r.json())
      .then((evalData) => {
        if (!isCancelled) {
          setPaypalEvaluation(evalData);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [selectedProduct?.id, selectedProduct?.title, selectedProduct?.offers]);

  const activeProduct = selectedProduct ? resolvedProduct : null;
  const leadOffer = activeProduct?.offers?.[0];

  const handlePayPalCheckout = async (usePayIn4: boolean) => {
    try {
      setCheckoutStatus("Contacting PayPal Orders v2 API...");
      const price = leadOffer?.price.price || 100;
      const res = await fetch("/api/paypal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: price,
          currency: leadOffer?.price.currency || "USD",
          itemName: activeProduct?.title || "Product Purchase",
          payIn4: usePayIn4,
        }),
      });

      if (!res.ok) {
        throw new Error(`Order creation failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      setCheckoutStatus(
        usePayIn4
          ? `Order #${data.orderId} Authorized! PayPal Pay in 4 activated (4 installments of $${data.installmentAmount?.toFixed(2) || (price / 4).toFixed(2)}).`
          : `Order #${data.orderId} Authorized! Paid in full: $${price.toFixed(2)} USD.`
      );

      if (data.approveUrl) {
        setTimeout(() => {
          window.open(data.approveUrl, "_blank", "noopener,noreferrer");
        }, 800);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout initialization failed";
      setCheckoutStatus(`Error: ${message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060c18] text-slate-100 font-sans">
      {/* Top Banner & Header - Dedicated Storefront Styling */}
      <header className="border-b border-[#172b4d] bg-[#081222] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 p-1.5 rounded-lg bg-[#0c182e] hover:bg-[#122344] border border-[#172b4d] text-slate-300 hover:text-white transition text-xs font-medium"
              title="Return to Home"
            >
              <Home className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#0070BA]/70 flex items-center justify-center shadow-md shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/clean/paypal-square.png" alt="PayPal" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                  PayPal Guardian <span className="text-[#38bdf8]">&amp; Storefront</span>
                </span>
                <Badge variant="outline" className="text-xs border-[#0070BA]/60 text-[#38bdf8] bg-[#002952]">
                  Channel3 Live
                </Badge>
              </div>
              <p className="text-xs text-[#8ea9cb] hidden sm:block">
                Universal catalog (25,000+ stores) with autonomous 90-day cash flow protection
              </p>
            </div>
          </div>

          {/* Navigation Links: Copilot & AG Grid Dashboard */}
          <div className="flex items-center gap-2.5 text-xs">
            <Link
              href="/copilot"
              className="relative inline-flex p-[2px] rounded-lg group shadow-[0_0_12px_rgba(147,51,234,0.4),0_0_6px_rgba(59,130,246,0.3)] hover:shadow-[0_0_18px_rgba(168,85,247,0.65)] transition-shadow"
            >
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
              <span className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-[#040711] group-hover:bg-transparent rounded-[6px] text-white font-semibold transition duration-200">
                <Sparkles className="w-3.5 h-3.5 text-white group-hover:rotate-12 transition-transform" />
                <span>Guardian Copilot</span>
                <span className="px-1.5 py-0.5 leading-none rounded text-[10px] bg-white/10 text-white font-bold border border-white/20">
                  AI AGENT
                </span>
              </span>
            </Link>

            <Link
              href="/dashboard"
              className="relative inline-flex p-[2px] rounded-lg group shadow-[0_0_12px_rgba(147,51,234,0.4),0_0_6px_rgba(59,130,246,0.3)] hover:shadow-[0_0_18px_rgba(168,85,247,0.65)] transition-shadow"
            >
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
              <span className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-[#040711] group-hover:bg-transparent rounded-[6px] text-white font-semibold transition duration-200">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>AG Grid Dashboard</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Experience */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeProduct ? (
          /* ==================== PRODUCT DETAIL PAGE (PDP) ==================== */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Back Button & Breadcrumbs */}
            <div className="flex items-center justify-between border-b border-[#172b4d] pb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloseProduct}
                className="gap-2 border-[#172b4d] bg-[#0c182e] hover:bg-[#122344] text-[#cbd5e1]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Search Grid
              </Button>

              <div className="text-xs text-[#8ea9cb] flex items-center gap-2">
                <span>Shop</span>
                <span>/</span>
                <span className="text-[#cbd5e1]">{activeProduct.category?.title || "Products"}</span>
                <span>/</span>
                <span className="text-[#38bdf8] truncate max-w-[200px] font-medium">{activeProduct.title}</span>
              </div>
            </div>

            {/* PayPal Guardian Cash Flow Shield Banner */}
            {paypalEvaluation && (
              <div className="p-4 rounded-xl border border-[#0070BA] bg-[#0b1629] shadow-md">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#38bdf8]" />
                      <span className="font-semibold text-sm text-white">
                        PayPal Guardian: 90-Day Cash-Flow Assessment
                      </span>
                      {paypalEvaluation.safe_in_full ? (
                        <Badge className="bg-[#064e3b] text-[#34d399] border-[#059669]">
                          Safe to Buy in Full
                        </Badge>
                      ) : (
                        <Badge className="bg-[#78350f] text-[#fcd34d] border-[#d97706]">
                          Recommend PayPal Pay in 4
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#cbd5e1] max-w-3xl leading-relaxed">
                      {typeof paypalEvaluation.explanation === "string" ? paypalEvaluation.explanation : ""}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="w-full max-w-md min-h-[45px] flex items-center gap-3 shrink-0 flex-wrap">
                    {Boolean((paypalEvaluation.pay_in_4 as { available?: boolean })?.available) && (
                      <Button
                        size="default"
                        onClick={() => handlePayPalCheckout(true)}
                        className="bg-[#0070BA] hover:bg-[#005ea6] text-white font-bold shadow-sm"
                      >
                        <CreditCard className="w-4 h-4 mr-1.5" />
                        PayPal Pay in 4 (${Number((paypalEvaluation.pay_in_4 as { first_payment_today?: number })?.first_payment_today ?? 0).toFixed(2)} today)
                      </Button>
                    )}
                    <Button
                      size="default"
                      variant="outline"
                      onClick={() => handlePayPalCheckout(false)}
                      className="border-[#172b4d] bg-[#0c182e] hover:bg-[#122344] text-slate-200"
                    >
                      Pay in Full (${Number(paypalEvaluation.amount ?? 0).toFixed(2)})
                    </Button>
                    <Link
                      href={`/dashboard?item=${encodeURIComponent(activeProduct.title)}&amount=${leadOffer?.price.price || (paypalEvaluation.amount as number) || 100}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#0070BA] bg-[#002952] hover:bg-[#003870] text-xs font-semibold text-[#93c5fd] transition shrink-0"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span>Deep AG Grid Simulation &rarr;</span>
                    </Link>
                  </div>
                </div>

                {checkoutStatus && (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#002952] border border-[#0070BA] text-[#93c5fd] text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#38bdf8]" />
                    <span>{checkoutStatus}</span>
                  </div>
                )}
              </div>
            )}

            {/* Official Channel3 ProductDetails UI Component */}
            <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-6 shadow-xl">
              <ProductDetails
                product={activeProduct}
                selection={selection}
                onSelectVariant={onSelectVariant}
                isResolving={isResolving}
                priceHistory={priceHistory}
                fetchSimilar={fetchSimilar}
                buyLinkRel="sponsored noopener noreferrer"
                recommendations={{
                  title: (
                    <div className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                      <Sparkles className="w-5 h-5 text-[#38bdf8]" />
                      <span>More Like This (Across 25,000+ Retailers)</span>
                    </div>
                  ),
                  onSelect: (rec) => {
                    setSelectedProduct(rec);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  },
                }}
              />
            </div>
          </div>
        ) : (
          /* ==================== PRODUCT SEARCH & GRID VIEW ==================== */
          <div className="space-y-6">
            {/* STOREFRONT CATALOG HEADER BAR */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#172b4d] pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <span>Storefront Product Catalog</span>
                  <Badge variant="outline" className="border-[#0070BA]/60 text-[#38bdf8] bg-[#002952] text-xs">
                    Channel3 Live Discovery
                  </Badge>
                </h2>
                <p className="text-xs text-[#8ea9cb] mt-1">
                  Search 100M+ items across 25,000+ verified retailers. 90-day cash flow simulation protects your $500 safety buffer.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#070e1b] border border-[#162846] text-xs text-[#cbd5e1]">
                  <Wallet className="w-3.5 h-3.5 text-[#34d399]" />
                  <span>Sandbox Balance: <strong className="text-white font-mono">$1,850.00</strong></span>
                </div>

                <Link
                  href="/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0070BA] hover:bg-[#005ea6] text-white font-bold text-xs shadow-md transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                  <span>AG Grid Ledger &rarr;</span>
                </Link>
              </div>
            </div>

            {/* CURATED CATEGORY CHIPS TOOLBAR */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#8ea9cb] px-1">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Popular Categories</span>
                <span>Click to filter instantly across 25,000+ merchants</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORY_CHIPS.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategoryQuery === cat.query;
                  return (
                    <button
                      type="button"
                      key={cat.query}
                      onClick={() => setActiveCategoryQuery(cat.query)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition ${
                        isActive
                          ? "bg-[#0070BA] text-white shadow-md"
                          : "bg-[#0b1629] hover:bg-[#10203a] text-[#8ea9cb] hover:text-white border border-[#172b4d]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Official Channel3 ProductSearch UI Component (Preloaded with Active Category) */}
            <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-4 sm:p-6 shadow-xl">
              <ProductSearch
                key={activeCategoryQuery}
                fetchSearch={fetchSearch}
                searchBrands={searchBrands}
                searchWebsites={searchWebsites}
                searchCategories={searchCategories}
                filtersLayout="bar"
                imageSearch={true}
                searchOnMount={true}
                initialQuery={activeCategoryQuery}
                placeholder={`Search for products in ${activeCategoryQuery}, or upload an image to find similar items...`}
                onSelect={(product) => {
                  setSelectedProduct(product);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#172b4d] bg-[#081222] py-6 text-xs text-[#64748b] text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PayPal Guardian Commerce — Built with Channel3 SDK, Next.js, and PayPal Sandbox APIs.</p>
          <div className="flex items-center gap-4 text-[#8ea9cb]">
            <span>Channel3 SDK 4.6</span>
            <span>•</span>
            <span>PayPal AI Toolkit</span>
            <span>•</span>
            <span>Affiliate Revenue Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

