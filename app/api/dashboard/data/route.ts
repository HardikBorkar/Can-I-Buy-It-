import { NextResponse } from "next/server";

interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: "PAY_IN_FULL" | "PAY_IN_4" | "PAYPAL_CREDIT" | "DIRECT_TRANSFER";
  status: "COMPLETED" | "PENDING" | "REFUNDED" | "CREATED";
  payer: string;
}

interface Commitment {
  id: string;
  name: string;
  category: "Housing" | "SaaS & Tech" | "Utilities" | "Health" | "Income";
  amount: number;
  cadence: "Monthly" | "Bi-Weekly" | "Weekly";
  nextDueDate: string;
  autopay: boolean;
  impactScore: "High" | "Medium" | "Low";
}

export async function GET() {
  const today = new Date();
  
  // Starting checking balance in PayPal Sandbox
  const startingBalance = 1850.00;
  const safetyFloor = 500.00;

  // Recurring Commitments
  const commitments: Commitment[] = [
    {
      id: "com-1",
      name: "Apartment Rent",
      category: "Housing",
      amount: -1200.00,
      cadence: "Monthly",
      nextDueDate: "1st of month",
      autopay: true,
      impactScore: "High",
    },
    {
      id: "com-2",
      name: "AWS / Cloud Infrastructure",
      category: "SaaS & Tech",
      amount: -85.00,
      cadence: "Monthly",
      nextDueDate: "15th of month",
      autopay: true,
      impactScore: "Medium",
    },
    {
      id: "com-3",
      name: "Software Tools (GitHub, ChatGPT)",
      category: "SaaS & Tech",
      amount: -42.00,
      cadence: "Monthly",
      nextDueDate: "18th of month",
      autopay: true,
      impactScore: "Low",
    },
    {
      id: "com-4",
      name: "Gym & Health Club",
      category: "Health",
      amount: -65.00,
      cadence: "Monthly",
      nextDueDate: "22nd of month",
      autopay: true,
      impactScore: "Low",
    },
    {
      id: "com-5",
      name: "Direct Deposit / Salary",
      category: "Income",
      amount: 2200.00,
      cadence: "Bi-Weekly",
      nextDueDate: "10th & 25th",
      autopay: false,
      impactScore: "High",
    },
  ];

  // Recent PayPal Sandbox Transactions
  const transactions: Transaction[] = [
    {
      id: "3N4420081Y251854T",
      date: new Date(today.getTime() - 2 * 3600000).toISOString().split("T")[0],
      description: "Channel3 Adidas Sneaker",
      category: "Shopping",
      amount: -89.50,
      paymentMethod: "PAY_IN_4",
      status: "COMPLETED",
      payer: "sb-6ckev53553701@business.example.com",
    },
    {
      id: "0U603912J86200723",
      date: new Date(today.getTime() - 5 * 3600000).toISOString().split("T")[0],
      description: "Sony WH-1000XM5 Headphones",
      category: "Electronics",
      amount: -199.99,
      paymentMethod: "PAY_IN_FULL",
      status: "COMPLETED",
      payer: "sb-6ckev53553701@business.example.com",
    },
    {
      id: "INV2-9844-8821-4190",
      date: new Date(today.getTime() - 24 * 3600000).toISOString().split("T")[0],
      description: "PayPal Invoicing: UI Consulting",
      category: "Income",
      amount: 450.00,
      paymentMethod: "DIRECT_TRANSFER",
      status: "COMPLETED",
      payer: "client@venturecap.io",
    },
    {
      id: "ORD-99120-X88",
      date: new Date(today.getTime() - 48 * 3600000).toISOString().split("T")[0],
      description: "GitHub Copilot Enterprise",
      category: "Software",
      amount: -19.00,
      paymentMethod: "PAYPAL_CREDIT",
      status: "COMPLETED",
      payer: "sb-6ckev53553701@business.example.com",
    },
    {
      id: "ORD-77412-M22",
      date: new Date(today.getTime() - 72 * 3600000).toISOString().split("T")[0],
      description: "Target Groceries & Supplies",
      category: "Supplies",
      amount: -114.30,
      paymentMethod: "PAY_IN_FULL",
      status: "COMPLETED",
      payer: "sb-6ckev53553701@business.example.com",
    },
    {
      id: "INV2-1102-3391-7781",
      date: new Date(today.getTime() - 96 * 3600000).toISOString().split("T")[0],
      description: "PayPal Invoicing: Brand Strategy",
      category: "Income",
      amount: 600.00,
      paymentMethod: "DIRECT_TRANSFER",
      status: "COMPLETED",
      payer: "growth@startup.co",
    },
  ];

  // 90-Day Deterministic Projection
  const timeline = [];
  let runningBalance = startingBalance;
  
  for (let i = 0; i < 90; i++) {
    const d = new Date(today.getTime() + i * 24 * 3600000);
    const dayOfMonth = d.getDate();
    const dateStr = d.toISOString().split("T")[0];

    // Recurring Income (10th and 25th)
    if (dayOfMonth === 10 || dayOfMonth === 25) {
      runningBalance += 2200.00;
    }
    // Recurring Rent (1st)
    if (dayOfMonth === 1) {
      runningBalance -= 1200.00;
    }
    // Cloud SaaS (15th)
    if (dayOfMonth === 15) {
      runningBalance -= 85.00;
    }
    // Software & Gym (18th & 22nd)
    if (dayOfMonth === 18) {
      runningBalance -= 42.00;
    }
    if (dayOfMonth === 22) {
      runningBalance -= 65.00;
    }

    // Daily nominal living expense ($15/day avg)
    runningBalance -= 15.00;

    timeline.push({
      dayIndex: i,
      date: dateStr,
      displayDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      baselineBalance: Math.round(runningBalance * 100) / 100,
      safetyFloor: safetyFloor,
      isDanger: runningBalance < safetyFloor,
    });
  }

  return NextResponse.json({
    account: {
      email: process.env.PAYPAL_SANDBOX_EMAIL || "sb-6ckev53553701@business.example.com",
      balance: startingBalance,
      currency: "USD",
      safetyBuffer: safetyFloor,
      discretionarySpend: Math.max(0, startingBalance - safetyFloor),
      mode: process.env.PAYPAL_MODE || "sandbox",
    },
    commitments,
    transactions,
    timeline,
  });
}
