import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Bracket",
  description: "World Cup knockout bracket predictions with live fantasy scoring.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="site-nav" aria-label="Primary navigation">
            <Link href="/leaderboard">Leaderboard</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
