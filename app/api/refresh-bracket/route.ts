import { NextRequest, NextResponse } from "next/server";
import { refreshAndPersistBracket } from "@/lib/bracket-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bracket = await refreshAndPersistBracket();
    return NextResponse.json({
      ok: true,
      source: bracket.source,
      matchCount: bracket.matches.length,
      refreshedAt: bracket.refreshedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

function isAuthorized(request: NextRequest) {
  const configuredSecret = process.env.REFRESH_SECRET ?? process.env.CRON_SECRET;
  if (!configuredSecret && process.env.NODE_ENV !== "production") return true;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-refresh-secret");
  return Boolean(configuredSecret && (bearer === configuredSecret || headerSecret === configuredSecret));
}
