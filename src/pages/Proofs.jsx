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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/common/PageHeader";
import TradeStatusBadge from "@/components/trade/TradeStatusBadge";
import {
  FileCheck,
  CheckCircle2,
  Loader2,
  Globe,
  ArrowRight,
  ChevronRight,
  Download,
  Shield,
  Hash,
  FileJson,
  FolderArchive,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Lock,
  Link2,
  TreeDeciduous,
  FileText,
  Search
} from "lucide-react";
import { format } from "date-fns";

// Simple SHA-256 simulation (in production would use Web Crypto API)
const sha256 = async (message) => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Merkle tree builder
const buildMerkleTree = async (leaves) => {
  if (leaves.length === 0) return { root: '', tree: [] };
  
  let level = [...leaves];
  const tree = [level];
  
  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left; // Duplicate last if odd number
      const combined = await sha256(left + right);
      nextLevel.push(combined);
    }
    tree.push(nextLevel);
    level = nextLevel;
  }
  
  return { root: level[0], tree };
};

const generateBundleId = () => {
  return `BND-${Date.now().toString(36).toUpperCase()}`;
};

export default function Proofs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const selectedTradeId = urlParams.get("trade");

  const [selectedTrade, setSelectedTrade] = useState(selectedTradeId || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedHash, setCopiedHash] = useState("");

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades"],
    queryFn: () => base44.entities.Trade.list("-created_date")
  });

  const { data: proofBundles = [], isLoading: bundlesLoading } = useQuery({
    queryKey: ["proofBundles"],
    queryFn: () => base44.entities.ProofBundle.list("-created_date", 50)
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () => base44.entities.Payment.list("-created_date")
  });

  const { data: complianceRuns = [] } = useQuery({
    queryKey: ["complianceRuns"],
    queryFn: () => base44.entities.ComplianceRun.list("-created_date")
  });

  const { data: financeOffers = [] } = useQuery({
    queryKey: ["financeOffers"],
    queryFn: () => base44.entities.FinanceOffer.list("-created_date")
  });

  const eligibleTrades = trades.filter(t => 
    t.status === "payment_completed" || t.status === "completed"
  );

  const trade = trades.find(t => t.id === selectedTrade);
  const tradeBundle = trade ? proofBundles.find(p => p.trade_id === trade.trade_id) : null;
  const tradePayment = trade ? payments.find(p => p.trade_id === trade.trade_id) : null;
  const tradeCompliance = trade ? complianceRuns.find(c => c.trade_id === trade.trade_id) : null;
  const tradeFinance = trade ? financeOffers.find(f => f.trade_id === trade.trade_id && f.status === "accepted") : null;

  const generateProofMutation = useMutation({
    mutationFn: async () => {
      if (!trade) return;

      setIsGenerating(true);
      setGenerationStep(1);

      const bundleId = generateBundleId();
      const artifacts = [];

      // Step 1: Create trade artifact
      await new Promise(resolve => setTimeout(resolve, 800));
      const tradeData = {
        trade_id: trade.trade_id,
        status: trade.status,
        route: `${trade.exporter_country} → ${trade.importer_country}`,
        product: trade.product,
        amount: trade.estimated_amount,
        currency: trade.currency,
        incoterm: trade.incoterm,
        created_at: trade.created_date
      };
      const tradeHash = await sha256(JSON.stringify(tradeData));
      artifacts.push({
        artifact_id: `ART-TRADE-${Date.now()}`,
        type: "trade_details",
        hash: tradeHash,
        timestamp: new Date().toISOString()
      });
      setGenerationStep(2);

      // Step 2: Create compliance artifact
      await new Promise(resolve => setTimeout(resolve, 800));
      if (tradeCompliance) {
        const complianceData = {
          run_id: tradeCompliance.run_id,
          status: tradeCompliance.status,
          risk_score: tradeCompliance.overall_risk_score,
          checks_count: tradeCompliance.checks?.length || 0,
          completed_at: tradeCompliance.completed_at
        };
        const complianceHash = await sha256(JSON.stringify(complianceData));
        artifacts.push({
          artifact_id: `ART-COMP-${Date.now()}`,
          type: "compliance_results",
          hash: complianceHash,
          timestamp: new Date().toISOString()
        });
      }
      setGenerationStep(3);

      // Step 3: Create finance artifact
      await new Promise(resolve => setTimeout(resolve, 800));
      if (tradeFinance) {
        const financeData = {
          offer_id: tradeFinance.offer_id,
          provider: tradeFinance.provider_name,
          amount: tradeFinance.amount,
          rate: tradeFinance.interest_rate,
          term_days: tradeFinance.term_days,
          stf_certified: tradeFinance.stf_certified
        };
        const financeHash = await sha256(JSON.stringify(financeData));
        artifacts.push({
          artifact_id: `ART-FIN-${Date.now()}`,
          type: "finance_terms",
          hash: financeHash,
          timestamp: new Date().toISOString()
        });
      }
      setGenerationStep(4);

      // Step 4: Create payment artifact
      await new Promise(resolve => setTimeout(resolve, 800));
      if (tradePayment) {
        const paymentData = {
          payment_id: tradePayment.payment_id,
          amount: tradePayment.amount,
          currency: tradePayment.currency,
          confirmation_code: tradePayment.confirmation_code,
          sender_hash: tradePayment.sender?.account_hash,
          recipient_hash: tradePayment.recipient?.account_hash,
          executed_at: tradePayment.executed_at
        };
        const paymentHash = await sha256(JSON.stringify(paymentData));
        artifacts.push({
          artifact_id: `ART-PAY-${Date.now()}`,
          type: "payment_confirmation",
          hash: paymentHash,
          timestamp: new Date().toISOString()
        });
      }
      setGenerationStep(5);

      // Step 5: Build Merkle tree
      await new Promise(resolve => setTimeout(resolve, 800));
      const leafHashes = artifacts.map(a => a.hash);
      const { root: merkleRoot, tree: merkleTree } = await buildMerkleTree(leafHashes);
      setGenerationStep(6);

      // Step 6: Create bundle hash
      await new Promise(resolve => setTimeout(resolve, 500));
      const manifest = {
        bundle_id: bundleId,
        trade_id: trade.trade_id,
        version: "1.0",
        created_at: new Date().toISOString(),
        artifact_count: artifacts.length,
        merkle_root: merkleRoot
      };
      const bundleHash = await sha256(JSON.stringify(manifest));

      // Create proof bundle record
      const proofBundle = await base44.entities.ProofBundle.create({
        bundle_id: bundleId,
        trade_id: trade.trade_id,
        status: "ready",
        merkle_root: merkleRoot,
        artifacts: artifacts,
        manifest: manifest,
        merkle_tree: {
          leaves: leafHashes,
          levels: merkleTree
        },
        anchor_info: {
          status: "pending",
          note: "Ready for blockchain anchoring"
        },
        bundle_hash: bundleHash
      });

      // Update trade status
      await base44.entities.Trade.update(trade.id, {
        status: "completed",
        proof_bundle_id: bundleId
      });

      // Create audit event
      await base44.entities.AuditEvent.create({
        event_id: `EVT-${Date.now()}`,
        trade_id: trade.trade_id,
        event_type: "ledger.bundle.ready",
        details: { 
          bundle_id: bundleId,
          merkle_root: merkleRoot,
          artifact_count: artifacts.length
        }
      });

      setIsGenerating(false);
      setGenerationStep(0);
      return proofBundle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["trades"]);
      queryClient.invalidateQueries(["proofBundles"]);
    }
  });

  const verifyBundle = async () => {
    if (!verifyInput.trim()) return;
    
    setIsVerifying(true);
    setVerifyResult(null);

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Find bundle by ID or merkle root
    const bundle = proofBundles.find(
      b => b.bundle_id === verifyInput.trim() || b.merkle_root === verifyInput.trim()
    );

    if (bundle) {
      // Recalculate merkle root to verify integrity
      const leafHashes = bundle.artifacts.map(a => a.hash);
      const { root: calculatedRoot } = await buildMerkleTree(leafHashes);
      
      const isValid = calculatedRoot === bundle.merkle_root;
      
      setVerifyResult({
        status: isValid ? "verified" : "tampered",
        bundle: bundle,
        message: isValid 
          ? "Bundle integrity verified. All artifacts match the merkle root."
          : "WARNING: Bundle integrity check failed. Artifacts may have been modified."
      });
    } else {
      setVerifyResult({
        status: "not_found",
        message: "No proof bundle found with this ID or merkle root."
      });
    }

    setIsVerifying(false);
  };

  const copyToClipboard = async (text, label) => {
    await navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(""), 2000);
  };

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const generationSteps = [
    "Initializing...",
    "Creating trade artifact...",
    "Creating compliance artifact...",
    "Creating finance artifact...",
    "Creating payment artifact...",
    "Building merkle tree...",
    "Finalizing bundle..."
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Proofs & Ledger"
        description="Generate cryptographic proof bundles and verify trade integrity"
      />

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="generate" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
            <FileCheck className="w-4 h-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="verify" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
            <Search className="w-4 h-4 mr-2" />
            Verify
          </TabsTrigger>
          <TabsTrigger value="bundles" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
            <FolderArchive className="w-4 h-4 mr-2" />
            All Bundles
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Trade Selection */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Generate Proof Bundle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Select Trade</label>
                    <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select a completed trade" />
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
                            No eligible trades (must have completed payment)
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
                        <span>{trade.product || "—"}</span>
                        <span className="text-white font-semibold">
                          {trade.estimated_amount ? formatCurrency(trade.estimated_amount, trade.currency) : "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  {trade && !tradeBundle && !isGenerating && (
                    <Button 
                      onClick={() => generateProofMutation.mutate()}
                      disabled={isGenerating}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <FileCheck className="w-4 h-4 mr-2" />
                      Generate Proof Bundle
                    </Button>
                  )}

                  {isGenerating && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{generationSteps[generationStep]}</span>
                        <span className="text-sm text-blue-400">{generationStep}/6</span>
                      </div>
                      <Progress value={(generationStep / 6) * 100} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Existing Bundle Display */}
              {tradeBundle && (
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-400" />
                        Proof Bundle Ready
                      </CardTitle>
                      <Badge className="bg-emerald-500/20 text-emerald-400">
                        Verified
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Bundle Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <p className="text-slate-400 text-xs mb-1">Bundle ID</p>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-mono text-sm">{tradeBundle.bundle_id}</p>
                          <button 
                            onClick={() => copyToClipboard(tradeBundle.bundle_id, "bundle_id")}
                            className="text-slate-400 hover:text-white"
                          >
                            {copiedHash === "bundle_id" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <p className="text-slate-400 text-xs mb-1">Artifacts</p>
                        <p className="text-white font-semibold">{tradeBundle.artifacts?.length || 0} files</p>
                      </div>
                    </div>

                    {/* Merkle Root */}
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-400 text-xs flex items-center gap-1">
                          <TreeDeciduous className="w-3 h-3" /> Merkle Root
                        </p>
                        <button 
                          onClick={() => copyToClipboard(tradeBundle.merkle_root, "merkle_root")}
                          className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
                        >
                          {copiedHash === "merkle_root" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </button>
                      </div>
                      <p className="text-white font-mono text-xs break-all">{tradeBundle.merkle_root}</p>
                    </div>

                    {/* Artifacts List */}
                    <div className="space-y-2">
                      <p className="text-slate-400 text-xs">Artifacts</p>
                      {tradeBundle.artifacts?.map((artifact, index) => (
                        <div key={artifact.artifact_id} className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-white text-sm">{artifact.type.replace(/_/g, " ")}</p>
                              <p className="text-slate-500 text-xs font-mono">{artifact.hash.substring(0, 16)}...</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => copyToClipboard(artifact.hash, artifact.artifact_id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {copiedHash === artifact.artifact_id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Download Button */}
                    <Button 
                      variant="outline" 
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Proof Bundle (ZIP)
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Info */}
            <div className="space-y-6">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-base">Bundle Contents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <FileJson className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400">manifest.json</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <TreeDeciduous className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-400">merkle.json</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Link2 className="w-4 h-4 text-purple-400" />
                    <span className="text-slate-400">anchor.json (optional)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-400">artifacts/*</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/5 border-blue-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Lock className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-white font-semibold">Cryptographic Integrity</h3>
                  </div>
                  <p className="text-slate-400 text-sm">
                    SHA-256 hashes and Merkle trees ensure complete traceability 
                    and tamper-proof verification of all trade data.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Verify Tab */}
        <TabsContent value="verify">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Verify Proof Bundle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Enter Bundle ID or Merkle Root</label>
                  <Textarea
                    value={verifyInput}
                    onChange={(e) => setVerifyInput(e.target.value)}
                    placeholder="BND-XXXXX or merkle root hash..."
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono text-sm h-24"
                  />
                </div>

                <Button 
                  onClick={verifyBundle}
                  disabled={!verifyInput.trim() || isVerifying}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Verify Bundle
                    </>
                  )}
                </Button>

                {verifyResult && (
                  <div className={`
                    p-4 rounded-lg border
                    ${verifyResult.status === "verified" 
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : verifyResult.status === "tampered"
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-amber-500/10 border-amber-500/20"
                    }
                  `}>
                    <div className="flex items-start gap-3">
                      {verifyResult.status === "verified" && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                      {verifyResult.status === "tampered" && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                      {verifyResult.status === "not_found" && <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
                      <div>
                        <p className={`font-medium ${
                          verifyResult.status === "verified" ? "text-emerald-400" :
                          verifyResult.status === "tampered" ? "text-red-400" : "text-amber-400"
                        }`}>
                          {verifyResult.status === "verified" ? "Verification Successful" :
                           verifyResult.status === "tampered" ? "Integrity Check Failed" : "Bundle Not Found"}
                        </p>
                        <p className="text-slate-400 text-sm mt-1">{verifyResult.message}</p>
                        
                        {verifyResult.bundle && (
                          <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                            <p className="text-slate-400 text-xs">Trade: <span className="text-white">{verifyResult.bundle.trade_id}</span></p>
                            <p className="text-slate-400 text-xs">Created: <span className="text-white">
                              {verifyResult.bundle.created_date && !isNaN(new Date(verifyResult.bundle.created_date))
                                ? format(new Date(verifyResult.bundle.created_date), "MMM d, yyyy h:mm a")
                                : "Recently"
                              }
                            </span></p>
                            <p className="text-slate-400 text-xs">Artifacts: <span className="text-white">{verifyResult.bundle.artifacts?.length || 0}</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Bundles Tab */}
        <TabsContent value="bundles">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">All Proof Bundles</CardTitle>
            </CardHeader>
            <CardContent>
              {bundlesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : proofBundles.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No proof bundles generated yet</p>
              ) : (
                <div className="space-y-4">
                  {proofBundles.map(bundle => (
                    <div 
                      key={bundle.id}
                      className="p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-mono">{bundle.bundle_id}</p>
                          <p className="text-slate-400 text-sm">{bundle.trade_id}</p>
                        </div>
                        <Badge variant="outline" className={`
                          ${bundle.status === "ready" || bundle.status === "verified"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }
                        `}>
                          {bundle.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{bundle.artifacts?.length || 0} artifacts</span>
                        <span className="text-slate-500">
                          {bundle.created_date && !isNaN(new Date(bundle.created_date))
                            ? format(new Date(bundle.created_date), "MMM d, yyyy")
                            : "Recently"
                          }
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-slate-500 text-xs">Merkle Root</p>
                        <p className="text-slate-400 font-mono text-xs truncate">{bundle.merkle_root}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}