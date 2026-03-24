import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PlanType = "monthly" | "yearly";

function normalizePlanType(value: unknown): PlanType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized === "monthly" || normalized === "month") {
    return "monthly";
  }

  if (
    normalized === "yearly" ||
    normalized === "year" ||
    normalized === "annual"
  ) {
    return "yearly";
  }

  return null;
}

async function resolvePlanType(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<PlanType> {
  const metadataPlan = normalizePlanType(session.metadata?.plan_type);
  if (metadataPlan) {
    return metadataPlan;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;
  if (!subscriptionId) {
    return "monthly";
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === "year" ? "yearly" : "monthly";
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 },
    );
  }

  if (!supabaseUrl || !supabaseServiceRole) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 500 },
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeWebhookSecret,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      session.metadata?.user_id ??
      (typeof session.client_reference_id === "string"
        ? session.client_reference_id
        : null);
    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    if (!userId || !customerId) {
      return NextResponse.json(
        {
          received: true,
          ignored: true,
          reason: "Missing user_id metadata or Stripe customer ID.",
        },
        { status: 200 },
      );
    }

    const planType = await resolvePlanType(stripe, session);

    const serviceClient = createClient(supabaseUrl, supabaseServiceRole);
    const { error: ensureUserError } = await serviceClient.from("users").upsert(
      {
        id: userId,
        role: "user",
        stripe_customer_id: customerId,
      },
      { onConflict: "id" },
    );

    if (ensureUserError) {
      return NextResponse.json(
        {
          error: `Failed to ensure user profile row: ${ensureUserError.message}`,
        },
        { status: 500 },
      );
    }

    const { error: userUpdateError } = await serviceClient
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);

    if (userUpdateError) {
      return NextResponse.json(
        {
          error: `Failed to update user Stripe customer: ${userUpdateError.message}`,
        },
        { status: 500 },
      );
    }

    const { error: deactivateError } = await serviceClient
      .from("subscriptions")
      .update({ status: "inactive" })
      .eq("user_id", userId)
      .eq("status", "active");

    if (deactivateError) {
      return NextResponse.json(
        {
          error: `Failed to deactivate previous subscriptions: ${deactivateError.message}`,
        },
        { status: 500 },
      );
    }

    const { error: insertError } = await serviceClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        status: "active",
        plan_type: planType,
      });

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create subscription: ${insertError.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
