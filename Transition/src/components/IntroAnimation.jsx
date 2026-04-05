import { useEffect, useState } from "react";

/**
 * Full-screen intro animation that plays on:
 * 1. Successful login
 * 2. Opening the app when already authenticated (auto-login)
 *
 * The video fades out starting at 4s and is fully gone by ~5s.
 */
export default function IntroAnimation({ onDone }) {
  // "visible" controls the overlay opacity for the fade-out
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fading at 6 seconds
    const fadeTimer = setTimeout(() => setFading(true), 6000);

    // Fully remove the overlay at 7.5 seconds
    const doneTimer = setTimeout(() => onDone(), 7500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000", // Black background prevents edge lines
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 1.5s ease-in-out",
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <video
        src="/logo%20animation.mp4"
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.02) translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      />
    </div>
  );
}
