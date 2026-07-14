import { useEffect } from "react";

/**
 * Full-screen loading screen that plays the logo animation on:
 * 1. Successful login
 * 2. Opening the app when already authenticated (auto-login)
 *
 * The logo resolves by ~2s, so the overlay snaps away at 2.5s
 * (no fade) to keep it feeling like a quick loading screen.
 */
export default function IntroAnimation({ onDone }) {
  useEffect(() => {
    // Snap the loading screen away once the logo has formed.
    const doneTimer = setTimeout(() => onDone(), 2500);
    return () => clearTimeout(doneTimer);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#f3f5f5", // Sampled from the logo animation's backdrop so the video blends seamlessly
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        src="/logo%20animation.mp4"
        autoPlay
        muted
        playsInline
        style={{
          // Centered logo animation — sized like a loading indicator
          // rather than a full-screen cover.
          width: "min(1360px, 95vw)",
          height: "auto",
          maxHeight: "90vh",
          objectFit: "contain",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      />
    </div>
  );
}
