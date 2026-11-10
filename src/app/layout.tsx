import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodFund Karachi · Rainfall-triggered preparedness funding (simulation)",
  description:
    "FloodFund Karachi pairs a real ECMWF AIFS rainfall forecast and NASA satellite context with a transparent, pre-agreed rule that records a simulated emergency allocation and a full audit trail.",
};

export const viewport: Viewport = {
  themeColor: "#030814",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
