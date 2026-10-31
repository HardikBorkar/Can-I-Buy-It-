"""
End-to-End Pipeline Orchestrator (Phase 6).
Ingests all 250 evaluation requests from dataset/requests.csv,
runs the full pipeline (Loader → Reconciliation → Simulation → Plan Selection),
and emits dataset/output.csv and evaluation/usage_report.md.
"""

import csv
import json
import os
import sys
from pathlib import Path

# Add code/ to sys.path for module imports
ROOT_DIR = Path(__file__).resolve().parent
CODE_DIR = ROOT_DIR / "code"
sys.path.insert(0, str(CODE_DIR))

from data_loader import FinancialDataLoader
from reconciler import FinancialReconciler
from plan_selector import PlanSelector, format_output_number


def process_request(data_loader: FinancialDataLoader, request_id: str) -> dict:
    """Process a single request through the full pipeline and return result dict."""
    context = data_loader.get_context(request_id)
    reconciled_events = FinancialReconciler.reconcile(context, data_loader.currency_graph)
    return PlanSelector.select_plan(context, reconciled_events)


def run_pipeline():
    """Run the full pipeline on all 250 evaluation requests."""
    print("=" * 60)
    print("Buy or Wait? — End-to-End Pipeline")
    print("=" * 60)

    # Initialize data loader
    data_loader = FinancialDataLoader("dataset")

    # Get all evaluation request IDs (request_26 through request_275)
    eval_request_ids = data_loader.get_evaluation_request_ids()
    print(f"Processing {len(eval_request_ids)} evaluation requests...")

    # Process each request
    results = []
    for i, req_id in enumerate(eval_request_ids, 1):
        try:
            result = process_request(data_loader, req_id)
            results.append(result)
            if i % 50 == 0 or i == len(eval_request_ids):
                print(f"  [{i}/{len(eval_request_ids)}] Processed {req_id}")
        except Exception as e:
            print(f"  ERROR processing {req_id}: {e}")
            # Write a not_recommended fallback row
            results.append({
                "request_id": req_id,
                "amount_safe_to_pay": 0,
                "affordability_status": "not_affordable",
                "recommended_payment_method": "not_recommended",
                "payment_plan": "none",
                "earliest_date_for_full_payment": "",
                "spending_changes_needed": "none",
                "decision_explanation": f"Error processing request: {e}",
            })

    # Write output CSV to both root and dataset/ locations
    output_paths = [ROOT_DIR / "output.csv", ROOT_DIR / "dataset" / "output.csv"]
    columns = [
        "request_id",
        "amount_safe_to_pay",
        "affordability_status",
        "recommended_payment_method",
        "payment_plan",
        "earliest_date_for_full_payment",
        "spending_changes_needed",
        "decision_explanation",
    ]

    for output_path in output_paths:
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            for row in results:
                # Format amount_safe_to_pay for clean output
                formatted_row = dict(row)
                formatted_row["amount_safe_to_pay"] = format_output_number(
                    row["amount_safe_to_pay"]
                )
                writer.writerow(formatted_row)

        print(f"\nOutput written to {output_path}")
        print(f"  Total rows: {len(results)} (+ 1 header = {len(results) + 1} lines)")

        # Validate output
        _validate_output(output_path, len(results))

    # Generate usage report
    _generate_usage_report(len(results))

    print("\nPipeline complete!")
    return results


def _validate_output(output_path: Path, expected_rows: int):
    """Validate output CSV has correct row count and no null required fields."""
    with open(output_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    assert len(rows) == expected_rows, (
        f"Expected {expected_rows} rows, got {len(rows)}"
    )

    required_fields = [
        "request_id",
        "amount_safe_to_pay",
        "affordability_status",
        "recommended_payment_method",
        "payment_plan",
        "spending_changes_needed",
        "decision_explanation",
    ]
    for i, row in enumerate(rows):
        for field in required_fields:
            val = row.get(field, "")
            assert val is not None and val != "", (
                f"Row {i} ({row['request_id']}): required field '{field}' is null/empty"
            )

    print("  Validation passed: all required fields non-null")


def _generate_usage_report(n_requests: int):
    """Generate evaluation/usage_report.md from cached token usage data."""
    token_path = ROOT_DIR / "dataset" / "cache" / "token_usage.json"
    usage = {"model_calls": 0, "prompt_tokens": 0, "candidate_tokens": 0, "total_tokens": 0}
    if token_path.exists():
        with open(token_path, "r") as f:
            usage = json.load(f)

    model_calls = usage.get("model_calls", 0)
    prompt_tokens = usage.get("prompt_tokens", 0)
    candidate_tokens = usage.get("candidate_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    per_req_calls = model_calls / n_requests if n_requests > 0 else 0
    per_req_tokens = total_tokens / n_requests if n_requests > 0 else 0

    report = f"""# Token Usage Report

## Final Full-Dataset Run Summary

### Model Information
| Provider | Model | Purpose |
|----------|-------|---------|
| Google | gemini-2.5-flash | Receipt image extraction (VLM) |

### Token Usage
| Metric | Value |
|--------|-------|
| Total API Calls | {model_calls} (all cached) |
| Prompt Tokens | {prompt_tokens} |
| Candidate Tokens | {candidate_tokens} |
| Total Tokens | {total_tokens} |

### Cost Analysis
| Metric | Value |
|--------|-------|
| Total Cost | $0.00 (cached extractions) |
| Per-Request Cost | $0.00 |

### Per-Request Averages ({n_requests} requests)
| Metric | Value |
|--------|-------|
| API Calls per Request | {per_req_calls:.2f} |
| Tokens per Request | {per_req_tokens:.2f} |

### Architecture Notes
- All 16 receipt image extractions are pre-cached in `dataset/cache/image_extractions.json`
- Financial computation (reconciliation, simulation, plan selection) is fully deterministic
- No LLM calls are needed during the evaluation pipeline run
- Token usage reflects only the image extraction phase (one-time cost)
"""

    # Write to both evaluation/ directories
    for eval_dir in [ROOT_DIR / "evaluation", ROOT_DIR / "code" / "evaluation"]:
        eval_dir.mkdir(parents=True, exist_ok=True)
        report_path = eval_dir / "usage_report.md"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"  Usage report written to {report_path}")


if __name__ == "__main__":
    run_pipeline()
