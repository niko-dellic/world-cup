import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const { data, error } = await supabase
    .from("prediction_brackets")
    .select("id,user_id,display_name,picks,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    supabaseConfigured: true,
    prediction: data
      ? {
          id: data.id,
          userId: data.user_id,
          displayName: data.display_name,
          picks: data.picks ?? {},
          updatedAt: data.updated_at,
        }
      : null,
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

  const displayName = body.displayName?.trim().slice(0, 48) || "Anonymous";
  const picks = Object.fromEntries(
    Object.entries(body.picks ?? {}).filter(([, value]) => typeof value === "string" || value === null),
  );

  const { data, error } = await supabase
    .from("prediction_brackets")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        picks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("id,user_id,display_name,picks,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    prediction: {
      id: data.id,
      userId: data.user_id,
      displayName: data.display_name,
      picks: data.picks ?? {},
      updatedAt: data.updated_at,
    },
  });
}
