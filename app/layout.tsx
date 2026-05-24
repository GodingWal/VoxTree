import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400"],
  style: ["normal", "italic"],
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
      <body className={`${dmSans.variable} ${instrumentSerif.variable} font-sans antialiased`} data-starfield="on">
        {children}
      </body>
    </html>
  );
}
