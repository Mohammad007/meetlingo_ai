import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkStatus {
  online: boolean | null;
  type: string;
  isWifi: boolean;
}

/** Network status for display only. Live captioning never depends on it. */
export function useNetwork(): NetworkStatus {
  const [state, setState] = useState<NetworkStatus>({ online: null, type: 'unknown', isWifi: false });
  useEffect(() => {
    const map = (s: NetInfoState): NetworkStatus => ({
      online: s.isConnected === null ? null : !!s.isConnected && s.isInternetReachable !== false,
      type: s.type,
      isWifi: s.type === 'wifi' || s.type === 'ethernet',
    });
    NetInfo.fetch().then((s) => setState(map(s)));
    return NetInfo.addEventListener((s) => setState(map(s)));
  }, []);
  return state;
}
