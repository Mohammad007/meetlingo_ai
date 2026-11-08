import { PermissionsAndroid, Platform } from 'react-native';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

const MIC = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
const NOTIF = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

/** Android 13+ requires a runtime grant for the ongoing-capture notification. */
export const needsNotificationPermission = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export async function checkMicrophone(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'unavailable';
  return (await PermissionsAndroid.check(MIC)) ? 'granted' : 'denied';
}

export async function requestMicrophone(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'unavailable';
  const r = await PermissionsAndroid.request(MIC, {
    title: 'Allow microphone',
    message:
      'MeetLingo AI listens only after you tap Start Listening, to turn English speech into live captions on this phone. Audio is not uploaded and is not saved unless you turn on audio recording.',
    buttonPositive: 'Continue',
    buttonNegative: 'Not now',
  });
  return mapResult(r);
}

export async function checkNotifications(): Promise<PermissionStatus> {
  if (!needsNotificationPermission) return 'granted';
  return (await PermissionsAndroid.check(NOTIF)) ? 'granted' : 'denied';
}

export async function requestNotifications(): Promise<PermissionStatus> {
  if (!needsNotificationPermission) return 'granted';
  return mapResult(await PermissionsAndroid.request(NOTIF));
}

function mapResult(r: string): PermissionStatus {
  if (r === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

export function canDrawOverlays(): boolean {
  try {
    return isNativeAvailable ? MeetLingoNative.canDrawOverlays() : false;
  } catch {
    return false;
  }
}

export function openOverlaySettings() {
  if (isNativeAvailable) MeetLingoNative.openOverlaySettings();
}

export function openAppSettings() {
  if (isNativeAvailable) MeetLingoNative.openAppSettings();
  else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native').Linking.openSettings();
  }
}
