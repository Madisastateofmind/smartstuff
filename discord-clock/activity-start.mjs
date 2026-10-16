import { DiscordSDK } from "./discord-connect.js";
import { manageActivitySession } from "./activity-session.mjs";

if (new URLSearchParams(location.search).has("frame_id")) {
  const container = document.querySelector(".container");
  const status = document.getElementById("activityStatus");
  const leaveButton = document.getElementById("leaveActivity");
  const sdk = new DiscordSDK("1558211468447449239");
  document.getElementById("activityControls").hidden = false;
  if (sdk.platform === "mobile") document.getElementById("mobileExitNote").hidden = false;
  window.dispatchEvent(new Event("resize"));
  const session = manageActivitySession(sdk, {
    document, window,
    onCloseRequested() {
      status.textContent = "Closing WCT. If it remains open, use Discord’s Leave Activity (door) control.";
    },
    onCloseError() {
      status.textContent = "Use Discord’s Leave Activity (door) control to finish leaving WCT.";
    }
  });
  leaveButton.addEventListener("click", () => session.leave());
  const timeout = setTimeout(connectionWarning, 15000);
  session.ready.then(() => clearTimeout(timeout)).catch(() => {
    clearTimeout(timeout);
    connectionWarning();
  });
  function connectionWarning() {
    const warning = document.createElement("p");
    warning.textContent = "The clock is running, but its Discord connection could not be established. Please leave and reopen the Activity.";
    warning.setAttribute("role", "alert");
    container.append(warning);
  }
}
