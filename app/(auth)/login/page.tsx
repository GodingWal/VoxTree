"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState("login");
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Resend verification
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setLoginError(error.message);
      setLoginLoading(false);
    } else {
      toast({ title: "Welcome back!", description: "You have been successfully logged in." });
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);

    if (regPassword !== regConfirmPassword) {
      setRegError("Passwords don't match");
      setRegLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setRegError("Password must be at least 6 characters");
      setRegLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: {
          name: `${regFirstName} ${regLastName}`.trim(),
          full_name: `${regFirstName} ${regLastName}`.trim(),
        },
      },
    });

    if (error) {
      setRegError(error.message);
      setRegLoading(false);
    } else {
      toast({
        title: "Account created!",
        description: "Check your email to verify your account, then sign in.",
      });
      setActiveTab("login");
      setRegLoading(false);
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      toast({ title: "OAuth failed", description: error.message, variant: "destructive" });
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reset link sent", description: "Check your inbox for password reset instructions." });
      setShowForgotPassword(false);
      setForgotEmail("");
    }
  }

  async function handleResendVerification(e: React.FormEvent) {
    e.preventDefault();
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail,
    });
    setResendLoading(false);
    if (error) {
      toast({ title: "Unable to resend", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Verification email sent", description: "Check your inbox for the verification link." });
      setShowResendVerification(false);
      setResendEmail("");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="absolute top-20 right-10 w-32 h-32 bg-primary/20 rounded-full blur-xl" />
      <div className="absolute bottom-20 left-10 w-24 h-24 bg-accent/20 rounded-full blur-xl" />

      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">VoxTree</h1>
          <p className="text-muted-foreground">Create magical family memories</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              {activeTab === "login" ? "Sign in to your account" : "Create your VoxTree account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>

                  {loginError && <p className="text-sm text-destructive">{loginError}</p>}

                  <div className="flex items-center justify-between text-sm">
                    <button type="button" className="text-primary hover:underline" onClick={() => { setForgotEmail(loginEmail); setShowForgotPassword(true); }}>
                      Forgot password?
                    </button>
                    <button type="button" className="text-primary hover:underline" onClick={() => { setResendEmail(loginEmail); setShowResendVerification(true); }}>
                      Resend verification
                    </button>
                  </div>

                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="regEmail">Email</Label>
                    <Input id="regEmail" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="regPassword">Password</Label>
                    <Input id="regPassword" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required />
                  </div>

                  {regError && <p className="text-sm text-destructive">{regError}</p>}

                  <Button type="submit" className="w-full" disabled={regLoading}>
                    {regLoading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>Enter your email and we&apos;ll send reset instructions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label htmlFor="forgotEmail">Email</Label>
              <Input id="forgotEmail" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForgotPassword(false)} disabled={forgotLoading}>Cancel</Button>
              <Button type="submit" disabled={forgotLoading}>{forgotLoading ? "Sending..." : "Send reset link"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showResendVerification} onOpenChange={setShowResendVerification}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend verification email</DialogTitle>
            <DialogDescription>We&apos;ll send a fresh verification link to confirm your account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResendVerification} className="space-y-4">
            <div>
              <Label htmlFor="resendEmail">Email</Label>
              <Input id="resendEmail" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} required />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowResendVerification(false)} disabled={resendLoading}>Cancel</Button>
              <Button type="submit" disabled={resendLoading}>{resendLoading ? "Sending..." : "Send verification"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
