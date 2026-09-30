"use client";

import Image from "next/image";
import { Music2, Pause } from "lucide-react";
import { type CSSProperties, type PointerEvent, useState } from "react";

interface InteractiveCloneProps {
  name: string;
  avatarUrl?: string | null;
  modelUrl?: string | null;
  speaking?: boolean;
}

type CloneStageStyle = CSSProperties & {
  "--clone-tilt-x": string;
  "--clone-tilt-y": string;
};

export function InteractiveClone({
  name,
  avatarUrl,
  modelUrl,
  speaking = false,
}: InteractiveCloneProps) {
  const [dancing, setDancing] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const isFeaturedClone = name.trim().toLocaleLowerCase() === "v";
  const hasFullBodyModel = Boolean(modelUrl || isFeaturedClone);
  const characterUrl = modelUrl || (isFeaturedClone ? "/clone-3d-character-v2.png" : avatarUrl) || "/mock_avatar.png";

  const stageStyle: CloneStageStyle = {
    "--clone-tilt-x": `${tilt.x}deg`,
    "--clone-tilt-y": `${tilt.y}deg`,
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    setTilt({ x: y * -7, y: x * 9 });
  };

  return (
    <div
      className="clone-stage"
      style={stageStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      aria-label={`Interactive 3D clone of ${name}`}
    >
      <div className="clone-scene" aria-hidden="true">
        <div className="clone-orbit clone-orbit-one" />
        <div className="clone-orbit clone-orbit-two" />
        <div className="clone-floor" />
        <div className={`clone-shadow ${dancing ? "is-dancing" : ""}`} />
        <div
          className={`clone-character ${
            dancing ? "is-dancing" : speaking ? "is-speaking" : "is-idle"
          } ${hasFullBodyModel ? "is-full-body" : "is-portrait"}`}
        >
          <Image
            src={characterUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 80vw, 250px"
            priority={isFeaturedClone}
          />
        </div>
        <div className={`clone-rim ${speaking ? "is-active" : ""}`} />
      </div>

      <button
        type="button"
        className={`clone-dance-button ${dancing ? "is-active" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDancing((current) => !current);
        }}
        aria-pressed={dancing}
        aria-label={dancing ? `Stop ${name} dancing` : `Make ${name} dance`}
      >
        {dancing ? <Pause size={13} aria-hidden="true" /> : <Music2 size={13} aria-hidden="true" />}
        <span>{dancing ? "Stop" : "Dance"}</span>
      </button>

      {speaking && (
        <div className="clone-speaking" aria-live="polite">
          <span className="clone-speaking-bars" aria-hidden="true">
            {[0, 1, 2, 3].map((bar) => <i key={bar} style={{ animationDelay: `${bar * 90}ms` }} />)}
          </span>
          Speaking
        </div>
      )}

      <style jsx>{`
        .clone-stage {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          border: 1px solid rgba(244, 236, 219, 0.08);
          border-radius: 20px;
          background:
            radial-gradient(circle at 50% 18%, rgba(244, 184, 96, 0.2), transparent 34%),
            linear-gradient(155deg, #222946 0%, #10162c 55%, #080c1b 100%);
          isolation: isolate;
          touch-action: pan-y;
        }
        .clone-stage::after {
          position: absolute;
          inset: 0;
          z-index: 8;
          border-radius: inherit;
          box-shadow: inset 0 0 36px rgba(3, 6, 18, 0.7);
          content: "";
          pointer-events: none;
        }
        .clone-scene {
          position: absolute;
          inset: 0;
          transform: perspective(700px) rotateX(var(--clone-tilt-x)) rotateY(var(--clone-tilt-y)) scale(1.04);
          transform-style: preserve-3d;
          transition: transform 160ms ease-out;
        }
        .clone-orbit {
          position: absolute;
          left: 50%;
          top: 48%;
          border: 1px solid rgba(244, 184, 96, 0.17);
          border-radius: 50%;
          transform: translate(-50%, -50%) rotateX(66deg);
        }
        .clone-orbit-one { width: 92%; height: 72%; }
        .clone-orbit-two { width: 68%; height: 54%; border-color: rgba(127, 196, 164, 0.13); }
        .clone-floor {
          position: absolute;
          left: 8%;
          right: 8%;
          bottom: -4%;
          height: 36%;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(244, 184, 96, 0.2), rgba(15, 21, 48, 0.04) 65%);
          transform: rotateX(68deg) translateZ(-35px);
        }
        .clone-shadow {
          position: absolute;
          left: 27%;
          right: 27%;
          bottom: 8%;
          height: 8%;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.62);
          filter: blur(8px);
          animation: cloneShadowIdle 3.6s ease-in-out infinite;
        }
        .clone-shadow.is-dancing { animation: cloneShadowDance 0.72s ease-in-out infinite; }
        .clone-character {
          position: absolute;
          z-index: 3;
          transform-origin: 50% 94%;
          will-change: transform;
        }
        .clone-character :global(img) { object-fit: contain; filter: drop-shadow(0 16px 13px rgba(0, 0, 0, 0.38)); }
        .clone-character.is-full-body { inset: 7% 8% 7%; }
        .clone-character.is-portrait { inset: 12% 5% 0; }
        .clone-character.is-portrait :global(img) { object-fit: cover; object-position: center top; border-radius: 16px; opacity: 0.88; }
        .clone-character.is-idle { animation: cloneIdle 3.6s ease-in-out infinite; }
        .clone-character.is-speaking { animation: cloneSpeak 0.5s ease-in-out infinite alternate; }
        .clone-character.is-dancing { animation: cloneDance 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite; }
        .clone-rim {
          position: absolute;
          inset: 5%;
          z-index: 4;
          border-radius: 50%;
          background: radial-gradient(circle, transparent 52%, rgba(244, 184, 96, 0.08));
          opacity: 0.35;
          pointer-events: none;
        }
        .clone-rim.is-active { animation: cloneRimPulse 0.8s ease-in-out infinite alternate; }
        .clone-dance-button,
        .clone-speaking {
          position: absolute;
          z-index: 12;
          display: flex;
          align-items: center;
          gap: 5px;
          border: 1px solid rgba(244, 236, 219, 0.12);
          border-radius: 999px;
          background: rgba(8, 12, 27, 0.72);
          color: rgba(244, 236, 219, 0.78);
          font-family: var(--font-mono), monospace;
          font-size: 8px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          backdrop-filter: blur(9px);
        }
        .clone-dance-button {
          right: 12px;
          bottom: 12px;
          padding: 8px 10px;
          cursor: pointer;
          transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
        }
        .clone-dance-button:hover,
        .clone-dance-button:focus-visible,
        .clone-dance-button.is-active {
          border-color: rgba(244, 184, 96, 0.65);
          background: rgba(244, 184, 96, 0.18);
          color: #f4b860;
          outline: none;
        }
        .clone-dance-button:active { transform: scale(0.95); }
        .clone-speaking { left: 12px; bottom: 12px; padding: 7px 9px; color: #7fc4a4; }
        .clone-speaking-bars { display: flex; align-items: center; gap: 2px; height: 10px; }
        .clone-speaking-bars i { width: 2px; height: 3px; border-radius: 2px; background: currentColor; animation: cloneBar 0.45s ease-in-out infinite alternate; }
        @keyframes cloneIdle {
          0%, 100% { transform: translate3d(0, 0, 20px) rotate(0); }
          50% { transform: translate3d(0, -4px, 22px) scale(1.012) rotate(-0.4deg); }
        }
        @keyframes cloneSpeak {
          from { transform: translate3d(-1px, 0, 22px) rotate(-0.3deg); }
          to { transform: translate3d(1px, -3px, 24px) scale(1.012) rotate(0.3deg); }
        }
        @keyframes cloneDance {
          0%, 100% { transform: translate3d(0, 0, 24px) rotate(0deg) scale(1); }
          12% { transform: translate3d(-10px, -10px, 28px) rotate(-5deg) scale(1.02, 0.99); }
          25% { transform: translate3d(-17px, 0, 24px) rotate(-8deg) scale(0.99, 1.01); }
          38% { transform: translate3d(-7px, -13px, 30px) rotate(3deg) scale(1.02, 0.98); }
          50% { transform: translate3d(0, 0, 24px) rotate(0deg) scale(1); }
          62% { transform: translate3d(10px, -10px, 28px) rotate(5deg) scale(1.02, 0.99); }
          75% { transform: translate3d(17px, 0, 24px) rotate(8deg) scale(0.99, 1.01); }
          88% { transform: translate3d(7px, -13px, 30px) rotate(-3deg) scale(1.02, 0.98); }
        }
        @keyframes cloneShadowIdle { 0%, 100% { opacity: 0.62; transform: scale(1); } 50% { opacity: 0.48; transform: scale(0.92); } }
        @keyframes cloneShadowDance { 0%, 100% { transform: translateX(-7px) scale(0.88); } 50% { transform: translateX(7px) scale(1.05); } }
        @keyframes cloneRimPulse { from { opacity: 0.32; } to { opacity: 0.86; } }
        @keyframes cloneBar { from { height: 3px; } to { height: 10px; } }
        @media (prefers-reduced-motion: reduce) {
          .clone-character,
          .clone-shadow,
          .clone-rim,
          .clone-speaking-bars i { animation: none !important; }
          .clone-scene { transform: none; transition: none; }
        }
      `}</style>
    </div>
  );
}
