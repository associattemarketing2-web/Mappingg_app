import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Checkbox, ChoicePills } from '@/components/ui/Choice';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { siteLink } from '@/constants/contact';
import { colors, fonts, radius } from '@/constants/theme';
import { DEFAULT_CODE, formatPhone, isValidNumber, PHONE_ERROR } from '@/lib/phone';
import { useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/services/api/errors';
import { requestOtp, SIGNUP_OPTIONS, type SignupInput, type SignupRole } from '@/services/auth';

// Same fields and rules as the website's "Create account" form: every field is
// required except a developer's website; the email is verified with a 6-digit code.

const ROLES = [
  { value: 'buyer', label: 'Buyer / Investor' },
  { value: 'developer', label: 'Developer / Builder' },
  { value: 'agent', label: 'Agent / Channel Partner' },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pills = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [role, setRole] = useState<SignupRole>('buyer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState({ code: DEFAULT_CODE, number: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [buyer, setBuyer] = useState({ area: '', configuration: '', budget: '', timeline: '', purpose: '' });
  const [dev, setDev] = useState({ company: '', designation: '', activeProjects: '', reraProject: '', website: '' });
  const [agent, setAgent] = useState({ agency: '', reraAgent: '', areas: '' });
  const [ticket, setTicket] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter your name.';
    if (!isValidNumber(phone.number)) e.phone = PHONE_ERROR;
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    if (role === 'buyer') {
      (Object.keys(buyer) as (keyof typeof buyer)[]).forEach((k) => {
        if (!buyer[k].trim()) e[k] = 'Required';
      });
    } else if (role === 'developer') {
      if (!dev.company.trim()) e.company = 'Required';
      if (!dev.designation) e.designation = 'Required';
      if (!dev.activeProjects) e.activeProjects = 'Required';
      if (dev.reraProject.trim().length < 4) e.reraProject = 'Enter a MahaRERA project number.';
    } else {
      if (!agent.agency.trim()) e.agency = 'Required';
      if (agent.reraAgent.trim().length < 4) e.reraAgent = 'Enter your MahaRERA agent number.';
      if (!agent.areas.trim()) e.areas = 'Required';
    }
    if (!terms) e.terms = 'Please agree to the Terms and Privacy Policy.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const sendCode = async () => {
    setFormError('');
    if (!validate()) {
      setFormError('Please fill in all required fields.');
      return;
    }
    setBusy(true);
    try {
      setTicket(await requestOtp(email.trim().toLowerCase(), 'signup', name.trim()));
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setFormError('');
    if (!/^\d{6}$/.test(otp.trim())) return setFormError('Enter the 6-digit code from your email.');
    const base = { name: name.trim(), email: email.trim().toLowerCase(), mobile: formatPhone(phone.code, phone.number), password, otp: otp.trim(), ticket };
    const input: SignupInput =
      role === 'buyer'
        ? { ...base, role, profile: { ...buyer, area: buyer.area.trim() } }
        : role === 'developer'
          ? { ...base, role, profile: { ...dev, company: dev.company.trim(), reraProject: dev.reraProject.trim(), website: dev.website.trim() } }
          : { ...base, role, profile: { agency: agent.agency.trim(), reraAgent: agent.reraAgent.trim(), areas: agent.areas.trim() } };
    setBusy(true);
    try {
      await signUp(input);
      router.dismissAll();
      router.replace(role === 'buyer' ? '/' : '/account');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <Screen>
        <AppText variant="title">Check your email</AppText>
        <AppText style={styles.sub}>We sent a 6-digit code to {email.trim()}. Enter it to create your account.</AppText>
        {formError ? <ErrorBox text={formError} /> : null}
        <TextField label="Email verification code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="6-digit code" />
        <Button title="Create account" onPress={() => void create()} loading={busy} />
        <Button title="Resend code" variant="ghost" onPress={() => void sendCode()} disabled={busy} style={styles.gap} />
        <Button title="Change my details" variant="ghost" onPress={() => setTicket('')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Create your account</AppText>
      <AppText style={styles.sub}>Takes less than a minute. All fields are required.</AppText>
      <ChoicePills label="I am a" options={ROLES} value={role} onChange={(v) => setRole(v as SignupRole)} />
      <TextField label="Full name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
      <PhoneField label="WhatsApp number" code={phone.code} number={phone.number} onChange={(code, number) => setPhone({ code, number })} error={errors.phone} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />

      {role === 'buyer' ? (
        <View style={styles.group}>
          <AppText variant="label">Tell us what you’re looking for</AppText>
          <AppText variant="caption" style={styles.groupSub}>
            Helps us match you to the right projects
          </AppText>
          <TextField label="Preferred area" value={buyer.area} onChangeText={(v) => setBuyer({ ...buyer, area: v })} placeholder="e.g. Mundhwa, Kharadi" error={errors.area} />
          <SelectField label="Configuration" value={buyer.configuration} options={SIGNUP_OPTIONS.configuration} onChange={(v) => setBuyer({ ...buyer, configuration: v })} error={errors.configuration} />
          <SelectField label="Budget" value={buyer.budget} options={SIGNUP_OPTIONS.budget} onChange={(v) => setBuyer({ ...buyer, budget: v })} error={errors.budget} />
          <SelectField label="Planning to buy" value={buyer.timeline} options={SIGNUP_OPTIONS.timeline} onChange={(v) => setBuyer({ ...buyer, timeline: v })} error={errors.timeline} />
          <ChoicePills label="Buying for" options={pills(SIGNUP_OPTIONS.purpose)} value={buyer.purpose} onChange={(v) => setBuyer({ ...buyer, purpose: v })} error={errors.purpose} />
        </View>
      ) : role === 'developer' ? (
        <View style={styles.group}>
          <AppText variant="label">Company details</AppText>
          <TextField label="Company / developer name" value={dev.company} onChangeText={(v) => setDev({ ...dev, company: v })} placeholder="e.g. ABC Developers Pvt Ltd" error={errors.company} />
          <SelectField label="Your role" value={dev.designation} options={SIGNUP_OPTIONS.designation} onChange={(v) => setDev({ ...dev, designation: v })} error={errors.designation} />
          <SelectField label="Active projects" value={dev.activeProjects} options={SIGNUP_OPTIONS.activeProjects} onChange={(v) => setDev({ ...dev, activeProjects: v })} error={errors.activeProjects} />
          <TextField label="A MahaRERA project no." value={dev.reraProject} onChangeText={(v) => setDev({ ...dev, reraProject: v })} autoCapitalize="characters" placeholder="P52100012345" error={errors.reraProject} />
          <TextField label="Website" optional value={dev.website} onChangeText={(v) => setDev({ ...dev, website: v })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
        </View>
      ) : (
        <View style={styles.group}>
          <AppText variant="label">Agency details</AppText>
          <TextField label="Agency / firm name (or “Individual”)" value={agent.agency} onChangeText={(v) => setAgent({ ...agent, agency: v })} placeholder="e.g. Prime Realty Advisors" error={errors.agency} />
          <TextField label="MahaRERA agent no." value={agent.reraAgent} onChangeText={(v) => setAgent({ ...agent, reraAgent: v })} autoCapitalize="characters" placeholder="A5XXXXXXXXXX" error={errors.reraAgent} />
          <TextField label="Areas you work in" value={agent.areas} onChangeText={(v) => setAgent({ ...agent, areas: v })} placeholder="Mundhwa, Kharadi" error={errors.areas} />
        </View>
      )}

      <TextField label="Password" value={password} onChangeText={setPassword} password autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" error={errors.password} />
      {role !== 'buyer' ? (
        <View style={styles.verify}>
          <Text style={styles.verifyText}>We verify your RERA number on the MahaRERA website before your account gets full access, usually within one working day.</Text>
        </View>
      ) : null}
      <Checkbox checked={terms} onChange={setTerms} label="I agree to the Terms & Privacy Policy and to be contacted on WhatsApp." />
      <View style={styles.links}>
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(siteLink('/terms'))} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.link}>Read the Terms</Text>
        </Pressable>
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(siteLink('/privacy'))} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.link}>Read the Privacy Policy</Text>
        </Pressable>
      </View>
      {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}
      {formError ? <ErrorBox text={formError} /> : null}
      <Button title="Continue — verify email" onPress={() => void sendCode()} loading={busy} style={styles.gap} />
      <Button title="I already have an account" variant="ghost" onPress={() => router.replace('/auth/sign-in')} style={styles.gap} />
    </Screen>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4, marginBottom: 18 },
  group: { marginTop: 4, marginBottom: 8, padding: 14, borderRadius: radius.md, backgroundColor: colors.land, borderWidth: 1, borderColor: colors.line },
  groupSub: { marginBottom: 12 },
  verify: { backgroundColor: colors.water50, padding: 12, borderRadius: radius.md, marginBottom: 8 },
  verifyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink },
  links: { flexDirection: 'row', gap: 18, marginLeft: 32, marginBottom: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest, paddingVertical: 6 },
  fieldError: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13, marginTop: 4 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginTop: 12 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 10 },
});
