# WCT mobile Activity exit regression checks

Run `node --test tests/activity-session.test.mjs` from the repository root.

These tests verify close requests, not Android audio routing or Discord's acknowledgement.
The bundled SDK is unchanged except for replacing WCT's old inline bootstrap with a
named DiscordSDK export. activity-start.mjs is now the entry point.

## Device validation required before release

Reported device: Samsung Galaxy S26 Ultra, built-in Samsung alarm clock.
Android and Discord versions have not yet been supplied. The report concerns an
Activity launched from a text channel without a voice call.

Use short daytime test alarms with a backup, not an overnight wake-up alarm.

1. Confirm an alarm sounds before launching WCT.
2. Launch WCT from a Discord text channel, without joining voice. Test an alarm
   while WCT is visible. Automatic background closure cannot address a failure
   while the Activity is still in the foreground.
3. Set a fresh short alarm. Switch away from Discord; verify WCT closes and the
   alarm sounds. Repeat by locking the screen and by minimizing WCT within Discord.
4. Repeat with Leave WCT and separately with Discord's own Leave Activity control.
5. Verify desktop pop-out remains open and standalone browser use stays independent.

Record actual Activity closure and audible alarms separately. The OS can suspend
JavaScript without delivering visibility or pagehide events, and SDK.close returns
no native audio-release acknowledgement. If audio remains affected, the mitigation
is insufficient and the native client issue must be investigated with Discord.
