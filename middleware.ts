import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type UserRole = "admin" | "user";

async function getRoleAndSubscriptionStatus(
  request: NextRequest,
  response: NextResponse,
  userId: string,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      role: "user" as UserRole,
      subscriptionStatus: null as string | null,
      hasConfig: false,
    };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const [profileRes, subscriptionRes] = await Promise.all([
    supabase.from("users").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const role = (profileRes.data?.role as UserRole | undefined) ?? "user";
  const subscriptionStatus =
    (subscriptionRes.data?.status as string | undefined) ?? null;
  const profileExists = Boolean(profileRes.data);

  return {
    role,
    subscriptionStatus,
    profileExists,
    hasConfig: true,
  };
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const landingUrl = new URL("/", request.url);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const redirect = NextResponse.redirect(landingUrl);
    return redirect;
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const metadataRole =
    (typeof user.app_metadata?.role === "string" &&
      (user.app_metadata.role as UserRole)) ||
    (typeof user.user_metadata?.role === "string" &&
      (user.user_metadata.role as UserRole)) ||
    null;

  const metadataSubscription =
    (typeof user.app_metadata?.subscription_status === "string" &&
      user.app_metadata.subscription_status) ||
    (typeof user.user_metadata?.subscription_status === "string" &&
      user.user_metadata.subscription_status) ||
    null;

  const { role, subscriptionStatus, profileExists } =
    await getRoleAndSubscriptionStatus(request, response, user.id);

  if (!profileExists) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("reason", "profile_missing");
    return NextResponse.redirect(redirectUrl);
  }

  const effectiveRole = metadataRole ?? role;
  const effectiveSubscriptionStatus =
    metadataSubscription ?? subscriptionStatus;

  if (pathname.startsWith("/admin") && effectiveRole !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    pathname.startsWith("/dashboard/scores") &&
    effectiveSubscriptionStatus !== "active"
  ) {
    const billingUrl = new URL("/dashboard/billing", request.url);
    billingUrl.searchParams.set("error", "upgrade_required");
    return NextResponse.redirect(billingUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
