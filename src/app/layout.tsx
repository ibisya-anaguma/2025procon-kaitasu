import type { Metadata } from "next";
import React from 'react';
import { BIZ_UDPGothic } from "next/font/google";
import "./globals.css";

const geistSans = BIZ_UDPGothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = BIZ_UDPGothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
