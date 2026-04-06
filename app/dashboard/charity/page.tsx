"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "../../../utils/supabase/client";
import CharityImpactCard from "../components/CharityImpactCard";

type UserProfileRow = {
  selected_charity_id: string | null;
  charity_percentage: number;
};

type CharityRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

export default function CharityPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [charity, setCharity] = useState<CharityRow | null>(null);
  const [contributionPercent, setContributionPercent] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = useMemo(() => {
    try {
      return createSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const loadCharity = async () => {
      if (!supabase) {
        setErrorMessage("Supabase client is unavailable.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("You must be signed in to view charity impact.");
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("selected_charity_id, charity_percentage")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setErrorMessage(profileError.message);
        return;
      }

      const castProfile = (profile as UserProfileRow | null) ?? null;
      setContributionPercent(
        Math.min(
          50,
          Math.max(10, Number(castProfile?.charity_percentage ?? 10)),
        ),
      );

      if (!castProfile?.selected_charity_id) {
        setCharity(null);
        return;
      }

      const { data: charityData, error: charityError } = await supabase
        .from("charities")
        .select("id, name, description, image_url")
        .eq("id", castProfile.selected_charity_id)
        .maybeSingle();

      if (charityError) {
        setErrorMessage(charityError.message);
        return;
      }

      setCharity((charityData as CharityRow | null) ?? null);
    };

    void loadCharity();
  }, [supabase]);

  const handleSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supabase || !userId) {
      setErrorMessage("You must be signed in to update contribution settings.");
      return;
    }

    const safePercent = Math.min(50, Math.max(10, contributionPercent));

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("users")
        .update({ charity_percentage: safePercent })
        .eq("id", userId);

      if (error) {
        throw new Error(error.message);
      }

      setContributionPercent(safePercent);
      setSuccessMessage("Contribution percentage updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save contribution settings.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-r from-primary/10 via-background to-chart-2/10 p-4 shadow-sm sm:p-6">
        <div
          className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-primary/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-chart-2/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Charity Impact
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Tune your contribution and maximize meaningful impact for your
            selected cause.
          </p>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-lg border border-chart-3/40 bg-chart-3/15 p-3 text-sm text-chart-3">
          {successMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm sm:p-4">
        <CharityImpactCard
          charityName={charity?.name ?? null}
          charityDescription={charity?.description ?? null}
          charityImageUrl={charity?.image_url ?? null}
          contributionPercent={contributionPercent}
          isSaving={isSaving}
          onContributionChange={setContributionPercent}
          onSave={handleSave}
        />
      </div>
    </section>
  );
}
