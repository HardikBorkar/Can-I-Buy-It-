# PayPal Guardian: Autonomous AI Agent & Commerce Platform

> **Submitted to the PayPal AI Hackathon: Build What's Next with PayPal and AI**  
> *Target Awards:* **Grand Prize**, **Best Use of Agentic Commerce**, **Best Use of AG Grid** ($5,000 Cash), and **Best Use of Channel3** ($1,500 Cash).

---

## 🌟 The Problem
AI shopping agents and autonomous commerce tools are increasingly granted authority to transact on behalf of users. However, standard checkout bots lack situational awareness of the buyer's upcoming real-world liabilities. An agent that blindly executes purchases can easily overdraw an account or leave the user unable to cover essential commitments like rent, tuition, or utility bills.

## 🛡️ The Solution: PayPal Guardian & Channel3 Commerce
**PayPal Guardian** is the first intelligent shopping and agentic commerce platform equipped with **deterministic 90-day rolling cash-flow guardrails** and a **universal 25,000+ retailer product discovery engine**.

1. **Universal Multi-Merchant Discovery:** Search across 100M+ products from 25,000+ stores using text or image search powered by **Channel3**.
2. **Deterministic Financial Guardrails:** Guardian simulates the user's daily liquid balance over 90 days across recurring bills and paychecks before executing a purchase.
3. **Intelligent Payment Routing:** If paying in full breaches the safety buffer when upcoming recurring bills hit, Guardian autonomously routes to **PayPal Pay Later (Pay in 4)** with 4 bi-weekly payments.
4. **Built-in Affiliate Monetization:** Every product offer returns affiliate-tracked links that earn up to 8% sales commission.
5. **Interactive Analytics:** Powered by **AG Grid** and **AG Charts** for transaction auditing and multi-dimensional analytics.

---

## 🏗️ Architecture & Sponsor Integrations

```mermaid
flowchart TD
    User([User / Consumer]) -->|Text or Image Search & Natural Language| Store[Next.js Channel3 Storefront]
    
    subgraph Channel3 Ecosystem
        C3API[Channel3 SDK 4.6 & UI Registry]
        C3Search[Text & Image Search API]
        C3PDP[Product Details & Variant Selector]
        C3Similar[Similar Products Recommender]
        C3Affiliate[Affiliate Monetization Links]
    end

    subgraph PayPal Developer Platform
        OAuth[OAuth 2.0 Token Lifecycle]
        Balances[Balances API /v1/reporting/balances]
        TxSearch[Transaction Search /v1/reporting/transactions]
        Orders[Orders API v2 with Pay Later]
        Invoices[Invoicing API v2 Dispatch]
    end

    subgraph Guardian Simulation Engine
        Adapter[PayPal Context Adapter]
        Sim[90-Day Cash Flow Simulator]
        Reconciler[Financial Invariant Reconciler]
    end

    subgraph AG Grid & Analytics
        AGGrid[AG Grid Ledger]
        AGCharts[AG Charts 90-Day Forecast]
    end

    Store --> C3API
    C3API --> C3Search
    C3API --> C3PDP
    C3API --> C3Similar
    C3API --> C3Affiliate

    Store -->|Run Cash-Flow Assessment| Adapter
    Adapter --> Sim
    Sim --> Orders
    Sim --> AGGrid
    Sim --> AGCharts
```

---

## 🚀 Key Features

### 1. Channel3 Multi-Store Shopping Experience
- **Faceted Search at the Top:** Text search, category selector, brand filter, color palette filters, and price range sliders.
- **Image Search:** Upload any product image to find matching or visually similar items across merchants.
- **Hydrated Product Detail Page (PDP):**
  - High-res image gallery with clean thumbnails.
  - Interactive variant selection (size, color, memory, kit options) using `useVariantSelection`.
  - Multi-merchant price comparison (Nike, B&H, Best Buy, Target, Amazon).
  - Price history chart (90-day tracking trends).
  - "More Like This" similar products carousel.
  - Seamless "Back to Grid" breadcrumb navigation.
- **Affiliate Monetization:** Commission-earning links generated for every merchant offer.

### 2. PayPal Guardian Financial Engine
- **Autonomous Safe-to-Spend Evaluation:** Ingests live account balance, monthly recurring obligations, and minimum cash reserve buffers.
- **PayPal Pay in 4 Routing:** When a single lump-sum payment is risky, Guardian automatically calculates the 4 bi-weekly payments and evaluates if they are safe.
- **Orders v2 Checkout:** Creates PayPal orders with Pay Later funding options using `PayPal-Request-Id` UUID idempotency.
- **Autonomous Invoicing:** Automatically drafts, formats, and dispatches v2 invoices for freelancers and merchants.

### 3. AG Grid Financial Dashboard
- **Interactive Transaction Ledger:** Custom currency formatting, status badges, column filtering, and sorting.
- **90-Day Projected Curve:** Visualizes safe balance thresholds, paydays, and scheduled debits.

---

## 💻 Tech Stack & API Credentials

| Component | Technology | Version |
| :--- | :--- | :--- |
| **Frontend Storefront** | Next.js App Router, React 19, Tailwind CSS v4, Lucide | 16.4 |
| **Catalog & Discovery** | `@channel3/sdk`, Channel3 shadcn UI Registry | 4.6.0 |
| **Payment Gateway** | PayPal REST APIs v2 (Orders, Invoicing, Reporting) | v2 / v1 |
| **Data Grid & Charts** | AG Grid, AG Charts, Streamlit-AGGrid | Latest |
| **AI & Mathematical Engine** | Python 3.14, Pydantic, TanStack React Query | v5 |

---

## 🛠️ Quickstart & Local Setup

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/paypal-guardian.git
cd paypal-guardian

# Install Node.js frontend dependencies (Next.js, Channel3 UI, SDK)
npm install

# (Optional) Install Python dependencies for the standalone simulation engine
pip install -r requirements.txt
```

### 2. Environment Variables
Create a `.env.local` or `.env` file in the root directory:
```env
# PayPal Sandbox Credentials (developer.paypal.com)
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

# Channel3 API Key (Promo Code: PAYPAL-HACKATHON-2026 for 20,000 free credits)
CHANNEL3_API_KEY=your_channel3_api_key_here

# (Optional) AI Model Keys
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If `CHANNEL3_API_KEY` or `PAYPAL_CLIENT_ID` are left unset, the platform runs in realistic simulation mode so you can test all features immediately).*

### 3. Run the Channel3 E-Commerce Storefront
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** to experience:
- Text and Image Search with top filters.
- Real-time product results grid.
- Interactive PDP with variant selection, multi-merchant offers, and price history.
- PayPal Guardian safe-to-spend analysis on every product.
- Similar products carousel with instant navigation.

### 4. Run the AG Grid Financial Ledger & Simulator
```bash
streamlit run src/web_app.py
```
Open **[http://localhost:8501](http://localhost:8501)** for the interactive AG Grid transaction audit and 90-day cash flow curve.

---

## 📜 Submission Checklist & Rules Compliance

- [x] **Channel3 Skill & Components:** Skill installed (`.agents/skills/channel3-api`), shadcn UI components installed (`ui.trychannel3.com/r/all.json`), `@channel3/sdk` 4.6.
- [x] **Text & Image Search:** Text query, image file upload, and faceted filters at the top (`filtersLayout="bar"`).
- [x] **Grid & PDP Navigation:** Product grid with one-click transition to PDP, variant options resolution, price history, similar items carousel, and back button.
- [x] **Affiliate Monetization:** All merchant offers display commission earning rates and link via tracked affiliate URLs (`rel="sponsored noopener noreferrer"`).
- [x] **PayPal Developer REST API Integration:** Orders v2 with Pay Later, Invoicing v2, Balances, and Transaction Search.
- [x] **AG Grid Sponsor Prize:** Polished AG Grid transaction ledger with money formatting and dynamic status renderers.
- [x] **Open-Source MIT License:** Full code repository eligible for all Devpost awards.

---

---

## 📁 Project Structure

```
├── app/                  # Next.js App Router (Storefront & API routes)
│   ├── api/channel3/     # Server-side Channel3 Search, Products, Similar APIs
│   ├── api/paypal/       # PayPal Guardian Cash Flow Evaluation API
│   ├── page.tsx          # Main Storefront: Search, Top Filters, Grid & PDP
│   └── layout.tsx        # App layout with TanStack Query Providers
├── components/           # Channel3 UI Component Kit (shadcn)
│   ├── product-search.tsx# Search bar + Top faceted filters + Product grid
│   ├── product-details.tsx# PDP with gallery, variants, offers, price history
│   └── ui/               # Base UI & Radix UI primitives
├── docs/                 # Official Hackathon Documentation & Research
│   ├── HACKATHON_CONTEXT.md# Devpost rules, sponsor tracks & prize criteria
│   ├── PAYPAL_DEV_DOCS.md# PayPal REST v2, Orders, Invoicing & Agent Toolkit
│   └── AG_GRID_DEV_DOCS.md# AG Grid & AG Studio Agent Framework Guide
├── hooks/                # Channel3 React hooks (search, variants, recommendations)
├── lib/                  # Channel3 server client, formatters, and search types
├── src/                  # Python PayPal Guardian Agent & Simulation Engine
│   ├── engine/           # 90-day cash flow simulator & financial reconciler
│   ├── paypal_client.py  # PayPal REST v2 client (OAuth, Balances, Orders, Invoicing)
│   ├── agent.py          # PayPalGuardianAgent orchestrator
│   └── web_app.py        # Streamlit + AG Grid Interactive Dashboard
└── paypal-ai-hackathon/  # Archived reference dataset and models from initial build
```

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
