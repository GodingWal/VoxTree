import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LandingDemo } from "@/components/landing-demo";
import {
  Sparkles,
  Mic,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  Smile,
  CheckCircle2,
  Video,
  Heart
} from "lucide-react";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If the user is logged in, redirect them to the dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream dark:bg-background text-brand-charcoal dark:text-foreground">
      {/* Navigation Header */}
      <header className="border-b border-brand-sage/10 bg-white/80 dark:bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo />
          
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/browse"
              className="text-sm font-semibold text-muted-foreground hover:text-brand-green transition-colors"
            >
              Browse Stories
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-muted-foreground hover:text-brand-green transition-colors"
            >
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-muted-foreground hover:text-brand-green transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-bold bg-brand-green text-white px-4 py-2 rounded-lg hover:bg-brand-green/90 hover:shadow-md transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-16 md:py-24 max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Details */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-1.5 bg-brand-green/10 text-brand-green px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                Bedtime, Reimagined
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-brand-charcoal dark:text-foreground leading-tight">
                Hear <span className="text-brand-green">Grandma Read</span> to Your Kids — Every Bedtime.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                VoxTree securely clones the voices of grandparents or parents, allowing them to narrate beautiful educational videos and children's bedtime stories. Keep family close, no matter the distance.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link
                  href="/signup"
                  className="bg-brand-coral hover:bg-brand-coral/95 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-brand-coral/20 hover:-translate-y-0.5 transition-all text-center flex items-center justify-center gap-2 group"
                >
                  Create Free Account
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/browse"
                  className="bg-white dark:bg-card border border-border hover:bg-muted font-bold px-8 py-4 rounded-xl transition-colors text-center text-brand-charcoal dark:text-foreground"
                >
                  Browse Stories
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-6 text-sm font-semibold text-muted-foreground border-t border-brand-sage/10">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4.5 w-4.5 text-brand-green" /> Free setup
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4.5 w-4.5 text-brand-green" /> Safe & encrypted
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4.5 w-4.5 text-brand-green" /> 100% private voice profiles
                </span>
              </div>
            </div>

            {/* Right Hero Demo Container */}
            <div className="lg:col-span-5 flex justify-center">
              <LandingDemo />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-white dark:bg-card/40 border-y border-brand-sage/10 py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-coral">
                VoxTree Features
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-brand-charcoal dark:text-foreground">
                Connecting Families Through Storytelling
              </h2>
              <p className="text-muted-foreground">
                Everything you need to create custom, safe, and engaging audiobooks for your kids.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-brand-cream/30 dark:bg-muted/10 p-8 rounded-2xl border border-brand-sage/10 space-y-4 hover:shadow-md transition-all group">
                <div className="h-12 w-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center transition-transform group-hover:scale-110">
                  <Mic className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-brand-charcoal dark:text-foreground">
                  Quick Voice Cloning
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Record or upload a 30-second audio clip of a family member. Our secure voice cloning model recreates their exact speech pattern, natural tone, and warm inflections.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-brand-cream/30 dark:bg-muted/10 p-8 rounded-2xl border border-brand-sage/10 space-y-4 hover:shadow-md transition-all group">
                <div className="h-12 w-12 rounded-xl bg-brand-gold/10 text-brand-gold flex items-center justify-center transition-transform group-hover:scale-110">
                  <BookOpen className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-brand-charcoal dark:text-foreground">
                  Vast Children's Library
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Explore a rich selection of illustrated bedtime classics, educational science books, adventure stories, and visual video templates read-aloud ready.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-brand-cream/30 dark:bg-muted/10 p-8 rounded-2xl border border-brand-sage/10 space-y-4 hover:shadow-md transition-all group">
                <div className="h-12 w-12 rounded-xl bg-brand-coral/10 text-brand-coral flex items-center justify-center transition-transform group-hover:scale-110">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-brand-charcoal dark:text-foreground">
                  100% Private & Protected
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your family's voice profiles are completely private, encrypted, and only accessible to people you invite. We never share, sell, or reuse voice files.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-green">
              Easy 3-Step Process
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-charcoal dark:text-foreground">
              How VoxTree Works
            </h2>
            <p className="text-muted-foreground">
              Bring family reading sessions to life in under five minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center space-y-4 relative">
              <div className="text-6xl md:text-8xl font-black text-brand-sage/20 select-none">
                01
              </div>
              <h3 className="text-xl font-bold text-brand-charcoal dark:text-foreground">
                Record or Upload Voice
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                Grandma or Dad reads a short, simple paragraph on their phone or uploads a pre-recorded audio snippet.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-4 relative">
              <div className="text-6xl md:text-8xl font-black text-brand-sage/20 select-none">
                02
              </div>
              <h3 className="text-xl font-bold text-brand-charcoal dark:text-foreground">
                Pick a Story
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                Select from our library of illustrated children's storybooks, fairy tales, or animated educational videos.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-4 relative">
              <div className="text-6xl md:text-8xl font-black text-brand-sage/20 select-none">
                03
              </div>
              <h3 className="text-xl font-bold text-brand-charcoal dark:text-foreground">
                Press Play & Enjoy
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                Stream the storybook with visual animations, narrated instantly in their comforting family voice.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="max-w-5xl mx-auto px-6 mb-24">
          <div className="bg-gradient-to-br from-brand-green to-emerald-900 text-white rounded-3xl p-10 md:p-16 text-center shadow-xl relative overflow-hidden">
            {/* Subtle background abstract shapes */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)]" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-xl" />
            
            <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-extrabold leading-tight">
                Keep the Bedtime Story Tradition Alive
              </h2>
              <p className="text-emerald-100 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                Help your kids fall asleep with their favorite stories read in the comforting voice of Grandma, Grandpa, or Mom — even if they are miles away.
              </p>
              
              <div className="pt-4">
                <Link
                  href="/signup"
                  className="bg-white hover:bg-emerald-50 text-brand-green hover:shadow-lg font-bold px-8 py-4 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
                >
                  Start Reading for Free
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-sage/10 bg-white/50 dark:bg-card/50 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1">
            <BrandLogo />
            <p className="text-xs text-muted-foreground font-semibold">
              Hear Grandma read, anytime. Bedtime made cozy.
            </p>
          </div>
          
          <div className="flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <Link href="/privacy" className="hover:text-brand-green transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-brand-green transition-colors">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:text-brand-green transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-8 text-center text-[10px] font-medium text-muted-foreground/60">
          © {new Date().getFullYear()} VoxTree. All rights reserved. Voice cloning technologies are protected and subject to user consent requirements.
        </div>
      </footer>
    </div>
  );
}
