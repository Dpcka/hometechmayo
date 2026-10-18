// Small injectable clock: no DOM, image loading, or dependency is required.
export function createAutoplay({
  advance,
  stagger = 0,
  interval = 5000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const reasons = new Set(["offscreen"]);
  let timer,
    first = true;
  const stop = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };
  const schedule = () => {
    if (reasons.size || timer !== undefined) return;
    timer = setTimer(
      () => {
        timer = undefined;
        if (reasons.size) return;
        first = false;
        advance();
        schedule();
      },
      interval + (first ? stagger : 0),
    );
  };
  return {
    pause(reason) {
      reasons.add(reason);
      first = true; // Keep cards staggered when a shared pause ends, too.
      stop();
    },
    resume(reason) {
      if (reasons.delete(reason)) schedule();
    },
    restart() {
      stop();
      schedule();
    },
    destroy() {
      reasons.add("destroyed");
      stop();
    },
  };
}
