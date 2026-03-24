import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CheckoutRequestBody = {
  planType?: "monthly" | "yearly";
};

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const monthlyPriceId =
      process.env.STRIPE_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRICE_ID;
    const yearlyPriceId = process.env.STRIPE_PRICE_ID_YEARLY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    const body = ((await request.json().catch(() => ({}))) ??
      {}) as CheckoutRequestBody;
    const planType = body.planType === "yearly" ? "yearly" : "monthly";
    const stripePriceId =
      planType === "yearly" ? yearlyPriceId : monthlyPriceId;

    if (!stripeSecretKey || !stripePriceId) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Set STRIPE_SECRET_KEY and a price id for the selected plan.",
        },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/dashboard/billing?checkout=cancelled`,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        plan_type: planType,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Checkout session creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
