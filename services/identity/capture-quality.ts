import type { Capture } from "./contracts";
export const FACE_VIEWS = ["front", "left", "right", "up", "down", "smile", "neutral", "mouth-open"];
export const BODY_VIEWS = ["front", "left", "back", "right", "walk", "arms-raised"];
export function assessCapture(input: Capture, kind: "face" | "body") {
  const required = kind === "face" ? FACE_VIEWS : BODY_VIEWS;
  const useful = input.views.filter(v => [v.blurScore, v.lightingScore, v.coverageScore, v.occlusionScore].every(n => Number.isFinite(n) && n >= 0 && n <= 1)
    && v.blurScore >= 0.6 && v.lightingScore >= 0.5 && v.coverageScore >= 0.8 && v.occlusionScore <= 0.2);
  const missingViews = required.filter(view => !useful.some(v => v.view === view));
  return { passed: input.liveCapture === true && missingViews.length === 0 && (kind !== "body" || !!input.heightCm && input.heightCm >= 100 && input.heightCm <= 250),
    missingViews, recommendations: missingViews.map(view => `Recapture ${view} with clear lighting and the entire ${kind} visible.`) };
}
