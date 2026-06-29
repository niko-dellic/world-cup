"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNav() {
  const pathname = usePathname();
  const isLeaderboard = pathname === "/leaderboard";

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <Link href={isLeaderboard ? "/" : "/leaderboard"}>
        {isLeaderboard ? "Brackets" : "Leaderboard"}
      </Link>
    </nav>
  );
}
