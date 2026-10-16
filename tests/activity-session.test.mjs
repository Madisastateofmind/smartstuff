import test from "node:test";
import assert from "node:assert/strict";
import { manageActivitySession } from "../discord-clock/activity-session.mjs";

function fixture(platform = "mobile", initialVisibility = "visible") {
  const document = new EventTarget();
  document.visibilityState = initialVisibility;
  const window = new EventTarget();
  const closes = [];
  let resolveReady, layout;
  const sdk = {
    platform,
    close(...args) { closes.push(args); },
    ready() { return new Promise(resolve => { resolveReady = resolve; }); },
    async subscribe(event, callback) { assert.equal(event, "ACTIVITY_LAYOUT_MODE_UPDATE"); layout = callback; }
  };
  const session = manageActivitySession(sdk, { document, window });
  return { document, window, closes, sdk, session,
    async connect() { resolveReady(); await session.ready; },
    layout(mode) { layout?.({ layout_mode: mode }); },
    hide() { document.visibilityState = "hidden"; document.dispatchEvent(new Event("visibilitychange")); }
  };
}
test("mobile backgrounding requests normal closure even before ready", async () => {
  const f = fixture();
  f.hide();
  assert.equal(f.closes.length, 1);
  assert.equal(f.closes[0][0], 1000);
  await f.connect();
  f.layout(0);
  assert.equal(f.closes.length, 1);
});
test("mobile minimized layouts close, focused layout stays open", async () => {
  for (const mode of [1, 2]) {
    const f = fixture(); await f.connect();
    f.layout(0); assert.equal(f.closes.length, 0);
    f.layout(mode); assert.equal(f.closes.length, 1);
  }
});
test("desktop background and pop-out are preserved", async () => {
  const f = fixture("desktop"); await f.connect();
  f.hide(); f.window.dispatchEvent(new Event("pagehide")); f.layout(1);
  assert.equal(f.closes.length, 0);
  f.session.leave(); assert.equal(f.closes.length, 1);
});
test("multiple exit signals close only once", async () => {
  const f = fixture(); await f.connect();
  f.window.dispatchEvent(new Event("pagehide")); f.hide(); f.layout(1); f.session.leave();
  assert.equal(f.closes.length, 1);
});
test("starting hidden closes immediately", () => {
  assert.equal(fixture("mobile", "hidden").closes.length, 1);
});
test("unavailable layout subscription retains visibility exit", async () => {
  const f = fixture(); f.sdk.subscribe = async () => { throw Error("Unsupported"); };
  await f.connect(); f.hide(); assert.equal(f.closes.length, 1);
});
test("failed close reports failure and can be retried", () => {
  const f = fixture(); let errors = 0;
  f.sdk.close = () => { throw Error("Transport unavailable"); };
  const session = manageActivitySession(f.sdk, { document: new EventTarget(), window: new EventTarget(), onCloseError() { errors++; } });
  session.leave(); session.leave(); assert.equal(errors, 2);
});
