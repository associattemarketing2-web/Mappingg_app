import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { openUrl } from '@/lib/openLink';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Checkbox, ChoicePills } from '@/components/ui/Choice';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { whatsappGeneralUrl } from '@/constants/contact';
import { colors, fonts, radius } from '@/constants/theme';
import { DEFAULT_CODE, formatPhone, isValidNumber, PHONE_ERROR } from '@/lib/phone';
import { useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/services/api/errors';
import { CONTACT_CHOICES, CONTACT_PLACEHOLDER, CONTACT_TOPICS, sendContact } from '@/services/contact';

// Public contact form (website: components/ContactForm.tsx → /api/contact).
// The call / WhatsApp opt-ins are separate and start unticked.

export default function ContactScreen() {
  const router = useRouter();
  const { project } = useLocalSearchParams<{ project?: string }>();
  const { user } = useAuth();
  const [subject, setSubject] = useState<string>(CONTACT_TOPICS[0].value);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState({ code: DEFAULT_CODE, number: '' });
  const [message, setMessage] = useState(project ? `I'd like details about ${project}.` : '');
  const [needs, setNeeds] = useState({ city: '', locality: '', budget: '', bhk: '', timeline: '' });
  const [consentCall, setConsentCall] = useState(false);
  const [consentWa, setConsentWa] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const buying = subject === 'Project enquiry';
  const hasNeeds = buying && Object.values(needs).some(Boolean);

  const submit = async () => {
    if (busy) return; // e.g. the keyboard's "Go" key while a request is running
    setError('');
    if (!name.trim()) return setError('Please add your name.');
    if (!message.trim() && !hasNeeds) return setError(buying ? 'Tell us what you’re looking for, or add a message.' : 'Please add a message.');
    if (!email.trim() && !phone.number) return setError('Add a phone number or email so we can reply.');
    if (phone.number && !isValidNumber(phone.number)) return setError(PHONE_ERROR);
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('That email address looks invalid.');
    setBusy(true);
    try {
      await sendContact({
        name: name.trim(),
        email: email.trim(),
        phone: phone.number ? formatPhone(phone.code, phone.number) : '',
        subject,
        message: message.trim(),
        ...needs,
        consent_call: consentCall,
        consent_whatsapp: consentWa,
      });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={54} color={colors.success} />
          <AppText variant="title" style={styles.center}>
            Thank you, {name.trim().split(' ')[0]}! We’ve got your message.
          </AppText>
          <AppText style={styles.center}>Our team will get back to you shortly at the contact details you shared.</AppText>
          <Button title="Explore projects" onPress={() => router.replace('/projects')} style={styles.stretch} />
          <Button title="Chat on WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => void openUrl(whatsappGeneralUrl())} style={styles.stretch} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText style={styles.sub}>Your message goes straight to the Mappingg team.</AppText>
      <ChoicePills label="What can we help with?" options={CONTACT_TOPICS} value={subject} onChange={setSubject} />
      <TextField label="Your name" value={name} onChangeText={setName} autoComplete="name" maxLength={120} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hint="Add an email or a phone number so we can reply." />
      <PhoneField label="Phone / WhatsApp" optional code={phone.code} number={phone.number} onChange={(code, number) => setPhone({ code, number })} />
      {buying ? (
        <View style={styles.group}>
          <AppText variant="label" style={styles.groupTitle}>
            What are you looking for? (optional)
          </AppText>
          <SelectField label="City" value={needs.city} options={CONTACT_CHOICES.city} onChange={(v) => setNeeds({ ...needs, city: v })} />
          <TextField label="Locality" value={needs.locality} onChangeText={(v) => setNeeds({ ...needs, locality: v })} placeholder="e.g. Kharadi" maxLength={120} />
          <SelectField label="Budget" value={needs.budget} options={CONTACT_CHOICES.budget} onChange={(v) => setNeeds({ ...needs, budget: v })} />
          <SelectField label="BHK" value={needs.bhk} options={CONTACT_CHOICES.bhk} onChange={(v) => setNeeds({ ...needs, bhk: v })} />
          <SelectField label="Planning to buy" value={needs.timeline} options={CONTACT_CHOICES.timeline} onChange={(v) => setNeeds({ ...needs, timeline: v })} />
        </View>
      ) : null}
      <TextField label="Message" value={message} onChangeText={setMessage} multiline maxLength={4000} placeholder={CONTACT_PLACEHOLDER[subject]} />
      <Checkbox checked={consentCall} onChange={setConsentCall} label="Associatte PropTech (Mappingg) may call me about matching projects." />
      <Checkbox checked={consentWa} onChange={setConsentWa} label="Associatte PropTech (Mappingg) may message me on WhatsApp about matching projects." />
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <Button title="Send message" icon="paper-plane-outline" onPress={() => void submit()} loading={busy} style={styles.send} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginBottom: 14 },
  group: { padding: 14, borderRadius: radius.md, backgroundColor: colors.land, borderWidth: 1, borderColor: colors.line, marginBottom: 14 },
  groupTitle: { marginBottom: 10 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginTop: 10 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  send: { marginTop: 14 },
  done: { alignItems: 'center', gap: 12, paddingTop: 40 },
  center: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
});
