import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({
 variable: "--font-inter",
 subsets: ["latin"],
});

export const metadata: Metadata = {
 title: "2nest | Connexion",
 description: "2nest, SaaS de co-parentalite pour parents separes au Quebec.",
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
  <html lang="en">
   <body className={`${inter.variable} antialiased`}>
    <AppShell>{children}</AppShell>
   </body>
  </html>
 );
}
