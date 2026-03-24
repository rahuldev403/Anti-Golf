"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { createClient as createSupabaseClient } from "../../../utils/supabase/client";

type ScoreRow = {
  id: string;
  score: number;
  date_played: string;
  created_at: string;
};

type ScoreApiResponse = {
  success?: boolean;
  error?: string;
  details?: string;
  scores?: ScoreRow[];
};

const todayIso = new Date().toISOString().slice(0, 10);

export default function ScoresPage() {
  const [scoreInput, setScoreInput] = useState(25);
  const [dateInput, setDateInput] = useState(todayIso);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const loadScores = async () => {
      if (!supabase) {
        setErrorMessage("Supabase client is unavailable.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("You must be signed in to manage scores.");
        return;
      }

      const { data, error } = await supabase
        .from("scores")
        .select("id, score, date_played, created_at")
        .eq("user_id", user.id)
        .order("date_played", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        setErrorMessage(`Failed to load scores: ${error.message}`);
        return;
      }

      setScores((data ?? []) as ScoreRow[]);
    };

    void loadScores();
  }, [supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supabase) {
      setErrorMessage("Supabase client is unavailable.");
      return;
    }

    const parsedScore = scoreInput;
    if (!Number.isInteger(parsedScore) || parsedScore < 1 || parsedScore > 45) {
      setErrorMessage("Score must be an integer between 1 and 45.");
      return;
    }

    try {
      setIsSubmitting(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setErrorMessage("You must be signed in to submit a score.");
        return;
      }

      const response = await fetch("/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ score: parsedScore, date_played: dateInput }),
      });

      const payload = (await response.json()) as ScoreApiResponse;
      if (!response.ok || !payload.success) {
        setErrorMessage(payload.error ?? "Failed to submit score.");
        return;
      }

      setScores(Array.isArray(payload.scores) ? payload.scores : []);
      setSuccessMessage("Score submitted successfully.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected error while submitting score.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const incrementScore = () => {
    setScoreInput((prev) => Math.min(prev + 1, 45));
  };

  const decrementScore = () => {
    setScoreInput((prev) => Math.max(prev - 1, 1));
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Score Entry</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your golf scores and track your recent performance.
        </p>
      </header>

      {errorMessage ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {errorMessage}
        </motion.div>
      ) : null}
      {successMessage ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-chart-3/40 bg-chart-3/15 p-4 text-sm text-chart-3"
        >
          {successMessage}
        </motion.div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* LEFT: Score Input */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Glassmorphism Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-md">
            <div className="pointer-events-none absolute inset-0 bg-primary/10" />

            <div className="relative z-10 space-y-8">
              {/* Large Numeric Display */}
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground mb-4">
                  Your Score
                </p>
                <motion.div
                  key={scoreInput}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-8xl font-black text-primary tracking-tighter"
                >
                  {scoreInput}
                </motion.div>
              </div>

              {/* +/- Buttons */}
              <div className="flex gap-4 justify-center">
                <motion.button
                  type="button"
                  onClick={decrementScore}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg transition-shadow hover:shadow-xl active:shadow-md"
                >
                  <Minus size={28} />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={incrementScore}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg transition-shadow hover:shadow-xl active:shadow-md"
                >
                  <Plus size={28} />
                </motion.button>
              </div>

              {/* Slider */}
              <div className="flex flex-col gap-3">
                <input
                  type="range"
                  aria-label="Select golf score"
                  min="1"
                  max="45"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-foreground/30 accent-primary dark:bg-white/20"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>45</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date Input */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Date Played
              </span>
              <input
                type="date"
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background/50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50"
              />
            </label>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Score"}
          </motion.button>
        </form>

        {/* RIGHT: Timeline */}
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-6">Recent Performance</h2>

          {scores.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/30 bg-card/30 p-8 backdrop-blur-sm text-center">
              <p className="text-sm text-muted-foreground">
                No scores yet. Submit your first score above!
              </p>
            </div>
          ) : (
            <div className="relative space-y-6">
              {/* Vertical Line */}
              <div className="absolute bottom-0 left-5 top-0 w-0.5 bg-primary/40" />

              {/* Timeline Items */}
              {scores.map((score, idx) => (
                <motion.div
                  key={score.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="relative pl-16"
                >
                  {/* Score Dot */}
                  <motion.div className="absolute left-0 top-1.5 h-10 w-10 rounded-full border border-border/50 bg-primary">
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary-foreground">
                      {score.score}
                    </div>
                  </motion.div>

                  {/* Score Card */}
                  <motion.div
                    whileHover={{ x: 4 }}
                    className="rounded-lg border border-border/40 bg-card/60 p-4 backdrop-blur-sm hover:bg-card/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(score.date_played).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Golf Score
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
