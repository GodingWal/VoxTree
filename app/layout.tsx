import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "VoxTree — Personalized Family Voices for Children's Stories",
  description:
    "Upload a family member's voice and hear them narrate your children's favorite educational videos. Grandma, Grandpa, or anyone special — reading to your kids, anytime.",
  keywords: [
    "personalized children's audiobooks",
    "family voice stories for kids",
    "grandparent reads bedtime stories",
    "voice cloning for families",
    "children's educational videos",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
