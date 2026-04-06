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

export async function GET() {
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

    const serviceDb = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const withCategory = await serviceDb
      .from("charities")
      .select("id, name, description, image_url, category")
      .order("name", { ascending: true });

    let charities: Array<{
      id: string;
      name: string;
      description: string | null;
      image_url: string | null;
      category: string | null;
    }> | null = null;

    if (!withCategory.error) {
      charities =
        (withCategory.data as Array<{
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          category: string | null;
        }> | null) ?? [];
    } else {
      const withoutCategory = await serviceDb
        .from("charities")
        .select("id, name, description, image_url")
        .order("name", { ascending: true });

      if (withoutCategory.error) {
        return jsonError(
          "Failed to load charities.",
          500,
          withoutCategory.error.message,
        );
      }

      charities = (
        (withoutCategory.data ?? []) as Array<{
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
        }>
      ).map((item) => ({
        ...item,
        category: null,
      }));
    }

    return NextResponse.json(
      {
        success: true,
        charities: charities ?? [],
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return jsonError("Unexpected error while loading charities.", 500, message);
  }
}
