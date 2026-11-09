import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clearbill",
  description: "Two AI agents settle a medical bill so the humans do not have to argue. A prototype with fictional data and PayPal sandbox.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#6C4CF1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
