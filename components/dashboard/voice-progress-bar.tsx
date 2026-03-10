"use client";

interface VoiceProgressBarProps {
  used: number;
  total: number | null;
}

export function VoiceProgressBar({ used, total }: VoiceProgressBarProps) {
  if (total === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-brand-green/20 dark:bg-brand-green/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-green transition-all duration-500"
            style={{ width: used > 0 ? "15%" : "0%" }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {used} / Unlimited
        </span>
      </div>
    );
  }

  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const isAtLimit = used >= total;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAtLimit ? "bg-brand-gold" : "bg-brand-green"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span
        className={`text-xs shrink-0 font-medium ${
          isAtLimit ? "text-brand-gold" : "text-muted-foreground"
        }`}
      >
        {used} / {total}
      </span>
    </div>
  );
}
