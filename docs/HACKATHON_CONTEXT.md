# PayPal AI Hackathon: Context & Reference Guide

> **Official Devpost:** [paypalaihackathon.devpost.com](https://paypalaihackathon.devpost.com/)  
> **Source Documents:** Scraped via Firecrawl from `paypalaihackathon.devpost.com/` and `paypalaihackathon.devpost.com/rules`.

---

## 1. Hackathon Overview & Theme

### Core Objective
The theme of the hackathon is **"Build What’s Next with PayPal and AI"**. PayPal moves money for millions of consumers and businesses globally every day; the goal is to open up this platform and explore what happens when AI agents and workflows take the wheel.

There are **no prescribed tracks or rigid problem statements**. Entrants are free to build an agent, an automation, a payment experience, a merchant productivity tool, or a consumer app.

### The Fundamental Requirement
> **The project must meaningfully integrate both PayPal and AI.**

---

## 2. Required Tech Stack / APIs

### Core PayPal Platform Requirement:
* Must integrate the **PayPal Developer Platform** using the free [PayPal Sandbox environment](https://developer.paypal.com/).
* Eligible PayPal technologies include:
  * **PayPal JavaScript SDK (v6)** & **Checkout**
  * **PayPal REST APIs** (Payments, Orders, Pay Later, Subscriptions, Invoicing, Payouts, Disputes, Webhooks)
  * **Services & subsidiaries under the PayPal umbrella:** Venmo, Braintree, Xoom, Honey, Zettle, Paidy, Hyperwallet, Simility, Swift Financial.
  * **Official AI / Agent Frameworks:**
    * **PayPal AI Toolkit on GitHub:** [github.com/paypal/AI-Toolkit](https://github.com/paypal/AI-Toolkit)
    * **PayPal AI Docs & Agent Toolkit:** [docs.paypal.ai](https://docs.paypal.ai/)
    * **PayPal MCP Server Quickstart:** [docs.paypal.ai/developer/tools/ai/mcp-quickstart](https://docs.paypal.ai/developer/tools/ai/mcp-quickstart)

### AI Tool / Model Requirement:
* Any AI model, tool, LLM, or agent framework can be used (e.g., OpenAI, Anthropic, Google Gemini, local models, LangChain, LlamaIndex, CrewAI, AutoGen, etc.).
* AI must be a **meaningful, functional component** of the experience (e.g., autonomous decision making, conversational commerce, multi-agent settlement, RAG/vector retrieval, intelligent financial analysis) — not just a cosmetic feature.

### Optional Partner / Sponsor Integrations:
Sponsor tools are optional, but integrating them unlocks dedicated prize pools:
* **AG Grid:** AG Studio & Studio Agent Framework (data grids, dashboards, conversational widgets).
* **APIMatic:** Context Plugins for AI coding agents & SDK generation.
* **Channel3:** Product discovery & normalization API (100M+ products, 25k+ retailers) + MCP server.
* **Render:** App & worker deployment, Render Workflows (distributed agent orchestration).
* **Elastic:** Elasticsearch vector/hybrid search, Elastic Agent Builder, ES|QL.
* **Zapier:** Zapier MCP connecting 9,000+ business applications.
* **Bryntum:** Gantt, Scheduler, and Calendar UI components.
* **KERNEL:** Cloud browser infrastructure for agents with anti-bot bypass.
* **Astropods:** Agent OS & runtime for deploying/monitoring agents.
* **Postman:** PayPal API collection and testing environment.

---

## 3. Tracks & Prizes

Total Prize Pool: **$67,500+ USD in Cash + Partner Credits / Subscriptions**

### Grand Prizes (Open to all eligible submissions):
* **1st Place:** $12,000 USD Cash (1 winner)
* **2nd Place:** $8,000 USD Cash (1 winner)
* **3rd Place:** $5,000 USD Cash (1 winner)

### Category & Honorable Mention Awards ($5,000 Cash each):
* **Most Creative ($5,000):** Most novel, unexpected, and imaginative concept.
* **Most Impactful ($5,000):** Credible solution solving a major real-world problem for a large or underserved audience.
* **Best Demo Delivery ($5,000):** Clear, polished, and compelling video demonstration.
* **Best Use of PayPal + AI ($5,000):** Deepest and most seamless technical pairing between PayPal capabilities and AI.
* **Best Use of Agentic Commerce ($5,000):** Autonomous agents transacting, negotiating, or executing commerce workflows on behalf of users or other agents.

### Sponsor Awards:
* **Best Use of AG Grid:**
  * 1st Place: $5,000 USD Cash
  * 2nd Place: $2,000 USD Cash
  * 3rd Place: $1,000 USD Cash (3 winners)
* **Best Use of APIMatic:** $1,000 USD Cash + 6 months APIMatic Business subscription (3 winners)
* **Best Use of Bryntum:** $1,000 USD Cash (3 winners)
* **Best Use of Channel3:** $1,500 USD Cash (1 winner)
* **Best Use of Render:**
  * 1st Place: $1,000 Render Credits
  * 2nd Place: $750 Render Credits
  * 3rd Place: $500 Render Credits

> **Prize Rule Constraint:** A single project can win at most:
> - One (1) Grand Prize + One (1) Sponsor Prize, **OR**
> - One (1) Honorable Mention Prize + One (1) Sponsor Prize.

---

## 4. Submission Deliverables

To be considered an eligible, passing submission:

1. **Public Code Repository:**
   * Hosted on GitHub, GitLab, or Bitbucket.
   * Must be public and include a recognized **Open Source license file** visible at the repository root / About section.
   * Must contain complete source code, configuration files, and assets needed to run.
2. **Functional Demo & Testing Access:**
   * **Hosted Demo URL** (preferred), **OR** clear, end-to-end local setup and execution instructions in `README.md`.
   * Any sandbox credentials, test cards, or API access required for testing must be documented.
   * *A static mockup, design wireframe, or non-functional prototype is strictly disqualified.*
3. **Demo Video:**
   * **Strict duration limit: Under 3 minutes (180 seconds).** Judges are not required to watch past the 3-minute mark.
   * Must be uploaded to YouTube (Public or Unlisted).
   * Must show real footage of the working software operating end-to-end on its intended device/platform.
   * Must not contain copyrighted music or unauthorized third-party IP.
4. **Written Project Overview:**
   * Summary of features and architecture.
   * Explicit list of all AI models, tools, and developer APIs utilized and how they function together.

---

## 5. Judging Criteria

Judging consists of a **Two-Stage Process**:
* **Stage One (Pass/Fail):** Baseline viability check confirming the project fits the theme and reasonably incorporates PayPal APIs/SDKs and AI.
* **Stage Two (Scoring):** Evaluated across **5 equally-weighted criteria (20% each)**:

| Criterion | Weight | Key Assessment Questions |
| :--- | :---: | :--- |
| **Technological Implementation** | 20% | How thoroughly and skillfully does the project use the PayPal Developer Platform and AI tool(s)? Does it reflect genuine effort with a working, non-trivial technical implementation? |
| **Design** | 20% | Does the project deliver a complete, coherent product experience — not just a raw proof of concept? Is UI/UX intuitive and polished? |
| **Potential Impact** | 20% | Does the project make a credible, specific case for solving a real problem for a real audience? Does the solution address that problem effectively? |
| **Innovation / Idea** | 20% | How creative and novel is the concept? Does the project differ from existing market solutions? |
| **Presentation** | 20% | Does the video clearly demonstrate the application working end-to-end? Does the pitch communicate what problem is solved, who it's for, and why it matters? |

*Tie-Breaker Rule:* If scores tie, the tie is broken first by *Technological Implementation*, then by *Design*, then *Potential Impact*, and so forth.

---

## 6. Key Deadlines

* **Submission Deadline:** **Thursday, November 12, 2026 @ 12:00 PM Pacific Time (3:00 PM Eastern Time)**
* **Judging Period:** December 1, 2026 – December 15, 2026
* **Winners Announced:** On or around December 21, 2026

