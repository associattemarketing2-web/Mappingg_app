import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { apiUrl, config } from '@/constants/config';
import { colors, TOUCH } from '@/constants/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { isAgent, isStaff, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { brochurePath } from '@/services/account';

// "View brochure" — the website's brochure viewer (live map): the brochure
// (PDF or image, /api/brochure/<pin id>) is drawn page by page with pdf.js,
// with no PDF toolbar and no long-press "Save image". Approved channel
// partners and staff also get Download (?download=1 — the server re-checks).

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

function viewerHtml(src: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=4">
<style>html,body{margin:0;background:#2b2b2b;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
canvas,img{display:block;width:100%;height:auto;margin:0 0 8px;background:#fff;pointer-events:none}
#m{color:#fff;font:15px -apple-system,Roboto,sans-serif;text-align:center;padding:48px 20px;line-height:1.5}</style></head>
<body oncontextmenu="return false"><div id="m">Loading brochure…</div><div id="p"></div>
<script src="${PDFJS}pdf.min.js"></script>
<script>(async function(){
  var m=document.getElementById('m'), p=document.getElementById('p');
  try{
    var r=await fetch(${JSON.stringify(src)});
    if(!r.ok) throw new Error(r.status===404?'No brochure for this project yet.':'Could not load the brochure. Please try again.');
    var type=(r.headers.get('content-type')||'').split(';')[0];
    var buf=await r.arrayBuffer();
    if(type.indexOf('image/')===0){
      var img=new Image(); img.alt='Brochure'; img.src=URL.createObjectURL(new Blob([buf],{type:type})); p.appendChild(img); m.remove(); return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc=${JSON.stringify(`${PDFJS}pdf.worker.min.js`)};
    var doc=await pdfjsLib.getDocument({data:buf}).promise; m.remove();
    var w=window.innerWidth*Math.min(window.devicePixelRatio||1,2);
    for(var i=1;i<=doc.numPages;i++){
      var pg=await doc.getPage(i), v=pg.getViewport({scale:1}), vp=pg.getViewport({scale:w/v.width});
      var c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height; p.appendChild(c);
      await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
    }
  }catch(e){ m.textContent=(e&&e.message)||'Could not load the brochure. Please try again.'; }
})();</script></body></html>`;
}

export default function BrochureScreen() {
  const { id = '', title = '' } = useLocalSearchParams<{ id: string; title?: string }>();
  const { user, sessionToken } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const canDownload = isStaff(user) || (isAgent(user) && !!user?.verified);
  const html = useMemo(() => viewerHtml(apiUrl(brochurePath(String(id)))), [id]);

  const download = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const token = sessionToken();
      const base = String(title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project';
      const dest = new File(Paths.cache, `${Date.now()}-${base}-brochure`);
      const file = await File.downloadFileAsync(apiUrl(brochurePath(String(id), true)), dest, {
        headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {},
      });
      const mime = file.type || 'application/pdf';
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: `${title || 'Project'} brochure` });
      else toast('Brochure saved.');
    } catch {
      toast('Could not download the brochure. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: title ? `${title} brochure` : 'Brochure',
          headerRight: canDownload
            ? () => (
                <Pressable onPress={() => void download()} accessibilityRole="button" accessibilityLabel="Download brochure" hitSlop={8} style={styles.dl}>
                  {saving ? <ActivityIndicator color={colors.forest} /> : <Ionicons name="download-outline" size={22} color={colors.forest} />}
                </Pressable>
              )
            : undefined,
        }}
      />
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: config.apiBaseUrl }}
        style={styles.root}
        javaScriptEnabled
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2b2b2b' },
  dl: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
});
