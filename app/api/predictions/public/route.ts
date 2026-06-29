import { NextResponse } from "next/server";
import { getPredictionRows } from "@/lib/bracket-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const predictions = await getPredictionRows();

  return NextResponse.json({
    predictions: predictions.map((prediction) => ({
      id: prediction.id ?? prediction.userId,
      displayName: prediction.displayName,
      picks: prediction.picks,
      updatedAt: prediction.updatedAt,
    })),
  });
}
