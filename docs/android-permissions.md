# Android permissions

| Permission | Why | When requested |
| --- | --- | --- |
| `RECORD_AUDIO` | Capture speech for on-device recognition. Also required by Android for playback capture. | Permissions screen, or before the audio test. Runtime dialog; "blocked" → app settings link. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE` | Keep listening with a visible notification while the screen is off or another app is in front. | Install-time. The service is started only from the visible app after the user taps **Start Listening** (Android 12+ background-start and Android 14 while-in-use rules). |
| `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Only for the optional same-phone playback capture (service type `mediaProjection`). | Install-time; used only after the user accepts the system screen-capture dialog. |
| `POST_NOTIFICATIONS` | Show the ongoing "Listening" notification (Android 13+). | Permissions screen. If denied, the service still runs but the notification may be hidden by the OS; the in-app LIVE indicator always shows. |
| `SYSTEM_ALERT_WINDOW` | Optional floating captions over other apps. Display only — it never grants audio access. | Only through the system "Display over other apps" settings page. |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Download models; show network status. | Install-time. Live captioning never needs the network. |
| `WAKE_LOCK` | Keep-screen-awake option during meetings / full-screen captions. | Install-time. |

Blocked: `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` (exports use the share sheet and the Storage Access Framework).

## Foreground service lifecycle

- Declared in the module manifest with `android:foregroundServiceType="microphone|mediaProjection"`, `exported=false`.
- `startForeground` is called with `FOREGROUND_SERVICE_TYPE_MICROPHONE` (or `MEDIA_PROJECTION` for playback). Failures (`SecurityException`, `ForegroundServiceStartNotAllowedException`) are reported to the UI as `foreground_service_not_allowed` with a recovery explanation.
- `START_NOT_STICKY`: after process death the service does **not** silently restart; on next launch the meeting is marked `interrupted`.
- Swiping the app away (`onTaskRemoved`) stops capture, because the JS layer that saves captions is gone.
- Stop (in-app or notification) releases the microphone immediately and removes the notification. Pause also releases the microphone.
- Revoking the microphone permission mid-session is detected from `AudioRecord` errors and stops capture with `mic_permission_revoked`.
