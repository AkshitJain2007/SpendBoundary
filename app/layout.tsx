import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpendBoundary — Policy-Gated Payments for AI Agents",
  description:
    "Merchant-side trust layer for AI-powered commerce. Policy-governed spending, human approval gates, idempotent payments, and tamper-evident audit logs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-navy-900 text-slate-100 min-h-screen antialiased flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
