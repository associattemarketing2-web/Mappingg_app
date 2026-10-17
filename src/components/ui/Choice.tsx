import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/constants/theme';
import { fieldStyles } from './TextField';

/** Pill-style single choice (e.g. "Buying for", account type, contact topic). */
export function ChoicePills({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label?: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <Text style={fieldStyles.label}>{label}</Text> : null}
      <View style={styles.pills}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.check}
    >
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</View>
      <Text style={styles.checkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 42,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  pillOn: { borderColor: colors.forest, backgroundColor: colors.forestTint },
  pillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  pillTextOn: { color: colors.forest, fontFamily: fonts.semibold },
  error: { marginTop: 5, color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, minHeight: 44 },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  checkText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
});
