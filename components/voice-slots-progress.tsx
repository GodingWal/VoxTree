interface VoiceSlotsProgressProps {
  used: number;
  total: number | null;
}

export function VoiceSlotsProgress({ used, total }: VoiceSlotsProgressProps) {
  if (total === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {used} voice{used !== 1 ? "s" : ""} added
        </span>
        <span className="text-xs text-brand-green font-medium">Unlimited</span>
      </div>
    );
  }

  const percentage = Math.min((used / total) * 100, 100);
  const isFull = used >= total;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {used} / {total} voice slot{total !== 1 ? "s" : ""} used
        </span>
        {isFull && (
          <span className="text-xs font-medium text-brand-gold">Full</span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFull
              ? "bg-brand-gold"
              : percentage > 50
                ? "bg-brand-gold/70"
                : "bg-brand-green"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
