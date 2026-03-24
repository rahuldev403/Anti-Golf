"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

function BillingPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [planType, setPlanType] = useState<"monthly" | "yearly">("monthly");

  const showUpgradeError = searchParams.get("error") === "upgrade_required";

  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType }),
      });

      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to create checkout session.");
      }

      window.location.href = payload.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open checkout.";
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activate premium access to unlock score submissions.
        </p>
      </header>

      {showUpgradeError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Premium access is required to enter scores. Please upgrade your
          subscription.
        </div>
      ) : null}

      <article className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Premium Plan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock score entry, draw participation, and full charity impact
          controls.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-border/70 bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setPlanType("monthly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              planType === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPlanType("yearly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              planType === "yearly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
          </button>
        </div>

        <p className="mt-4 text-3xl font-semibold text-primary">
          {planType === "monthly" ? "Rs 899 / month" : "Rs 7,999 / year"}
        </p>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={isLoading}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Redirecting..." : "Subscribe Now"}
        </button>
      </article>
    </section>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground">
            Loading billing details...
          </p>
        </section>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
