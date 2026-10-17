import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, fonts } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'eyebrow';

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      accessibilityRole={variant === 'display' || variant === 'title' || variant === 'heading' ? 'header' : undefined}
      style={[styles[variant], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: colors.ink, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.ink },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.ink },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.park, letterSpacing: 0.8, textTransform: 'uppercase' },
});
