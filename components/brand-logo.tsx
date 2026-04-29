import Link from "next/link";
import { Sparkles } from "lucide-react";

interface BrandLogoProps {
  href?: string;
  hideTextOnMobile?: boolean;
}

export function BrandLogo({ href = "/", hideTextOnMobile = false }: BrandLogoProps) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-brand-green flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <span
        className={`text-xl font-bold text-brand-charcoal dark:text-foreground ${
          hideTextOnMobile ? "hidden sm:block" : ""
        }`}
      >
        VoxTree
      </span>
    </Link>
  );
}
