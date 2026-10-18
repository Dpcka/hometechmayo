import test from "node:test";
import assert from "node:assert/strict";
import { createAutoplay } from "../js/project-autoplay.mjs";
function time() {
  let now = 0,
    id = 0;
  const tasks = new Map();
  return {
    setTimer(fn, delay) {
      const key = ++id;
      tasks.set(key, { fn, at: now + delay });
      return key;
    },
    clearTimer(key) {
      tasks.delete(key);
    },
    tick(ms) {
      const end = now + ms;
      while (true) {
        const due = [...tasks]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        tasks.delete(due[0]);
        due[1].fn();
      }
      now = end;
    },
    pending: () => tasks.size,
  };
}
test("autoplay starts only on screen and advances every five seconds", () => {
  const clock = time();
  let calls = 0;
  const auto = createAutoplay({ ...clock, advance: () => calls++ });
  clock.tick(20000);
  assert.equal(calls, 0);
  auto.resume("offscreen");
  clock.tick(4999);
  assert.equal(calls, 0);
  clock.tick(1);
  assert.equal(calls, 1);
  clock.tick(10000);
  assert.equal(calls, 3);
  auto.destroy();
  assert.equal(clock.pending(), 0);
});
test("independent clocks stagger the first frame without changing five-second cadence", () => {
  const clock = time();
  let a = 0,
    b = 0;
  const first = createAutoplay({ ...clock, advance: () => a++ }),
    second = createAutoplay({ ...clock, stagger: 1700, advance: () => b++ });
  first.resume("offscreen");
  second.resume("offscreen");
  clock.tick(5000);
  assert.deepEqual([a, b], [1, 0]);
  clock.tick(1700);
  assert.deepEqual([a, b], [1, 1]);
  clock.tick(3300);
  assert.deepEqual([a, b], [2, 1]);
  clock.tick(1700);
  assert.deepEqual([a, b], [2, 2]);
});
test("hover, focus, interaction, viewer, hidden tab and reduced motion independently suspend scheduling", () => {
  for (const reason of [
    "hover",
    "focus",
    "interaction",
    "viewer",
    "hidden",
    "reduced",
    "offscreen",
  ]) {
    const clock = time();
    let calls = 0;
    const auto = createAutoplay({ ...clock, advance: () => calls++ });
    auto.resume("offscreen");
    clock.tick(2500);
    auto.pause(reason);
    assert.equal(clock.pending(), 0);
    clock.tick(20000);
    assert.equal(calls, 0);
    auto.resume(reason);
    clock.tick(4999);
    assert.equal(calls, 0);
    clock.tick(1);
    assert.equal(calls, 1);
    auto.destroy();
  }
});
test("overlapping pause reasons and manual interaction cannot accidentally restart autoplay", () => {
  const clock = time();
  let calls = 0;
  const auto = createAutoplay({ ...clock, advance: () => calls++ });
  auto.resume("offscreen");
  auto.pause("hover");
  auto.pause("focus");
  auto.restart();
  auto.resume("hover");
  clock.tick(20000);
  assert.equal(calls, 0);
  auto.resume("focus");
  clock.tick(3000);
  auto.restart();
  clock.tick(4999);
  assert.equal(calls, 0);
  clock.tick(1);
  assert.equal(calls, 1);
});

test("shared pause and resume keeps card starting times staggered", () => {
  const clock = time();
  let a = 0,
    b = 0;
  const first = createAutoplay({ ...clock, advance: () => a++ }),
    second = createAutoplay({ ...clock, stagger: 1700, advance: () => b++ });
  first.resume("offscreen");
  second.resume("offscreen");
  clock.tick(7000);
  assert.deepEqual([a, b], [1, 1]);
  first.pause("hidden");
  second.pause("hidden");
  clock.tick(10000);
  first.resume("hidden");
  second.resume("hidden");
  clock.tick(5000);
  assert.deepEqual([a, b], [2, 1]);
  clock.tick(1700);
  assert.deepEqual([a, b], [2, 2]);
});
