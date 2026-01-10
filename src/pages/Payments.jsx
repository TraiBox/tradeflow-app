import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/common/PageHeader";
import TradeStatusBadge from "@/components/trade/TradeStatusBadge";
import {
  CreditCard,
  Building2,
  DollarSign,
  CheckCircle2,
  Loader2,
  Globe,
  ArrowRight,
  Package,
  ChevronRight,
  Clock,
  Route,
  AlertCircle,
  XCircle,
  Banknote,
  Send,
  MapPin,
  Timer,
  Receipt,
  Shield
} from "lucide-react";
import { format } from "date-fns";

// Simulated payment route banks
const CORRESPONDENT_BANKS = [
  { id: "swift_1", name: "Deutsche Bank", country: "Germany", type: "correspondent" },
  { id: "swift_2", name: "JP Morgan Chase", country: "USA", type: "correspondent" },
  { id: "swift_3", name: "HSBC", country: "UK", type: "correspondent" },
  { id: "swift_4", name: "Bank of America", country: "USA", type: "correspondent" }
];

const generatePaymentId = () => {
  return `PAY-${Date.now().toString(36).toUpperCase()}`;
};

const generateConfirmationCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Simple hash function for simulation
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0').toUpperCase();
};

export default function Payments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const selectedTradeId = urlParams.get("trade");

  const [selectedTrade, setSelectedTrade] = useState(selectedTradeId || "");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStep, setExecutionStep] = useState(0);
  const [paymentRoute, setPaymentRoute] = useState(null);

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades"],
    queryFn: () => base44.entities.Trade.list("-created_date")
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => base44.entities.Payment.list("-created_date", 50)
  });

  const { data: financeOffers = [] } = useQuery({
    queryKey: ["financeOffers"],
    queryFn: () => base44.entities.FinanceOffer.list("-created_date")
  });

  const eligibleTrades = trades.filter(t => 
    ["finance_accepted", "payment_pending"].includes(t.status)
  );

  const trade = trades.find(t => t.id === selectedTrade);
  const tradePayment = trade ? payments.find(p => p.trade_id === trade.trade_id) : null;
  const acceptedOffer = trade ? financeOffers.find(o => o.trade_id === trade.trade_id && o.status === "accepted") : null;

  const calculateRouteMutation = useMutation({
    mutationFn: async () => {
      if (!trade || !acceptedOffer) return;

      setIsCalculating(true);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate route calculation
      const senderBank = { name: `${trade.exporter_name || 'Exporter'} Bank`, country: trade.exporter_country };
      const recipientBank = { name: `${trade.importer_name || 'Importer'} Bank`, country: trade.importer_country };
      
      // Pick 1-2 correspondent banks
      const numCorrespondents = Math.random() > 0.5 ? 2 : 1;
      const shuffled = [...CORRESPONDENT_BANKS].sort(() => 0.5 - Math.random());
      const correspondents = shuffled.slice(0, numCorrespondents);

      const steps = [
        { step: 1, bank: senderBank.name, country: senderBank.country, type: "origin", status: "pending" },
        ...correspondents.map((cb, idx) => ({
          step: idx + 2,
          bank: cb.name,
          country: cb.country,
          type: "correspondent",
          status: "pending"
        })),
        { 
          step: correspondents.length + 2, 
          bank: recipientBank.name, 
          country: recipientBank.country, 
          type: "destination", 
          status: "pending" 
        }
      ];

      const baseFee = acceptedOffer.amount * 0.001;
      const correspondentFee = correspondents.length * 25;
      const totalFees = baseFee + correspondentFee;

      const route = {
        steps,
        estimated_duration: `${1 + correspondents.length} business days`,
        total_fees: parseFloat(totalFees.toFixed(2)),
        currency: acceptedOffer.currency
      };

      setPaymentRoute(route);
      setIsCalculating(false);
      return route;
    }
  });

  const executePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!trade || !acceptedOffer || !paymentRoute) return;

      setIsExecuting(true);
      const paymentId = generatePaymentId();

      // Create initial payment record
      const payment = await base44.entities.Payment.create({
        payment_id: paymentId,
        trade_id: trade.trade_id,
        finance_offer_id: acceptedOffer.offer_id,
        status: "executing",
        amount: acceptedOffer.amount,
        currency: acceptedOffer.currency,
        sender: {
          name: trade.exporter_name || "Exporter",
          bank: paymentRoute.steps[0].bank,
          country: trade.exporter_country,
          account_hash: simpleHash(`${trade.exporter_name}-${Date.now()}`)
        },
        recipient: {
          name: trade.importer_name || "Importer",
          bank: paymentRoute.steps[paymentRoute.steps.length - 1].bank,
          country: trade.importer_country,
          account_hash: simpleHash(`${trade.importer_name}-${Date.now()}`)
        },
        route: paymentRoute
      });

      // Update trade status
      await base44.entities.Trade.update(trade.id, {
        status: "payment_executing",
        payment_id: paymentId
      });

      // Simulate step-by-step execution
      for (let i = 0; i < paymentRoute.steps.length; i++) {
        setExecutionStep(i + 1);
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Update route step status
        const updatedSteps = [...paymentRoute.steps];
        updatedSteps[i].status = "completed";
        setPaymentRoute({ ...paymentRoute, steps: updatedSteps });
      }

      // Finalize payment
      const confirmationCode = generateConfirmationCode();
      
      await base44.entities.Payment.update(payment.id, {
        status: "completed",
        executed_at: new Date().toISOString(),
        confirmation_code: confirmationCode
      });

      await base44.entities.Trade.update(trade.id, {
        status: "payment_completed"
      });

      // Create audit event
      await base44.entities.AuditEvent.create({
        event_id: `EVT-${Date.now()}`,
        trade_id: trade.trade_id,
        event_type: "payment.executed",
        details: { 
          payment_id: paymentId,
          confirmation_code: confirmationCode,
          amount: acceptedOffer.amount,
          currency: acceptedOffer.currency
        }
      });

      setIsExecuting(false);
      return { ...payment, confirmation_code: confirmationCode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["trades"]);
      queryClient.invalidateQueries(["payments"]);
    }
  });

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStepIcon = (type) => {
    switch (type) {
      case "origin": return Building2;
      case "correspondent": return Route;
      case "destination": return MapPin;
      default: return Building2;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Payments"
        description="Execute payment routes and track transaction status"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trade Selection */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Execute Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Select Trade</label>
                <Select value={selectedTrade} onValueChange={(v) => {
                  setSelectedTrade(v);
                  setPaymentRoute(null);
                }}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select a trade for payment" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {eligibleTrades.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-slate-300 focus:bg-slate-800 focus:text-white">
                        <span className="font-mono text-xs mr-2">{t.trade_id}</span>
                        {t.title || "Untitled Trade"}
                      </SelectItem>
                    ))}
                    {eligibleTrades.length === 0 && (
                      <SelectItem value="none" disabled className="text-slate-500">
                        No eligible trades (must have accepted finance)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {trade && acceptedOffer && (
                <div className="p-4 bg-slate-800/50 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-blue-400" />
                      <span className="text-white">{trade.exporter_country}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-white">{trade.importer_country}</span>
                    </div>
                    <TradeStatusBadge status={trade.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-700">
                    <div>
                      <p className="text-slate-400 text-xs">Amount</p>
                      <p className="text-white font-semibold text-lg">{formatCurrency(acceptedOffer.amount, acceptedOffer.currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Finance Provider</p>
                      <p className="text-white">{acceptedOffer.provider_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Finance Type</p>
                      <p className="text-white">{acceptedOffer.finance_type?.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                </div>
              )}

              {trade && acceptedOffer && !tradePayment && !paymentRoute && (
                <Button 
                  onClick={() => calculateRouteMutation.mutate()}
                  disabled={isCalculating}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isCalculating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calculating Route...
                    </>
                  ) : (
                    <>
                      <Route className="w-4 h-4 mr-2" />
                      Calculate Payment Route
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment Route */}
          {paymentRoute && !tradePayment && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">Payment Route</CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Timer className="w-4 h-4" />
                      {paymentRoute.estimated_duration}
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Banknote className="w-4 h-4" />
                      {formatCurrency(paymentRoute.total_fees, paymentRoute.currency)} fees
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Route Visualization */}
                <div className="relative">
                  {paymentRoute.steps.map((step, index) => {
                    const StepIcon = getStepIcon(step.type);
                    const isLast = index === paymentRoute.steps.length - 1;
                    
                    return (
                      <div key={step.step} className="flex items-start gap-4 pb-6 last:pb-0">
                        <div className="relative flex flex-col items-center">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            ${step.status === "completed" 
                              ? "bg-emerald-500/20 border-2 border-emerald-500"
                              : isExecuting && executionStep === step.step
                                ? "bg-blue-500/20 border-2 border-blue-500 animate-pulse"
                                : "bg-slate-800 border-2 border-slate-600"
                            }
                          `}>
                            {step.status === "completed" ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : isExecuting && executionStep === step.step ? (
                              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                            ) : (
                              <StepIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          {!isLast && (
                            <div className={`
                              w-0.5 h-full absolute top-10 left-1/2 -translate-x-1/2
                              ${step.status === "completed" ? "bg-emerald-500" : "bg-slate-700"}
                            `} style={{ height: "calc(100% - 1rem)" }} />
                          )}
                        </div>
                        <div className="flex-1 pt-2">
                          <p className="text-white font-medium">{step.bank}</p>
                          <p className="text-slate-400 text-sm">{step.country}</p>
                          <Badge 
                            variant="outline" 
                            className={`mt-1 text-xs ${
                              step.type === "origin" 
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : step.type === "destination"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                            }`}
                          >
                            {step.type === "origin" ? "Sender Bank" : 
                             step.type === "destination" ? "Recipient Bank" : "Correspondent"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!isExecuting && (
                  <Button 
                    onClick={() => executePaymentMutation.mutate()}
                    disabled={isExecuting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Execute Payment
                  </Button>
                )}

                {isExecuting && (
                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Executing payment...</span>
                      <span className="text-sm text-blue-400">{executionStep}/{paymentRoute.steps.length}</span>
                    </div>
                    <Progress value={(executionStep / paymentRoute.steps.length) * 100} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completed Payment */}
          {tradePayment && tradePayment.status === "completed" && (
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Payment Completed
                  </CardTitle>
                  <Badge className="bg-emerald-500/20 text-emerald-400">
                    Confirmed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-xs">Payment ID</p>
                    <p className="text-white font-mono">{tradePayment.payment_id}</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-xs">Confirmation Code</p>
                    <p className="text-white font-mono">{tradePayment.confirmation_code}</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-xs">Amount</p>
                    <p className="text-white font-semibold text-lg">
                      {formatCurrency(tradePayment.amount, tradePayment.currency)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-xs">Executed At</p>
                    <p className="text-white">
                      {tradePayment.executed_at && !isNaN(new Date(tradePayment.executed_at))
                        ? format(new Date(tradePayment.executed_at), "MMM d, yyyy h:mm a")
                        : "Recently"
                      }
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-xs mb-2">Sender</p>
                    <p className="text-white font-medium">{tradePayment.sender?.name}</p>
                    <p className="text-slate-400 text-sm">{tradePayment.sender?.bank}</p>
                    <p className="text-slate-500 text-xs font-mono mt-1">{tradePayment.sender?.account_hash?.substring(0, 8)}...</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-xs mb-2">Recipient</p>
                    <p className="text-white font-medium">{tradePayment.recipient?.name}</p>
                    <p className="text-slate-400 text-sm">{tradePayment.recipient?.bank}</p>
                    <p className="text-slate-500 text-xs font-mono mt-1">{tradePayment.recipient?.account_hash?.substring(0, 8)}...</p>
                  </div>
                </div>

                <Link to={createPageUrl(`Proofs?trade=${trade.id}`)}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-4">
                    Generate Proof Bundle
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Info */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Recent Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No payments yet</p>
              ) : (
                <div className="space-y-3">
                  {payments.slice(0, 8).map(payment => (
                    <div 
                      key={payment.id}
                      className="p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-slate-400">{payment.payment_id}</span>
                        <Badge variant="outline" className={`text-xs ${
                          payment.status === "completed" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : payment.status === "failed"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}>
                          {payment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-white font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {payment.created_date && !isNaN(new Date(payment.created_date))
                          ? format(new Date(payment.created_date), "MMM d, h:mm a")
                          : "Recently"
                        }
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Payment Process</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">1</span>
                </div>
                <p className="text-slate-400 text-sm">Calculate optimal payment route</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">2</span>
                </div>
                <p className="text-slate-400 text-sm">Review fees and estimated duration</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">3</span>
                </div>
                <p className="text-slate-400 text-sm">Execute payment via SWIFT network</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">4</span>
                </div>
                <p className="text-slate-400 text-sm">Receive confirmation code</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-white font-semibold">Secure Transactions</h3>
              </div>
              <p className="text-slate-400 text-sm">
                All payment routes are calculated to minimize fees while ensuring 
                secure and compliant fund transfers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}