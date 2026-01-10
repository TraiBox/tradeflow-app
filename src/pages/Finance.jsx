import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/common/PageHeader";
import TradeStatusBadge from "@/components/trade/TradeStatusBadge";
import {
  Wallet,
  Building2,
  Percent,
  Calendar,
  DollarSign,
  CheckCircle2,
  Loader2,
  Globe,
  ArrowRight,
  Package,
  ChevronRight,
  Leaf,
  Star,
  TrendingDown,
  Clock,
  Shield,
  FileText,
  Sparkles
} from "lucide-react";
import { format, addDays } from "date-fns";

// Simulated finance providers
const FINANCE_PROVIDERS = [
  {
    id: "global_trade_bank",
    name: "Global Trade Bank",
    logo: "🏦",
    base_rate: 4.5,
    fee_multiplier: 1.0,
    stf_certified: true,
    specialty: "Letter of Credit"
  },
  {
    id: "trade_finance_corp",
    name: "Trade Finance Corp",
    logo: "💼",
    base_rate: 5.2,
    fee_multiplier: 0.9,
    stf_certified: true,
    specialty: "Supply Chain Finance"
  },
  {
    id: "meridian_capital",
    name: "Meridian Capital",
    logo: "🌐",
    base_rate: 5.8,
    fee_multiplier: 0.85,
    stf_certified: false,
    specialty: "Factoring"
  }
];

const FINANCE_TYPES = [
  { id: "letter_of_credit", name: "Letter of Credit", description: "Bank-backed payment guarantee" },
  { id: "trade_credit", name: "Trade Credit", description: "Deferred payment terms" },
  { id: "supply_chain_finance", name: "Supply Chain Finance", description: "Working capital optimization" }
];

const generateOfferId = () => {
  return `OFF-${Date.now().toString(36).toUpperCase()}`;
};

export default function Finance() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const selectedTradeId = urlParams.get("trade");

  const [selectedTrade, setSelectedTrade] = useState(selectedTradeId || "");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades"],
    queryFn: () => base44.entities.Trade.list("-created_date")
  });

  const { data: financeOffers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["financeOffers"],
    queryFn: () => base44.entities.FinanceOffer.list("-created_date", 50)
  });

  const eligibleTrades = trades.filter(t => 
    ["compliance_check", "finance_pending"].includes(t.status) &&
    t.compliance_status === "passed"
  );

  const trade = trades.find(t => t.id === selectedTrade);
  const tradeOffers = trade ? financeOffers.filter(o => o.trade_id === trade.trade_id) : [];
  const acceptedOffer = tradeOffers.find(o => o.status === "accepted");

  const generateOffersMutation = useMutation({
    mutationFn: async () => {
      if (!trade) return;

      setIsGenerating(true);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      const amount = trade.estimated_amount || 100000;
      const offers = [];

      for (const provider of FINANCE_PROVIDERS) {
        const offerId = generateOfferId();
        const termDays = 60 + Math.floor(Math.random() * 60);
        const rate = provider.base_rate + (Math.random() * 1.5);
        const arrangementFee = amount * 0.002 * provider.fee_multiplier;
        const commitmentFee = amount * 0.001 * provider.fee_multiplier;
        const totalCost = (amount * (rate / 100) * (termDays / 365)) + arrangementFee + commitmentFee;

        const offer = await base44.entities.FinanceOffer.create({
          offer_id: offerId,
          trade_id: trade.trade_id,
          provider_name: provider.name,
          provider_logo: provider.logo,
          finance_type: provider.specialty === "Letter of Credit" ? "letter_of_credit" :
                       provider.specialty === "Supply Chain Finance" ? "supply_chain_finance" : "trade_credit",
          amount: amount,
          currency: trade.currency || "USD",
          interest_rate: parseFloat(rate.toFixed(2)),
          term_days: termDays,
          total_cost: parseFloat(totalCost.toFixed(2)),
          fees: {
            arrangement_fee: parseFloat(arrangementFee.toFixed(2)),
            commitment_fee: parseFloat(commitmentFee.toFixed(2)),
            other_fees: 0
          },
          stf_certified: provider.stf_certified,
          stf_details: provider.stf_certified ? {
            certification: "Green Trade Finance Standard",
            co2_offset: Math.floor(Math.random() * 50) + 10
          } : null,
          status: "available",
          valid_until: addDays(new Date(), 7).toISOString(),
          terms_conditions: `Standard ${provider.name} trade finance terms apply.`
        });

        offers.push(offer);
      }

      // Update trade status
      await base44.entities.Trade.update(trade.id, {
        status: "finance_pending"
      });

      // Create audit event
      await base44.entities.AuditEvent.create({
        event_id: `EVT-${Date.now()}`,
        trade_id: trade.trade_id,
        event_type: "finance.offers.ready",
        details: { offer_count: offers.length }
      });

      setIsGenerating(false);
      return offers;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["trades"]);
      queryClient.invalidateQueries(["financeOffers"]);
    }
  });

  const acceptOfferMutation = useMutation({
    mutationFn: async (offerId) => {
      const offer = tradeOffers.find(o => o.offer_id === offerId);
      if (!offer) return;

      // Mark selected offer as accepted
      await base44.entities.FinanceOffer.update(offer.id, {
        status: "accepted"
      });

      // Mark other offers as rejected
      for (const other of tradeOffers.filter(o => o.offer_id !== offerId)) {
        await base44.entities.FinanceOffer.update(other.id, {
          status: "rejected"
        });
      }

      // Update trade
      await base44.entities.Trade.update(trade.id, {
        status: "finance_accepted",
        finance_offer_id: offerId
      });

      // Create audit event
      await base44.entities.AuditEvent.create({
        event_id: `EVT-${Date.now()}`,
        trade_id: trade.trade_id,
        event_type: "finance.offer.accepted",
        details: { 
          offer_id: offerId,
          provider: offer.provider_name,
          amount: offer.amount
        }
      });

      return offer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["trades"]);
      queryClient.invalidateQueries(["financeOffers"]);
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

  const availableOffers = tradeOffers.filter(o => o.status === "available");
  const bestRate = availableOffers.length > 0 ? 
    Math.min(...availableOffers.map(o => o.interest_rate)) : null;
  const lowestCost = availableOffers.length > 0 ?
    Math.min(...availableOffers.map(o => o.total_cost)) : null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Finance"
        description="Request and compare trade finance offers from multiple providers"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trade Selection */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Request Finance Offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Select Trade</label>
                <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select a trade for financing" />
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
                        No eligible trades (must pass compliance)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {trade && (
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-blue-400" />
                      <span className="text-white">{trade.exporter_country}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-white">{trade.importer_country}</span>
                    </div>
                    <TradeStatusBadge status={trade.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {trade.product || "—"}
                    </span>
                    <span className="text-white font-semibold">
                      {trade.estimated_amount ? formatCurrency(trade.estimated_amount, trade.currency) : "—"}
                    </span>
                  </div>
                </div>
              )}

              {trade && tradeOffers.length === 0 && (
                <Button 
                  onClick={() => generateOffersMutation.mutate()}
                  disabled={isGenerating || trade.status !== "compliance_check"}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Offers...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Request Finance Offers
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Finance Offers */}
          {trade && tradeOffers.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">
                    {acceptedOffer ? "Accepted Offer" : "Available Offers"}
                  </CardTitle>
                  {!acceptedOffer && availableOffers.length > 0 && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {availableOffers.length} offers
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {acceptedOffer ? (
                  <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-2xl">
                          {acceptedOffer.provider_logo}
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{acceptedOffer.provider_name}</h3>
                          <p className="text-slate-400 text-sm">{acceptedOffer.finance_type?.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Accepted
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-slate-400 text-xs">Amount</p>
                        <p className="text-white font-semibold">{formatCurrency(acceptedOffer.amount, acceptedOffer.currency)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Interest Rate</p>
                        <p className="text-white font-semibold">{acceptedOffer.interest_rate}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Term</p>
                        <p className="text-white font-semibold">{acceptedOffer.term_days} days</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Total Cost</p>
                        <p className="text-white font-semibold">{formatCurrency(acceptedOffer.total_cost, acceptedOffer.currency)}</p>
                      </div>
                    </div>

                    {acceptedOffer.stf_certified && (
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                        <Leaf className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm">Sustainable Trade Finance Certified</span>
                      </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-slate-700">
                      <Link to={createPageUrl(`Payments?trade=${trade.id}`)}>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700">
                          Proceed to Payment
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <RadioGroup value={selectedOfferId} onValueChange={setSelectedOfferId}>
                    {availableOffers.map((offer, index) => {
                      const isBestRate = offer.interest_rate === bestRate;
                      const isLowestCost = offer.total_cost === lowestCost;

                      return (
                        <div key={offer.id} className="relative">
                          <RadioGroupItem
                            value={offer.offer_id}
                            id={offer.offer_id}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={offer.offer_id}
                            className={`
                              block p-5 rounded-xl border-2 cursor-pointer transition-all
                              ${selectedOfferId === offer.offer_id
                                ? "bg-blue-500/10 border-blue-500"
                                : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                              }
                            `}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-xl">
                                  {offer.provider_logo}
                                </div>
                                <div>
                                  <h3 className="text-white font-medium">{offer.provider_name}</h3>
                                  <p className="text-slate-500 text-xs">{offer.finance_type?.replace(/_/g, " ")}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {isBestRate && (
                                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                                    <TrendingDown className="w-3 h-3 mr-1" /> Best Rate
                                  </Badge>
                                )}
                                {isLowestCost && (
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                                    <Star className="w-3 h-3 mr-1" /> Lowest Cost
                                  </Badge>
                                )}
                                {offer.stf_certified && (
                                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                                    <Leaf className="w-3 h-3 mr-1" /> STF
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-slate-400 text-xs flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" /> Amount
                                </p>
                                <p className="text-white font-medium">{formatCurrency(offer.amount, offer.currency)}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-xs flex items-center gap-1">
                                  <Percent className="w-3 h-3" /> Rate
                                </p>
                                <p className="text-white font-medium">{offer.interest_rate}%</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-xs flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> Term
                                </p>
                                <p className="text-white font-medium">{offer.term_days} days</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-xs">Total Cost</p>
                                <p className="text-white font-medium">{formatCurrency(offer.total_cost, offer.currency)}</p>
                              </div>
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}

                {!acceptedOffer && availableOffers.length > 0 && (
                  <Button 
                    onClick={() => acceptOfferMutation.mutate(selectedOfferId)}
                    disabled={!selectedOfferId || acceptOfferMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
                  >
                    {acceptOfferMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Accepting Offer...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Accept Selected Offer
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Info */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Finance Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {FINANCE_TYPES.map(type => (
                <div key={type.id} className="p-3 bg-slate-800/50 rounded-lg">
                  <h4 className="text-white text-sm font-medium">{type.name}</h4>
                  <p className="text-slate-400 text-xs mt-1">{type.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-white font-semibold">Sustainable Trade Finance</h3>
              </div>
              <p className="text-slate-400 text-sm">
                STF certified offers support environmentally sustainable trade practices 
                and may include CO₂ offset programs.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">1</span>
                </div>
                <p className="text-slate-400 text-sm">Select a trade that passed compliance</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">2</span>
                </div>
                <p className="text-slate-400 text-sm">Request offers from multiple providers</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">3</span>
                </div>
                <p className="text-slate-400 text-sm">Compare rates, terms and STF status</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">4</span>
                </div>
                <p className="text-slate-400 text-sm">Accept the best offer for your needs</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}