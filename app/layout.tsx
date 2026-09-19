import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://postmatch.rawia.dev"),
  title: "postmatch",
  description: "Paste a job posting. Get its requirements, sponsorship and eligibility as structured facts, streamed live.",
  openGraph: {
    title: "postmatch",
    description: "Paste a job posting. Get its requirements, sponsorship and eligibility as structured facts, streamed live.",
    url: "https://postmatch.rawia.dev",
    siteName: "postmatch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "postmatch",
    description: "Paste a job posting. Get its requirements, sponsorship and eligibility as structured facts, streamed live.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
