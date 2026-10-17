import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { useIsOnline } from '@/hooks/useNetwork';

export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.ink} />
      <Text style={styles.text}>You’re offline — showing saved data where available.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.road50,
    borderBottomWidth: 1,
    borderBottomColor: '#f1dcae',
  },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
});
