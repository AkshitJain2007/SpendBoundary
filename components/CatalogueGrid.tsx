import React from "react";
import { ShoppingBag, ShieldCheck, ShieldAlert, Tag } from "lucide-react";

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  pricePaise: number;
  stock: number;
  allowed: boolean;
  description: string;
}

interface CatalogueGridProps {
  products: ProductItem[];
  onAddToCart?: (product: ProductItem) => void;
}

export function CatalogueGrid({ products, onAddToCart }: CatalogueGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-navy-700">
        <div className="flex items-center space-x-2">
          <ShoppingBag className="h-5 w-5 text-brand-blue" />
          <h3 className="text-sm font-semibold text-slate-100">Merchant Product Catalogue (6 Items)</h3>
        </div>
        <span className="text-xs text-slate-400">Fixed Synthetic Inventory</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const formattedPrice = (p.pricePaise / 100).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
          });

          return (
            <div
              key={p.id}
              className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                p.allowed
                  ? "bg-navy-850 border-navy-700 hover:border-brand-blue/50"
                  : "bg-red-950/20 border-red-800/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-navy-950 text-slate-400 border border-navy-800">
                    {p.category}
                  </span>
                  {p.allowed ? (
                    <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Allowed</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-[10px] text-red-400 font-semibold">
                      <ShieldAlert className="h-3 w-3" />
                      <span>Restricted</span>
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-semibold text-slate-100">{p.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                  {p.description}
                </p>
              </div>

              <div className="pt-2 border-t border-navy-750 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">Verified DB Price</div>
                  <div className="text-sm font-bold font-mono text-slate-100">₹{formattedPrice}</div>
                </div>

                <div className="text-[10px] text-slate-400">
                  Stock: <span className="text-slate-200 font-semibold">{p.stock}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
