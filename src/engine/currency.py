"""
Currency conversion graph module supporting direct dated rate lookup per AGENTS.md §6.1
and problem_statement.md (§Files provided), with rate inversion and multi-hop
USD-bridge chaining implemented as our own defensive design decisions.
"""

from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
try:
    import pandas as pd
except ImportError:
    pd = None


class CurrencyGraph:
    """
    Dated currency conversion graph.
    
    Capabilities:
    1. Direct rate matching for a given settlement date and currency pair.
    2. Automatic rate inversion (1 / rate) when only the reverse pair is given.
    3. 2-hop chaining with USD as the bridge currency (e.g., INR -> USD -> EUR).
    4. General BFS shortest-path chaining fallback if multiple hops are required.
    """

    BRIDGE_CURRENCY = "USD"

    def __init__(self, exchange_rates_source: Union[str, Path, Any]):
        """
        Initialize the currency graph from exchange_rates.csv or a DataFrame.
        """
        if isinstance(exchange_rates_source, (str, Path)):
            self.df = pd.read_csv(exchange_rates_source)
        else:
            self.df = exchange_rates_source.copy()

        # Clean string columns
        self.df["rate_date"] = self.df["rate_date"].astype(str).str.strip()
        self.df["from_currency"] = self.df["from_currency"].astype(str).str.strip().str.upper()
        self.df["to_currency"] = self.df["to_currency"].astype(str).str.strip().str.upper()
        self.df["rate"] = self.df["rate"].astype(float)

        # Storage structures:
        # direct_rates[date][(from_c, to_c)] = rate
        self._direct_rates: Dict[str, Dict[Tuple[str, str], float]] = defaultdict(dict)
        # adj[date][from_c][to_c] = rate (includes inverted edges)
        self._adj: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(lambda: defaultdict(dict))

        # Cache for resolved paths and rates: cache[(date, from_c, to_c)] = (rate, path)
        self._cache: Dict[Tuple[str, str, str], Tuple[float, List[str]]] = {}

        self._build_graph()

    def _build_graph(self) -> None:
        """Construct the directed and inverted rate graphs per rate_date."""
        for _, row in self.df.iterrows():
            date = row["rate_date"]
            u = row["from_currency"]
            v = row["to_currency"]
            r = float(row["rate"])

            if r <= 0:
                continue

            self._direct_rates[date][(u, v)] = r

            # Forward edge
            self._adj[date][u][v] = r

            # Inverted edge (if reverse not explicitly provided)
            if u not in self._adj[date][v]:
                self._adj[date][v][u] = 1.0 / r

    def get_rate_and_path(
        self,
        rate_date: str,
        from_currency: str,
        to_currency: str,
        prefer_usd_bridge: bool = True,
    ) -> Optional[Tuple[float, List[str]]]:
        """
        Compute the exchange rate and conversion path from from_currency to to_currency on rate_date.
        
        Returns:
            Tuple[float, List[str]]: (effective_rate, path_list) or None if unreachable.
        """
        rate_date = str(rate_date).strip()
        from_c = str(from_currency).strip().upper()
        to_c = str(to_currency).strip().upper()

        if from_c == to_c:
            return 1.0, [from_c]

        cache_key = (rate_date, from_c, to_c)
        if cache_key in self._cache:
            return self._cache[cache_key]

        date_graph = self._adj.get(rate_date)
        if not date_graph:
            return None

        # 1. Check direct rate (exact row in CSV)
        if (from_c, to_c) in self._direct_rates.get(rate_date, {}):
            rate = self._direct_rates[rate_date][(from_c, to_c)]
            result = (rate, [from_c, to_c])
            self._cache[cache_key] = result
            return result

        # 2. Check 1-hop inverted rate (exact reverse row in CSV)
        if (to_c, from_c) in self._direct_rates.get(rate_date, {}):
            reverse_rate = self._direct_rates[rate_date][(to_c, from_c)]
            rate = 1.0 / reverse_rate
            result = (rate, [from_c, to_c])
            self._cache[cache_key] = result
            return result

        # 3. 2-Hop chaining via USD bridge
        bridge = self.BRIDGE_CURRENCY
        if prefer_usd_bridge and from_c != bridge and to_c != bridge:
            # Check if from_c -> USD and USD -> to_c both exist in date_graph
            if bridge in date_graph.get(from_c, {}) and to_c in date_graph.get(bridge, {}):
                rate_1 = date_graph[from_c][bridge]
                rate_2 = date_graph[bridge][to_c]
                rate = rate_1 * rate_2
                result = (rate, [from_c, bridge, to_c])
                self._cache[cache_key] = result
                return result

        # 4. General Breadth-First Search (Shortest path by hops)
        queue = deque([(from_c, 1.0, [from_c])])
        visited = {from_c}

        while queue:
            curr, curr_rate, path = queue.popleft()

            if curr == to_c:
                result = (curr_rate, path)
                self._cache[cache_key] = result
                return result

            for neighbor, edge_rate in date_graph.get(curr, {}).items():
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, curr_rate * edge_rate, path + [neighbor]))

        return None

    def get_rate(
        self,
        rate_date: str,
        from_currency: str,
        to_currency: str,
        raise_on_missing: bool = True,
    ) -> float:
        """
        Get the exchange rate from from_currency to to_currency on rate_date.
        """
        res = self.get_rate_and_path(rate_date, from_currency, to_currency)
        if res is None:
            if raise_on_missing:
                raise KeyError(
                    f"No conversion path found from {from_currency} to {to_currency} on date {rate_date}."
                )
            return None
        return res[0]

    def convert(
        self,
        amount: float,
        rate_date: str,
        from_currency: str,
        to_currency: str,
    ) -> float:
        """
        Convert an amount from from_currency to to_currency on rate_date.
        """
        rate = self.get_rate(rate_date, from_currency, to_currency)
        return float(amount) * rate
