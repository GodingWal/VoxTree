import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/" className="text-xl font-bold text-brand-green">VoxTree</Link>
        </div>
      </header>

      <main className="container max-w-3xl py-12 space-y-8">
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: February 2026</p>

        <div className="prose prose-sm max-w-none space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By using VoxTree, you agree to these Terms of Service. If you do not agree, please do not use our service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2. Description of Service</h2>
            <p className="text-muted-foreground">
              VoxTree provides a platform for creating personalized voice narrations for children&apos;s educational content using voice cloning technology. Users can upload voice samples of family members and generate narrated content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3. User Accounts</h2>
            <p className="text-muted-foreground">
              You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your account and for all activities under your account. You must provide accurate and complete information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4. Voice Cloning Consent</h2>
            <p className="text-muted-foreground">
              By uploading voice samples, you represent that you have obtained consent from the individual whose voice is being cloned. You agree to use voice cloning only for personal, family use within the VoxTree platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5. Subscriptions and Payments</h2>
            <p className="text-muted-foreground">
              Paid subscriptions are billed through Stripe. You can cancel at any time. Refunds are handled on a case-by-case basis. Plan limits are enforced based on your subscription tier.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6. Prohibited Uses</h2>
            <p className="text-muted-foreground">
              You may not use VoxTree to create deepfakes, impersonate others without consent, generate harmful or inappropriate content for children, or violate any applicable laws.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7. Intellectual Property</h2>
            <p className="text-muted-foreground">
              Content in our library is licensed for use within VoxTree only. You retain ownership of voice samples you upload. Generated clips are for personal use only and may not be redistributed commercially.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              VoxTree is provided &quot;as is&quot; without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">9. Contact</h2>
            <p className="text-muted-foreground">
              Questions about these terms? Visit our{" "}
              <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
