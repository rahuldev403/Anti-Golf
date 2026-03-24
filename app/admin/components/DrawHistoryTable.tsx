"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DrawItem = {
  id: string;
  draw_date: string;
  status: "published" | "simulated" | string;
  winning_numbers: number[];
  total_prize_pool?: number | null;
  jackpot_amount?: number | null;
  rollover_amount_generated?: number | null;
};

type DrawHistoryTableProps = {
  draws: DrawItem[];
  onDeleteSimulatedDraw?: (drawId: string) => void;
  deletingDrawId?: string | null;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0.00";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function DrawHistoryTable({
  draws,
  onDeleteSimulatedDraw,
  deletingDrawId = null,
}: DrawHistoryTableProps) {
  const pageSize = 5;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(draws.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedDraws = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return draws.slice(start, start + pageSize);
  }, [currentPage, draws]);

  const startItem = draws.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, draws.length);

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">Draw History</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review simulations and published draw outcomes.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {draws.length > 0 ? (
          paginatedDraws.map((draw) => {
            const isPublished = draw.status === "published";
            const isSimulated = draw.status === "simulated";
            const jackpotValue =
              draw.jackpot_amount ?? draw.rollover_amount_generated ?? 0;

            return (
              <article
                key={draw.id}
                className="rounded-xl border border-border/50 bg-background/60 p-4 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Draw Date
                    </p>
                    <h3 className="mt-1 text-sm font-semibold sm:text-base">
                      {formatDate(draw.draw_date)}
                    </h3>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                      isPublished
                        ? "bg-primary/15 text-primary"
                        : "bg-accent/25 text-accent-foreground"
                    }`}
                  >
                    {isPublished ? "Published" : "Simulated"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {draw.winning_numbers.length > 0 ? (
                    draw.winning_numbers.map((number, index) => (
                      <span
                        key={`${draw.id}-num-${index}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-sm font-semibold text-foreground"
                      >
                        {number}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Winning numbers unavailable.
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border/50 bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total Prize Pool
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatCurrency(draw.total_prize_pool)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Jackpot / Rollover
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatCurrency(jackpotValue)}
                    </p>
                  </div>
                </div>

                {isSimulated ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onDeleteSimulatedDraw?.(draw.id)}
                      disabled={
                        !onDeleteSimulatedDraw || deletingDrawId === draw.id
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {deletingDrawId === draw.id
                        ? "Deleting..."
                        : "Delete Simulation"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-border/50 bg-background/50 p-6 text-sm text-muted-foreground">
            No draw history available yet.
          </div>
        )}
      </div>

      {draws.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startItem}-{endItem} of {draws.length} draws
          </p>

          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-sm transition hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-sm transition hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
