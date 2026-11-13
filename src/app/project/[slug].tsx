import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { apiUrl } from '@/constants/config';
import { copyText } from '@/lib/clipboard';
import { usePrefAsk } from '@/providers/PrefAskProvider';
import { openUrl } from '@/lib/openLink';
import { Chip, StatusBadge } from '@/components/ProjectBits';
import { ProjectCard } from '@/components/ProjectCard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { callUrl, directionsUrl, WHATSAPP_NUMBER, whatsappProjectUrl } from '@/constants/contact';
import { listStatusLabel, mapStatusLabel, STATUS_ROUTES } from '@/constants/status';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { cityOf, relatedProjects, typeLabel } from '@/lib/entities';
import { CITY_LABELS, hasCityHub } from '@/lib/city';
import { isFieldOn, reraNumbers, shown, uspPoints, visibleCustomFields } from '@/lib/fieldVisibility';
import { displayPlaceName } from '@/lib/developerName';
import { localitiesOf } from '@/lib/locality';
import { projectFaqs, projectSummary, publicFacts } from '@/lib/projectMeta';
import { reraRegistry } from '@/lib/rera';
import { slugify } from '@/lib/slug';
import { youtubeId, youtubeThumb, youtubeWatchUrl } from '@/lib/youtube';
import { findPinBySlug, usePins, useQuickView } from '@/hooks/usePublicData';
import { projectShareUrl, useProjectActions } from '@/hooks/useProjectActions';
import { useCompare, useFavorites } from '@/hooks/useSavedList';
import { isAgent, isBuyer, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { hasCoords, withWidth } from '@/services/publicData';
import type { Pin } from '@/types/models';

const fmtDate = (d?: string) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Website's details-panel tiles; a missing figure reads "On request". */
const FACT_TILES: [string, RegExp][] = [
  ['Land parcel', /land|acre|parcel/i],
  ['No. of towers', /tower|wing|building/i],
  ['No. of floors', /floor|storey|story/i],
  ['Total units', /unit|flat|apartment/i],
];
const abs = (u: string) => (u ? apiUrl(u) : '');
const askOnWhatsApp = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`${text} (Mappingg).`)}`;

export default function ProjectScreen() {
  const { slug = '', enquiry, via, visit } = useLocalSearchParams<{ slug: string; enquiry?: string; via?: string; visit?: string }>();
  const router = useRouter();
  const pinsQ = usePins();
  const pin = findPinBySlug(pinsQ.data, String(slug));

  if (pinsQ.isPending) return <LoadingState />;
  if (pinsQ.isError && !pinsQ.data) return <ErrorState error={pinsQ.error} onRetry={() => void pinsQ.refetch()} />;
  if (!pin) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <EmptyState icon="business-outline" title="Project not found" text="It may have been removed or is no longer public." action={{ title: 'Browse projects', onPress: () => router.replace('/projects') }} />
      </>
    );
  }
  return <ProjectBody pin={pin} all={pinsQ.data || []} enquiry={enquiry} via={via} visit={visit} refreshing={pinsQ.isRefetching} onRefresh={() => void pinsQ.refetch()} />;
}

function ProjectBody({
  pin,
  all,
  enquiry,
  via,
  visit,
  refreshing,
  onRefresh,
}: {
  pin: Pin;
  all: Pin[];
  enquiry?: string;
  via?: string;
  visit?: string;
  refreshing: boolean;
  onRefresh(): void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user, status } = useAuth();
  const { enquireAbout, share, busyId } = useProjectActions();
  const compare = useCompare(toast);
  const favorites = useFavorites(toast);
  const prefAsk = usePrefAsk();
  const [imgFailed, setImgFailed] = useState(false);
  const qv = useQuickView(pin.number).data || null;
  const { width } = useWindowDimensions();

  // Opening a project counts towards the buyer's "What are you looking for?" prompt.
  useEffect(() => prefAsk.noteProject(pin.id), [pin.id, prefAsk]);

  const photos = (qv?.photos || []).map(abs).filter(Boolean);
  const vidUrl = pin.youtubeVideoUrl || qv?.video || '';
  // Project size (land · towers · floors · units): Projects Intake figures, else the pin's custom fields.
  const pubCustom = visibleCustomFields(pin);
  const sizeTiles = FACT_TILES.map(([k, re]) => {
    const fromQv = qv?.facts.find((f) => f.k === k)?.v;
    const fromPin = pubCustom.find((cf) => cf.label && re.test(cf.label) && cf.value)?.value;
    return { k, v: fromQv || fromPin || '' };
  });
  const hasSize = sizeTiles.some((t) => t.v);
  const brochureFile = qv?.brochure ? abs(qv.brochure) : '';
  const explore: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress(): void }[] = [
    {
      key: 'payment',
      label: 'Payment plan',
      icon: 'card-outline',
      onPress: () => void openUrl(qv?.paymentPlan ? abs(qv.paymentPlan) : askOnWhatsApp(`Hi, please share the payment plan of ${pin.title}`)),
    },
    {
      key: 'floor',
      label: qv?.floorPlans.length && qv.floorPlans.length > 1 ? `Floor plans (${qv.floorPlans.length})` : 'Floor plans',
      icon: 'grid-outline',
      onPress: () => {
        const plans = (qv?.floorPlans || []).map(abs);
        if (!plans.length) return void openUrl(askOnWhatsApp(`Hi, please share the floor plans of ${pin.title}`));
        if (plans.length === 1) return void WebBrowser.openBrowserAsync(plans[0]!).catch(() => openUrl(plans[0]!));
        Alert.alert('Floor plans', undefined, [
          ...plans.slice(0, 8).map((u, i) => ({ text: `Floor plan ${i + 1}`, onPress: () => void WebBrowser.openBrowserAsync(u).catch(() => openUrl(u)) })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      },
    },
    {
      key: 'brochure',
      label: 'Brochure',
      icon: 'document-text-outline',
      onPress: () => {
        if (pin.hasBrochure) return router.push({ pathname: '/brochure/[id]', params: { id: pin.id, title: pin.title } });
        if (brochureFile) return void WebBrowser.openBrowserAsync(brochureFile).catch(() => openUrl(brochureFile));
        void openUrl(askOnWhatsApp(`Hi, please share the brochure of ${pin.title}`));
      },
    },
    {
      key: 'tour',
      label: '360° tour',
      icon: 'cube-outline',
      onPress: () =>
        qv?.tour360 ? void WebBrowser.openBrowserAsync(qv.tour360).catch(() => openUrl(qv.tour360)) : void openUrl(askOnWhatsApp(`Hi, please share the 360° tour of ${pin.title}`)),
    },
  ];

  const copyLink = async () => {
    if (await copyText(projectShareUrl(pin))) toast('Link copied');
  };

  const loc = pin.locality;
  const cityKey = cityOf(pin);
  const city = CITY_LABELS[cityKey];
  const sold = pin.status === 'sold';
  const vid = youtubeId(vidUrl);
  const rera = reraNumbers(pin);
  // The registry that issued the number (MahaRERA, RERA Karnataka, Haryana RERA…), with its website.
  const reg = rera.length ? reraRegistry(rera[0]) : null;
  const pinUsp = uspPoints(pin);
  const usp = pinUsp.length ? pinUsp : qv?.highlights || [];
  const about = pin.description || qv?.about || '';
  const cover = withWidth(pin.image, 1000);

  const facts: [string, string][] = sold
    ? []
    : ([
        ['Starting price', shown(pin, 'price', pin.price)],
        ['Configuration', shown(pin, 'configuration', pin.configuration)],
        ['Carpet area', shown(pin, 'configuration', pin.sqft ? `${pin.sqft}${/sq/i.test(pin.sqft) ? '' : ' sq.ft'}` : '')],
        pin.status === 'upcoming' ? ['Launch', shown(pin, 'possession', pin.launchDate)] : ['Possession', shown(pin, 'possession', pin.possessionTimeline)],
        ["What's available", pin.whatsAvailable],
      ] as [string, string][]).filter(([, v]) => v);

  const specs: [string, string][] = ([
    ['Developer', shown(pin, 'developer', pin.developer)],
    ['Status', isFieldOn(pin, 'status') ? listStatusLabel(pin.status) : ''],
    ['Property type', shown(pin, 'type', pin.type)],
    ['Location', shown(pin, 'location', pin.location)],
    ...visibleCustomFields(pin).map((cf) => [cf.label || '', cf.value || ''] as [string, string]),
  ] as [string, string][]).filter(([k, v]) => k && v);

  const statusRoute = STATUS_ROUTES.find((r) => (r.match as readonly string[]).includes(pin.status));
  const links: { label: string; kind: string; slug: string }[] = [
    ...(pin.developer && isFieldOn(pin, 'developer') ? [{ label: `More by ${pin.developer}`, kind: 'developer', slug: slugify(pin.developer) }] : []),
    ...(statusRoute ? [{ label: `${statusRoute.label} projects`, kind: 'status', slug: statusRoute.slug }] : []),
    ...(pin.type ? [{ label: `${typeLabel(pin.type)} projects`, kind: 'type', slug: slugify(pin.type) }] : []),
    ...localitiesOf(pin.location).map((l) => ({ label: `All projects in ${displayPlaceName(l) || l}`, kind: 'locality', slug: slugify(l) })),
    ...(hasCityHub(cityKey) ? [{ label: `Real estate in ${city}`, kind: 'city', slug: cityKey }] : []),
  ];
  const related = relatedProjects(pin, all.filter((p) => p.isProject));

  // Facts-only overview and FAQs, same text as the website's project page; every
  // answer comes from a field shown here (src/lib/projectMeta.ts).
  const pub = publicFacts(pin);
  const overview = projectSummary(pub, loc, city, {
    sameLocality: loc ? all.filter((p) => p.isProject && p.number !== pin.number && p.locality === loc).length : 0,
    sameDeveloper: pub.developer ? all.filter((p) => p.isProject && p.number !== pin.number && p.developer === pin.developer).length : 0,
  });
  const faqs = projectFaqs(pub, loc, city);

  const signedIn = status === 'signedIn';

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen options={{ title: isFieldOn(pin, 'name') ? pin.title : 'Project' }} />

      {enquiry === 'visit' ? (
        <View style={styles.enqNote} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={styles.enqText}>
            <Text style={styles.bold}>Site visit booked{visit ? ` — ${visit}` : ''}. </Text>
            Our team will confirm your visit{via ? ` on WhatsApp (${via})` : ' by email'}.
          </Text>
        </View>
      ) : enquiry === 'sent' || enquiry === 'already' ? (
        <View style={styles.enqNote} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={styles.enqText}>
            <Text style={styles.bold}>{enquiry === 'already' ? 'You have already enquired. ' : 'Enquiry sent. '}</Text>
            Our team will contact you{via ? ` on WhatsApp (${via})` : ' by email'}.
          </Text>
        </View>
      ) : null}

      {photos.length ? (
        <Gallery photos={photos} width={width - 32} title={pin.title} />
      ) : cover && !imgFailed ? (
        <Image source={{ uri: cover }} style={styles.cover} contentFit="contain" onError={() => setImgFailed(true)} accessibilityLabel={`${pin.title}${pin.developer ? ` by ${pin.developer}` : ''}`} />
      ) : null}

      <AppText variant="eyebrow">{[loc, city].filter(Boolean).join(' · ') || 'Project'}</AppText>
      <AppText variant="display" style={styles.title}>
        {isFieldOn(pin, 'name') ? pin.title : 'Project'}
      </AppText>
      <View style={styles.chips}>
        {isFieldOn(pin, 'status') ? <StatusBadge status={pin.status} label={mapStatusLabel(pin.status)} /> : null}
        {shown(pin, 'type', pin.type) ? <Chip text={pin.type} /> : null}
      </View>
      <View style={styles.meta}>
        {shown(pin, 'developer', pin.developer) ? <Text style={styles.metaText}>🏢 {pin.developer}</Text> : null}
        {shown(pin, 'location', pin.location) ? <Text style={styles.metaText}>📍 {pin.location}</Text> : null}
      </View>
      {pin.updatedAt ? <Text style={styles.updated}>Last updated: {fmtDate(pin.updatedAt)}</Text> : null}

      {sold ? (
        <View style={styles.sold}>
          <Text style={styles.soldText}>This project is sold out. Tap WhatsApp to hear about similar projects nearby.</Text>
        </View>
      ) : null}

      {facts.length ? (
        <View style={styles.facts}>
          {facts.map(([k, v]) => (
            <View key={k} style={[styles.fact, k === "What's available" && styles.factWide]}>
              <Text style={styles.factLabel}>{k}</Text>
              <Text style={styles.factValue}>{v}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {hasSize && !sold ? (
        <View style={styles.sizeRow}>
          {sizeTiles.map((t) => (
            <View key={t.k} style={styles.sizeTile}>
              <Text style={styles.sizeV} numberOfLines={2}>
                {t.v || 'On request'}
              </Text>
              <Text style={styles.sizeK} numberOfLines={1}>
                {t.k}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {qv?.green ? (
        <View style={styles.green}>
          <Ionicons name="leaf" size={16} color={colors.park} />
          <Text style={styles.greenText}>{qv.green}</Text>
        </View>
      ) : null}

      {rera.length ? (
        <View style={styles.rera}>
          <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          <View style={styles.flex}>
            <Text style={styles.reraLabel}>{reg?.name || 'RERA'} registration</Text>
            <Text style={styles.reraNo} selectable>
              {rera.join('  ')}
            </Text>
          </View>
          {reg?.url ? (
            <Pressable onPress={() => void openUrl(reg.url)} accessibilityRole="link" accessibilityLabel={`Verify on the ${reg.name} website`} style={styles.reraBtn}>
              <Text style={styles.reraBtnText}>Verify ↗</Text>
            </Pressable>
          ) : null}
        </View>
      ) : shown(pin, 'rera', pin.reraNumber) ? (
        <View style={styles.rera}>
          <Ionicons name="document-text-outline" size={20} color={colors.muted} />
          <View style={styles.flex}>
            <Text style={styles.reraLabel}>RERA registration</Text>
            <Text style={styles.reraNo} selectable>
              {pin.reraNumber}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {isFieldOn(pin, 'enquire') ? (
          <Button
            title={signedIn ? 'Enquire now' : 'Enquire about this project'}
            icon="mail-unread-outline"
            loading={busyId === pin.id}
            onPress={() => void enquireAbout(pin)}
            accessibilityHint={signedIn ? 'Sends an enquiry from your account' : 'Opens the contact form'}
          />
        ) : null}
        <View style={styles.actionRow}>
          {isFieldOn(pin, 'whatsapp') ? <Small icon="logo-whatsapp" label="WhatsApp" color={colors.whatsapp} onPress={() => void openUrl(whatsappProjectUrl(pin.title))} /> : null}
          <Small icon="call" label="Call" onPress={() => void openUrl(callUrl())} />
          {hasCoords(pin) ? <Small icon="navigate" label="Directions" onPress={() => void openUrl(directionsUrl(pin.lat, pin.lng))} /> : null}
          <Small icon="share-social" label="Share" onPress={() => void share(pin)} />
        </View>
        <View style={styles.actionRow}>
          {!sold ? (
            <Small
              icon="calendar-outline"
              label="Book site visit"
              onPress={() => router.push({ pathname: '/site-visit', params: { pinId: pin.id, slug: pin.slug, title: pin.title } })}
            />
          ) : null}
          <Small icon="link-outline" label="Copy link" onPress={() => void copyLink()} />
          {pin.hasBrochure ? <Small icon="document-text-outline" label="Brochure" onPress={() => router.push({ pathname: '/brochure/[id]', params: { id: pin.id, title: pin.title } })} /> : null}
        </View>
        <View style={styles.actionRow}>
          {hasCoords(pin) ? <Small icon="map" label="See on live map" onPress={() => router.navigate({ pathname: '/map', params: { pin: pin.id } })} /> : null}
          {signedIn && isBuyer(user) ? (
            <Small icon={compare.pins.includes(pin.id) ? 'git-compare' : 'git-compare-outline'} label={compare.pins.includes(pin.id) ? 'In compare' : 'Compare'} active={compare.pins.includes(pin.id)} onPress={() => compare.toggle(pin.id)} />
          ) : null}
          {signedIn && isAgent(user) ? (
            <Small icon={favorites.pins.includes(pin.id) ? 'heart' : 'heart-outline'} label={favorites.pins.includes(pin.id) ? 'Saved' : 'Favourite'} active={favorites.pins.includes(pin.id)} onPress={() => favorites.toggle(pin.id)} />
          ) : null}
        </View>
      </View>

      {usp.length ? (
        <Section title="Highlights">
          {usp.map((s, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.body}>{s}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {vid ? (
        <Section title="Project walkthrough">
          <Pressable onPress={() => void openUrl(youtubeWatchUrl(vid))} accessibilityRole="link" accessibilityLabel={`Watch the ${pin.title} walkthrough on YouTube`}>
            <Image source={{ uri: youtubeThumb(vid) }} style={styles.video} contentFit="cover" />
            <View style={styles.play}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
          </Pressable>
        </Section>
      ) : null}

      {overview.length ? (
        <Section title={`${pin.title} overview`}>
          <Text style={styles.body} selectable>
            {overview.join(' ')}
          </Text>
        </Section>
      ) : null}

      {qv?.units.length && !sold ? (
        <Section title="Configuration · carpet area · price">
          {qv.units.map((u, i) => (
            <Pressable
              key={`${u.config}-${i}`}
              onPress={() => void openUrl(askOnWhatsApp(`Hi, please share price and availability of ${u.config} in ${pin.title}`))}
              accessibilityRole="link"
              accessibilityLabel={`${u.config}, ${u.area || 'area on request'}, ${u.price || 'price on request'}. Ask on WhatsApp`}
              style={styles.unit}
            >
              <Text style={styles.unitCfg}>{u.config}</Text>
              <Text style={styles.unitArea}>{u.area || '—'}</Text>
              <Text style={styles.unitPrice}>{u.price || 'On request'}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </Section>
      ) : null}

      {about ? (
        <Section title={`About ${pin.title}`}>
          <Text style={styles.body} selectable>
            {about}
          </Text>
        </Section>
      ) : null}

      {!sold ? (
        <Section title="Explore more">
          <View style={styles.exploreGrid}>
            {explore.map((x) => (
              <Pressable key={x.key} onPress={x.onPress} accessibilityRole="button" accessibilityLabel={x.label} style={({ pressed }) => [styles.explore, pressed && { opacity: 0.8 }]}>
                <Ionicons name={x.icon} size={22} color={colors.forest} />
                <Text style={styles.exploreText} numberOfLines={1}>
                  {x.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {specs.length ? (
        <Section title="Project details">
          {specs.map(([k, v]) => (
            <View key={k} style={styles.spec}>
              <Text style={styles.specK}>{k}</Text>
              <Text style={styles.specV} selectable>
                {v}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      {links.length ? (
        <Section title="Explore related">
          <View style={styles.pills}>
            {links.map((l) => (
              <Pressable key={`${l.kind}-${l.slug}`} onPress={() => router.push({ pathname: '/browse/[kind]/[slug]', params: { kind: l.kind, slug: l.slug } })} accessibilityRole="link" style={styles.pill}>
                <Text style={styles.pillText}>{l.label}</Text>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {related.length ? (
        <Section title={loc ? `Other projects in ${loc}` : 'Related projects'}>
          {related.map((p) => (
            <ProjectCard key={p.id} pin={p} />
          ))}
        </Section>
      ) : null}

      {faqs.length ? (
        <Section title="Frequently asked questions">
          {faqs.map((f) => (
            <Faq key={f.q} q={f.q} a={f.a} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

/** Photo gallery (website: big box + "1/N" count): swipe through the project's photos. */
function Gallery({ photos, width, title }: { photos: string[]; width: number; title: string }) {
  const [index, setIndex] = useState(0);
  const w = Math.max(200, width);
  return (
    <View style={styles.gallery}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / w))}
        accessibilityLabel={`${title} photos`}
      >
        {photos.map((u, i) => (
          <Image key={u} source={{ uri: /[?&]w=\d/.test(u) ? u : withWidth(u, 1000) || u }} style={[styles.galleryImg, { width: w }]} contentFit="cover" accessibilityLabel={`${title} photo ${i + 1} of ${photos.length}`} />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.galleryCount}>
          <Text style={styles.galleryCountText}>
            {Math.min(index + 1, photos.length)}/{photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" style={styles.sectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faq}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.faqQ}>
        <Text style={styles.faqQText}>{q}</Text>
        <Ionicons name={open ? 'remove' : 'add'} size={18} color={colors.forest} />
      </Pressable>
      {open ? <Text style={styles.body}>{a}</Text> : null}
    </View>
  );
}

function Small({ icon, label, onPress, color, active }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void; color?: string; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} style={[styles.small, active && styles.smallOn]}>
      <Ionicons name={icon} size={20} color={active ? colors.forest : color || colors.ink} />
      <Text style={[styles.smallText, active && { color: colors.forest }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  enqNote: { flexDirection: 'row', gap: 10, backgroundColor: colors.successBg, padding: 12, borderRadius: radius.md, marginBottom: 14 },
  enqText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  cover: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: colors.land, marginBottom: 16 },
  title: { marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  meta: { marginTop: 10, gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  updated: { marginTop: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  sold: { marginTop: 14, padding: 12, backgroundColor: colors.earth50, borderRadius: radius.md },
  soldText: { fontFamily: fonts.medium, fontSize: 14, color: colors.earth },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  fact: { flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: radius.md, backgroundColor: colors.land, borderWidth: 1, borderColor: colors.line },
  factWide: { flexBasis: '100%' },
  factLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  factValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  rera: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#cfe6c6', backgroundColor: colors.park50 },
  reraLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.park },
  reraNo: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  reraBtn: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 6 },
  reraBtnText: { fontFamily: fonts.semibold, color: colors.forest },
  actions: { marginTop: 18, gap: 10 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: {
    flexGrow: 1,
    flexBasis: '22%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  smallOn: { backgroundColor: colors.forestTint, borderColor: colors.forest },
  smallText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  section: { marginTop: 24 },
  sectionTitle: { marginBottom: 10 },
  body: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.text },
  bullet: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bulletDot: { fontFamily: fonts.bold, fontSize: 15, color: colors.park },
  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: '#000' },
  play: { position: 'absolute', top: '40%', alignSelf: 'center', width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  spec: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  specK: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, flexShrink: 0, maxWidth: '45%' },
  specV: { flex: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.forestTint },
  pillText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  gallery: { marginBottom: 16, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.land },
  galleryImg: { aspectRatio: 16 / 10 },
  galleryCount: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.6)' },
  galleryCountText: { fontFamily: fonts.semibold, fontSize: 12, color: '#fff' },
  sizeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  sizeTile: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  sizeV: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center' },
  sizeK: { marginTop: 2, fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  green: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.park50 },
  greenText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.park },
  unit: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  unitCfg: { flex: 1.1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  unitArea: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  unitPrice: { flex: 1, textAlign: 'right', fontFamily: fonts.bold, fontSize: 14, color: colors.forest },
  exploreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  explore: { flexGrow: 1, flexBasis: '45%', minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  exploreText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  faq: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 8 },
  faqQ: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
