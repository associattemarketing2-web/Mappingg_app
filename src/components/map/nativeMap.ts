import ExpoConstants, { ExecutionEnvironment } from 'expo-constants';
import { TurboModuleRegistry } from 'react-native';

// MapLibre is a native module. It is included in development builds, preview
// APKs and store builds, but NOT in the Expo Go app — there the map screen
// shows a list fallback instead of crashing.

function detect(): boolean {
  if (ExpoConstants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  try {
    return TurboModuleRegistry.get('MLRNMapViewModule') != null;
  } catch {
    return false;
  }
}

export const nativeMapAvailable: boolean = detect();
