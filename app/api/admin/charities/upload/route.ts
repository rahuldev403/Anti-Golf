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

function jsonSuccess(data: unknown) {
  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(
        "Supabase environment variables are not configured.",
        500,
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Missing required file.", 400);
    }

    if (!file.type.startsWith("image/")) {
      return jsonError("Only image files are allowed.", 400);
    }

    const configuredBucket = (
      process.env.NEXT_PUBLIC_CHARITY_IMAGE_BUCKET || "charity-media"
    ).trim();
    const candidateBuckets = Array.from(
      new Set(
        [configuredBucket, "charity-media", "winner-proofs"].filter(Boolean),
      ),
    );

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `charities/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const serviceDb = createClient(supabaseUrl, serviceRoleKey);

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

      return jsonSuccess({
        bucket,
        path: data.path,
        publicUrl,
      });
    }

    return jsonError(
      lastError ||
        "No valid storage bucket found. Set NEXT_PUBLIC_CHARITY_IMAGE_BUCKET to an existing bucket.",
      400,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to upload image.", 500, message);
  }
}
