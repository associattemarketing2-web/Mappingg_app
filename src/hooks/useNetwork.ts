import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** False only when the device reports no connection (unknown counts as online). */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)), []);
  return online;
}
