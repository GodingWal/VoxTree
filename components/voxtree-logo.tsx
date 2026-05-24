// @ts-nocheck
import React from 'react';

// VoxTree logo — a tree whose canopy is concentric soundwave arcs
// rippling up from the trunk, with a top dot. Reads as foliage + voice.

export function VoxMark({ size = 48, color = "var(--paper)", glow = "var(--lamp)", animate = false }) {
  // viewBox 64x64. Trunk anchored at bottom; arcs sweep upward.
  const ring = animate
    ? { animation: "lampPulse 3s ease-in-out infinite" }
    : null;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
         style={{ display: "block" }}>
      {/* soft glow halo behind canopy */}
      {animate && (
        <circle cx="32" cy="28" r="22" fill={glow} opacity="0.18" style={ring} />
      )}

      {/* canopy arcs — three ripples and a top dot */}
      <g stroke={color} strokeWidth="3" strokeLinecap="round" fill="none">
        {/* outermost ripple */}
        <path d="M10 42 A22 22 0 0 1 54 42" opacity="0.55" />
        {/* middle ripple */}
        <path d="M17 42 A15 15 0 0 1 47 42" opacity="0.78" />
        {/* innermost ripple */}
        <path d="M24 42 A 8  8 0 0 1 40 42" opacity="1.0" />
      </g>

      {/* top sprout dot */}
      <circle cx="32" cy="14" r="2.8" fill={color} />

      {/* trunk — slightly tapered, rounded */}
      <path
        d="M30 42 Q30.5 50 31.4 58 L32.6 58 Q33.5 50 34 42 Z"
        fill={color}
      />
      {/* ground line */}
      <path d="M22 58 L42 58" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

// Full wordmark — Instrument Serif "VoxTree" with the mark on the left
export function VoxWordmark({ size = 28, color = "var(--paper)", animate = false }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4 }}>
      <VoxMark size={size * 1.5} color={color} animate={animate} />
      <span
        className="serif"
        style={{
          fontSize: size * 1.45,
          color,
          letterSpacing: "-0.015em",
          lineHeight: 1,
          paddingBottom: size * 0.04,
        }}
      >
        Vox<span className="serif-italic">Tree</span>
      </span>
    </div>
  );
}

// Animated speaking variant — the rings pulse outward as the voice is "live"
export function VoxMarkSpeaking({ size = 64, color = "var(--lamp)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes ripple1 { 0%{opacity:.95; transform: scaleY(.7); transform-origin: 32px 42px;} 60%{opacity:.4;} 100%{opacity:0; transform: scaleY(1); transform-origin: 32px 42px;} }
          @keyframes ripple2 { 0%{opacity:0;} 40%{opacity:.7;} 100%{opacity:0;} }
          .vt-r1 { animation: ripple1 1.6s ease-out infinite; }
          .vt-r2 { animation: ripple1 1.6s ease-out infinite .4s; }
          .vt-r3 { animation: ripple1 1.6s ease-out infinite .8s; }
        `}</style>
      </defs>
      <g stroke={color} strokeWidth="3" strokeLinecap="round" fill="none">
        <path className="vt-r1" d="M10 42 A22 22 0 0 1 54 42" />
        <path className="vt-r2" d="M17 42 A15 15 0 0 1 47 42" />
        <path className="vt-r3" d="M24 42 A 8 8 0 0 1 40 42" />
      </g>
      <circle cx="32" cy="14" r="2.8" fill={color} />
      <path d="M30 42 Q30.5 50 31.4 58 L32.6 58 Q33.5 50 34 42 Z" fill={color} />
      <path d="M22 58 L42 58" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

