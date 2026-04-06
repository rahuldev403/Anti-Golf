import CharityImage from "../../components/CharityImage";

type CharityImpactCardProps = {
  charityName: string | null;
  charityDescription?: string | null;
  charityImageUrl?: string | null;
  contributionPercent: number;
  isSaving: boolean;
  onContributionChange: (value: number) => void;
  onSave: () => void;
};

const PLACEHOLDER_IMAGE = "/charity.jpg";

export default function CharityImpactCard({
  charityName,
  charityDescription,
  charityImageUrl,
  contributionPercent,
  isSaving,
  onContributionChange,
  onSave,
}: CharityImpactCardProps) {
  const resolvedCharityName = charityName ?? "Hope Foundation";
  const safePercent = Math.min(50, Math.max(10, contributionPercent));
  const milestoneValues = [10, 20, 30, 40, 50];

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm ring-1 ring-primary/8">
      <div className="grid grid-cols-1 lg:grid-cols-[40%_60%]">
        <div className="relative h-56 lg:h-full">
          <CharityImage
            src={charityImageUrl || PLACEHOLDER_IMAGE}
            alt={resolvedCharityName}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background/60 via-background/15 to-transparent" />
          <div className="absolute bottom-4 left-4 rounded-full border border-white/40 bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            Active Charity Partner
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Charity Impact
              </p>
              <h3 className="mt-2 text-2xl font-semibold leading-tight">
                You are currently funding {resolvedCharityName}.
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Min 10%
                </span>
                <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Max 50%
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-right">
              <p className="text-xs text-muted-foreground">Contribution</p>
              <p className="text-2xl font-semibold leading-none text-primary">
                {safePercent}%
              </p>
            </div>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {charityDescription ||
              "Every score you submit pushes real support into causes that need it most. You are not just playing better, you are building impact."}
          </p>

          <div className="mt-6 rounded-2xl border border-border/70 bg-background/60 p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <label
                htmlFor="charity-impact-slider"
                className="font-medium text-muted-foreground"
              >
                Contribution Level
              </label>
              <span className="font-semibold text-primary">
                {safePercent}% selected
              </span>
            </div>

            <div className="pb-2">
              <progress
                value={safePercent - 10}
                max={40}
                aria-label="Contribution progress"
                className="h-3 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-linear-to-r [&::-webkit-progress-value]:from-primary/70 [&::-webkit-progress-value]:via-primary [&::-webkit-progress-value]:to-chart-2 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary"
              />

              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                {milestoneValues.map((value) => (
                  <span
                    key={value}
                    className={
                      value <= safePercent
                        ? "font-semibold text-foreground"
                        : ""
                    }
                  >
                    {value}%
                  </span>
                ))}
              </div>
            </div>

            <input
              id="charity-impact-slider"
              type="range"
              min={10}
              max={50}
              step={1}
              value={safePercent}
              onChange={(event) =>
                onContributionChange(Number(event.target.value))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {milestoneValues.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onContributionChange(value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    value === safePercent
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Tip: Higher contribution percentages increase your monthly support
              impact for this partner.
            </p>
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? "Saving..." : "Save Contribution"}
          </button>
        </div>
      </div>
    </article>
  );
}
