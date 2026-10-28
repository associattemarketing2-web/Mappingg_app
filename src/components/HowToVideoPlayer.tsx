import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';

// The "How to use Mappingg" player for SignUpPopup. Kept in its own file so the
// popup can skip loading expo-video on builds that don't include its native code.

/** Plays muted while `playing`, unless reduced motion is on — then it waits for
 *  a tap on its controls. Calls `onStarted` once the first frame plays. */
export function HowToVideoPlayer({ src, playing, onStarted }: { src: string; playing: boolean; onStarted(): void }) {
  const player = useVideoPlayer(src, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    if (isPlaying) onStarted();
  }, [isPlaying, onStarted]);

  useEffect(() => {
    if (!playing) {
      player.pause();
      return;
    }
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!cancelled && !reduce) player.play();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [playing, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls
      accessibilityLabel="How to find property near you on Mappingg: tap Near Me on the live map"
    />
  );
}
