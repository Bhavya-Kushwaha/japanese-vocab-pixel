import type { Metadata } from "next";
import "./globals.css";
import { VocabProvider } from "@/context/VocabContext";
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: "Vocab Quest | Japanese Pixel SRS",
  description: "A retro-themed Japanese vocabulary collector and spaced repetition system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* We keep audio global if we want continuous background music */}
        <audio id="bgMusic" src="/bg-music.webm" loop />
        
        <main className="container mx-auto p-4 max-w-4xl flex-grow flex flex-col">
          <VocabProvider>
            {children}
          </VocabProvider>
        </main>
        <SpeedInsights />
      </body>
    </html>
  );
}
