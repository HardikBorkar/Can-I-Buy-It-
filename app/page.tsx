"use client";

import * as React from "react";
import type {
  Brand,
  CategorySummary,
  OptionValue,
  PriceHistoryResponse,
  Product,
  SearchFilters,
  Website,
} from "@channel3/sdk/resources";
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Percent,
  Store,
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductSearch } from "@/components/product-search";
import { ProductDetails } from "@/components/product-details";
import { useVariantSelection, type VariantResolveInput } from "@/hooks/use-variant-selection";
import type { SearchFetcher, SearchFetchInput } from "@/hooks/use-product-search";
import type { SimilarFetcher } from "@/hooks/use-product-recommendations";

export default function ShoppingPage() {
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = React.useState<PriceHistoryResponse | undefined>(undefined);
  const [paypalEvaluation, setPaypalEvaluation] = React.useState<any>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [checkoutStatus, setCheckoutStatus] = React.useState<string | null>(null);

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
  const fetchSimilar: SimilarFetcher = React.useCallback(async (input) => {
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
    product: selectedProduct || ({} as Product),
    resolve: variantResolver,
  });

  // Fetch price history and run PayPal Guardian simulation when a product is opened
  React.useEffect(() => {
    if (!selectedProduct?.id) {
      setPriceHistory(undefined);
      setPaypalEvaluation(null);
      setCheckoutStatus(null);
      return;
    }

    // Load price history
    fetch(`/api/channel3/price-history/${selectedProduct.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPriceHistory(data))
      .catch(() => {});

    // Run PayPal Guardian Cash Flow Evaluation
    const leadPrice = selectedProduct.offers?.[0]?.price.price || 150;
    setIsEvaluating(true);
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
        setPaypalEvaluation(evalData);
        setIsEvaluating(false);
      })
      .catch(() => setIsEvaluating(false));
  }, [selectedProduct?.id]);

  const activeProduct = selectedProduct ? resolvedProduct : null;
  const leadOffer = activeProduct?.offers?.[0];

  const handlePayPalCheckout = (usePayIn4: boolean) => {
    setCheckoutStatus("Processing order through PayPal Sandbox...");
    setTimeout(() => {
      setCheckoutStatus(
        usePayIn4
          ? `Order Authorized with PayPal Pay in 4! 4 installments of \$${(
              (leadOffer?.price.price || 100) / 4
            ).toFixed(2)} scheduled every 2 weeks.`
          : `Order Authorized with PayPal! Paid in full: \$${leadOffer?.price.price.toFixed(2)} USD.`
      );
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Banner & Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-400 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  PayPal Guardian <span className="text-blue-400">&amp; Commerce</span>
                </span>
                <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-400 bg-blue-500/10">
                  Channel3 AI
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Universal product catalog with 25,000+ merchants &amp; autonomous financial safety guardrails
              </p>
            </div>
          </div>

          {/* Monetization & Platform Trust Badges */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              <span>Affiliate Monetization Active (Up to 8% Commission)</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300">
              <Store className="w-3.5 h-3.5 text-blue-400" />
              <span>25,000+ Retailers Indexed</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Experience */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeProduct ? (
          /* ==================== PRODUCT DETAIL PAGE (PDP) ==================== */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Back Button & Breadcrumbs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProduct(null)}
                className="gap-2 border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Search Grid
              </Button>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Shop</span>
                <span>/</span>
                <span className="text-slate-300">{activeProduct.category?.title || "Products"}</span>
                <span>/</span>
                <span className="text-blue-400 truncate max-w-[200px] font-medium">{activeProduct.title}</span>
              </div>
            </div>

            {/* PayPal Guardian Cash Flow Shield Banner */}
            {paypalEvaluation && (
              <div className="p-4 rounded-xl border border-blue-900/60 bg-gradient-to-r from-blue-950/40 to-slate-900/80 shadow-md">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-teal-400" />
                      <span className="font-semibold text-sm text-white">
                        PayPal Guardian: 90-Day Cash-Flow Assessment
                      </span>
                      {paypalEvaluation.safe_in_full ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                          Safe to Buy in Full
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                          Recommend PayPal Pay in 4
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                      {paypalEvaluation.explanation}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {paypalEvaluation.pay_in_4.available && (
                      <Button
                        size="sm"
                        onClick={() => handlePayPalCheckout(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm"
                      >
                        <CreditCard className="w-4 h-4 mr-1.5" />
                        PayPal Pay in 4 (${paypalEvaluation.pay_in_4.first_payment_today.toFixed(2)} today)
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePayPalCheckout(false)}
                      className="border-slate-700 hover:bg-slate-800 text-slate-200"
                    >
                      Pay in Full (${paypalEvaluation.amount.toFixed(2)})
                    </Button>
                  </div>
                </div>

                {checkoutStatus && (
                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{checkoutStatus}</span>
                  </div>
                )}
              </div>
            )}

            {/* Official Channel3 ProductDetails UI Component */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
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
                      <Sparkles className="w-5 h-5 text-blue-400" />
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
            {/* Hero / Value Proposition */}
            <div className="text-center py-6 px-4 max-w-3xl mx-auto space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Shop 100M+ Products with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300">
                  Financial Guardian Guardrails
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Discover live prices across top stores like Nike, B&amp;H, Best Buy, and Target. Compare variant options,
                explore price history trends, and buy with verified cash-flow protection.
              </p>
            </div>

            {/* Official Channel3 ProductSearch UI Component (Faceted Filters at the Top) */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl">
              <ProductSearch
                fetchSearch={fetchSearch}
                searchBrands={searchBrands}
                searchWebsites={searchWebsites}
                searchCategories={searchCategories}
                filtersLayout="bar"
                imageSearch={true}
                searchOnMount={true}
                placeholder="Search across 25,000+ stores, or upload an image to find similar products..."
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
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PayPal Guardian Commerce — Built with Channel3 SDK, Next.js, and PayPal Sandbox APIs.</p>
          <div className="flex items-center gap-4 text-slate-400">
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
