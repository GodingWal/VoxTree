interface VoiceSlotsProgressProps {
  used: number;
  total: number | null;
}

export function VoiceSlotsProgress({ used, total }: VoiceSlotsProgressProps) {
  if (total === null) {
    return (
      <div className="flex items-center gap-3 bg-brand-green/5 dark:bg-brand-green/10 rounded-xl p-3 border border-brand-green/20">
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-charcoal dark:text-foreground">Unlimited Clones</p>
          <p className="text-xs text-muted-foreground">{used} added</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center">
          <span className="text-brand-green text-lg font-bold">∞</span>
        </div>
      </div>
    );
  }

  const percentage = Math.min((used / total) * 100, 100);
  const isFull = used >= total;
  
  // Circular ring properties
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-4 bg-muted/30 dark:bg-muted/10 rounded-xl p-3 border border-border">
      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="4"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-out ${
              isFull ? "text-brand-gold" : "text-brand-green"
            }`}
          />
        </svg>
        <span className="absolute text-xs font-bold text-brand-charcoal dark:text-foreground">
          {used}/{total}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-brand-charcoal dark:text-foreground">
          Clone Limit
        </p>
        <p className="text-xs text-muted-foreground">
          {isFull ? <span className="text-brand-gold font-medium">Upgrade for more</span> : "Available slots"}
        </p>
      </div>
    </div>
  );
}
