// Discord owns the native audio session. CLOSE requests Activity shutdown;
// it does not confirm that Android/iOS has released its native audio session.
export function manageActivitySession(sdk, { document, window, onCloseRequested, onCloseError }) {
  let closing = false;
  const mobile = sdk.platform === "mobile";
  function leave(reason = "You left World Clock Together") {
    if (closing) return;
    closing = true;
    try {
      sdk.close(1000, reason);
      onCloseRequested?.();
    } catch (error) {
      closing = false;
      onCloseError?.(error);
    }
  }
  function checkVisibility() {
    if (document.visibilityState === "hidden") leave("World Clock Together moved to the background");
  }
  // Register immediately: the user may leave before SDK.ready resolves.
  if (mobile) {
    document.addEventListener("visibilitychange", checkVisibility);
    window.addEventListener("pagehide", () => leave("World Clock Together page hidden"));
    checkVisibility();
  }
  const ready = sdk.ready().then(() => {
    if (!mobile || closing) return;
    // PIP=1 and GRID=2 are Discord's documented layout enum values.
    // Desktop pop-outs remain available; mobile WCT is foreground-only.
    try {
      Promise.resolve(sdk.subscribe("ACTIVITY_LAYOUT_MODE_UPDATE", ({ layout_mode }) => {
        if (layout_mode === 1 || layout_mode === 2) leave("World Clock Together minimized");
      })).catch(() => {});
    } catch {
      // Older clients may lack layout events. Visibility and manual exit still work.
    }
  });
  return { leave, ready };
}
