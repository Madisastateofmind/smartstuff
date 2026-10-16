# WCT mobile Activity exit regression checks

Run `node --test tests/activity-session.test.mjs` from the repository root.

These tests verify close requests, not Android/iOS audio routing or Discord's acknowledgement.
Discord reports both iPhone and Android clients as platform="mobile", so both use
the same lifecycle guard. This is shared-code coverage, not an iPhone device test.
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

## iPhone and Android device matrix

Run every case separately on an iPhone with Apple's built-in Clock app and on
the reported Samsung with its built-in Clock app. Record device, OS version,
Discord version, output route (speaker/Bluetooth), visible Activity state,
and whether the alarm is audible. No iPhone alarm failure has yet been reported
or reproduced; do not infer one from the Android report.

| Case | Verify separately on each OS |
| --- | --- |
| Baseline | Alarm sounds before launching an Activity. |
| Text-channel launch, no voice | Alarm sounds while WCT is visible; no voice channel is joined. |
| Discord floating/minimized Activity | The close request is delivered, the Activity actually exits, and alarm audio remains audible. |
| Navigate to another Discord channel | Check actual visibility/layout events and whether closure occurs. |
| Switch to another phone app | Check closure and the alarm independently. |
| Lock the phone | Check closure and alarm audio while locked. |
| Leave WCT button | Check actual Activity exit and audio restoration, not just the status message. |
| Discord's door/Leave Activity | Compare native exit with WCT's close request. |
| Relaunch after each exit | A new Activity connects and the clock/dropdown work normally. |
| Standalone Safari/Chrome | Clock works without a Discord Activity connection; compare alarm audio. |

Mobile floating use and auto-exit on minimized layout are mutually exclusive
in this candidate. Desktop floating use remains enabled. Do not claim that
WCT can keep Discord's mobile pop-out while independently disabling Discord's
native audio session: the Embedded App SDK exposes no documented switch for it.

Record actual Activity closure and audible alarms separately. The OS can suspend
JavaScript without delivering visibility or pagehide events, and SDK.close returns
no native audio-release acknowledgement. iOS backgrounding is also subject to this
limitation. If audio remains affected, the mitigation
is insufficient and the native client issue must be investigated with Discord.
