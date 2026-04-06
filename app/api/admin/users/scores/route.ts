import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type UpdateScoreBody = {
  score_id?: unknown;
  score?: unknown;
  date_played?: unknown;
};

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

function sanitizeDatePlayed(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export async function PATCH(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(
        "Supabase environment variables are not configured.",
        500,
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    let body: UpdateScoreBody = {};
    try {
      body = (await request.json()) as UpdateScoreBody;
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const scoreId =
      typeof body.score_id === "string" && body.score_id.trim().length > 0
        ? body.score_id.trim()
        : null;

    if (!scoreId) {
      return jsonError("score_id is required.", 400);
    }

    const updateData: Record<string, unknown> = {};

    if (typeof body.score === "number") {
      const rounded = Math.round(body.score);
      if (rounded < 1 || rounded > 45) {
        return jsonError("score must be between 1 and 45.", 400);
      }
      updateData.score = rounded;
    }

    if (typeof body.date_played === "string") {
      const parsedDate = sanitizeDatePlayed(body.date_played);
      if (!parsedDate) {
        return jsonError("date_played must be a valid date string.", 400);
      }
      updateData.date_played = parsedDate;
    }

    if (Object.keys(updateData).length === 0) {
      return jsonError("At least one field must be provided to update.", 400);
    }

    const serviceDb = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await serviceDb
      .from("scores")
      .update(updateData)
      .eq("id", scoreId)
      .select("id, score, date_played, created_at")
      .single();

    if (error || !data) {
      return jsonError("Failed to update score.", 500, error?.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Score updated successfully.",
        score: data,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError("Unexpected error while updating score.", 500, message);
  }
}
