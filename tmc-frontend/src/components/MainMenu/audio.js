let touchAudio = null;

export function loadTouchAudio(src = "/sounds/menu_touch.mp3") {
  if (!touchAudio) {
    touchAudio = new Audio(src);
    touchAudio.preload = "auto";
    touchAudio.volume = 1.0;
  }
  return touchAudio;
}

export function playTouchAudio() {
  try {
    if (!touchAudio) loadTouchAudio();
    touchAudio.currentTime = 0;
    const p = touchAudio.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {});
    }
  } catch {}
}