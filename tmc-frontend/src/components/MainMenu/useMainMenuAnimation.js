import { useEffect, useRef, useState, useCallback } from "react";
import { playTouchAudio } from "./audio";

export function useMainMenuAnimation(opts) {
  const {
    overlayCtrl,
    logoCtrl,
    headlineCtrl,
    buttonsCtrl,
    reducedMotion,
    introAlreadyPlayed,
    onComplete,
    silent = false,
  } = opts;

  const [phase, setPhase] = useState(
    introAlreadyPlayed || reducedMotion ? "complete" : "init"
  );
  const skipRequestedRef = useRef(false);

  const finalize = (instant) => {
    skipRequestedRef.current = false;
    setPhase("complete");
    if (instant) {
      overlayCtrl.set({ opacity: 1 });
      logoCtrl.set({ translateX: 0, translateY: 0, scale: 1, opacity: 1 });
      headlineCtrl.set("activatedStatic");
      buttonsCtrl.set("instant");
    }
    if (!introAlreadyPlayed && !reducedMotion) {
      try { localStorage.setItem("menuIntroPlayed", "true"); } catch {}
    }
    onComplete && onComplete();
  };

  const run = useCallback(async () => {
    if (phase !== "init") return;
    setPhase("animating");
    if (introAlreadyPlayed || reducedMotion) {
      finalize(true);
      return;
    }

    await overlayCtrl.start({ opacity: 1, transition: { duration: 0.3 } });

    await new Promise((r) => setTimeout(r, 300));
    if (skipRequestedRef.current) return;

    await logoCtrl.start({
      translateX: [600, 320, 120, 40, 0],
      translateY: [300, 210, 150, 65, 0],
      scale: [1, 1.08, 1, 1],
      transition: { duration: 1.3, ease: "easeInOut" },
    });
    if (skipRequestedRef.current) return;

    if (!silent) {
      try { playTouchAudio(); } catch {}
    }

    await logoCtrl.start({
      translateX: 0,
      translateY: 0,
      scale: [1, 1.07, 1],
      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
    });
    if (skipRequestedRef.current) return;

    headlineCtrl.start("activate");
    buttonsCtrl.start("show");

    await new Promise((r) => setTimeout(r, 1200));
    if (!skipRequestedRef.current) finalize(false);
  }, [
    phase, overlayCtrl, logoCtrl, headlineCtrl, buttonsCtrl,
    introAlreadyPlayed, reducedMotion, silent
  ]);

  useEffect(() => { run(); }, [run]);

  const skip = () => {
    if (phase === "complete") return;
    skipRequestedRef.current = true;
    finalize(true);
  };

  return { phase, skip };
}