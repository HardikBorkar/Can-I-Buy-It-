# Token Usage & Cost Analysis Report

## 1. Final Full-Dataset Evaluation Run (Cached)

This run generated `output.csv` for all 250 evaluation requests (`request_26` through `request_275`).

| Model Provider | Model Name | Model Calls | Input Tokens | Output Tokens | Total Tokens | Estimated Cost (USD) |
|---|---|---|---|---|---|---|
| Google | gemini-2.5-flash | 0 | 0 | 0 | 0 | $0.00 |

### Per-Request Efficiency (250 Requests)
* **Average API Calls per Request:** 0.00
* **Average Tokens per Request:** 0.00
* **Average Cost per Request:** $0.0000

---

## 2. Multimodal Perception Baseline (One-Time Ingestion)

Token expenditure for the 16 receipt extractions (`dataset/media/images/`) used to populate `dataset/cache/image_extractions.json`:

| Model Provider | Model Name | Model Calls | Input Tokens | Output Tokens | Total Tokens | Estimated Cost (USD) |
|---|---|---|---|---|---|---|
| Google | gemini-2.5-flash | 16 | 4,928 | 480 | 5,408 | $0.0005 |

### Amortized Cost Over 250 Requests
* **Amortized Calls per Request:** 0.064 calls/req
* **Amortized Tokens per Request:** 21.63 tokens/req
* **Amortized Cost per Request:** $0.000002/req

---

## 3. Architecture & Optimization Summary

* **Multimodal Perception:** `gemini-2.5-flash` with structured Pydantic schema validation extracts missing transaction amounts and currencies from unstructured receipts.
* **Zero-Latency Invariant:** Extractions persist to `dataset/cache/image_extractions.json`, preventing redundant network calls, API rate-limiting, and non-deterministic latency spikes during batch evaluation.
* **Deterministic Financial Core:** Ledger reconciliation, 90-day cash flow projections, and the 6-tier tie-breaker execute purely via Python `Decimal` state machines, eliminating LLM arithmetic hallucinations and token waste.