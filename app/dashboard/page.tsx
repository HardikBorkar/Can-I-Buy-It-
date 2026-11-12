"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import "./dashboard.css";
import { AgGridTransactions, TransactionRow } from "@/components/ag-grid-transactions";
import { ProjectionChart } from "@/components/projection-chart";
import { PayPalAccountModal, ConnectedAccount } from "@/components/copilot/modals";

const asset = (name: string) => `/assets/${name}.svg`;

const icons = {
  shield: "53e8d",
  wallet: "53ae9",
  down: "e19d1",
  grid: "96d34",
  swap: "62853",
  chart: "42cea",
  store: "4111f",
  spark: "886e7",
  settings: "f47d9",
  help: "3f027",
  search: "54829",
  bell: "7ff1e",
  account: "3011b",
  accountDown: "825f5",
  clock: "4340c",
  dateDown: "992de",
  download: "2be47",
  balance: "cd7f9",
  protected: "e6c79",
  risk: "30ecc",
  earnings: "ab707",
  chartPlot: "b3d0c",
  footerShield: "df121",
  copilot: "d96bf",
  check: "f5e4e",
  ask: "24aec",
  whiteArrow: "8a3a0",
  tableDown: "c2537",
  blueArrow: "43b38",
  receipt: "3bf74",
  rowCheck: "bd1f4",
  rowStore: "9c1b3",
  rowShield: "af391",
  rowSpark: "3410b",
  rowReturn: "82efb",
} as const;

function Icon({ name, className = "" }: { name: keyof typeof icons; className?: string }) {
  return <img alt="" aria-hidden="true" className={className} src={asset(icons[name])} />;
}

const nav = [
  { label: "Overview", icon: "grid", href: "/dashboard" },
  { label: "Transactions", icon: "swap", href: "#transactions" },
  { label: "Cash flow", icon: "chart", href: "#forecast" },
  { label: "Storefront", icon: "store", href: "/" },
  { label: "Guardian Copilot", icon: "spark", href: "/copilot" },
] as const;

interface DashboardData {
  account: {
    user_id?: string;
    name?: string;
    email: string;
    balance: number;
    currency: string;
    safetyBuffer: number;
    discretionarySpend: number;
    mode: string;
  };
  transactions: TransactionRow[];
  timeline: Array<{
    dayIndex: number;
    date: string;
    displayDate: string;
    baselineBalance: number;
    safetyFloor: number;
    isDanger: boolean;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"30D" | "60D" | "90D">("90D");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [activeAccount, setActiveAccount] = useState<ConnectedAccount>({
    user_id: "alex_cro",
    email: "guardian-buyer-healthy@personal.example.com",
    name: "Michael Buyer (Healthy)",
    account_type: "PERSONAL",
    balance: 3500.0,
    currency: "USD",
  });
  const [exported, setExported] = useState(false);

  // Load saved persona from localStorage or backend
  useEffect(() => {
    const saved = localStorage.getItem("guardian_active_account");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveAccount(parsed);
      } catch {}
    }
  }, []);

  // Fetch live dashboard data based on active account
  const loadDashboardData = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/data?user_id=${userId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn("Could not fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeAccount?.user_id) {
      loadDashboardData(activeAccount.user_id);
    }
  }, [activeAccount?.user_id]);

  const handleSelectAccount = (acc: ConnectedAccount) => {
    setActiveAccount(acc);
    localStorage.setItem("guardian_active_account", JSON.stringify(acc));
    loadDashboardData(acc.user_id);
  };

  // Filter timeline based on 30D / 60D / 90D
  const filteredTimeline = React.useMemo(() => {
    if (!data?.timeline) return [];
    const days = period === "30D" ? 30 : period === "60D" ? 60 : 90;
    return data.timeline.slice(0, days);
  }, [data?.timeline, period]);

  const currentBalance = data?.account.balance ?? activeAccount.balance ?? 3500.0;
  const discretionarySpend = data?.account.discretionarySpend ?? Math.max(0, currentBalance - 500);
  const transactionsCount = data?.transactions.length ?? 0;

  return (
    <div className="dashboard-root">
      <div className="app-shell">
        {/* 1. Sidebar */}
        <aside className="sidebar">
          <div>
            <div className="brand">
              <span className="brand-mark">
                <Icon name="shield" />
              </span>
              <strong>guardian</strong>
            </div>
            <p className="eyebrow">MERCHANT WORKSPACE</p>

            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="workspace-switcher group cursor-pointer"
              title="Click to switch PayPal account or sandbox persona"
            >
              <Icon name="wallet" />
              <span>
                <b>{activeAccount?.name || "PayPal Sandbox"}</b>
                <small>{activeAccount?.email || "Personal workspace"}</small>
              </span>
              <Icon name="down" />
            </button>

            <p className="eyebrow workspace-label">WORKSPACE</p>
            <nav aria-label="Workspace">
              {nav.map((item, index) => (
                <Link
                  href={item.href}
                  className={`nav-item ${index === 0 ? "active" : ""}`}
                  key={item.label}
                >
                  <Icon name={item.icon as any} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="sidebar-bottom">
            <div className="protection-card">
              <Icon name="shield" />
              <b>Always on your side</b>
              <p>
                Your $500 safety buffer
                <br />
                is actively protected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="utility-link cursor-pointer hover:text-white transition"
            >
              <Icon name="settings" />
              Account Settings
            </button>
            <Link
              href="/copilot"
              className="utility-link hover:text-white transition"
            >
              <Icon name="help" />
              Guardian Copilot
            </Link>
            <p className="sidebar-caption">GUARDIAN / SANDBOX</p>
          </div>
        </aside>

        {/* 2. Main Workspace */}
        <div className="main-workspace">
          {/* Topbar */}
          <header className="topbar">
            <div className="crumbs">
              <span>Workspace</span>
              <i>/</i>
              <b>Overview</b>
            </div>

            <label className="search">
              <Icon name="search" />
              <input aria-label="Search workspace" placeholder="Search orders, invoices, or metrics…" />
              <kbd>⌘ K</kbd>
            </label>

            <span className="sandbox">
              <i />
              Sandbox mode
            </span>

            <button
              type="button"
              className="icon-button hover:bg-slate-800 transition"
              aria-label="Notifications"
            >
              <Icon name="bell" />
            </button>

            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="account cursor-pointer hover:bg-slate-800 transition"
            >
              <span>
                <Icon name="account" />
              </span>
              <span>{activeAccount?.name?.split(" ")[0] || "Account"}</span>
              <Icon name="accountDown" />
            </button>
          </header>

          {/* Main Dashboard Content */}
          <main className="dashboard-main">
            {/* Page Heading */}
            <section className="page-heading">
              <div>
                <h1>Your business, protected.</h1>
                <p>Real-time cash flow, automated AG Grid telemetry, and active PayPal Sandbox defense.</p>
              </div>
              <div className="heading-actions">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="date-button cursor-pointer hover:bg-slate-800 transition"
                >
                  <Icon name="clock" />
                  Active: {activeAccount?.name || "Michael Buyer"}
                  <Icon name="dateDown" />
                </button>
                <button
                  type="button"
                  className="export-button cursor-pointer active:scale-95 transition"
                  onClick={() => {
                    setExported(true);
                    window.open("/api/py/auth/download-bulk-csv", "_blank");
                    setTimeout(() => setExported(false), 3000);
                  }}
                >
                  <Icon name="download" />
                  {exported ? "CSV Downloaded!" : "Export Bulk CSV"}
                </button>
              </div>
            </section>

            {/* 3. Live Metric Cards */}
            <section className="metrics" aria-label="Key metrics">
              <article className="metric-card">
                <div className="metric-label">
                  <span>Sandbox balance</span>
                  <Icon name="balance" />
                </div>
                <strong>${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                <p>
                  <em>Available</em>
                  <span>in PayPal Sandbox</span>
                </p>
              </article>

              <article className="metric-card">
                <div className="metric-label">
                  <span>Protected transactions</span>
                  <Icon name="protected" />
                </div>
                <strong>{transactionsCount}</strong>
                <p>
                  <em>100%</em>
                  <span>audited by Swarm</span>
                </p>
              </article>

              <article className="metric-card">
                <div className="metric-label">
                  <span>Safety Buffer Floor</span>
                  <Icon name="risk" />
                </div>
                <strong className="text-emerald-400 font-mono">$500.00</strong>
                <p>
                  <em className="purple">Sacred floor</em>
                  <span>overdraft defense</span>
                </p>
              </article>

              <article className="metric-card">
                <div className="metric-label">
                  <span>Discretionary spend</span>
                  <Icon name="earnings" />
                </div>
                <strong>${discretionarySpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                <p>
                  <em>Safe to spend</em>
                  <span>above $500 floor</span>
                </p>
              </article>
            </section>

            {/* 4. Insights Section: Cash-flow forecast & Copilot */}
            <section className="insights" id="forecast">
              {/* Cash-flow forecast card */}
              <article className="forecast card">
                <div className="card-title-row">
                  <div>
                    <h2>Cash-flow forecast</h2>
                    <p>Real-time rolling projection with $500 liquidity floor protection.</p>
                  </div>
                  <div className="segmented">
                    {(["30D", "60D", "90D"] as const).map((item) => (
                      <button
                        type="button"
                        onClick={() => setPeriod(item)}
                        className={period === item ? "selected" : ""}
                        key={item}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="forecast-summary">
                  <strong>${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  <span>starting balance</span>
                  <em>↑ Safe above $500 floor</em>
                </div>

                {/* Interactive AG Charts / Recharts Projection */}
                <div className="chart-wrap" style={{ height: "240px" }}>
                  <ProjectionChart
                    data={filteredTimeline}
                    candidateAmount={0}
                    showComparison={false}
                  />
                </div>

                <div className="chart-footer">
                  <span>
                    <i className="solid-line" />
                    Projected Balance Curve
                  </span>
                  <span className="protected-note">
                    <Icon name="footerShield" />
                    $500 Safety buffer floor strictly intact
                  </span>
                </div>
              </article>

              {/* Guardian Copilot AI Agent Card */}
              <article className="copilot card flex flex-col justify-between">
                <div>
                  <div className="copilot-head">
                    <span className="copilot-mark">
                      <Icon name="copilot" />
                    </span>
                    <h2>Guardian Copilot</h2>
                    <small>AI AGENT</small>
                  </div>

                  <span className="protected-pill">
                    <Icon name="check" />
                    Multi-Agent Swarm Ready
                  </span>

                  <h3>
                    Your next {period === "30D" ? "30" : period === "60D" ? "60" : "90"} days
                    <br />
                    look healthy.
                  </h3>

                  <p>
                    You are currently projected to stay safe above your $500 reserve floor.
                    Use Guardian to evaluate purchases or draft invoices.
                  </p>
                </div>

                <div>
                  <Link href="/copilot" className="ask-button">
                    <Icon name="ask" />
                    <span>Ask Guardian Copilot</span>
                    <Icon name="whiteArrow" />
                  </Link>

                  <div className="quick-links">
                    <Link href="/copilot" className="hover:text-white transition">Verify an order</Link>
                    <i>·</i>
                    <Link href="/copilot" className="hover:text-white transition">Audit spend risk</Link>
                  </div>
                </div>
              </article>
            </section>

            {/* 5. Recent Transactions powered by AG Grid */}
            <section className="transactions card" id="transactions">
              <div className="transactions-head">
                <div>
                  <h2>Recent transactions</h2>
                  <p>Real-time PayPal Sandbox ledger powered by high-performance AG Grid.</p>
                </div>
                <div className="table-actions">
                  <Link href="/copilot" className="ledger hover:bg-slate-800 transition">
                    Ask Copilot <Icon name="blueArrow" />
                  </Link>
                </div>
              </div>

              {/* AG Grid Component */}
              <div className="w-full">
                <AgGridTransactions transactions={data?.transactions || []} />
              </div>
            </section>

            {/* Dashboard Footer */}
            <footer className="dashboard-footer">
              <div>
                <i />
                PayPal Sandbox REST v2 Connected <span>·&nbsp; Live multi-tenant synchronization</span>
              </div>
              <p>Active Persona: {activeAccount?.name || "Michael Buyer"} &nbsp;·&nbsp; All amounts in USD</p>
            </footer>
          </main>
        </div>
      </div>

      {/* Persona & PayPal Account Hub Modal */}
      <PayPalAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        activeAccountId={activeAccount?.user_id || "alex_cro"}
        onSelectAccount={handleSelectAccount}
      />
    </div>
  );
}
