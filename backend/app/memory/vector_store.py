import logging
import os
from typing import Any, Dict, List, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.app.core.config import settings

logger = logging.getLogger("guardian.vector_store")


class GuardianVectorStore:
    """
    ChromaDB wrapper providing semantic transaction memory and merchant intelligence.
    Stores past transactions, contract clauses, and financial invariant rules.
    """

    def __init__(self, persist_dir: Optional[str] = None):
        self.persist_dir = persist_dir or settings.CHROMA_PERSIST_DIR
        os.makedirs(self.persist_dir, exist_ok=True)

        try:
            self.client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False, is_persistent=True),
            )
            self.collection = self.client.get_or_create_collection(
                name="guardian_transaction_memory",
                metadata={"description": "Financial invariants & merchant transaction records"},
            )
            self._seed_initial_memory()
            logger.info("ChromaDB vector store initialized at %s", self.persist_dir)
        except Exception as exc:
            logger.error("Failed to initialize ChromaDB: %s", exc)
            raise

    def _seed_initial_memory(self):
        """Seeds representative financial memory if collection is empty."""
        count = self.collection.count()
        if count == 0:
            seed_docs = [
                "Financial Safety Rule: Maintain a minimum safety buffer floor of $500.00 USD at all times. Never authorize discretionary purchases that drop liquidity below this floor.",
                "Recurring Outflows: Apartment Rent of $1,200.00 is due on the 1st of every month. AWS Hosting of $85.00 is due on the 15th. Software subscriptions total $42.00 on the 18th.",
                "Recurring Revenue: Bi-weekly direct deposit of $2,200.00 arrives on the 10th and 25th of every month.",
                "Dispute Anomaly Rule: If projected merchant chargeback exceeds 1.15%, mandate 3D Secure verification and hold escrow milestone releases.",
                "Pay in 4 Routing Rule: If a lump-sum payment violates the $500 buffer but 4 bi-weekly payments preserve the floor, recommend PayPal Pay in 4.",
                "Contract SLA Rule: High-value vendor contracts over $10,000 require 7-day fast-track PayPal arbitration and staged milestone escrow verification.",
            ]
            ids = [f"seed-rule-{i}" for i in range(len(seed_docs))]
            metadatas = [{"category": "financial_policy", "seed": True} for _ in seed_docs]
            self.collection.add(documents=seed_docs, ids=ids, metadatas=metadatas)
            logger.info("Seeded %d core financial invariant rules into ChromaDB.", len(seed_docs))

    def add_transaction_memory(self, doc_id: str, text: str, metadata: Optional[Dict[str, Any]] = None):
        """Adds a new transaction or contract summary to vector memory."""
        self.collection.upsert(
            documents=[text],
            ids=[doc_id],
            metadatas=[metadata or {"source": "runtime"}],
        )

    def search_similar(self, query: str, n_results: int = 3) -> List[str]:
        """Performs semantic similarity query against ChromaDB."""
        try:
            results = self.collection.query(query_texts=[query], n_results=n_results)
            documents = results.get("documents", [[]])
            return documents[0] if documents else []
        except Exception as exc:
            logger.warning("Vector search error: %s. Returning fallback rules.", exc)
            return [
                "Financial Safety Rule: Maintain a $500.00 safety buffer floor.",
                "Recurring Outflows: $1,200 Rent due on 1st of month.",
            ]


vector_store = GuardianVectorStore()

