import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Fund Desk",
  description: "Client ad accounts, daily budgets and available funds.",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
