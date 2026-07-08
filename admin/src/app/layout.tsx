import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROVLAJKY admin",
  description: "Interní administrace PROVLAJKY.CZ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
