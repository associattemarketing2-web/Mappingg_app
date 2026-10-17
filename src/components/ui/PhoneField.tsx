import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COUNTRY_CODES } from '@/constants/countryCodes';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { PHONE_DIGITS } from '@/lib/phone';
import { OptionSheet } from './OptionSheet';
import { fieldStyles } from './TextField';

interface Props {
  label: string;
  code: string;
  number: string;
  onChange: (code: string, number: string) => void;
  error?: string;
  optional?: boolean;
}

/** Country code + exactly 10 digits, with a live "7/10" counter (same as the website's phone field). */
export function PhoneField({ label, code, number, onChange, error, optional }: Props) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => COUNTRY_CODES.map(([c, flag]) => ({ value: c, label: `${flag}  ${c}` })), []);
  const flag = COUNTRY_CODES.find(([c]) => c === code)?.[1] || '';
  const n = number.length;
  return (
    <View style={styles.wrap}>
      <Text style={fieldStyles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <View style={[styles.box, !!error && styles.boxError]}>
        <Pressable
          onPress={() => setOpen(true)}
          style={styles.code}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${code}`}
          accessibilityHint="Opens the list of country codes"
        >
          <Text style={styles.codeText}>
            {flag} {code}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          value={number}
          onChangeText={(t) => onChange(code, t.replace(/\D/g, '').slice(0, PHONE_DIGITS))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          maxLength={PHONE_DIGITS}
          placeholder="10-digit number"
          placeholderTextColor="#8a938f"
          accessibilityLabel={`${label} number`}
          style={styles.input}
          maxFontSizeMultiplier={1.4}
        />
        <Text style={[styles.count, n === PHONE_DIGITS && styles.countOk]} accessibilityElementsHidden importantForAccessibility="no">
          {n === PHONE_DIGITS ? '✓' : `${n}/${PHONE_DIGITS}`}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <OptionSheet visible={open} title="Country code" options={options} selected={code} onSelect={(c) => onChange(c, number)} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  optional: { fontFamily: fonts.regular, color: colors.muted },
  box: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  boxError: { borderColor: colors.danger },
  code: {
    minHeight: TOUCH,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.land,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  codeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  input: { flex: 1, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  count: { paddingHorizontal: 12, fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  countOk: { color: colors.success, fontSize: 15 },
  error: { marginTop: 5, color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
});
