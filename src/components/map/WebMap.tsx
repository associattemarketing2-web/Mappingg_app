import ExpoConstants from 'expo-constants';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { mapTiles, tileUserAgent } from '@/constants/mapTiles';
import { asPinStatus, STATUS_COLOR } from '@/constants/status';
import { colors } from '@/constants/theme';
import type { Bounds } from '@/lib/geo';
import type { Pin } from '@/types/models';
import type { Basemap, LiveMapHandle } from './LiveMap';

// A lightweight live map drawn with Leaflet inside a WebView. Used wherever the
// native MapLibre engine isn't in the build (Expo Go), so the map is always
// visible instead of a plain list. Pins only — infra & roads stay native-only.

interface Props {
  pins: Pin[];
  selectedId?: string | null;
  basemap?: Basemap;
  me?: { lat: number; lng: number } | null;
  /** Disable panning/zooming (e.g. a small preview card). */
  interactive?: boolean;
  onPinPress?(pin: Pin): void;
  onMapPress?(): void;
  onReady?(): void;
  onLoadError?(): void;
}

// react-native-webview 14.0.1 types its class as `never` under this TypeScript (see PanelWebView).
interface WebViewRef {
  injectJavaScript(script: string): void;
}
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewRef> }>;

const DEFAULT_CENTER = { lat: 18.5204, lng: 73.8567, zoom: 11 }; // Pune

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

function html(interactive: boolean): string {
  const street = mapTiles.street;
  const sat = mapTiles.satellite;
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="${LEAFLET}/leaflet.css"/>
<style>
html,body,#m{margin:0;padding:0;height:100%;width:100%;background:${colors.mapPaper}}
.leaflet-container{font-family:-apple-system,Roboto,sans-serif}
.pin{position:relative;width:34px;height:42px;transition:transform .2s}
.pin.sel{transform:scale(1.25);z-index:1000!important}
.pin svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.me{width:18px;height:18px;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 0 0 8px rgba(26,115,232,.2)}
.night .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.9) contrast(.9)}
.leaflet-control-attribution{font-size:9px}
</style></head><body><div id="m"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
(function(){
  function post(o){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  if(!window.L){ post({t:'error'}); return; }
  var interactive=${interactive ? 'true' : 'false'};
  var map=L.map('m',{zoomControl:false,attributionControl:true,dragging:interactive,touchZoom:interactive,
    doubleClickZoom:interactive,scrollWheelZoom:false,boxZoom:false,keyboard:false,tap:interactive})
    .setView([${DEFAULT_CENTER.lat},${DEFAULT_CENTER.lng}],${DEFAULT_CENTER.zoom});
  map.attributionControl.setPrefix(false);
  var street=L.tileLayer(${JSON.stringify(street.tiles[0])},{maxZoom:${street.maxzoom},attribution:${JSON.stringify(street.attribution)}});
  var sat=L.tileLayer(${JSON.stringify(sat.tiles[0])},{maxZoom:${sat.maxzoom},attribution:${JSON.stringify(sat.attribution)}});
  street.addTo(map);
  var current='map';
  var layer=L.layerGroup().addTo(map), markers={}, data={}, sel=null, meM=null;
  function svg(c){return '<svg width="34" height="42" viewBox="0 0 34 42"><path d="M17 41C17 41 32 26.5 32 16A15 15 0 0 0 2 16C2 26.5 17 41 17 41Z" fill="'+c+'" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16" r="10" fill="#fff"/><path d="M11.5 16.5 17 11.8l5.5 4.7v5.2h-3.6v-3.4h-3.8v3.4h-3.6z" fill="'+c+'"/></svg>';}
  function icon(p,on){return L.divIcon({className:'',html:'<div class="pin'+(on?' sel':'')+'">'+svg(p.c)+'</div>',iconSize:[34,42],iconAnchor:[17,41]});}
  window.setPins=function(list){
    layer.clearLayers(); markers={}; data={};
    list.forEach(function(p){
      data[p.id]=p;
      var m=L.marker([p.lat,p.lng],{icon:icon(p,p.id===sel),keyboard:false});
      m.on('click',function(e){ L.DomEvent.stopPropagation(e); post({t:'pin',id:p.id}); });
      m.addTo(layer); markers[p.id]=m;
    });
  };
  window.setSelected=function(id){
    var prev=sel; sel=id;
    if(prev&&markers[prev]) markers[prev].setIcon(icon(data[prev],false));
    if(id&&markers[id]){ markers[id].setIcon(icon(data[id],true)); markers[id].setZIndexOffset(1000); }
  };
  window.setBasemap=function(b){
    if(b===current) return; current=b;
    map.removeLayer(street); map.removeLayer(sat);
    (b==='satellite'?sat:street).addTo(map);
    document.body.className=b==='night'?'night':'';
  };
  window.setMe=function(p){
    if(meM){ map.removeLayer(meM); meM=null; }
    if(p) meM=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]}),interactive:false}).addTo(map);
  };
  window.flyTo=function(lat,lng,z){ map.flyTo([lat,lng],z,{duration:0.8}); };
  window.fitB=function(b,pad){ map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[pad,pad],maxZoom:15}); };
  window.zoomBy=function(d){ map.setZoom(map.getZoom()+(d>0?1:-1)); };
  map.on('click',function(){ post({t:'map'}); });
  post({t:'ready'});
})();
</script></body></html>`;
}

export const WebMap = forwardRef<LiveMapHandle, Props>(function WebMap(
  { pins, selectedId = null, basemap = 'map', me = null, interactive = true, onPinPress, onMapPress, onReady, onLoadError },
  ref,
) {
  const web = useRef<WebViewRef>(null);
  const [ready, setReady] = useState(false);
  const source = useMemo(() => ({ html: html(interactive), baseUrl: 'https://www.mappingg.com/' }), [interactive]);
  const byId = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);

  const run = useCallback((js: string) => web.current?.injectJavaScript(`try{${js}}catch(e){};true;`), []);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (lat, lng, zoom) => run(`flyTo(${lat},${lng},${Math.round(zoom)})`),
      fitBounds: (b: Bounds, padding = 40) => run(`fitB(${JSON.stringify(b)},${padding})`),
      zoomBy: (d) => run(`zoomBy(${d})`),
    }),
    [run],
  );

  useEffect(() => {
    if (!ready) return;
    const list = pins.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, c: STATUS_COLOR[asPinStatus(p.status)] }));
    run(`setPins(${JSON.stringify(list)});setSelected(${JSON.stringify(selectedId)})`);
    // selectedId is applied separately below; pins re-render keeps it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, ready, run]);
  useEffect(() => {
    if (ready) run(`setSelected(${JSON.stringify(selectedId)})`);
  }, [ready, run, selectedId]);
  useEffect(() => {
    if (ready) run(`setBasemap(${JSON.stringify(basemap)})`);
  }, [basemap, ready, run]);
  useEffect(() => {
    if (ready) run(`setMe(${JSON.stringify(me)})`);
  }, [me, ready, run]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { t?: string; id?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.t === 'ready') {
      setReady(true);
      onReady?.();
    } else if (msg.t === 'pin' && msg.id) {
      const p = byId.get(msg.id);
      if (p) onPinPress?.(p);
    } else if (msg.t === 'map') onMapPress?.();
    else if (msg.t === 'error') onLoadError?.();
  };

  return (
    <View style={styles.fill} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        ref={web}
        source={source}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        userAgent={tileUserAgent(ExpoConstants.expoConfig?.version ?? '')}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        onError={() => onLoadError?.()}
        style={styles.web}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: colors.mapPaper },
});
