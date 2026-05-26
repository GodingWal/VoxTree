"use client";

import { useState } from "react";
import { TwilightShell } from "@/components/twilight-layout";
import { Section } from "@/components/twilight-ui";
import { Search, HelpCircle, ChevronDown, BookOpen, Volume2, ShieldCheck, CreditCard } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: "voice" | "avatar" | "privacy" | "billing";
}

const FAQS: FAQItem[] = [
  {
    category: "voice",
    question: "How much audio recording is required to clone a voice?",
    answer: "We recommend recording between 60 to 90 seconds of clear audio reading our onboarding prompt. For family voice clones, a quiet room and reading at an unhurried, natural bedtime-reading pace yield the best, warmest results."
  },
  {
    category: "voice",
    question: "Is there a limit to how many family clones I can add?",
    answer: "Free plan members get 1 voice profile slot. Upgrading to the Family Plan gives you 2 voice clone profiles, and the Premium Plan allows you to add unlimited voice clones for your entire family tree."
  },
  {
    category: "voice",
    question: "What is RVC training and how long does it take?",
    answer: "RVC (Retrieval-based Voice Conversion) is an advanced AI audio model that wraps the narrator's unique timber. The training process runs in the background and takes approximately 1 to 2 minutes after completing the onboarding capture."
  },
  {
    category: "avatar",
    question: "How does the Pixar visual clone capture work?",
    answer: "During onboarding, the webcam snaps a 5-second video frame. Our visual pipeline runs an style-transfer network that transforms the photo into a stylized Pixar-inspired character. This character is used as the narrator's profile avatar throughout the app."
  },
  {
    category: "avatar",
    question: "Do the avatars actually animate during story readbacks?",
    answer: "Yes! On the Clones page and during Story playing, the Pixar characters slowly breathe while idle. When you play a story, their lips and outline bounce with the sound frequency, providing a responsive visual narration."
  },
  {
    category: "privacy",
    question: "Is my family's voice print data secure?",
    answer: "Yes, absolutely. We encrypt all voice uploads and visual snapshots. VoxTree operates on a private architecture: your family's voice prints are never shared with third parties, never sold, and never utilized to train public foundation models."
  },
  {
    category: "privacy",
    question: "Is VoxTree COPPA and GDPR compliant?",
    answer: "Yes. VoxTree complies fully with the Children's Online Privacy Protection Act (COPPA) and GDPR-K regulations. We require parental consent before any account can use visual captures or voice cloning, and we do not utilize ad tracking."
  },
  {
    category: "billing",
    question: "How do I upgrade or cancel my subscription plan?",
    answer: "You can view available plans on the Pricing page. To upgrade, downscale, or cancel a recurring membership, navigate to Profile & Billing settings under your account dashboard. You can also contact admin support to manually adjust limits."
  },
  {
    category: "billing",
    question: "Can multiple parents log in to the same family tree?",
    answer: "Yes! Under the Family page, Premium users can send email invitations to other family members. Once accepted, they gain access to log in, share existing voice clones, and read stories to your kids."
  }
];

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Filter FAQs
  const filteredFaqs = FAQS.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(search.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "all" || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleAccordion = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const categories = [
    { id: "all", label: "All Topics", icon: <BookOpen size={16} /> },
    { id: "voice", label: "Voice Cloning", icon: <Volume2 size={16} /> },
    { id: "avatar", label: "Pixar Avatars", icon: <HelpCircle size={16} /> },
    { id: "privacy", label: "Privacy & Safety", icon: <ShieldCheck size={16} /> },
    { id: "billing", label: "Billing & Plans", icon: <CreditCard size={16} /> },
  ];

  return (
    <TwilightShell>
      {/* Decorative background glows */}
      <div style={{
        position: "fixed", top: "20%", right: "10%", width: 350, height: 350,
        background: "radial-gradient(circle, rgba(244,184,96,0.05) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: -1
      }} />

      <div style={{ maxWidth: 840, margin: "64px auto 96px", padding: "0 24px" }}>
        
        {/* Page Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }} className="fadeUp">
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Support Center
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: "0 0 16px 0", color: "var(--paper)", letterSpacing: "-0.02em" }}>
            How can we <span className="serif-italic">help</span>?
          </h1>
        </div>

        {/* Search Bar */}
        <div style={{
          position: "relative", maxWidth: 540, margin: "0 auto 48px",
        }} className="fadeUp">
          <input
            type="text"
            placeholder="Search FAQs, voice cloning, billing..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 99, padding: "16px 24px 16px 52px", color: "var(--paper)",
              fontSize: 15, outline: "none"
            }}
            className="focus:border-lamp/50 transition-colors"
          />
          <Search style={{
            position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
            color: "var(--paper-mute)"
          }} size={18} />
        </div>

        {/* Category Toggles */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 40
        }} className="fadeUp">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setExpandedIndex(null);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 18px", borderRadius: 99, fontSize: 13, fontWeight: 500,
                background: activeCategory === cat.id ? "rgba(244,184,96,0.12)" : "var(--ink-2)",
                color: activeCategory === cat.id ? "var(--lamp-soft)" : "var(--paper-dim)",
                border: `1px solid ${activeCategory === cat.id ? "rgba(244,184,96,0.3)" : "var(--ink-3)"}`,
                cursor: "pointer", transition: "all 0.2s"
              }}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQs List Accordion */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="fadeUp">
          {filteredFaqs.map((faq, i) => {
            const isExpanded = expandedIndex === i;
            return (
              <div
                key={i}
                style={{
                  background: "var(--ink-2)", border: `1px solid ${isExpanded ? "rgba(244,184,96,0.3)" : "var(--ink-3)"}`,
                  borderRadius: 18, overflow: "hidden", transition: "all 0.3s ease"
                }}
              >
                {/* Question Row */}
                <button
                  onClick={() => toggleAccordion(i)}
                  style={{
                    width: "100%", background: "none", border: "none", padding: "20px 28px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: "pointer", color: "var(--paper)", textAlign: "left", gap: 16
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{faq.question}</span>
                  <ChevronDown
                    style={{
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.3s", color: "var(--paper-mute)", flexShrink: 0
                    }}
                    size={18}
                  />
                </button>

                {/* Answer Box */}
                <div style={{
                  maxHeight: isExpanded ? 300 : 0, overflow: "hidden",
                  transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}>
                  <div style={{
                    padding: "0 28px 24px", color: "var(--paper-dim)",
                    fontSize: 14, lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.02)"
                  }}>
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredFaqs.length === 0 && (
            <div style={{
              background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 18,
              padding: 48, textAlign: "center", color: "var(--paper-mute)"
            }}>
              No answers matched your search terms. Please try another query.
            </div>
          )}
        </div>

      </div>
    </TwilightShell>
  );
}
