# AG Grid & AG Studio Developer Documentation

> Comprehensive guide and reference for **AG Grid**, **AG Studio**, and the **Studio Agent Framework**, tailored for the **PayPal AI Hackathon 2026** ($10,000 AG Grid Sponsor Prize Pool).

---

## Table of Contents
1. [Hackathon AG Grid Prize & Judging Criteria](#1-hackathon-ag-grid-prize--judging-criteria)
2. [Official Hackathon Boilerplate Architecture](#2-official-hackathon-boilerplate-architecture)
3. [AG Studio Agent Framework](#3-ag-studio-agent-framework)
4. [AG Studio Quickstart & Setup (React)](#4-ag-studio-quickstart--setup-react)
5. [Custom Widgets, Data Mapping & Cross-Filtering](#5-custom-widgets-data-mapping--cross-filtering)
6. [AG Grid & AG Charts Custom Theming](#6-ag-grid--ag-charts-custom-theming)
7. [Python & Streamlit AG Grid Integration (`streamlit-aggrid`)](#7-python--streamlit-ag-grid-integration-streamlit-aggrid)
8. [Judges' Checklist to Win the $5,000 AG Grid Award](#8-judges-checklist-to-win-the-5000-ag-grid-award)

---

## 1. Hackathon AG Grid Prize & Judging Criteria

### Prize Structure ($10,000 Total Cash across 5 Winners)
- **1st Place:** $5,000 USD (Cash)
- **2nd Place:** $2,000 USD (Cash)
- **3rd Place:** $1,000 USD (Cash)
- **4th Place:** $1,000 USD (Cash)
- **5th Place:** $1,000 USD (Cash)

### Official Challenge Statement
> **"Best Use of AG Grid"** covers both what your dashboard looks like and how you build it.  
> Show us polish: custom widgets, theming, and layout tools, not just AG Grid or AG Charts on their own.  
> Take the **Studio Agent Framework** for a spin: a custom agent talking to Studio's built-in agents, or a swapped-in harness.

### Judges & Evaluation Team
- **Eddie Jaoude** — Founder of EddieHub, Developer Advocate, Author of the official PayPal-AG Grid hackathon boilerplate.
- **Sylwia Vargas** — Developer Relations Lead at AG Grid.

### Suggested Project Angles from AG Grid
- **Anomaly-Alert Agent:** Monitors transaction streams and auto-builds widgets flagging suspicious spikes, chargebacks, or failed payments.
- **Storefront / Merchant Analytics:** Revenue-by-product widgets, refund rate tiles, geographic sales maps.
- **Natural-Language Finance Agent:** E.g., *"Show PayPal revenue by customer segment"*, *"Simulate our runway if cash drops 20%"*, or *"Can I afford this purchase given recurring bills?"*
- **Nonprofit Donation Dashboard:** Live PayPal donation feed, donor leaderboard, campaign progress bars.

---

## 2. Official Hackathon Boilerplate Architecture

The official hackathon starter is hosted at [`paypaldev/hackathon-paypal-ag-grid-boilerplate`](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate).

### Tech Stack
- **Framework:** Next.js 15 (App Router, React Server Components)
- **Language:** TypeScript 98.6%
- **Grid & Dashboarding:** `ag-grid-react`, `ag-charts-react`, `ag-studio-react` (`@ag-grid-community`)
- **Backend:** Native Node.js `fetch` (No SDK, modern REST API v1/v2 direct calls)
- **AI Backend:** OpenAI API via server-side streaming proxy

### File Structure
```
lib/
  paypal.ts               # OAuth2 token cache, pagination, retries, snake_case typing
  dashboard-data.ts       # Joins PayPal endpoints into relational tabular schemas
app/
  (endpoints)/            # Dedicated endpoint pages, each rendering an AG Grid
    balances/page.tsx     # GET /v1/reporting/balances
    invoices/page.tsx     # GET /v2/invoicing/invoices -> GET /v2/invoicing/invoices/{id}
    plans/page.tsx        # GET /v1/billing/plans -> GET /v1/billing/plans/{id}
    products/page.tsx     # GET /v1/catalogs/products -> GET /v1/catalogs/products/{id}
    transactions/page.tsx # GET /v1/reporting/transactions (max 31 days per call)
    data-grid.tsx         # Shared reusable DataGrid component
  dashboard/              # The AG Studio self-serve dashboard
    page.tsx              # Fetches all 5 endpoints concurrently and renders AgStudio
    studio/               # Studio data sources, relationships, custom widgets & agents
  api/
    ai/responses/route.ts # Server-side proxy streaming LLM responses to browser
```

### Key PayPal Endpoint Quirks Documented in Boilerplate
1. **Summary vs. Full Detail:** List endpoints (`/v1/catalogs/products`, `/v1/billing/plans`, `/v2/invoicing/invoices`) only return bare summaries. To show full line items or billing cycles, you must fetch each item by ID.
2. **Transaction Search Constraints:**
   - Maximum range per request is **31 days**.
   - Dates must be ISO-8601 **without fractional seconds** (e.g., `2026-10-01T00:00:00Z`).
   - Use `fields=all` to include `payer_info` in each `transaction_info`.
   - Event codes use PayPal T-codes: `T0001` (Payout), `T0006` (Payment), etc.
   - Status codes: `S` (Success), `P` (Pending), `D` (Denied), `V` (Reversed), `F` (Partially Refunded).
3. **Money Columns:** All PayPal monetary amounts are returned as `{ value: "100.00", currency_code: "USD" }`. The grid implements a custom column type `type: 'money'` that dynamically formats the number using the row's specific currency code.

---

## 3. AG Studio Agent Framework

The **Studio Agent Framework** connects LLMs directly into AG Studio dashboards, allowing both users and autonomous agents to build, modify, query, and cross-filter widgets cooperatively.

### Core Philosophy
- **Agents and Users are Co-equals:** Anything an agent can do (add widgets, change filters, edit layout), the human user can also tweak manually, eliminating the "90% accuracy trap".
- **Deterministic Guardrails via Tools:** Security is enforced by **limiting tools**, not by system prompt begging. An agent only receives tools it is permitted to execute.
- **Zero AG Grid Telemetry:** Studio has no internal model or remote servers; all data stays between your application and your chosen LLM provider.

### The Agent Contract (`AgAiAgentDefinition`)
Every agent in the framework adheres to this contract:

```typescript
export interface AgAiAgentDefinition {
  /** Stable identifier referenced in conversation threads */
  id: string;
  /** Human-readable name displayed in the chat roster */
  name: string;
  /** Short description shown to delegating agents */
  description: string;
  /** Parameter schema when delegated to (return s.undefined() if param-less) */
  schema: () => any;
  /** System instructions callback (re-evaluated per run to capture live schema) */
  instructions: () => string;
  /** Available tools callback (re-resolved dynamically) */
  tools: () => AgAiTool[];
  /** Optional tools executed automatically before turn 1 to seed context */
  defaultToolCalls?: () => Array<{ tool: AgAiTool; args: any }>;
  /** Safety cutoff for agent turns (default: 100) */
  maxTurns?: number;
}
```

### The Three Agent Runners

| Runner | You Bring | Studio Runs Turn Loop | Studio Executes Tools | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **`directLlmRunner`** | Model Adapter | **Yes** | **Yes** (Native) | Standard LLMs (OpenAI, Gemini, Anthropic) via API proxy |
| **`clientToolRunner`** | Request Stream | **Yes** | Any unresolved client tools | Remote agent backends that cannot touch browser DOM |
| **`customRunner`** | Complete Loop | **No** | **No** (Self-managed) | Custom agent SDKs (LangGraph, CrewAI, AutoGen) |

#### Example: `directLlmRunner`
```typescript
import { directLlmRunner } from 'ag-studio';

export const financialAnalystAgent = directLlmRunner({
  id: 'financial_guardian',
  name: 'Financial Guardian Agent',
  description: 'Audits PayPal transactions and simulates 90-day cash flow.',
  adapter: myStreamingAdapter,
  instructions: () => `You are an expert financial analyst. Analyze current balance, upcoming recurring bills, and projected cash flow before approving new purchases.`,
  tools: () => [
    studio.viewSchema(),
    studio.executeQuery(),
    studio.addWidget(),
    studio.configureWidget()
  ]
});
```

### AG-UI Protocol Compatibility
AG Studio emits and receives events using the open standard **[AG-UI](https://docs.ag-ui.com/)** wire vocabulary:
- `RUN_STARTED`
- `TEXT_MESSAGE_CONTENT`
- `TOOL_CALL_START`
- `TOOL_CALL_RESULT`
- `RUN_FINISHED`

AG Studio ships with zero third-party runtime dependencies. Events are structurally compatible without importing extra `@ag-ui/*` packages.

### Multi-Agent Rosters & Delegation
```typescript
import { createAiHarness } from 'ag-studio';

export const harness = createAiHarness(api, ({ tools }) => ({
  agents: [triageLeadAgent, transactionAuditorAgent, cashFlowSimulatorAgent],
  primary: 'triage_lead' // The only agent the human user talks to directly
}));
```
When `triageLeadAgent` determines a query requires deep financial simulation, it invokes `tools.delegateTo(['cash_flow_simulator'])`. Studio spawns a sub-agent thread and renders an expandable child run in the chat panel.

---

## 4. AG Studio Quickstart & Setup (React)

### 1. Installation
```bash
npm install ag-studio-react ag-grid-react ag-charts-react
```

### 2. Development Mode Validations
In development, enable dev validations to catch misconfigured widget schemas early:
```typescript
import { enableStudioDevValidations } from 'ag-studio';

if (process.env.NODE_ENV !== 'production') {
  enableStudioDevValidations();
}
```

### 3. Rendering AG Studio
```tsx
'use client';
import React, { useMemo } from 'react';
import { AgStudio } from 'ag-studio-react';

export default function PayPalDashboard({ transactions, balances }) {
  const data = useMemo(() => ({
    sources: [
      { id: 'transactions', data: transactions },
      { id: 'balances', data: balances }
    ]
  }), [transactions, balances]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AgStudio data={data} mode="edit" />
    </div>
  );
}
```

### 4. License Setup
AG Studio offers a free 45-day evaluation license for hackathons:
1. Obtain evaluation key at [ag-grid.com/studio/license-pricing/](https://www.ag-grid.com/studio/license-pricing/).
2. Pass key via environment variable:
```tsx
import { AgStudioProvider } from 'ag-studio-react';

<AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_KEY}>
  <AgStudio data={data} mode="edit" />
</AgStudioProvider>
```

---

## 5. Custom Widgets, Data Mapping & Cross-Filtering

Custom widgets allow you to introduce domain-specific visualizations (e.g., Cash Flow Forecast Curves, Safe-to-Spend Gauges, or PayPal Pay in 4 Breakdown Tiles) into AG Studio.

### The Custom Widget Definition (`AgWidgetDefinition`)
```typescript
import { AgWidgetDefinition, AgWidgetFormParams } from 'ag-studio';
import CashFlowChartComponent from './CashFlowChartComponent';

export const CashFlowForecastWidget: AgWidgetDefinition = {
  id: 'cash-flow-forecast',
  label: '90-Day Cash Flow Forecast',
  icon: { url: '/icons/forecast.svg' },
  comp: CashFlowChartComponent,
  defaultSize: { width: 600, height: 350 },
  minSize: { width: 300, height: 200 },
  
  // Define required fields for this widget
  dataMapping: {
    dateField: {
      type: 'field',
      supportedRoles: ['temporal', 'category'],
      requires: { cardinality: 'many' },
      required: true,
      aiDescription: 'The simulation date timeline.'
    },
    balanceField: {
      type: 'field',
      supportedRoles: ['numeric'],
      requires: { per: 'dataMapping.dateField', cardinality: 'one' },
      required: true,
      aiDescription: 'Projected net balance in home currency.'
    }
  },

  // Form configuration for Studio Edit Panel
  form: (params: AgWidgetFormParams<any>) => {
    return params.createDefaults({
      dataMappingItems: [
        { key: 'dateField', label: 'Date' },
        { key: 'balanceField', label: 'Projected Balance' }
      ],
      supportsCrossHighlight: true
    });
  },

  // AI discovery metadata
  ai: {
    description: 'Renders a 90-day cash flow projection curve with minimum safety buffer zones.'
  },

  featureConfig: {
    crossFilter: {
      supportsHighlight: true
    }
  }
};
```

### Display States in Custom Widgets
Inside the custom React component, update the display state so AG Studio can manage overlays:
```typescript
export default function CashFlowChartComponent({ widgetApi, dataMapping }) {
  useEffect(() => {
    async function loadData() {
      widgetApi.setDisplayState('loading');
      
      const query = {
        kind: 'flat',
        fields: [dataMapping.dateField[0], dataMapping.balanceField[0]],
        sort: [{ field: dataMapping.dateField[0], direction: 'asc' }]
      };
      
      const response = await widgetApi.getData(query);
      
      if (!response || response.results.length === 0) {
        widgetApi.setDisplayState('noData');
        return;
      }
      
      widgetApi.setDisplayState('displayed');
    }
    loadData();
  }, [dataMapping]);
  
  return <div id="chart-container">...</div>;
}
```

### Implementing Cross-Filtering
When a user clicks a row or a date range in your custom widget, filter the rest of the dashboard:
```typescript
function onDateBucketClick(selectedCategory, dateValue) {
  widgetApi.toggleCrossFilter({
    type: 'multiValue',
    values: [
      { field: 'category', value: selectedCategory },
      { field: 'transaction_date', value: dateValue }
    ],
    group: 0
  });
}
```

---

## 6. AG Grid & AG Charts Custom Theming

To qualify for the **"Show us polish: custom widgets and theming"** criteria:

### AG Grid Theming
Pass the studio theme token or custom theme parameters into the grid options:
```typescript
import { themeQuartz } from 'ag-grid-community';

const paypalDarkTheme = themeQuartz.withParams({
  backgroundColor: '#0b0f19',
  foregroundColor: '#f3f4f6',
  headerBackgroundColor: '#111827',
  headerTextColor: '#0070ba', // PayPal Blue accent
  accentColor: '#00cf92',       // Safe Green
  borderColor: '#1f2937',
  borderRadius: 8,
  fontFamily: 'Inter, sans-serif'
});
```

### AG Charts Theming in Custom Widgets
```typescript
import { getChartTheme } from 'ag-studio';

const chartOptions = {
  theme: getChartTheme(api), // Inherits active Studio palette
  background: {
    fill: 'transparent'
  },
  series: [
    {
      type: 'line',
      xKey: 'date',
      yKey: 'balance',
      stroke: '#0070ba',
      marker: { fill: '#00cf92' }
    }
  ]
};
```

---

## 7. Python & Streamlit AG Grid Integration (`streamlit-aggrid`)

If your project leverages Python (like our `PayPalGuardianAgent` core engine), you can deliver AG Grid experiences directly using `streamlit-aggrid`:

```python
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode, DataReturnMode
import pandas as pd

def render_paypal_transaction_grid(df: pd.DataFrame):
    """
    Renders an interactive AG Grid for PayPal transaction history
    with custom money formatting, filtering, and cross-row selection.
    """
    gb = GridOptionsBuilder.from_dataframe(df)
    
    # Configure pagination & selection
    gb.configure_pagination(paginationAutoPageSize=False, paginationPageSize=15)
    gb.configure_selection(selection_mode="single", use_checkbox=True)
    gb.configure_default_column(
        sortable=True,
        filterable=True,
        resizable=True,
        editable=False
    )
    
    # Custom currency & status column styling
    gb.configure_column(
        "gross_amount",
        header_name="Amount",
        type=["numericColumn", "numberColumnFilter"],
        valueFormatter="value.toLocaleString('en-US', {style: 'currency', currency: 'USD'})",
        cellStyle={"fontWeight": "bold"}
    )
    
    gb.configure_column(
        "status",
        header_name="Status",
        cellRenderer="""
        function(params) {
            let color = params.value === 'S' ? '#10b981' : (params.value === 'P' ? '#f59e0b' : '#ef4444');
            let text = params.value === 'S' ? 'COMPLETED' : (params.value === 'P' ? 'PENDING' : 'FAILED');
            return `<span style="color: ${color}; font-weight: 600;">${text}</span>`;
        }
        """
    )

    grid_options = gb.build()

    return AgGrid(
        df,
        gridOptions=grid_options,
        update_mode=GridUpdateMode.SELECTION_CHANGED,
        data_return_mode=DataReturnMode.FILTERED_AND_SORTED,
        theme="balham", # Or "alpine", "streamlit"
        fit_columns_on_grid_load=True
    )
```

---

## 8. Judges' Checklist to Win the $5,000 AG Grid Award

Before submitting your project to Devpost, verify every item below:

- [x] **Beyond Default Grid:** Project includes custom widgets, cards, and charts — not just a raw table.
- [x] **Theme Consistency:** Palette matches a clean, modern design system (e.g., PayPal Navy `#003087`, Electric Blue `#0070BA`, Mint `#00CF92`).
- [x] **Studio Agent Framework Integration:** AI agent either lives in AG Studio or dynamically triggers widget queries/mutations based on user conversation.
- [x] **Cross-Filtering:** Selecting a transaction or category dynamically updates linked forecast widgets.
- [x] **Real Data Pipelines:** Reads live PayPal Sandbox data (`/v1/reporting/transactions`, `/v1/reporting/balances`, `/v2/invoicing/invoices`).
- [x] **Public Codebase:** Clean repository with open-source MIT license, descriptive `README.md`, and clean environment setup instructions.

