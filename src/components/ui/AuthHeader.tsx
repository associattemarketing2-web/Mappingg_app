import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '@/constants/theme';

/** Brand mark + title + subtitle at the top of the sign-in / sign-up screens. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.markWrap}>
        <Image source={require('@assets/images/mappingg-mark.png')} style={styles.mark} contentFit="contain" accessibilityLabel="Mappingg" />
      </View>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        {title}
      </Text>
      <Text style={styles.sub} maxFontSizeMultiplier={1.4}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 4, marginBottom: 22 },
  markWrap: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.forestTint, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  mark: { width: 34, height: 44 },
  title: { ...type.h1, fontSize: 26, lineHeight: 32, color: colors.ink, textAlign: 'center' },
  sub: { ...type.body, color: colors.text, textAlign: 'center', marginTop: 6, maxWidth: 320 },
});
