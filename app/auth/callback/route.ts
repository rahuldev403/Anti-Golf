import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  const safeNextPath = next.startsWith("/") ? next : "/dashboard";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const landingUrl = new URL("/", requestUrl.origin);
    landingUrl.searchParams.set("error", "verification_failed");
    return NextResponse.redirect(landingUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const selectedCharityId =
      typeof metadata.selected_charity_id === "string" &&
      metadata.selected_charity_id.trim().length > 0
        ? metadata.selected_charity_id.trim()
        : null;

    const rawContribution = Number(metadata.charity_percentage ?? 10);
    const safeContribution = Number.isFinite(rawContribution)
      ? Math.min(50, Math.max(10, Math.round(rawContribution)))
      : 10;

    await supabase.from("users").upsert(
      {
        id: user.id,
        role: "user",
        selected_charity_id: selectedCharityId,
        charity_percentage: safeContribution,
      },
      {
        onConflict: "id",
      },
    );
  }

  return NextResponse.redirect(new URL(safeNextPath, requestUrl.origin));
}
