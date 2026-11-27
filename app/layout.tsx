import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVEN Master ERP & Quotation System | SPARECONN SOLUTIONS",
  description:
    "End-to-End Quotation, Proforma Invoice, Tax Invoice, and Purchase Order System for Aven Industrial Automation",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#09090b] text-zinc-100 min-h-screen antialiased selection:bg-zinc-800 selection:text-white">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
