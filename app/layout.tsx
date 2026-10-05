import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";

export const metadata: Metadata = {
  title: "PDFs bearbeiten",
  description: "PDFs bearbeiten, zusammenfügen, teilen und Text aus Scans erkennen. Direkt im Browser, ohne Dokumenten-Upload.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
