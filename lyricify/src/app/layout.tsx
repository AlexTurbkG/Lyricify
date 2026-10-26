import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Spotify's real typeface (Circular) is proprietary. Manrope is a free
// geometric sans with the same rounded, confident feel, so it stands in
// as the app's display/body font instead of the generic Geist default.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lyricify — Spotify Lyric Guesser",
  description: "Turn any public Spotify playlist or album into a lyric-guessing game.",
};

export const viewport: Viewport = {
  themeColor: "#1DB954",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-[#121212] text-white"
        style={{ fontFamily: "var(--font-manrope), var(--font-geist-sans), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}