"use client";

import { Maximize2, Minimize2, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function SiteNav() {
  const pathname = usePathname();
  const isLeaderboard = pathname === "/leaderboard";
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers deny fullscreen outside supported contexts.
    }
  }

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <Link
        href={isLeaderboard ? "/" : "/leaderboard"}
        className={isLeaderboard ? undefined : "site-nav-icon-link"}
        aria-label={isLeaderboard ? undefined : "Leaderboard"}
        title={isLeaderboard ? undefined : "Leaderboard"}
      >
        {isLeaderboard ? "Brackets" : <Trophy className="site-nav-trophy-icon" aria-hidden="true" />}
      </Link>
      <button
        type="button"
        className="fullscreen-toggle"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        onClick={() => void toggleFullscreen()}
      >
        {isFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
      </button>
    </nav>
  );
}
