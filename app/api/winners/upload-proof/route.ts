import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
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

    const formData = await request.formData();
    const file = formData.get("file");
    const userIdRaw = formData.get("user_id");
    const winnerIdRaw = formData.get("winner_id");

    if (!(file instanceof File)) {
      return jsonError("Missing required file.", 400);
    }

    const userId = typeof userIdRaw === "string" ? userIdRaw.trim() : "";
    const winnerId =
      typeof winnerIdRaw === "string" ? winnerIdRaw.trim() : "proof";

    if (!userId) {
      return jsonError("Missing required field: user_id", 400);
    }

    if (!file.type.startsWith("image/")) {
      return jsonError("Only image files are allowed.", 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return jsonError("Image size must be 10MB or smaller.", 400);
    }

    const configuredBucket = (
      process.env.NEXT_PUBLIC_WINNER_PROOF_BUCKET ||
      process.env.WINNER_PROOF_BUCKET ||
      "winner-proofs"
    ).trim();

    const candidateBuckets = Array.from(
      new Set(
        [configuredBucket, "winner-proofs", "charity-media"].filter(Boolean),
      ),
    );

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${userId}/${winnerId}-${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const serviceDb = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let lastError: string | null = null;

    for (const bucket of candidateBuckets) {
      const { data, error } = await serviceDb.storage
        .from(bucket)
        .upload(filePath, bytes, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        lastError = error.message;
        continue;
      }

      const {
        data: { publicUrl },
      } = serviceDb.storage.from(bucket).getPublicUrl(data.path);

      return NextResponse.json(
        {
          success: true,
          bucket,
          path: data.path,
          publicUrl,
        },
        { status: 200 },
      );
    }

    return jsonError(
      lastError ||
        "No valid proof bucket found. Configure NEXT_PUBLIC_WINNER_PROOF_BUCKET.",
      400,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to upload winner proof.", 500, message);
  }
}
