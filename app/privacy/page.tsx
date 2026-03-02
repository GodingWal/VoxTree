import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/" className="text-xl font-bold text-brand-green">VoxTree</Link>
        </div>
      </header>

      <main className="container max-w-3xl py-12 space-y-8">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: February 2026</p>

        <div className="prose prose-sm max-w-none space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1. Information We Collect</h2>
            <p className="text-muted-foreground">
              We collect information you provide directly, including your name, email address, and audio recordings you upload for voice cloning. We also collect usage data such as how you interact with our service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2. Voice Data</h2>
            <p className="text-muted-foreground">
              Audio samples you upload are used solely for creating personalized voice profiles. Voice data is processed through our third-party TTS provider (ElevenLabs) and stored securely in AWS S3. You can delete your voice profiles at any time, which removes all associated audio data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
            <p className="text-muted-foreground">
              We use your information to provide and improve VoxTree, process payments, communicate with you about your account, and ensure the security of our service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              Your data is stored securely using Supabase (PostgreSQL) and AWS S3. We use encryption in transit and at rest. Authentication is handled through Supabase Auth with support for OAuth providers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5. Third-Party Services</h2>
            <p className="text-muted-foreground">
              We use the following third-party services: Supabase (database and authentication), AWS (file storage and CDN), ElevenLabs (voice synthesis), and Stripe (payment processing). Each service has its own privacy policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6. Your Rights</h2>
            <p className="text-muted-foreground">
              You have the right to access, update, or delete your personal information at any time. You can manage your data through your account settings or by contacting us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground">
              VoxTree is designed for parents and family members. We do not knowingly collect personal information from children under 13. The content we provide is designed for children, but accounts must be created by adults.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy, please contact us at{" "}
              <Link href="/contact" className="text-primary hover:underline">our contact page</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
