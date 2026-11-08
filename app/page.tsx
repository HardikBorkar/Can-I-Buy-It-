"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ShoppingBag, Loader2, ShieldCheck, AlertTriangle,
  CheckCircle2, TrendingUp, Calendar, Home as HomeIcon, Zap, Wifi,
  MessageSquare, Send, X, Bot
} from "lucide-react";

export default function Home() {
  // Analyzer States
  const [price, setPrice] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<null | 'safe' | 'unsafe'>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I'm your Financial Guardian. How can I help you optimize your spending today?" }
  ]);

  const handleAnalyze = () => {
    if (!price) return;
    setIsAnalyzing(true);
    setResult(null);
    setCheckoutComplete(false);
    setTimeout(() => {
      setIsAnalyzing(false);
      setResult(Number(price) > 500 ? 'unsafe' : 'safe');
    }, 1500);
  };

  const handleCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      setCheckoutComplete(true);
    }, 2000);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { role: "user", text: chatInput }]);
    setChatInput("");

    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: "bot",
        text: "Aryan will connect my real brain soon! For now, try using the Purchase Analyzer on the dashboard to check your safety buffer."
      }]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20 relative overflow-hidden">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            CB
          </div>
          <span className="font-semibold text-lg tracking-wide text-gray-200">Can-I-Buy-It?</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Sandbox Mode</span>
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-3xl font-light text-gray-200 mb-2">Financial Overview</h1>
          <p className="text-gray-500 mb-10">Analyze your purchases against your 90-day safety buffer.</p>

          {/* Top Section: Balance & Analyzer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="col-span-1 bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-2xl transition-all hover:border-white/20 h-fit">
              <div className="flex items-center gap-3 text-gray-400 mb-4">
                <Wallet size={20} />
                <span className="text-sm font-medium">Available Sandbox Balance</span>
              </div>
              <div className="text-4xl font-semibold tracking-tight">$1,850.00</div>
              <div className="mt-4 text-xs font-medium text-emerald-400 bg-emerald-400/10 inline-block px-3 py-1.5 rounded-md">
                + Safe buffer active
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-6">
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all hover:border-white/20">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full"></div>

                <div className="flex items-center gap-3 text-gray-400 mb-6 relative z-10">
                  <ShoppingBag size={20} />
                  <span className="text-sm font-medium">Purchase Analyzer</span>
                </div>

                <div className="relative z-10">
                  <label className="block text-sm text-gray-400 mb-2">Enter product price to check affordability</label>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-3 text-gray-500 font-medium">$</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                      />
                    </div>
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !price}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium px-8 py-3 rounded-xl transition-colors flex items-center justify-center min-w-[120px]"
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : "Analyze"}
                    </button>
                  </div>
                </div>
              </div>

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border rounded-2xl p-6 ${result === 'safe' ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-rose-950/20 border-rose-500/20'}`}
                >
                  <div className="flex items-start gap-4">
                    {result === 'safe' ? <ShieldCheck className="text-emerald-500 mt-1" size={24} /> : <AlertTriangle className="text-rose-500 mt-1" size={24} />}
                    <div className="w-full">
                      <h3 className={`text-lg font-medium mb-1 ${result === 'safe' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {result === 'safe' ? 'Safe to purchase upfront' : 'Upfront payment unsafe'}
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        {result === 'safe'
                          ? 'This purchase keeps your balance well above your required 90-day safety buffer.'
                          : 'Paying this amount outright dips below your required rent and bills buffer.'}
                      </p>
                      {result === 'unsafe' && (
                        !checkoutComplete ? (
                          <button
                            onClick={handleCheckout}
                            disabled={isCheckingOut}
                            className="bg-white text-black font-medium px-6 py-2.5 rounded-lg text-sm hover:bg-gray-200 transition-colors flex items-center gap-2"
                          >
                            {isCheckingOut && <Loader2 className="animate-spin" size={16} />}
                            {isCheckingOut ? "Processing..." : "Use PayPal Pay in 4"}
                          </button>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2.5 rounded-lg w-fit"
                          >
                            <CheckCircle2 size={18} />
                            <span className="text-sm font-medium">Payment Scheduled Successfully</span>
                          </motion.div>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Bottom Section: Charts & Data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Cash Flow Chart */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-2xl hover:border-white/20 transition-all">
              <div className="flex items-center gap-3 text-gray-400 mb-8">
                <TrendingUp size={20} />
                <span className="text-sm font-medium">90-Day Cash Flow Projection</span>
              </div>

              <div className="flex items-end justify-between h-40 border-b border-white/10 pb-4 px-4">
                {[
                  { month: "Next 30 Days", in: "h-[100%]", out: "h-[60%]" },
                  { month: "30-60 Days", in: "h-[90%]", out: "h-[50%]" },
                  { month: "60-90 Days", in: "h-[95%]", out: "h-[75%]" }
                ].map((data, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 w-1/3 group">
                    <div className="w-full flex items-end justify-center gap-2 h-32">
                      <div className={`w-8 bg-blue-500/80 rounded-t-sm ${data.in} group-hover:bg-blue-400 transition-colors`}></div>
                      <div className={`w-8 bg-rose-500/80 rounded-t-sm ${data.out} group-hover:bg-rose-400 transition-colors`}></div>
                    </div>
                    <span className="text-xs text-gray-500">{data.month}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-center gap-8 mt-6 text-xs text-gray-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500/80 rounded-sm"></div> Projected Income</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500/80 rounded-sm"></div> Fixed Expenses</div>
              </div>
            </div>

            {/* Fixed Expenses List */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-2xl hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-gray-400">
                  <Calendar size={20} />
                  <span className="text-sm font-medium">Protected Buffer Breakdown</span>
                </div>
                <span className="text-xs font-medium text-gray-500 bg-white/5 px-2 py-1 rounded">Next 30 Days</span>
              </div>

              <div className="space-y-4">
                {[
                  { icon: <HomeIcon size={18} />, name: "Rent & Housing", due: "Due in 5 days", amount: "-$1,200.00", color: "text-blue-400", bg: "bg-blue-500/10" },
                  { icon: <Zap size={18} />, name: "Electric & Utilities", due: "Due in 12 days", amount: "-$145.00", color: "text-yellow-400", bg: "bg-yellow-500/10" },
                  { icon: <Wifi size={18} />, name: "Internet", due: "Due in 15 days", amount: "-$80.00", color: "text-emerald-400", bg: "bg-emerald-500/10" }
                ].map((bill, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${bill.bg} ${bill.color}`}>
                        {bill.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-200">{bill.name}</div>
                        <div className="text-xs text-gray-500">{bill.due}</div>
                      </div>
                    </div>
                    <div className="font-semibold text-gray-300">{bill.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Floating AI Chat Component */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-[#111111] border border-white/10 rounded-2xl shadow-2xl w-[350px] overflow-hidden mb-4 flex flex-col"
            >
              {/* Chat Header */}
              <div className="bg-white/5 px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center">
                    <Bot size={18} />
                  </div>
                  <span className="font-medium text-sm text-gray-200">Financial Copilot</span>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-5 h-[300px] overflow-y-auto space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white/5 text-gray-300 border border-white/5 rounded-bl-none'
                      }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-black/20">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about a purchase..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 rounded-lg text-white transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Toggle Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-transform hover:scale-105 ${isChatOpen ? 'bg-white/10 text-white border border-white/20' : 'bg-blue-600 text-white'
            }`}
        >
          {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </button>
      </div>
    </div>
  );
}