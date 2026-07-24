import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteNav from "../components/SiteNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AgroVision AI",
  description: "Browser-based crop-field segmentation from Sentinel-2 time series.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
