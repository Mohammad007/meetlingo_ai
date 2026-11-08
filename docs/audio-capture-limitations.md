# Audio capture limitations

## Supported and reliable

| Workflow | How audio reaches the app |
| --- | --- |
| **Physical meeting** | Phone microphone in the room. |
| **Laptop meeting** | Meeting plays through the **laptop speakers**; the phone microphone listens. Works with any platform (Google Meet, Zoom, Microsoft Teams, …). |

If the laptop uses **headphones**, the phone hears nothing; the app shows a "No audio detected" warning after 15 s of near-silence and explains why.

## Same phone (experimental, conditional)

Android's `AudioPlaybackCapture` API (Android 10+) lets an app capture another app's audio **only** when all of these hold:

1. The user grants MediaProjection consent (system screen-capture dialog). The consent token is single-use.
2. The audio is played with usage `MEDIA`, `GAME` or `UNKNOWN`.
3. The playing app's capture policy allows it.

Call audio in Google Meet, Zoom and Teams uses `USAGE_VOICE_COMMUNICATION`, which Android never exposes to other apps. During a call, the meeting app usually also holds the microphone, so Android silences other apps' microphone input as well.

What MeetLingo does:

- **Check Capture Compatibility** asks for consent, then captures permitted playback for 5 s and reports the measured result:
  - `supported`: signal received from an app that allows capture. The UI states that this does **not** prove call audio is capturable.
  - `unavailable`: silence or error. The UI shows "This meeting application's call audio can't be captured on this phone" and offers the laptop-speaker and second-device workflows.
  - `unsupported`: Android < 10.
- Playback capture runs in the foreground service with type `mediaProjection` and a registered `MediaProjection.Callback` (required on Android 14).
- If Android silences the microphone because another app has priority, the app reports `mic_silenced` and does not try to force it.

What MeetLingo never does: root, hidden/reflection APIs, accessibility-service audio tricks, call interception, or claiming a meeting platform integration ("Connect Zoom/Teams account") that doesn't exist.

The floating overlay only displays captions. It does not capture any audio.
