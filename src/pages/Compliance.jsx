import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import TradeStatusBadge from "@/components/trade/TradeStatusBadge";
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Globe,
  Package,
  FileText,
  Download,
  ArrowRight,
  ChevronRight,
  Building2,
  Scale,
  Flag,
  Ban,
  FileWarning
} from "lucide-react";
import { format } from "date-fns";

// Simulated compliance rules
const COMPLIANCE_CHECKS = [
  {
    id: "sanctions",
    name: "Sanctions Screening",
    category: "sanctions",
    description: "Check against OFAC, EU, and UN sanctions lists"
  },
  {
    id: "export_control",
    name: "Export Control Classification",
    category: "export_control",
    description: "Verify product export licensing requirements"
  },
  {
    id: "country_risk",
    name: "Country Risk Assessment",
    category: "country_risk",
    description: "Evaluate destination country trade restrictions"
  },
  {
    id: "product_restrictions",
    name: "Product Restrictions",
    category: "product",
    description: "Check for dual-use goods and restricted items"
  },
  {
    id: "documentation",
    name: "Documentation Requirements",
    category: "documentation",
    description: "Verify required trade documents"
  },
  {
    id: "kyc_aml",
    name: "KYC/AML Screening",
    category: "kyc",
    description: "Know Your Customer and Anti-Money Laundering checks"
  }
];

// High-risk countries for simulation
const HIGH_RISK_COUNTRIES = ["North Korea", "Iran", "Syria", "Cuba", "Venezuela", "Russia", "Belarus"];
const MEDIUM_RISK_COUNTRIES = ["China", "Myanmar", "Afghanistan", "Iraq", "Libya", "Yemen"];

const generateRunId = () => {
  return `CMP-${Date.now().toString(36).toUpperCase()}`;
};

export default function Compliance() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const selectedTradeId = urlParams.get("trade");

  const [selectedTrade, setSelectedTrade] = useState(selectedTradeId || "");
  const [isRunning, setIsRunning] = useState(false);
  const [currentCheck, setCurrentCheck] = useState(0);
  const [checkResults, setCheckResults] = useState([]);

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades"],
    queryFn: () => base44.entities.Trade.list("-created_date")
  });

  const { data: complianceRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: ["complianceRuns"],
    queryFn: () => base44.entities.ComplianceRun.list("-created_date", 50)
  });

  const eligibleTrades = trades.filter(t => 
    ["planning", "compliance_check"].includes(t.status)
  );

  const trade = trades.find(t => t.id === selectedTrade);

  const runComplianceMutation = useMutation({
    mutationFn: async () => {
      if (!trade) return;

      setIsRunning(true);
      setCheckResults([]);
      setCurrentCheck(0);

      const runId = generateRunId();
      const results = [];

      // Simulate running each check with delay
      for (let i = 0; i < COMPLIANCE_CHECKS.length; i++) {
        setCurrentCheck(i + 1);
        await new Promise(resolve => setTimeout(resolve, 800));

        const check = COMPLIANCE_CHECKS[i];
        const result = simulateCheck(check, trade);
        results.push(result);
        setCheckResults([...results]);
      }

      // Calculate overall status
      const hasFailure = results.some(r => r.status === "failed");
      const hasWarning = results.some(r => r.status === "warning");
      const overallStatus = hasFailure ? "failed" : hasWarning ? "warnings" : "passed";
      const riskScore = calculateRiskScore(results);

      // Create compliance run record
      const complianceRun = await base44.entities.ComplianceRun.create({
        trade_id: trade.trade_id,
        run_id: runId,
        status: overallStatus,
        checks: results,
        overall_risk_score: riskScore,
        completed_at: new Date().toISOString()
      });

      // Update trade status
      await base44.entities.Trade.update(trade.id, {
        status: "compliance_check",
        compliance_status: overallStatus
      });

      // Create audit event
      await base44.entities.AuditEvent.create({
        event_id: `EVT-${Date.now()}`,
        trade_id: trade.trade_id,
        event_type: "compliance.completed",
        details: { 
          run_id: runId,
          status: overallStatus,
          risk_score: riskScore
        }
      });

      setIsRunning(false);
      return complianceRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["trades"]);
      queryClient.invalidateQueries(["complianceRuns"]);
    }
  });

  const simulateCheck = (check, trade) => {
    const exporterRisk = HIGH_RISK_COUNTRIES.includes(trade.exporter_country) ? "high" :
      MEDIUM_RISK_COUNTRIES.includes(trade.exporter_country) ? "medium" : "low";
    const importerRisk = HIGH_RISK_COUNTRIES.includes(trade.importer_country) ? "high" :
      MEDIUM_RISK_COUNTRIES.includes(trade.importer_country) ? "medium" : "low";

    let status = "passed";
    let message = "";

    switch (check.id) {
      case "sanctions":
        if (exporterRisk === "high" || importerRisk === "high") {
          status = "failed";
          message = "One or more parties are in a sanctioned country. Trade cannot proceed.";
        } else {
          status = "passed";
          message = "No sanctions matches found for involved parties.";
        }
        break;

      case "export_control":
        if (trade.product?.toLowerCase().includes("electronic") || trade.product?.toLowerCase().includes("tech")) {
          status = "warning";
          message = "Product may require export license. Recommend EAR classification review.";
        } else {
          status = "passed";
          message = "No export license required for this product category.";
        }
        break;

      case "country_risk":
        if (importerRisk === "medium" || exporterRisk === "medium") {
          status = "warning";
          message = "Elevated country risk. Enhanced due diligence recommended.";
        } else if (importerRisk === "high" || exporterRisk === "high") {
          status = "failed";
          message = "High-risk country detected. Additional authorization required.";
        } else {
          status = "passed";
          message = "Country risk assessment within acceptable parameters.";
        }
        break;

      case "product_restrictions":
        status = "passed";
        message = "Product is not on restricted or dual-use goods list.";
        break;

      case "documentation":
        status = "passed";
        message = "Standard trade documentation requirements identified.";
        break;

      case "kyc_aml":
        if (trade.estimated_amount > 500000) {
          status = "warning";
          message = "High-value transaction. Enhanced KYC verification recommended.";
        } else {
          status = "passed";
          message = "KYC/AML screening completed successfully.";
        }
        break;

      default:
        status = "passed";
        message = "Check completed successfully.";
    }

    return {
      check_id: check.id,
      name: check.name,
      category: check.category,
      status,
      message,
      severity: status === "failed" ? "critical" : status === "warning" ? "medium" : "low"
    };
  };

  const calculateRiskScore = (results) => {
    let score = 100;
    results.forEach(r => {
      if (r.status === "failed") score -= 30;
      if (r.status === "warning") score -= 10;
    });
    return Math.max(0, score);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "passed": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "failed": return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "passed": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "warning": case "warnings": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "failed": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const latestRunForTrade = trade ? complianceRuns.find(r => r.trade_id === trade.trade_id) : null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Compliance"
        description="Run compliance checks for trade sanctions, export controls, and regulatory requirements"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Run Compliance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trade Selection */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Run Compliance Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Select Trade</label>
                <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select a trade to check" />
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
                        No eligible trades found
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
                    <span>
                      {trade.estimated_amount ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: trade.currency || "USD",
                        minimumFractionDigits: 0
                      }).format(trade.estimated_amount) : "—"}
                    </span>
                  </div>
                </div>
              )}

              <Button 
                onClick={() => runComplianceMutation.mutate()}
                disabled={!trade || isRunning}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running Checks ({currentCheck}/{COMPLIANCE_CHECKS.length})
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Run Compliance Check
                  </>
                )}
              </Button>

              {isRunning && (
                <Progress value={(currentCheck / COMPLIANCE_CHECKS.length) * 100} className="h-2" />
              )}
            </CardContent>
          </Card>

          {/* Current/Latest Results */}
          {(checkResults.length > 0 || latestRunForTrade) && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">
                    {isRunning ? "Running Checks..." : "Compliance Results"}
                  </CardTitle>
                  {!isRunning && latestRunForTrade && (
                    <Badge variant="outline" className={getStatusColor(latestRunForTrade.status)}>
                      {getStatusIcon(latestRunForTrade.status)}
                      <span className="ml-1">{latestRunForTrade.status}</span>
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(isRunning ? checkResults : latestRunForTrade?.checks || []).map((result, index) => (
                  <div 
                    key={result.check_id}
                    className={`
                      p-4 rounded-lg border transition-all duration-300
                      ${result.status === "passed" 
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : result.status === "warning"
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-red-500/5 border-red-500/20"
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-medium">{result.name}</h4>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getStatusColor(result.status)}`}
                          >
                            {result.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{result.message}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {!isRunning && latestRunForTrade && (
                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Risk Score</p>
                          <p className={`text-2xl font-bold ${
                            latestRunForTrade.overall_risk_score >= 80 ? "text-emerald-400" :
                            latestRunForTrade.overall_risk_score >= 60 ? "text-amber-400" : "text-red-400"
                          }`}>
                            {latestRunForTrade.overall_risk_score}/100
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Run ID</p>
                          <p className="text-sm text-slate-300 font-mono">{latestRunForTrade.run_id}</p>
                        </div>
                      </div>
                      
                      {latestRunForTrade.status !== "failed" && (
                        <Link to={createPageUrl(`Finance?trade=${trade?.id}`)}>
                          <Button className="bg-blue-600 hover:bg-blue-700">
                            Proceed to Finance
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Recent Runs */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Recent Compliance Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : complianceRuns.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No compliance runs yet</p>
              ) : (
                <div className="space-y-3">
                  {complianceRuns.slice(0, 10).map(run => (
                    <div 
                      key={run.id}
                      className="p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={() => {
                        const trade = trades.find(t => t.trade_id === run.trade_id);
                        if (trade) setSelectedTrade(trade.id);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-slate-400">{run.run_id}</span>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(run.status)}`}>
                          {run.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-white">{run.trade_id}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(new Date(run.created_date), "MMM d, h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compliance Legend */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Check Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Flag className="w-4 h-4 text-red-400" />
                <span className="text-slate-400">Sanctions Screening</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Ban className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400">Export Controls</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400">Country Risk</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Package className="w-4 h-4 text-purple-400" />
                <span className="text-slate-400">Product Restrictions</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileWarning className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-400">Documentation</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Scale className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-400">KYC/AML</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}