import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { OptionSheet, type Option } from './OptionSheet';
import { fieldStyles } from './TextField';

interface Props {
  label: string;
  value: string;
  options: readonly (string | Option)[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export function SelectField({ label, value, options, onChange, placeholder = 'Select…', error }: Props) {
  const [open, setOpen] = useState(false);
  const opts: Option[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = opts.find((o) => o.value === value);
  return (
    <View style={styles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current ? current.label : 'not selected'}`}
        accessibilityHint="Opens a list of choices"
        style={[styles.box, !!error && styles.boxError]}
      >
        <Text style={[styles.value, !current && styles.placeholder]} numberOfLines={1}>
          {current ? current.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <OptionSheet visible={open} title={label} options={opts} selected={value} onSelect={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  box: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  boxError: { borderColor: colors.danger },
  value: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  placeholder: { color: '#8a938f' },
  error: { marginTop: 5, color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
});
