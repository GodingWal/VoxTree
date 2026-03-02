import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const pressLogos = [
  { name: "FamilyTech Weekly", tagline: "Innovating how families stay connected" },
  { name: "Home Movie Journal", tagline: "Top tools for storytellers" },
  { name: "AI Creators Digest", tagline: "Featured product of the month" },
  { name: "Parenting Today", tagline: "Editors' choice for memory making" },
  { name: "Voices & Vision", tagline: "Rated best for collaborative video" },
  { name: "Future Family", tagline: "Awarded for safe AI experiences" },
];

const testimonials = [
  {
    name: "The Martinez Family",
    role: "Parents of two",
    quote: "We turned a weekend at the lake into a cinematic recap that made our grandparents cry happy tears.",
  },
  {
    name: "Jordan & Priya",
    role: "New parents",
    quote: "VoxTree helps us capture milestones without spending hours editing. The AI scripts are spot on!",
  },
  {
    name: "Grandma June",
    role: "Family historian",
    quote: "Hearing my late husband's voice narrate old photos is the most special gift our family could imagine.",
  },
];

const planSpotlight = [
  { name: "Starter", price: "$0", description: "Create highlight reels with guided templates and shared storage for the whole crew.", featured: false },
  { name: "Family", price: "$19/mo", description: "Unlock voice cloning, collaborative editing rooms, and monthly AI story credits.", featured: true },
  { name: "Studio", price: "$39/mo", description: "Automate longer productions with premium renders, priority support, and advanced privacy controls.", featured: false },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Bar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">VoxTree</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium hover:bg-accent">
                Sign In
              </Link>
              <Link href="/signup" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-4 sm:mb-6 px-2">
              Create Magical
              <br />
              Family Videos
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-3xl mx-auto px-4">
              Transform your family memories with AI-powered voice cloning, collaborative editing, and stunning video creation tools designed for families.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
                Start Creating Today
              </Link>
              <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-md bg-secondary px-6 text-base font-medium hover:bg-secondary/80">
                Watch Demo
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute top-20 right-10 w-32 h-32 bg-primary/20 rounded-full blur-xl hidden sm:block" />
        <div className="absolute bottom-20 left-10 w-24 h-24 bg-accent/20 rounded-full blur-xl hidden sm:block" />
      </section>

      {/* Press Logos */}
      <section className="py-12 border-y border-border bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm uppercase tracking-[0.3em] text-muted-foreground mb-8">
            Celebrated by families and the press
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-10 text-center">
            {pressLogos.map((logo) => (
              <div key={logo.name} className="space-y-1 text-muted-foreground hover:text-foreground transition-colors">
                <p className="font-semibold text-foreground text-sm sm:text-base">{logo.name}</p>
                <p className="text-xs sm:text-sm opacity-80">{logo.tagline}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-2">Powerful Features for Every Family</h3>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Everything you need to create professional-quality family videos with the power of AI
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { icon: "🎤", title: "AI Voice Cloning", desc: "Clone family voices with just a few audio samples and bring stories to life", color: "bg-primary/20" },
              { icon: "👥", title: "Real-time Collaboration", desc: "Work together as a family to create videos in real-time from anywhere", color: "bg-accent/20" },
              { icon: "🤖", title: "AI Script Generation", desc: "Generate engaging family stories and scripts using advanced AI technology", color: "bg-primary/20" },
              { icon: "🎬", title: "Professional Templates", desc: "Choose from curated video templates designed specifically for family stories", color: "bg-accent/20" },
            ].map((f) => (
              <Card key={f.title} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 ${f.color} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-2xl">{f.icon}</span>
                  </div>
                  <h4 className="text-lg sm:text-xl font-semibold mb-2">{f.title}</h4>
                  <p className="text-sm sm:text-base text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Families Are Sharing the Love</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Real stories from families who transformed everyday moments into unforgettable films
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => {
              const initials = testimonial.name
                .split(" ")
                .map((part) => part.charAt(0))
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <Card key={testimonial.name} className="h-full">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex-1">
                      <span className="text-primary text-2xl">&ldquo;</span>
                      <p className="mt-2 text-lg leading-relaxed text-muted-foreground">
                        &ldquo;{testimonial.quote}&rdquo;
                      </p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-border flex items-center gap-4">
                      <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                        <span className="text-base font-semibold">{initials}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create stunning family videos in three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: "1", title: "Record & Upload", desc: "Record voice samples to create AI voice profiles for your family members" },
              { step: "2", title: "Choose & Customize", desc: "Select from professional video templates and let AI generate engaging scripts tailored to your family" },
              { step: "3", title: "Create & Share", desc: "Collaborate with family members to edit and perfect your video, then share your masterpiece" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-primary-foreground">{s.step}</span>
                </div>
                <h4 className="text-xl font-semibold mb-4">{s.title}</h4>
                <p className="text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl md:text-4xl font-bold mb-6">Why Families Love VoxTree</h3>
              <div className="space-y-6">
                {[
                  { icon: "❤️", title: "Preserve Family Memories", desc: "Create lasting memories that can be shared across generations with authentic family voices" },
                  { icon: "⏱️", title: "Save Time & Effort", desc: "AI-powered tools handle the heavy lifting, so you can focus on the creative storytelling" },
                  { icon: "🛡️", title: "Safe & Private", desc: "Your family data is protected with enterprise-grade security and privacy controls" },
                  { icon: "📱", title: "Works Anywhere", desc: "Access from any device, collaborate remotely, and create together wherever you are" },
                ].map((b) => (
                  <div key={b.title} className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm">{b.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">{b.title}</h4>
                      <p className="text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <div className="bg-card rounded-2xl p-8 shadow-lg">
                <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-white text-3xl">✨</span>
                </div>
                <h4 className="text-2xl font-bold mb-4">Crafted for Modern Families</h4>
                <p className="text-muted-foreground">
                  From daily updates to milestone documentaries, VoxTree combines secure sharing with joyful
                  storytelling tools that every generation can enjoy.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 text-left">
                  <div className="bg-primary/5 rounded-xl p-4">
                    <p className="text-3xl font-bold text-primary">98%</p>
                    <p className="text-sm text-muted-foreground">of families say collaboration feels effortless</p>
                  </div>
                  <div className="bg-accent/5 rounded-xl p-4">
                    <p className="text-3xl font-bold">24 hrs</p>
                    <p className="text-sm text-muted-foreground">average time saved every month on editing</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans Teaser */}
      <section className="py-20 bg-card/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Plans at a Glance</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Flexible options that grow with your family&apos;s storytelling ambitions
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {planSpotlight.map((plan) => (
              <Card
                key={plan.name}
                className={`relative h-full border ${plan.featured ? "border-primary shadow-lg" : "border-border"}`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold tracking-wide px-3 py-1 rounded-full shadow">
                    Most Loved
                  </span>
                )}
                <CardContent className="p-6 text-center flex flex-col h-full">
                  <div className="mb-4">
                    <h4 className="text-2xl font-semibold mb-2">{plan.name}</h4>
                    <p className="text-3xl font-bold text-primary">{plan.price}</p>
                  </div>
                  <p className="text-muted-foreground flex-1">{plan.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card rounded-2xl p-10 shadow-xl text-center">
            <h4 className="text-3xl font-bold mb-4">Ready to Get Started?</h4>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of families already creating magical memories with VoxTree.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
                Create Your First Video
              </Link>
              <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-md bg-secondary px-6 text-base font-medium hover:bg-secondary/80">
                Talk with Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary mb-4">VoxTree</h2>
            <p className="text-muted-foreground mb-6">Creating magical family memories with AI</p>
            <div className="flex justify-center space-x-6">
              <Link href="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
                Get Started
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
