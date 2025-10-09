import type { Metadata } from "next";
import React from 'react';
import { BIZ_UDPGothic } from "next/font/google";
import "./globals.css";

const bizUDPGothic = BIZ_UDPGothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-biz-udpgothic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "かいたす",
  description: "A sample application for managing subscriptions to Japanese food products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="light">
      <body className={bizUDPGothic.className}>
        {children}
      </body>
    </html>
  );
}
