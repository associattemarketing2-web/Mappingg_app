import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { config } from '@/constants/config';
import { colors, fonts, radius } from '@/constants/theme';
import { openUrl } from '@/lib/openLink';
import { youtubeThumb, youtubeWatchUrl } from '@/lib/youtube';

// A project's YouTube video, playing inline in the card. It starts on its own
// (muted, as phones only allow muted autoplay; tap the speaker to hear it) and
// loops. The embed is served from the website's origin because YouTube refuses
// to play embeds that have no referrer ("Error 153"). If the player can't load,
// the thumbnail is shown and a tap opens the video in YouTube.

const ORIGIN = config.siteUrl;

function embedHtml(id: string): string {
  const v = encodeURIComponent(id);
  const params = `autoplay=1&mute=1&playsinline=1&loop=1&playlist=${v}&rel=0&modestbranding=1&controls=1&enablejsapi=0&origin=${encodeURIComponent(ORIGIN)}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe src="https://www.youtube.com/embed/${v}?${params}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="Project video"></iframe></body></html>`;
}

// Only the player itself loads inside the card; any other link (the YouTube logo,
// "Watch on YouTube", channel name) opens in the YouTube app / browser instead.
const keepInside: WebViewProps['onShouldStartLoadWithRequest'] = (req) => {
  const url = req.url || '';
  if (url === 'about:blank' || url.startsWith(ORIGIN) || /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//.test(url)) return true;
  if (req.isTopFrame === false) return true;
  if (/^https?:/i.test(url)) void openUrl(url);
  return false;
};

export const YouTubePlayer = memo(function YouTubePlayer({ id, title }: { id: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => ({ html: embedHtml(id), baseUrl: ORIGIN }), [id]);
  const openInYouTube = () => void openUrl(youtubeWatchUrl(id));

  if (failed) {
    return (
      <Pressable onPress={openInYouTube} accessibilityRole="link" accessibilityLabel={`Watch the ${title} video on YouTube`} style={styles.frame}>
        <Image source={{ uri: youtubeThumb(id) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.play}>
          <Ionicons name="play" size={26} color="#fff" />
        </View>
      </Pressable>
    );
  }

  return (
    <View>
      <View style={styles.frame} accessible accessibilityLabel={`${title} video, playing muted`}>
        <WebView
          source={source}
          originWhitelist={['*']}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          nestedScrollEnabled={false}
          onShouldStartLoadWithRequest={keepInside}
          onLoadEnd={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onHttpError={(e) => {
            if (e.nativeEvent.url?.startsWith('https://www.youtube.com/embed/')) setFailed(true);
          }}
          onContentProcessDidTerminate={() => setFailed(true)}
          onRenderProcessGone={() => setFailed(true)}
        />
        {/* The thumbnail covers the black frame until the player has loaded. */}
        {!loaded ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image source={{ uri: youtubeThumb(id) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          </View>
        ) : null}
      </View>
      <Pressable onPress={openInYouTube} accessibilityRole="link" hitSlop={8} style={styles.link}>
        <Ionicons name="logo-youtube" size={16} color="#e62117" />
        <Text style={styles.linkText}>Open in YouTube</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, marginTop: 4 },
  linkText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
});
