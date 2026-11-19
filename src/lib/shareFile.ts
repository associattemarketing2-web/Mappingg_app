import { requireOptionalNativeModule } from 'expo';

// Saves a text file (e.g. a CSV export) to the app's cache and opens the
// phone's share sheet, so it can be saved to Files / Drive or sent on.
// Returns false on app builds without the file-system / sharing modules.

export const canShareFiles = !!requireOptionalNativeModule('FileSystem') && !!requireOptionalNativeModule('ExpoSharing');

export async function shareTextFile(name: string, mime: string, text: string): Promise<boolean> {
  if (!canShareFiles) return false;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const file = new File(Paths.cache, `${Date.now()}-${name.replace(/[\\/:*?"<>|]+/g, '_')}`);
  file.create({ overwrite: true });
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
  return true;
}
