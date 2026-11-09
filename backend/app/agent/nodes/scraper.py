import logging
import re
from typing import Dict, Any
from backend.app.agent.state import AgentState
from backend.app.agent.tools.firecrawl_client import firecrawl_client

logger = logging.getLogger("guardian.node.scraper")

URL_REGEX = re.compile(r"https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)")


async def scraper_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes Firecrawl structured extraction on URL found in user prompt or context.
    Populates state['scraped_data'] with structured JSON & clean markdown.
    """
    messages = state.get("messages", [])
    content = ""
    if messages:
        last = messages[-1]
        content = last.content if hasattr(last, "content") else str(last)

    # Find URL
    url = None
    url_match = URL_REGEX.search(content)
    if url_match:
        url = url_match.group(0)
    else:
        for c in state.get("retrieved_context", []):
            if "Target URL to scrape:" in c:
                url = c.split("Target URL to scrape:")[-1].strip()
                break

    if not url:
        logger.warning("Scraper node entered without a valid URL.")
        return {"scraped_data": None}

    logger.info("Executing Firecrawl structured scrape on %s", url)
    merchant_data = firecrawl_client.extract_merchant_details(url)

    return {
        "scraped_data": merchant_data.model_dump(),
        "retrieved_context": [
            f"Merchant Scrape Verified: {merchant_data.title} (${merchant_data.price} {merchant_data.currency}) from {merchant_data.vendor_name}",
        ],
    }

