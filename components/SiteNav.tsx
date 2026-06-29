"use client";

import {
  CircleDotDashed,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Trophy,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useBracketLayoutPreference } from "@/components/BracketLayoutPreference";
import {
  getNextBracketLayoutMode,
  type BracketLayoutMode,
} from "@/lib/bracket-layout-mode";

export function SiteNav() {
  const pathname = usePathname();
  const isLeaderboard = pathname === "/leaderboard";
  const { layoutMode, toggleLayoutMode } = useBracketLayoutPreference();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const nextLayoutMode = getNextBracketLayoutMode(layoutMode);
  const nextLayoutLabel = `Switch to ${getLayoutModeLabel(nextLayoutMode)} bracket layout`;

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
      {!isLeaderboard ? (
        <button
          type="button"
          className="bracket-layout-toggle"
          aria-label={nextLayoutLabel}
          aria-pressed={layoutMode !== "symmetric"}
          title={nextLayoutLabel}
          onClick={toggleLayoutMode}
        >
          <BracketLayoutIcon layoutMode={nextLayoutMode} />
        </button>
      ) : null}
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

function BracketLayoutIcon({ layoutMode }: { layoutMode: BracketLayoutMode }) {
  if (layoutMode === "symmetric") {
    return <LayoutGrid aria-hidden="true" />;
  }
  if (layoutMode === "team-circular") {
    return <Waypoints aria-hidden="true" />;
  }
  return <CircleDotDashed aria-hidden="true" />;
}

function getLayoutModeLabel(layoutMode: BracketLayoutMode) {
  if (layoutMode === "team-circular") return "team circular";
  return layoutMode;
}
