import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { AuthHeader } from '@/components/ui/AuthHeader';
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
import { ApiError, errorMessage } from '@/services/api/errors';
import { requestOtp, SIGNUP_OPTIONS, type SignupInput, type SignupRole } from '@/services/auth';
import { rememberSignupPlan } from '@/hooks/useSignupPlan';
import { useToast } from '@/providers/ToastProvider';
import { usePlansQuery } from '@/hooks/useSubscriptionsEnabled';
import { categoryForRole, formatInr, type PublicPlan } from '@/services/subscriptions';

// Same fields and rules as the website's "Create account" form: buyers give
// name, WhatsApp, email and password; developers and agents also their company
// + RERA details (all required except a developer's website). The account is
// created directly; a WhatsApp code is asked for only while the server requires it.

const ROLES = [
  { value: 'buyer', label: 'Buyer / Investor' },
  { value: 'developer', label: 'Developer / Builder' },
  { value: 'agent', label: 'Agent / Channel Partner' },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERIOD_SHORT: Record<string, string> = { month: '/month', quarter: '/quarter', half_year: '/6 months', year: '/year' };
const ROLE_NAME: Record<SignupRole, string> = { buyer: 'Buyer', developer: 'Developer', agent: 'Channel Partner' };
const isRole = (v: unknown): v is SignupRole => v === 'buyer' || v === 'developer' || v === 'agent';

export default function SignUpScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ role?: string; plan?: string }>();
  const { signUp } = useAuth();
  const [role, setRole] = useState<SignupRole>(isRole(params.role) ? params.role : 'buyer');
  // Plan picker (website: sign-up form): Free by default, or any paid plan of this account type.
  // Hidden while the subscription master switch is off (website: same) — accounts start as before.
  const plansQ = usePlansQuery();
  const plansOn = !!plansQ.data && plansQ.data.enabled !== false;
  const [planCode, setPlanCode] = useState(String(params.plan || '').slice(0, 40));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState({ code: DEFAULT_CODE, number: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [dev, setDev] = useState({ company: '', designation: '', activeProjects: '', reraProject: '', website: '' });
  const [agent, setAgent] = useState({ agency: '', reraAgent: '', areas: '' });
  const [ticket, setTicket] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const rolePlans = (plansQ.data?.plans || []).filter((p) => p.category === categoryForRole(role)).sort((a, b) => a.sort - b.sort);
  const freePlan = rolePlans.find((p) => p.is_free);
  const chosenPlan: PublicPlan | undefined = plansOn && planCode ? rolePlans.find((p) => p.code === planCode && !p.is_free) : undefined;
  // A deep-linked plan of another account type simply counts as Free (chosenPlan is undefined).

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter your name.';
    if (!isValidNumber(phone.number)) e.phone = PHONE_ERROR;
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    if (role === 'developer') {
      if (!dev.company.trim()) e.company = 'Required';
      if (!dev.designation) e.designation = 'Required';
      if (!dev.activeProjects) e.activeProjects = 'Required';
      if (dev.reraProject.trim().length < 4) e.reraProject = 'Enter a MahaRERA project number.';
    } else if (role === 'agent') {
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
    setBusy(true);
    try {
      const sent = await requestOtp({ email: email.trim().toLowerCase(), mobile: formatPhone(phone.code, phone.number) }, 'signup', name.trim());
      setSentTo(sent.to);
      setTicket(sent.ticket);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** "Create account": straight away with email + password. Only if the server
   *  insists on verifying the WhatsApp number does it ask for a code. */
  const createNow = async () => {
    setFormError('');
    if (!validate()) {
      setFormError('Please fill in all required fields.');
      return;
    }
    await create(true);
  };

  const create = async (direct = false) => {
    setFormError('');
    if (!direct && !/^\d{6}$/.test(otp.trim())) return setFormError('Enter the 6-digit code we sent on WhatsApp.');
    const base = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobile: formatPhone(phone.code, phone.number),
      password,
      otp: direct ? '' : otp.trim(),
      ticket: direct ? '' : ticket,
    };
    const plan = chosenPlan?.code || '';
    const input: SignupInput =
      role === 'buyer'
        ? // Buyers' preferences are no longer asked here (website, Oct 2026): the live map asks later.
          { ...base, role, profile: { area: '', configuration: '', budget: '', timeline: '', purpose: '', plan } }
        : role === 'developer'
          ? { ...base, role, profile: { ...dev, company: dev.company.trim(), reraProject: dev.reraProject.trim(), website: dev.website.trim(), plan } }
          : { ...base, role, profile: { agency: agent.agency.trim(), reraAgent: agent.reraAgent.trim(), areas: agent.areas.trim(), plan } };
    setBusy(true);
    try {
      const created = await signUp(input);
      await rememberSignupPlan(created.email || created.mobile || base.email, plan);
      router.dismissAll();
      // A paid plan picked on the form: buyers go straight to its checkout; developers /
      // channel partners pay after RERA verification (website: same).
      if (chosenPlan && role === 'buyer') {
        router.replace('/');
        router.push({ pathname: '/subscription', params: { plan: chosenPlan.code } });
        return;
      }
      if (chosenPlan) toast(`You picked ${chosenPlan.name}. We’ll verify your RERA number shortly — then open My plan to activate it. Until then you’re on the Free plan.`);
      router.replace(role === 'buyer' ? '/' : '/account');
    } catch (e) {
      if (direct && e instanceof ApiError && e.code === 'otp') {
        // The server still verifies new numbers: send the code and show that step.
        setBusy(false);
        await sendCode();
        return;
      }
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <Screen>
        <AuthHeader title="One last step" subtitle={`We sent a 6-digit code on WhatsApp to ${sentTo}. Enter it to finish creating your account.`} />
        {formError ? <ErrorBox text={formError} /> : null}
        <TextField label="Verification code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="6-digit code" />
        <Button title="Verify & create account" onPress={() => void create(false)} loading={busy} />
        <Button title="Resend code" variant="ghost" onPress={() => void sendCode()} disabled={busy} style={styles.gap} />
        <Button title="Change my details" variant="ghost" onPress={() => setTicket('')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AuthHeader title="Create your account" subtitle="Free forever. Explore every project on the live map." />
      <ChoicePills label="I am a" options={ROLES} value={role} onChange={(v) => setRole(v as SignupRole)} />
      <AppText style={styles.sub}>
        {role === 'buyer' ? 'Your name, WhatsApp number, email and a password.' : 'All fields are needed so we can verify your RERA details.'}
      </AppText>
      <TextField label="Full name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
      <PhoneField label="WhatsApp number" code={phone.code} number={phone.number} onChange={(code, number) => setPhone({ code, number })} error={errors.phone} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />

      {role === 'buyer' ? null : role === 'developer' ? (
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

      {plansOn ? (
        <View style={styles.group}>
          <AppText variant="label">Your {ROLE_NAME[role]} plan</AppText>
          <View style={styles.tiles}>
            <PlanTile on={!chosenPlan} name={freePlan?.name || 'Free'} price="₹0" sub={freePlan?.tagline || 'Start free'} onPress={() => setPlanCode('')} />
            {rolePlans
              .filter((p) => !p.is_free)
              .map((p) => (
                <PlanTile
                  key={p.code}
                  on={chosenPlan?.code === p.code}
                  name={p.name}
                  star={p.recommended}
                  price={`${formatInr(p.price_paise)}${p.billing_unit === 'project' ? '/project' : ''}${PERIOD_SHORT[p.billing_period] || ''}`}
                  sub={p.tagline}
                  onPress={() => setPlanCode(p.code)}
                />
              ))}
          </View>
          <Text style={styles.planNote}>
            {!chosenPlan
              ? `${plansQ.data && !plansQ.data.plans.length ? 'Plans could not be loaded — your account starts on Free. ' : 'Every account starts on Free. '}`
              : role === 'buyer'
                ? `After your account is created you go straight to secure payment for ${chosenPlan.name}. `
                : `Your account starts on Free. Once we verify your RERA number you can pay for ${chosenPlan.name} from My plan. `}
            <Text style={styles.link} onPress={() => router.push('/pricing')} accessibilityRole="link">
              {chosenPlan ? 'Compare plans' : 'Compare all plans'}
            </Text>
          </Text>
        </View>
      ) : null}
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
      <Button title="Create account" onPress={() => void createNow()} loading={busy} style={styles.gap} />
      <Button title="I already have an account" variant="ghost" onPress={() => router.replace('/auth/sign-in')} style={styles.gap} />
    </Screen>
  );
}

function PlanTile({ on, name, price, sub, star, onPress }: { on: boolean; name: string; price: string; sub?: string; star?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.tile, on && styles.tileOn]}>
      <Text style={[styles.tileName, on && styles.tileNameOn]}>
        {name}
        {star ? ' ★' : ''}
      </Text>
      <Text style={styles.tilePrice}>{price}</Text>
      {sub ? (
        <Text style={styles.tileSub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tile: { width: '48%', flexGrow: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 10, backgroundColor: '#fff', gap: 2 },
  tileOn: { borderColor: colors.forest, borderWidth: 2, backgroundColor: colors.forestTint },
  tileName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  tileNameOn: { color: colors.forest },
  tilePrice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.goldDeep },
  tileSub: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.muted },
  planNote: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.text, marginTop: 10 },
});
