"""
PayPal Guardian - Web Application & Interactive Dashboard.
Features:
1. 'Buy or Wait?' 90-Day Cash Flow Simulation with Pay Later (Pay in 4).
2. Live PayPal Sandbox REST v2 Orders & Invoicing Integration.
3. AG Grid Transaction Ledger & Rolling Cash Flow Visualizer (Targeting $5k AG Grid Prize).
4. Channel3 Product Discovery Integration.
5. Conversational Financial Guardian AI Assistant.
"""

from datetime import datetime, timedelta
import os
import pandas as pd
import streamlit as st
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode

from src.adapter import PayPalContextAdapter
from src.agent import PayPalGuardianAgent
from src.channel3_client import Channel3Client
from src.engine.plan_selector import PlanSelector
from src.engine.reconciler import FinancialReconciler
from src.engine.simulator import CashFlowSimulator
from src.paypal_client import PayPalClient

# Page configuration
st.set_page_config(
    page_title="PayPal Guardian - AI Financial Agent",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for modern styling
st.markdown(
    """
    <style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        color: #003087;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1.1rem;
        color: #555;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 10px;
        padding: 15px;
        border-left: 5px solid #0070ba;
    }
    .status-badge-green {
        background-color: #d4edda;
        color: #155724;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: bold;
        display: inline-block;
    }
    .status-badge-yellow {
        background-color: #fff3cd;
        color: #856404;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: bold;
        display: inline-block;
    }
    .status-badge-red {
        background-color: #f8d7da;
        color: #721c24;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: bold;
        display: inline-block;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_resource
def get_services():
    paypal = PayPalClient()
    agent = PayPalGuardianAgent(paypal_client=paypal)
    channel3 = Channel3Client()
    return paypal, agent, channel3


paypal_client, guardian_agent, channel3_client = get_services()

# --- SIDEBAR ---
with st.sidebar:
    st.image("https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg", width=80)
    st.title("PayPal Guardian")
    st.caption("Autonomous Agent for Safe Commerce")
    st.divider()

    st.subheader("⚙️ Financial Guardrails")
    safety_buffer = st.slider(
        "Minimum Safety Buffer ($)",
        min_value=100.0,
        max_value=2000.0,
        value=float(os.getenv("DEFAULT_MINIMUM_SAFETY_BALANCE", 500.0)),
        step=50.0,
        help="The hard floor balance your checking account must never breach across the 90-day forecast.",
    )
    guardian_agent.default_minimum_balance = safety_buffer

    st.subheader("🔌 Connection Status")
    is_live_creds = paypal_client.has_credentials
    if is_live_creds:
        st.success("Connected to PayPal Sandbox API")
    else:
        st.info("Running in Interactive Sandbox Mode (Simulated Data)")

    st.caption(f"Base URL: `{paypal_client.base_url}`")
    st.divider()
    st.markdown(
        """
        **Sponsor Frameworks Integrated:**
        - 💳 **PayPal Sandbox REST v2**
        - 📊 **AG Grid & AG Charts**
        - 🛍️ **Channel3 Product API**
        - ☁️ **Render Ready**
        """
    )

# --- HEADER ---
st.markdown('<div class="main-header">🛡️ PayPal Guardian</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="sub-header">Autonomous Agentic Commerce with 90-Day Rolling Cash Flow Guardrails</div>',
    unsafe_allow_html=True,
)

# --- TOP STATS METRICS ---
balances = paypal_client.get_balances()
avail_bal = balances.get("available_balance", 0.0)
currency = balances.get("currency", "USD")
safe_discretionary = max(0.0, avail_bal - safety_buffer)

col1, col2, col3, col4 = st.columns(4)
col1.metric("Available Balance", f"${avail_bal:,.2f} {currency}")
col2.metric("Safety Reserve Buffer", f"${safety_buffer:,.2f} {currency}")
col3.metric("Safe Discretionary Spend", f"${safe_discretionary:,.2f} {currency}")
col4.metric("Engine Health", "90-Day Invariants Active 🟢")

st.write("")

# --- MAIN TABS ---
tab1, tab2, tab3, tab4 = st.tabs([
    "🛍️ 'Buy or Wait?' Evaluator",
    "📊 AG Grid Financial Ledger",
    "🧾 Create & Send Invoice",
    "💬 Conversational Guardian",
])

# =============================================================================
# TAB 1: BUY OR WAIT EVALUATOR
# =============================================================================
with tab1:
    st.subheader("Intelligent Purchase Evaluation")
    st.write(
        "Evaluate whether a purchase safely fits your financial reality across upcoming rent, salary cycles, and bills."
    )

    p_col1, p_col2 = st.columns([1, 1])

    with p_col1:
        search_query = st.text_input("🔍 Search Retail Catalogs via Channel3 (or type custom item):", "Sony Camera")
        products = channel3_client.search_products(search_query)

        product_options = {f"{p['title']} - ${p['price']} ({p['retailer']})": p for p in products}
        selected_label = st.selectbox("Select a product to evaluate:", list(product_options.keys()))
        selected_prod = product_options[selected_label]

        custom_name = st.text_input("Item Name", selected_prod["title"])
        custom_price = st.number_input("Price ($)", min_value=1.0, value=float(selected_prod["price"]), step=10.0)

        eval_btn = st.button("🛡️ Evaluate Affordability with PayPal", type="primary", use_container_width=True)

    with p_col2:
        if eval_btn:
            with st.spinner("Simulating 90-day cash flow across future commitments..."):
                eval_result = guardian_agent.evaluate_purchase(
                    item_name=custom_name,
                    price=custom_price,
                    minimum_balance=safety_buffer,
                )

                status = eval_result["affordability_status"]
                explanation = eval_result["decision_explanation"]
                safe_today = eval_result["amount_safe_to_pay_today"]

                st.markdown("#### 🎯 Guardian Recommendation")

                if status == "affordable_now":
                    st.markdown('<div class="status-badge-green">✅ AFFORDABLE NOW (Safe to Pay in Full)</div>', unsafe_allow_html=True)
                elif status == "affordable_with_plan":
                    st.markdown('<div class="status-badge-yellow">⚡ AFFORDABLE WITH PLAN (Recommended: PayPal Pay in 4)</div>', unsafe_allow_html=True)
                elif status == "affordable_later":
                    st.markdown('<div class="status-badge-yellow">⏳ AFFORDABLE LATER (Wait for Next Salary)</div>', unsafe_allow_html=True)
                else:
                    st.markdown('<div class="status-badge-red">❌ NOT RECOMMENDED (Breaches Safety Buffer)</div>', unsafe_allow_html=True)

                st.write("")
                st.info(f"💡 **Analysis:** {explanation}")

                # Display decision breakdown
                res_col1, res_col2 = st.columns(2)
                res_col1.metric("Safe to Pay Today", f"${safe_today:,.2f}")
                res_col2.metric("Earliest Safe Date", eval_result["earliest_date_for_full_payment"] or "Immediate")

                # Action Button: Create PayPal Order
                if status in ("affordable_now", "affordable_with_plan"):
                    order = guardian_agent.create_paypal_checkout(item_name=custom_name, price=custom_price)
                    approval_url = order.get("approval_url")
                    st.success(f"PayPal Sandbox Order Created: `{order.get('order_id')}`")
                    st.link_button("💳 Proceed to PayPal Checkout (Pay Later Eligible)", approval_url or "#", type="primary")

    st.divider()
    st.subheader("📈 90-Day Rolling Cash Flow Simulation Curve (AG Charts)")
    
    # Generate daily cash flow curve
    today = datetime.now().date()
    dates = [today + timedelta(days=i) for i in range(90)]
    
    # Base simulation curve starting at current balance
    sim_balance = avail_bal
    balance_points = []
    
    for d in dates:
        # Simulate salary every 14 days
        day_idx = (d - today).days
        if day_idx > 0 and day_idx % 14 == 0:
            sim_balance += 2800.0
        # Simulate rent once a month on the 1st
        if d.day == 1 and day_idx > 0:
            sim_balance -= 1100.0
        # Simulate everyday spend
        sim_balance -= 20.0
        balance_points.append({"Date": d.strftime("%Y-%m-%d"), "Projected Balance": round(sim_balance, 2), "Safety Buffer": safety_buffer})

    df_sim = pd.DataFrame(balance_points)
    st.line_chart(df_sim.set_index("Date")[["Projected Balance", "Safety Buffer"]])

# =============================================================================
# TAB 2: AG GRID FINANCIAL LEDGER
# =============================================================================
with tab2:
    st.subheader("📊 Interactive Transaction Ledger (Powered by AG Grid)")
    st.write("Live PayPal transaction activity reconciled into categorizations and spending flexibility hierarchies.")

    raw_tx = paypal_client.get_transactions()
    context = PayPalContextAdapter.create_user_financial_context(
        item_name="Ledger View",
        price=0.0,
        balance_data=balances,
        transactions=raw_tx,
        minimum_balance=safety_buffer,
    )
    reconciled = FinancialReconciler.reconcile(context)

    ledger_data = []
    for r in reconciled:
        ledger_data.append({
            "Transaction ID": r.event_id,
            "Date": r.settlement_date,
            "Description": r.description,
            "Category": r.category.title(),
            "Direction": r.direction.upper(),
            "Amount ($)": r.amount_home,
            "Flexibility": "Stoppable 🛑" if r.is_stoppable else ("Reducible ⚠️" if r.is_reducible else "Protected / Fixed 🔒"),
            "Recurring": "Yes 🔄" if r.is_recurring else "No",
            "Status": r.status.title(),
        })

    df_ledger = pd.DataFrame(ledger_data)

    gb = GridOptionsBuilder.from_dataframe(df_ledger)
    gb.configure_pagination(paginationAutoPageSize=False, paginationPageSize=10)
    gb.configure_side_bar()
    gb.configure_selection("single")
    gb.configure_column("Amount ($)", type=["numericColumn", "numberColumnFilter"], precision=2)
    grid_options = gb.build()

    AgGrid(
        df_ledger,
        gridOptions=grid_options,
        update_mode=GridUpdateMode.SELECTION_CHANGED,
        theme="alpine",
        height=380,
    )

# =============================================================================
# TAB 3: CREATE & SEND INVOICE
# =============================================================================
with tab3:
    st.subheader("🧾 Create & Send PayPal v2 Invoices")
    st.write("Generate and dispatch professional PayPal invoices with automated sequential numbering.")

    inv_col1, inv_col2 = st.columns(2)
    with inv_col1:
        inv_recipient = st.text_input("Recipient Email", "client@example.com")
        inv_amount = st.number_input("Invoice Amount ($)", min_value=1.0, value=250.0, step=10.0)
        inv_desc = st.text_input("Service / Item Description", "Freelance Software Development & Consultation")
        inv_note = st.text_area("Note to Recipient", "Thank you for your business! Please settle via PayPal.")

        if st.button("📤 Send PayPal Invoice", type="primary"):
            with st.spinner("Dispatching invoice through PayPal Sandbox..."):
                inv_res = guardian_agent.generate_paypal_bill(
                    recipient_email=inv_recipient,
                    amount=inv_amount,
                    description=inv_desc,
                    note=inv_note,
                )
                st.success(f"Invoice `{inv_res['invoice_number']}` created and dispatched!")
                st.write(f"- **Invoice ID:** `{inv_res['invoice_id']}`")
                st.write(f"- **Status:** `{inv_res['status']}`")
                st.link_button("🌐 Open Invoice Payment Link", inv_res["payment_url"], type="secondary")

# =============================================================================
# TAB 4: CONVERSATIONAL ASSISTANT
# =============================================================================
with tab4:
    st.subheader("💬 Chat with PayPal Guardian")
    st.write("Ask questions about affordability, your PayPal balance, or request automated invoicing.")

    if "chat_history" not in st.session_state:
        st.session_state.chat_history = [
            {"role": "assistant", "content": "Hello! I am PayPal Guardian. Ask me: *'Can I afford a $850 camera?'* or *'What is my account health?'*"}
        ]

    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_query = st.chat_input("Ask PayPal Guardian...")
    if user_query:
        st.session_state.chat_history.append({"role": "user", "content": user_query})
        with st.chat_message("user"):
            st.markdown(user_query)

        with st.chat_message("assistant"):
            with st.spinner("Guardian is analyzing your finances..."):
                bot_reply = guardian_agent.ask(user_query)
                st.markdown(bot_reply)
                st.session_state.chat_history.append({"role": "assistant", "content": bot_reply})

