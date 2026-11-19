import { requireOptionalNativeModule } from 'expo';
import { Share } from 'react-native';

// Older dev builds may not include the clipboard native module. Load it only
// when it exists, otherwise fall back to the share sheet so the app doesn't crash.
// Returns true when the text was copied (false: the share sheet was shown).
export async function copyText(text: string): Promise<boolean> {
  if (requireOptionalNativeModule('ExpoClipboard')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard: typeof import('expo-clipboard') = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  }
  await Share.share({ message: text }).catch(() => undefined);
  return false;
}
