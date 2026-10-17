import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { useToast } from '@/providers/ToastProvider';
import { createMyProject, getMyProjects, updateMyProject, type DeveloperProjectInput, type DeveloperStatus } from '@/services/account';
import { errorMessage } from '@/services/api/errors';
import type { DeveloperProject } from '@/types/models';

// Same fields and choices as the website's developer project form.
const STATUSES: { value: DeveloperStatus; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'under_construction', label: 'Under construction' },
  { value: 'available', label: 'Available' },
  { value: 'sold', label: 'Sold' },
];
const TYPES = ['Residential', 'Commercial', 'Mixed-Use', 'Land Parcel'];
const EMPTY = { title: '', location: '', type: 'Residential', status: 'upcoming' as DeveloperStatus, price: '', configuration: '', description: '', lat: '', lng: '' };

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery({ queryKey: ['me', 'projects'], queryFn: getMyProjects, enabled: !!id });
  if (id && q.isPending) return <LoadingState />;
  if (id && q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const existing = id ? q.data?.find((x) => x.id === id) : undefined;
  if (id && !existing) return <EmptyState title="Project not found" text="It may have been removed." />;
  return <ProjectForm id={id} initial={existing ? toForm(existing) : EMPTY} />;
}

function toForm(p: DeveloperProject): typeof EMPTY {
  const status = (STATUSES.find((s) => s.value === p.status)?.value || (p.status === 'construction' ? 'under_construction' : 'upcoming')) as DeveloperStatus;
  return {
    title: p.title,
    location: p.location,
    type: p.type || 'Residential',
    status,
    price: p.price,
    configuration: p.configuration,
    description: p.description,
    lat: p.lat != null ? String(p.lat) : '',
    lng: p.lng != null ? String(p.lng) : '',
  };
}

function ProjectForm({ id, initial }: { id?: string; initial: typeof EMPTY }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fillMyLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        toast('Location permission is needed to fill this in.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
    } catch {
      toast('Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    setError('');
    if (form.title.trim().length < 2) return setError('Please fill in a project name.');
    const lat = form.lat.trim() ? Number(form.lat) : undefined;
    const lng = form.lng.trim() ? Number(form.lng) : undefined;
    if ((lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
      return setError('Latitude must be between -90 and 90, longitude between -180 and 180.');
    }
    if ((lat === undefined) !== (lng === undefined)) return setError('Enter both latitude and longitude, or leave both empty.');
    const input: DeveloperProjectInput = {
      title: form.title.trim(),
      location: form.location.trim(),
      type: form.type,
      status: form.status,
      price: form.price.trim(),
      configuration: form.configuration.trim(),
      description: form.description.trim(),
      ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
    };
    setBusy(true);
    try {
      if (id) await updateMyProject(id, input);
      else await createMyProject(input);
      await qc.invalidateQueries({ queryKey: ['me', 'projects'] });
      void qc.invalidateQueries({ queryKey: ['me', 'notifications'] });
      toast('Sent for review — it goes live once the Mappingg team approves it');
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit project' : 'Add a project' }} />
      <View style={styles.info}>
        <Text style={styles.infoText}>Every change is checked by the Mappingg team before it appears on the public map.</Text>
      </View>
      <TextField label="Project name" value={form.title} onChangeText={(v) => set('title', v)} maxLength={160} />
      <TextField label="Location" optional value={form.location} onChangeText={(v) => set('location', v)} placeholder="e.g. Mundhwa, Pune" maxLength={160} />
      <SelectField label="Property type" value={form.type} options={TYPES} onChange={(v) => set('type', v)} />
      <SelectField label="Status" value={form.status} options={STATUSES} onChange={(v) => set('status', v as DeveloperStatus)} />
      <TextField label="Price" optional value={form.price} onChangeText={(v) => set('price', v)} placeholder="e.g. ₹ 1.2 Cr onwards" maxLength={80} />
      <TextField label="Configuration" optional value={form.configuration} onChangeText={(v) => set('configuration', v)} placeholder="e.g. 2, 3 BHK" maxLength={120} />
      <TextField label="Description" optional value={form.description} onChangeText={(v) => set('description', v)} multiline maxLength={4000} />
      <AppText variant="label">Map location (optional — the team can place it on review)</AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Latitude" value={form.lat} onChangeText={(v) => set('lat', v)} keyboardType="numeric" />
        </View>
        <View style={styles.flex}>
          <TextField label="Longitude" value={form.lng} onChangeText={(v) => set('lng', v)} keyboardType="numeric" />
        </View>
      </View>
      <Button title="Use my current location" variant="ghost" icon="locate" onPress={() => void fillMyLocation()} loading={locating} />
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <Button title={id ? 'Save and send for review' : 'Add and send for review'} onPress={() => void save()} loading={busy} style={styles.gap} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: { backgroundColor: colors.water50, padding: 12, borderRadius: radius.md, marginBottom: 16 },
  infoText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  flex: { flex: 1 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginTop: 10 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 12 },
});
