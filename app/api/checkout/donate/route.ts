import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type DonateRequestBody = {
  charityId?: string;
  amount?: number;
};

function toSafeDollarAmount(value: unknown): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.round(parsed * 100) / 100;
  if (rounded < 1 || rounded > 100000) {
    return null;
  }

  return rounded;
}

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRole) {
      return NextResponse.json(
        {
          error:
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY), and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      );
    }

    const body = ((await request.json().catch(() => ({}))) ??
      {}) as DonateRequestBody;

    if (!body.charityId || typeof body.charityId !== "string") {
      return NextResponse.json(
        { error: "charityId is required." },
        { status: 400 },
      );
    }

    const amountDollars = toSafeDollarAmount(body.amount);
    if (amountDollars === null) {
      return NextResponse.json(
        {
          error:
            "amount must be a number between 1 and 100000 dollars (up to 2 decimal places).",
        },
        { status: 400 },
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
    } = await supabase.auth.getUser();

    const serviceClient = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: charity, error: charityError } = await serviceClient
      .from("charities")
      .select("id, name")
      .eq("id", body.charityId)
      .maybeSingle<{ id: string; name: string }>();

    if (charityError) {
      return NextResponse.json(
        { error: `Unable to verify charity: ${charityError.message}` },
        { status: 500 },
      );
    }

    if (!charity) {
      return NextResponse.json(
        { error: "Charity not found." },
        { status: 404 },
      );
    }

    const amountCents = Math.round(amountDollars * 100);
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `${charity.name} Donation`,
              description: `One-off donation to ${charity.name}`,
            },
          },
        },
      ],
      success_url: `${siteUrl}/charities/${body.charityId}?donation=success`,
      cancel_url: `${siteUrl}/charities/${body.charityId}?donation=cancelled`,
      metadata: {
        charity_id: body.charityId,
        user_id: user?.id ?? "",
        amount_dollars: amountDollars.toFixed(2),
      },
      customer_email: user?.email ?? undefined,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe checkout session did not return a URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create donation checkout session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
