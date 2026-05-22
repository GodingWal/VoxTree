"use client";

import { useState } from "react";
import { KeyRound, Loader2, UserCog, CheckCircle2 } from "lucide-react";
import { resetUserPassword } from "./actions";

export function UserActions({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handlePasswordReset() {
    if (!confirm(`Are you sure you want to send a password reset email to ${userEmail}?`)) return;
    
    setIsResetting(true);
    const result = await resetUserPassword(userEmail);
    setIsResetting(false);

    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        title="Manage User"
        className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <UserCog className="h-4 w-4" />
      </button>
      <button
        onClick={handlePasswordReset}
        disabled={isResetting || resetSuccess}
        title="Send Password Reset"
        className="p-2 rounded-lg text-brand-coral hover:bg-brand-coral/10 transition-colors disabled:opacity-50"
      >
        {isResetting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : resetSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-brand-green" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
