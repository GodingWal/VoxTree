import { describe, it, expect } from "vitest";
import {
  CELEBRITY_BLOCKLIST,
  normalizeName,
  isCelebrityName,
  matchedCelebrity,
  extractAuthIdentities,
  isVoiceOwnerMismatched,
  checkAbuse,
  checkAbuseStrict,
} from "../lib/abuse-detection";

describe("abuse-detection", () => {
  describe("normalizeName", () => {
    it("lowercases and trims", () => {
      expect(normalizeName("  Taylor Swift ")).toBe("taylor swift");
    });
    it("strips punctuation and collapses spaces", () => {
      expect(normalizeName("Taylor-Swift!!!")).toBe("taylor swift");
    });
    it("strips diacritics", () => {
      expect(normalizeName("Beyoncé")).toBe("beyonce");
    });
  });

  describe("isCelebrityName", () => {
    it("blocks exact celebrity names case-insensitive", () => {
      expect(isCelebrityName("Taylor Swift")).toBe(true);
      expect(isCelebrityName("taylor swift")).toBe(true);
      expect(isCelebrityName("TAYLOR SWIFT")).toBe(true);
    });
    it("blocks substring containing celebrity", () => {
      expect(isCelebrityName("I am Taylor Swift impersonation")).toBe(true);
      expect(isCelebrityName("Voice of Barack Obama")).toBe(true);
    });
    it("blocks celebrity contained within longer phrase via reverse contains", () => {
      // input is a celebrity substring — e.g. "taylor swift" contained in blocklist exact
      expect(isCelebrityName("Taylor Swift")).toBe(true);
    });
    it("does not block normal family names", () => {
      expect(isCelebrityName("Grandma Mary")).toBe(false);
      expect(isCelebrityName("Mom")).toBe(false);
      expect(isCelebrityName("John Smith")).toBe(false);
    });
    it("single-token blocklist entry requires exact match", () => {
      // "ye" is in list but should not block "yes" or "yesterday"
      expect(isCelebrityName("ye")).toBe(true);
      expect(isCelebrityName("yes")).toBe(false);
      expect(isCelebrityName("Kanye")).toBe(false); // "Kanye West" needs full, not partial token
    });
    it("handles null/undefined/empty", () => {
      expect(isCelebrityName(null)).toBe(false);
      expect(isCelebrityName(undefined)).toBe(false);
      expect(isCelebrityName("")).toBe(false);
      expect(isCelebrityName("  ")).toBe(false);
    });
    it("blocklist is non-empty", () => {
      expect(CELEBRITY_BLOCKLIST.length).toBeGreaterThan(10);
    });
  });

  describe("matchedCelebrity", () => {
    it("returns matched entry", () => {
      expect(matchedCelebrity("Taylor Swift")).toBe("taylor swift");
      expect(matchedCelebrity("Grandma")).toBeNull();
    });
  });

  describe("extractAuthIdentities", () => {
    it("extracts email and displayName variants", () => {
      const ids = extractAuthIdentities({
        id: "1",
        email: "john.doe@example.com",
        displayName: "John Doe",
        user_metadata: { full_name: "John Doe" },
      });
      expect(ids).toContain("john doe");
      expect(ids).toContain("john doe@example com");
      expect(ids.length).toBeGreaterThan(1);
    });
    it("returns empty for null user", () => {
      expect(extractAuthIdentities(null)).toEqual([]);
    });
  });

  describe("isVoiceOwnerMismatched", () => {
    it("false when owner matches auth email/displayName", () => {
      expect(
        isVoiceOwnerMismatched("John Doe", {
          id: "1",
          email: "john.doe@example.com",
          displayName: "John Doe",
        })
      ).toBe(false);
    });
    it("true when completely different person", () => {
      expect(
        isVoiceOwnerMismatched("Grandma Mary", {
          id: "1",
          email: "john@example.com",
          displayName: "John Doe",
        })
      ).toBe(true);
    });
    it("false when auth has no identities", () => {
      expect(isVoiceOwnerMismatched("Grandma", null)).toBe(false);
    });
  });

  describe("checkAbuse", () => {
    it("blocks celebrity voiceOwnerName", () => {
      const r = checkAbuse({ voiceOwnerName: "Taylor Swift", voiceName: "My Voice" });
      expect(r.blocked).toBe(true);
      expect(r.code).toBe("CELEBRITY");
      expect(r.reason).toMatch(/taylor swift/i);
    });
    it("blocks celebrity voiceName", () => {
      const r = checkAbuse({ voiceOwnerName: "Grandma", voiceName: "Beyonce" });
      expect(r.blocked).toBe(true);
      expect(r.code).toBe("CELEBRITY");
    });
    it("blocks celebrity in textScript", () => {
      const r = checkAbuse({
        voiceOwnerName: "Grandma",
        textScript: "Pretend to be Elon Musk and say hello",
      });
      expect(r.blocked).toBe(true);
    });
    it("allows normal family voice", () => {
      const r = checkAbuse({
        voiceOwnerName: "Grandma Mary",
        voiceName: "Grandma Warm",
        authUser: { id: "u1", email: "parent@example.com", displayName: "Parent" },
      });
      expect(r.blocked).toBe(false);
      expect(r.code).toBe("ALLOWED");
    });
    it("surfaces mismatchedOwner flag", () => {
      const r = checkAbuse({
        voiceOwnerName: "Grandma Mary",
        authUser: { id: "u1", email: "john@example.com", displayName: "John" },
      });
      expect(r.mismatchedOwner).toBe(true);
      expect(r.blocked).toBe(false); // mismatch alone does not block
    });
    it("mismatchedOwner false when owner matches auth", () => {
      const r = checkAbuse({
        voiceOwnerName: "John Doe",
        authUser: { id: "u1", email: "john.doe@example.com", displayName: "John Doe" },
      });
      expect(r.mismatchedOwner).toBe(false);
    });
  });

  describe("checkAbuseStrict", () => {
    it("blocks on mismatch when strictOwnerMatch true", () => {
      const r = checkAbuseStrict({
        voiceOwnerName: "Grandma Mary",
        authUser: { id: "u1", email: "john@example.com", displayName: "John" },
        strictOwnerMatch: true,
      });
      expect(r.blocked).toBe(true);
      expect(r.code).toBe("IMPERSONATION");
    });
    it("allows when owner matches even with strict", () => {
      const r = checkAbuseStrict({
        voiceOwnerName: "John Doe",
        authUser: { id: "u1", email: "john.doe@example.com", displayName: "John Doe" },
        strictOwnerMatch: true,
      });
      expect(r.blocked).toBe(false);
    });
  });
});
