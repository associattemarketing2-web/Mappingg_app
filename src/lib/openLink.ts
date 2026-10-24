import { Alert, Linking } from 'react-native';

// Opens a link in another app (WhatsApp, phone dialer, mail, maps, YouTube,
// browser). Linking.openURL rejects when no installed app can handle the link
// (e.g. no mail app or no WhatsApp); without a catch the tap silently does
// nothing, so tell the person instead.

export const OPEN_FAILED_MESSAGE = 'No app on this phone can open this link.';

export async function openUrl(url: string, failMessage: string = OPEN_FAILED_MESSAGE): Promise<boolean> {
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert('Can’t open link', failMessage);
    return false;
  }
}
