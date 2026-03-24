import Stripe from "stripe";
import { NextResponse } from "next/server";

type OneOffCheckoutRequestBody = {
  charityId?: string;
  amountInr?: number;
};

function sanitizeAmountInr(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1000;
  }

  return Math.min(500000, Math.max(100, Math.round(parsed)));
}

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error: "Stripe is not configured. Set STRIPE_SECRET_KEY.",
        },
        { status: 500 },
      );
    }

    const body = ((await request.json().catch(() => ({}))) ??
      {}) as OneOffCheckoutRequestBody;

    if (!body.charityId) {
      return NextResponse.json(
        { error: "Missing charity id." },
        { status: 400 },
      );
    }

    const amountInr = sanitizeAmountInr(body.amountInr);
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: "One-Off Charity Donation",
              description: `Donation for charity ${body.charityId}`,
            },
            unit_amount: amountInr * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/charities/${body.charityId}?donation=success`,
      cancel_url: `${siteUrl}/charities/${body.charityId}?donation=cancelled`,
      metadata: {
        charity_id: body.charityId,
        donation_type: "one_off",
        amount_inr: String(amountInr),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "One-off checkout session creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
