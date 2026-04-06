import { CloudUpload } from "lucide-react";

type WinnerVerificationAlertProps = {
  isVisible: boolean;
  pendingPrizeAmount?: number;
  isUploading: boolean;
  selectedFileName?: string | null;
  selectedFileSizeBytes?: number | null;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
};

export default function WinnerVerificationAlert({
  isVisible,
  pendingPrizeAmount,
  isUploading,
  selectedFileName,
  selectedFileSizeBytes,
  onFileChange,
  onSubmit,
}: WinnerVerificationAlertProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-destructive/35 border-l-4 border-l-destructive bg-linear-to-r from-destructive/12 via-background to-primary/5 p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-destructive/10 blur-2xl" />
      <h2 className="text-lg font-semibold text-destructive">
        Action Required: Verify Your Winning Score!
      </h2>
      <p className="mt-1 text-sm text-destructive/85">
        {typeof pendingPrizeAmount === "number"
          ? `Pending payout: $${pendingPrizeAmount.toFixed(2)}. Upload your platform screenshot to complete verification.`
          : "Upload your platform screenshot to complete verification and release your payout."}
      </p>

      <div className="mt-4 space-y-4">
        <label className="group block cursor-pointer rounded-xl border-2 border-dashed border-primary/45 bg-background/70 p-5 transition hover:border-primary/70 hover:bg-background">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <CloudUpload className="h-7 w-7 text-primary transition group-hover:scale-105" />
            <p className="text-sm font-medium text-foreground">
              Upload proof screenshot
            </p>
            <p className="text-xs text-muted-foreground">
              Click to browse image files. JPG/PNG/WebP up to 10MB.
            </p>
          </div>
        </label>

        {selectedFileName ? (
          <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-foreground">
            <p className="font-medium">Selected file: {selectedFileName}</p>
            {typeof selectedFileSizeBytes === "number" ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Size: {(selectedFileSizeBytes / (1024 * 1024)).toFixed(2)} MB
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No file selected yet.</p>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isUploading || !selectedFileName}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? "Submitting..." : "Submit Proof for Verification"}
        </button>
      </div>
    </section>
  );
}
