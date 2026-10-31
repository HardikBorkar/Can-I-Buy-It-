"""
Multimodal Receipt Extraction module.
Uses google-genai with gemini-2.5-flash and a strict Pydantic schema
to extract amounts and currencies from receipt images, with persistent caching
and token usage tracking.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union
from PIL import Image
from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

from currency import CurrencyGraph
from data_loader import FinancialDataLoader
from models import FinancialEvent


class ReceiptExtraction(BaseModel):
    """Strict Pydantic schema for receipt / invoice extraction."""
    amount: float = Field(..., description="Final total amount shown on the receipt/invoice.")
    currency: str = Field(..., description="Currency code (e.g. INR, USD, IDR, EUR, ZAR).")


class ReceiptExtractor:
    """
    Handles extraction of receipt amounts from images using gemini-2.5-flash
    with local caching in dataset/cache/image_extractions.json and
    token usage recording in dataset/cache/token_usage.json.
    """

    MODEL_NAME = "gemini-2.5-flash"

    def __init__(
        self,
        dataset_dir: Union[str, Path] = "dataset",
        cache_file: Optional[Union[str, Path]] = None,
        token_usage_file: Optional[Union[str, Path]] = None,
        client: Optional[Any] = None,
    ):
        self.dataset_dir = Path(dataset_dir)
        self.cache_file = (
            Path(cache_file)
            if cache_file
            else self.dataset_dir / "cache" / "image_extractions.json"
        )
        self.token_usage_file = (
            Path(token_usage_file)
            if token_usage_file
            else self.dataset_dir / "cache" / "token_usage.json"
        )
        self._client = client
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._token_usage: Dict[str, Any] = {
            "model_calls": 0,
            "prompt_tokens": 0,
            "candidate_tokens": 0,
            "total_tokens": 0,
            "per_image_usage": {},
        }
        self._load_cache()
        self._load_token_usage()

    def _load_cache(self) -> None:
        """Load persistent cache from disk if it exists."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)
            except Exception:
                self._cache = {}

    def _save_cache(self) -> None:
        """Persist cache to disk."""
        self.cache_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.cache_file, "w", encoding="utf-8") as f:
            json.dump(self._cache, f, indent=2)

    def _load_token_usage(self) -> None:
        """Load token usage metrics from disk if it exists."""
        if self.token_usage_file.exists():
            try:
                with open(self.token_usage_file, "r", encoding="utf-8") as f:
                    self._token_usage = json.load(f)
            except Exception:
                pass

    def _save_token_usage(self) -> None:
        """Persist token usage metrics to disk."""
        self.token_usage_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.token_usage_file, "w", encoding="utf-8") as f:
            json.dump(self._token_usage, f, indent=2)

    def _get_client(self) -> Any:
        """Retrieve or instantiate google-genai Client."""
        if self._client is not None:
            return self._client
        if genai is None:
            raise ImportError("google-genai package is not installed.")
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable is not set and no client was provided."
            )
        self._client = genai.Client(api_key=api_key)
        return self._client

    def extract_from_image(
        self, image_id: str, image_path: Union[str, Path]
    ) -> ReceiptExtraction:
        """
        Extract total amount and currency from receipt image.
        Checks cache first. If cached, makes 0 API calls.
        Otherwise calls Gemini 2.5 Flash with structured output schema.
        """
        image_id = str(image_id).strip()
        image_path = Path(image_path)

        # 1. Check local persistent cache
        if image_id in self._cache:
            entry = self._cache[image_id]
            return ReceiptExtraction(
                amount=float(entry["amount"]),
                currency=str(entry["currency"]).strip().upper(),
            )

        # 2. Perform live VLM extraction
        if not image_path.exists():
            raise FileNotFoundError(f"Receipt image not found at {image_path}")

        client = self._get_client()
        pil_img = Image.open(image_path)

        prompt = (
            "Extract the final total payment amount and 3-letter currency code (such as INR, USD, IDR, EUR, ZAR) "
            "from this receipt, invoice, or payslip. "
            "Identify the net pay, grand total, balance due, or total paid amount that represents the full transaction amount."
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ReceiptExtraction,
            temperature=0.0,
        )

        response = client.models.generate_content(
            model=self.MODEL_NAME,
            contents=[pil_img, prompt],
            config=config,
        )

        # Parse output
        if hasattr(response, "parsed") and response.parsed is not None:
            if isinstance(response.parsed, ReceiptExtraction):
                extraction = response.parsed
            else:
                extraction = ReceiptExtraction.model_validate(response.parsed)
        else:
            raw_text = response.text if hasattr(response, "text") else str(response)
            data = json.loads(raw_text)
            extraction = ReceiptExtraction.model_validate(data)

        extraction.currency = extraction.currency.upper()

        # Update and save cache
        self._cache[image_id] = {
            "amount": extraction.amount,
            "currency": extraction.currency,
        }
        self._save_cache()

        # Track token usage
        prompt_tokens = 0
        candidate_tokens = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
            prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
            candidate_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

        self._record_token_usage(image_id, prompt_tokens, candidate_tokens)

        return extraction

    def _record_token_usage(self, image_id: str, prompt_tokens: int, candidate_tokens: int) -> None:
        """Record model calls and token metrics to persistent storage."""
        self._token_usage["model_calls"] = self._token_usage.get("model_calls", 0) + 1
        self._token_usage["prompt_tokens"] = self._token_usage.get("prompt_tokens", 0) + prompt_tokens
        self._token_usage["candidate_tokens"] = self._token_usage.get("candidate_tokens", 0) + candidate_tokens
        self._token_usage["total_tokens"] = (
            self._token_usage["prompt_tokens"] + self._token_usage["candidate_tokens"]
        )
        if "per_image_usage" not in self._token_usage:
            self._token_usage["per_image_usage"] = {}
        self._token_usage["per_image_usage"][image_id] = {
            "prompt_tokens": prompt_tokens,
            "candidate_tokens": candidate_tokens,
            "total_tokens": prompt_tokens + candidate_tokens,
        }
        self._save_token_usage()

    def get_token_usage(self) -> Dict[str, Any]:
        """Return current token usage metrics."""
        return dict(self._token_usage)

    def enrich_blank_events(self, data_loader: FinancialDataLoader) -> Dict[str, ReceiptExtraction]:
        """
        Locate all blank-amount events in the data_loader, extract amounts from images,
        and update event amount, currency, and normalized_amount via CurrencyGraph.
        """
        extractions: Dict[str, ReceiptExtraction] = {}

        for event in data_loader.events_by_id.values():
            if event.amount is not None:
                continue

            linked_images = data_loader.images_by_event.get(event.event_id, [])
            if not linked_images:
                continue

            img_evidence = linked_images[0]
            extraction = self.extract_from_image(
                img_evidence.image_id, img_evidence.file_path
            )
            extractions[event.event_id] = extraction

            # Update event raw amount and currency
            event.amount = extraction.amount
            if not event.currency:
                event.currency = extraction.currency

            # Currency normalization to home_currency
            profile = data_loader.profiles.get(event.user_id)
            home_currency = profile.home_currency if profile else event.currency

            if event.currency == home_currency:
                event.normalized_amount = event.amount
                event.exchange_rate_applied = 1.0
                event.conversion_path = [home_currency]
            elif event.settlement_date:
                rate_res = data_loader.currency_graph.get_rate_and_path(
                    event.settlement_date, event.currency, home_currency
                )
                if rate_res is not None:
                    rate, path = rate_res
                    event.exchange_rate_applied = rate
                    event.conversion_path = path
                    event.normalized_amount = round(event.amount * rate, 4)
                else:
                    raise ValueError(
                        f"Failed to normalize foreign currency {event.currency} to {home_currency} "
                        f"on {event.settlement_date} for event {event.event_id}"
                    )

        return extractions
