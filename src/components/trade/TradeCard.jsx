import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TradeStatusBadge from "./TradeStatusBadge";
import {
  ArrowRight,
  Globe,
  Package,
  DollarSign,
  Calendar,
  Building2,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";

export default function TradeCard({ trade }) {
  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-slate-500 mb-1">{trade.trade_id}</p>
            <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
              {trade.title || "Untitled Trade"}
            </h3>
          </div>
          <TradeStatusBadge status={trade.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {trade.exporter_country && trade.importer_country && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400">
                {trade.exporter_country}
                <ArrowRight className="w-3 h-3 inline mx-1" />
                {trade.importer_country}
              </span>
            </div>
          )}
          
          {trade.product && (
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400 truncate">{trade.product}</span>
            </div>
          )}

          {trade.estimated_amount && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400">
                {formatCurrency(trade.estimated_amount, trade.currency)}
              </span>
            </div>
          )}

          {trade.shipping_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400">
                {trade.shipping_date && !isNaN(new Date(trade.shipping_date)) 
                  ? format(new Date(trade.shipping_date), "MMM d, yyyy")
                  : "TBD"
                }
              </span>
            </div>
          )}
        </div>

        {(trade.exporter_name || trade.importer_name) && (
          <div className="flex items-center gap-4 mb-6 pt-4 border-t border-slate-800">
            {trade.exporter_name && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400">{trade.exporter_name}</span>
              </div>
            )}
            {trade.exporter_name && trade.importer_name && (
              <ArrowRight className="w-4 h-4 text-slate-600" />
            )}
            {trade.importer_name && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-400">{trade.importer_name}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            {trade.created_date ? `Created ${format(new Date(trade.created_date), "MMM d, yyyy")}` : "Created recently"}
          </p>
          <Link to={createPageUrl(`TradeDetail?id=${trade.id}`)}>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
            >
              View Details
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}