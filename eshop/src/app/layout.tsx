import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROVLAJKY.CZ",
  description: "Nový e-shop PROVLAJKY.CZ — již brzy.",
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
