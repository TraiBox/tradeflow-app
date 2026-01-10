import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/common/PageHeader";
import TradeStatusBadge from "@/components/trade/TradeStatusBadge";
import TradeSteps from "@/components/trade/TradeSteps";
import {
  ArrowLeft,
  Globe,
  Package,
  DollarSign,
  Building2,
  Calendar,
  Truck,
  Shield,
  Wallet,
  CreditCard,
  FileCheck,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Download,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";

export default function TradeDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const tradeId = urlParams.get("id");

  const { data: trade, isLoading } = useQuery({
    queryKey: ["trade", tradeId],
    queryFn: async () => {
      const trades = await base44.entities.Trade.filter({ id: tradeId });
      return trades[0];
    },
    enabled: !!tradeId
  });

  const { data: complianceRuns = [] } = useQuery({
    queryKey: ["compliance", trade?.trade_id],
    queryFn: () => base44.entities.ComplianceRun.filter({ trade_id: trade?.trade_id }),
    enabled: !!trade?.trade_id
  });

  const { data: financeOffers = [] } = useQuery({
    queryKey: ["financeOffers", trade?.trade_id],
    queryFn: () => base44.entities.FinanceOffer.filter({ trade_id: trade?.trade_id }),
    enabled: !!trade?.trade_id
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", trade?.trade_id],
    queryFn: () => base44.entities.Payment.filter({ trade_id: trade?.trade_id }),
    enabled: !!trade?.trade_id
  });

  const { data: proofBundles = [] } = useQuery({
    queryKey: ["proofs", trade?.trade_id],
    queryFn: () => base44.entities.ProofBundle.filter({ trade_id: trade?.trade_id }),
    enabled: !!trade?.trade_id
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ["auditEvents", trade?.trade_id],
    queryFn: () => base44.entities.AuditEvent.filter({ trade_id: trade?.trade_id }, "-created_date"),
    enabled: !!trade?.trade_id
  });

  const latestCompliance = complianceRuns[0];
  const acceptedOffer = financeOffers.find(o => o.status === "accepted");
  const latestPayment = payments[0];
  const latestProof = proofBundles[0];

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Trade Not Found</h2>
            <p className="text-slate-400 mb-6">The trade you're looking for doesn't exist or has been deleted.</p>
            <Link to={createPageUrl("Dashboard")}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to={createPageUrl("Dashboard")} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{trade.title || "Untitled Trade"}</h1>
              <TradeStatusBadge status={trade.status} />
            </div>
            <p className="text-slate-400 font-mono text-sm">{trade.trade_id}</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <Card className="bg-slate-900/50 border-slate-800 mb-6">
        <CardContent className="p-6">
          <TradeSteps currentStatus={trade.status} />
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Trade Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trade Overview */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Trade Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Route */}
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                <Globe className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium">{trade.exporter_country || "—"}</span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
                <span className="text-white font-medium">{trade.importer_country || "—"}</span>
                {trade.incoterm && (
                  <Badge variant="outline" className="ml-auto bg-purple-500/10 text-purple-400 border-purple-500/20">
                    {trade.incoterm}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                    <Package className="w-3 h-3" /> Product
                  </div>
                  <p className="text-white">{trade.product || "—"}</p>
                  {trade.product_hs_code && (
                    <p className="text-slate-500 text-xs mt-1">HS Code: {trade.product_hs_code}</p>
                  )}
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                    <DollarSign className="w-3 h-3" /> Value
                  </div>
                  <p className="text-white text-xl font-semibold">
                    {trade.estimated_amount ? formatCurrency(trade.estimated_amount, trade.currency) : "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {trade.exporter_name && (
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                      <Building2 className="w-3 h-3" /> Exporter
                    </div>
                    <p className="text-white">{trade.exporter_name}</p>
                  </div>
                )}
                {trade.importer_name && (
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                      <Building2 className="w-3 h-3" /> Importer
                    </div>
                    <p className="text-white">{trade.importer_name}</p>
                  </div>
                )}
              </div>

              {(trade.shipping_date || trade.delivery_date) && (
                <div className="grid grid-cols-2 gap-4">
                  {trade.shipping_date && (
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                        <Calendar className="w-3 h-3" /> Shipping Date
                      </div>
                      <p className="text-white">
                        {trade.shipping_date && !isNaN(new Date(trade.shipping_date))
                          ? format(new Date(trade.shipping_date), "MMM d, yyyy")
                          : "TBD"
                        }
                      </p>
                    </div>
                  )}
                  {trade.delivery_date && (
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                        <Truck className="w-3 h-3" /> Delivery Date
                      </div>
                      <p className="text-white">
                        {trade.delivery_date && !isNaN(new Date(trade.delivery_date))
                          ? format(new Date(trade.delivery_date), "MMM d, yyyy")
                          : "TBD"
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Sections */}
          <Tabs defaultValue="compliance" className="space-y-4">
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger value="compliance" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                <Shield className="w-4 h-4 mr-2" />
                Compliance
              </TabsTrigger>
              <TabsTrigger value="finance" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                <Wallet className="w-4 h-4 mr-2" />
                Finance
              </TabsTrigger>
              <TabsTrigger value="payment" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                <CreditCard className="w-4 h-4 mr-2" />
                Payment
              </TabsTrigger>
              <TabsTrigger value="proof" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                <FileCheck className="w-4 h-4 mr-2" />
                Proof
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compliance">
              <ComplianceSection trade={trade} complianceRun={latestCompliance} />
            </TabsContent>

            <TabsContent value="finance">
              <FinanceSection trade={trade} offers={financeOffers} acceptedOffer={acceptedOffer} />
            </TabsContent>

            <TabsContent value="payment">
              <PaymentSection trade={trade} payment={latestPayment} />
            </TabsContent>

            <TabsContent value="proof">
              <ProofSection trade={trade} proofBundle={latestProof} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Timeline & Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {trade.status === "planning" && (
                <Link to={createPageUrl(`Compliance?trade=${trade.id}`)} className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-between">
                    Run Compliance Check
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {trade.status === "compliance_check" && latestCompliance?.status === "passed" && (
                <Link to={createPageUrl(`Finance?trade=${trade.id}`)} className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-between">
                    Request Finance Offers
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {trade.status === "finance_accepted" && (
                <Link to={createPageUrl(`Payments?trade=${trade.id}`)} className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-between">
                    Execute Payment
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {trade.status === "payment_completed" && !latestProof && (
                <Link to={createPageUrl(`Proofs?trade=${trade.id}`)} className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-between">
                    Generate Proof Bundle
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {latestProof?.status === "ready" && (
                <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 justify-between">
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Proof Bundle
                  </span>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Audit Timeline */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No events yet</p>
              ) : (
                <div className="space-y-4">
                  {auditEvents.slice(0, 10).map((event, index) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="relative">
                        <div className={`
                          w-2 h-2 rounded-full mt-2
                          ${event.event_type.includes("completed") || event.event_type.includes("executed") 
                            ? "bg-emerald-400" 
                            : event.event_type.includes("failed") 
                              ? "bg-red-400"
                              : "bg-blue-400"
                          }
                        `} />
                        {index < auditEvents.length - 1 && (
                          <div className="absolute top-4 left-[3px] w-0.5 h-full bg-slate-800" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm text-white">
                          {event.event_type.replace(/\./g, " ").replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {event.created_date && !isNaN(new Date(event.created_date))
                            ? format(new Date(event.created_date), "MMM d, h:mm a")
                            : "Recently"
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ComplianceSection({ trade, complianceRun }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-6">
        {!complianceRun ? (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Compliance Check Pending</h3>
            <p className="text-slate-400 mb-4">Run a compliance check to verify trade regulations and restrictions.</p>
            <Link to={createPageUrl(`Compliance?trade=${trade.id}`)}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Start Compliance Check
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Compliance Results</h3>
              <Badge 
                variant="outline"
                className={`
                  ${complianceRun.status === "passed" 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : complianceRun.status === "warnings"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }
                `}
              >
                {complianceRun.status === "passed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {complianceRun.status === "warnings" && <AlertCircle className="w-3 h-3 mr-1" />}
                {complianceRun.status === "failed" && <AlertCircle className="w-3 h-3 mr-1" />}
                {complianceRun.status?.charAt(0).toUpperCase() + complianceRun.status?.slice(1)}
              </Badge>
            </div>
            
            {complianceRun.checks?.map((check, index) => (
              <div key={index} className="p-3 bg-slate-800/50 rounded-lg flex items-start gap-3">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                  ${check.status === "passed" 
                    ? "bg-emerald-500/20 text-emerald-400"
                    : check.status === "warning"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  }
                `}>
                  {check.status === "passed" ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{check.name}</p>
                  <p className="text-slate-400 text-xs mt-1">{check.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceSection({ trade, offers, acceptedOffer }) {
  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-6">
        {offers.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Finance Offers</h3>
            <p className="text-slate-400 mb-4">Request finance offers after completing compliance checks.</p>
            {trade.compliance_status === "passed" && (
              <Link to={createPageUrl(`Finance?trade=${trade.id}`)}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Request Finance Offers
                </Button>
              </Link>
            )}
          </div>
        ) : acceptedOffer ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Accepted Offer</h3>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Accepted
              </Badge>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-emerald-500/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">{acceptedOffer.provider_name}</span>
                {acceptedOffer.stf_certified && (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                    STF Certified
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Amount</p>
                  <p className="text-white font-medium">{formatCurrency(acceptedOffer.amount, acceptedOffer.currency)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Rate</p>
                  <p className="text-white font-medium">{acceptedOffer.interest_rate}%</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Term</p>
                  <p className="text-white font-medium">{acceptedOffer.term_days} days</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Available Offers</h3>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                {offers.length} offers
              </Badge>
            </div>
            <Link to={createPageUrl(`Finance?trade=${trade.id}`)}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                View & Compare Offers
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentSection({ trade, payment }) {
  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-6">
        {!payment ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Payment Pending</h3>
            <p className="text-slate-400 mb-4">Execute payment after accepting a finance offer.</p>
            {trade.status === "finance_accepted" && (
              <Link to={createPageUrl(`Payments?trade=${trade.id}`)}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Execute Payment
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Payment Status</h3>
              <Badge 
                variant="outline"
                className={`
                  ${payment.status === "completed" 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : payment.status === "failed"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : payment.status === "executing"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }
                `}
              >
                {payment.status === "executing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {payment.status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
              </Badge>
            </div>
            
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Amount</p>
                  <p className="text-white font-medium text-lg">{formatCurrency(payment.amount, payment.currency)}</p>
                </div>
                {payment.confirmation_code && (
                  <div>
                    <p className="text-slate-400 text-xs">Confirmation</p>
                    <p className="text-white font-mono text-sm">{payment.confirmation_code}</p>
                  </div>
                )}
              </div>
              
              {payment.route?.steps && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-slate-400 text-xs mb-2">Payment Route</p>
                  <div className="flex items-center gap-2 text-sm">
                    {payment.route.steps.map((step, index) => (
                      <React.Fragment key={index}>
                        <span className="text-white">{step.bank || step.name}</span>
                        {index < payment.route.steps.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProofSection({ trade, proofBundle }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-6">
        {!proofBundle ? (
          <div className="text-center py-8">
            <FileCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Proof Bundle</h3>
            <p className="text-slate-400 mb-4">Generate a cryptographic proof bundle after payment completion.</p>
            {trade.status === "payment_completed" && (
              <Link to={createPageUrl(`Proofs?trade=${trade.id}`)}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Generate Proof Bundle
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Proof Bundle</h3>
              <Badge 
                variant="outline"
                className={`
                  ${proofBundle.status === "ready" || proofBundle.status === "verified"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : proofBundle.status === "tampered"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }
                `}
              >
                {proofBundle.status === "generating" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {proofBundle.status === "ready" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {proofBundle.status?.charAt(0).toUpperCase() + proofBundle.status?.slice(1)}
              </Badge>
            </div>
            
            <div className="p-4 bg-slate-800/50 rounded-lg space-y-3">
              <div>
                <p className="text-slate-400 text-xs">Bundle ID</p>
                <p className="text-white font-mono text-sm">{proofBundle.bundle_id}</p>
              </div>
              {proofBundle.merkle_root && (
                <div>
                  <p className="text-slate-400 text-xs">Merkle Root</p>
                  <p className="text-white font-mono text-xs break-all">{proofBundle.merkle_root}</p>
                </div>
              )}
              {proofBundle.artifacts && (
                <div>
                  <p className="text-slate-400 text-xs">Artifacts</p>
                  <p className="text-white">{proofBundle.artifacts.length} files</p>
                </div>
              )}
            </div>

            {proofBundle.status === "ready" && (
              <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                <Download className="w-4 h-4 mr-2" />
                Download Proof Bundle
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}