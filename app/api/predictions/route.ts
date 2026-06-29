import { NextRequest, NextResponse } from "next/server";
import { LEGACY_PREDICTION_SUBMITTED_AT } from "@/lib/prediction-submission";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PREDICTION_COLUMNS = "id,user_id,display_name,picks,updated_at";
const PREDICTION_COLUMNS_WITH_CREATED_AT =
  "id,user_id,display_name,picks,created_at,updated_at";

type PredictionRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  picks: Record<string, string | null | undefined> | null;
  created_at?: string | null;
  updated_at: string;
};

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ supabaseConfigured: false, prediction: null });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ supabaseConfigured: true, prediction: null }, { status: 401 });
  }

  const withSubmittedAt = await supabase
    .from("prediction_brackets")
    .select(PREDICTION_COLUMNS_WITH_CREATED_AT)
    .eq("user_id", user.id)
    .maybeSingle();
  let data = withSubmittedAt.data as unknown as PredictionRow | null;
  let error = withSubmittedAt.error;

  if (isMissingCreatedAtError(error)) {
    const fallback = await supabase
      .from("prediction_brackets")
      .select(PREDICTION_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();
    data = fallback.data as PredictionRow | null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    supabaseConfigured: true,
    prediction: data ? serializePrediction(data as PredictionRow) : null,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 501 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Anonymous session required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    displayName?: string;
    picks?: Record<string, string | null | undefined>;
  };

  const displayName = body.displayName?.trim().slice(0, 48);
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }
  const picks = Object.fromEntries(
    Object.entries(body.picks ?? {}).filter(([, value]) => typeof value === "string" || value === null),
  );

  const savedAt = new Date().toISOString();
  const row = {
    user_id: user.id,
    display_name: displayName,
    picks,
    updated_at: savedAt,
  };
  const savePrediction = (columns: string) =>
    supabase
      .from("prediction_brackets")
      .upsert(
        row,
        { onConflict: "user_id" },
      )
      .select(columns)
      .single();

  const savedWithSubmittedAt = await savePrediction(PREDICTION_COLUMNS_WITH_CREATED_AT);
  let data = savedWithSubmittedAt.data as unknown as PredictionRow | null;
  let error = savedWithSubmittedAt.error;

  if (isMissingCreatedAtError(error)) {
    const fallback = await savePrediction(PREDICTION_COLUMNS);
    data = fallback.data as unknown as PredictionRow | null;
    error = fallback.error;
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Prediction was not saved" }, { status: 500 });
  }

  return NextResponse.json({
    prediction: serializePrediction(data),
  });
}

function serializePrediction(row: PredictionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    picks: row.picks ?? {},
    submittedAt: row.created_at ?? LEGACY_PREDICTION_SUBMITTED_AT,
    updatedAt: row.updated_at,
  };
}

function isMissingCreatedAtError(error: { code?: string; details?: string | null; message?: string } | null) {
  if (!error) return false;
  const errorText = `${error.code ?? ""} ${error.details ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    errorText.includes("created_at") &&
    (error.code === "42703" || errorText.includes("could not find") || errorText.includes("does not exist"))
  );
}
