import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";

export const metadata: Metadata = {
  title: "PDFs bearbeiten",
  description: "PDFs bearbeiten, zusammenfügen, teilen und Text aus Scans erkennen. Direkt im Browser, ohne Dokumenten-Upload.",
  icons: {
    icon: {url: "/favicon.png?v=43c33290ac2f", type: "image/png", sizes: "256x256"},
    shortcut: "/favicon.ico?v=43c33290ac2f",
    apple: {url: "/apple-touch-icon.png?v=43c33290ac2f", sizes: "180x180"},
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
