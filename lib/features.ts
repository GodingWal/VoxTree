export type AdvancedFeature = "visualCloning" | "singingVoice" | "talkingVideo";

const envKeys: Record<AdvancedFeature, string> = {
  visualCloning: "FEATURE_VISUAL_CLONING",
  singingVoice: "FEATURE_SINGING_VOICE",
  talkingVideo: "FEATURE_TALKING_VIDEO",
};

export function isFeatureEnabled(feature: AdvancedFeature): boolean {
  return process.env[envKeys[feature]] === "true";
}

export function isSimulationEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.SIMULATION_MODE === "true";
}

export function featureForPath(pathname: string): AdvancedFeature | null {
  if (pathname.startsWith("/api/avatar")) return "visualCloning";
  if (/^\/api\/voices\/[^/]+\/(capture|omni-upload)$/.test(pathname)) return "visualCloning";
  if (pathname.startsWith("/api/voices/singing") || pathname.startsWith("/dashboard/clones/singing")) return "singingVoice";
  if (pathname.startsWith("/api/clips/talking-video") || pathname === "/videos") return "talkingVideo";
  return null;
}
