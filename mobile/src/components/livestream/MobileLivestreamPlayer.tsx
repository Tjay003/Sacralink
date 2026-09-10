import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
  Share,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  Video,
  Radio,
  Flame,
  Heart,
  Maximize2,
  Minimize2,
  X,
  Calendar,
  Clock,
  Sparkles,
  Share2,
} from 'lucide-react-native';
import type { Church, MassSchedule } from '@/lib/supabase/churches';

interface MobileLivestreamPlayerProps {
  church: Church;
  candleCount?: number;
  onLightCandle?: () => void;
  onOpenOffertory?: () => void;
}

/**
 * Robust stream parser for mobile WebView
 */
export function parseMobileStreamUrl(url?: string | null, platformPref?: string | null) {
  if (!url || !url.trim()) return null;
  const clean = url.trim();

  // YouTube formats
  const ytMatch = clean.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      platform: 'youtube' as const,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`,
    };
  }

  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return {
      platform: 'youtube' as const,
      embedUrl: `https://www.youtube-nocookie.com/embed/${clean}?autoplay=1&rel=0&playsinline=1&modestbranding=1`,
    };
  }

  // Facebook formats
  if (clean.includes('facebook.com') || clean.includes('fb.watch') || clean.includes('fb.me') || platformPref === 'facebook') {
    return {
      platform: 'facebook' as const,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(clean)}&show_text=false&autoplay=true&mute=0&allowfullscreen=true`,
    };
  }

  return {
    platform: 'generic' as const,
    embedUrl: clean,
  };
}

export function MobileLivestreamPlayer({
  church,
  candleCount = 0,
  onLightCandle,
  onOpenOffertory,
}: MobileLivestreamPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isLive = Boolean(church.is_live && church.livestream_url);
  const parsed = useMemo(
    () => parseMobileStreamUrl(church.livestream_url, church.livestream_platform),
    [church.livestream_url, church.livestream_platform]
  );

  const htmlContent = useMemo(() => {
    if (!parsed) return '';
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #020617;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }
  </style>
</head>
<body>
  <iframe
    src="${parsed.embedUrl}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
</body>
</html>
    `;
  }, [parsed]);

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${church.name} - Live Mass`,
        message: `Watch the Holy Mass live broadcast from ${church.name} on SacraLink!`,
      });
    } catch {
      // Ignored
    }
  };

  return (
    <View className="w-full">
      {/* Player Container */}
      <View className="w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-lg relative">
        {isLive && parsed ? (
          <>
            <WebView
              originWhitelist={['*']}
              source={{ html: htmlContent }}
              style={{ flex: 1, backgroundColor: '#020617' }}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              onLoadEnd={() => setIsLoading(false)}
            />

            {isLoading && (
              <View className="absolute inset-0 bg-slate-950 items-center justify-center">
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text className="text-xs font-semibold text-slate-400 mt-2 font-sans">
                  Connecting to sanctuary feed...
                </Text>
              </View>
            )}

            {/* Top Badges Overlay */}
            <View className="absolute top-3 left-3 right-3 flex-row items-center justify-between pointer-events-none">
              <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 border border-red-400/40">
                <View className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <Text className="text-[10px] font-bold text-white font-sans uppercase">
                  LIVE MASS
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setIsFullscreen(true)}
                className="w-8 h-8 rounded-full bg-black/60 items-center justify-center border border-white/20"
              >
                <Maximize2 size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Offline / Standby State */
          <View className="flex-1 p-5 justify-between bg-gradient-to-b from-slate-900 to-slate-950">
            {/* Top Header */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                <Radio size={12} color="#94A3B8" />
                <Text className="text-[10px] font-semibold text-slate-300 ml-1.5 font-sans">
                  Broadcast Offline
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleShare}
                className="w-7 h-7 rounded-full bg-slate-800/80 items-center justify-center border border-slate-700"
              >
                <Share2 size={12} color="#E2E8F0" />
              </TouchableOpacity>
            </View>

            {/* Center Info */}
            <View className="py-2">
              <View className="flex-row items-center gap-1 mb-1">
                <Sparkles size={13} color="#F59E0B" />
                <Text className="text-[10px] font-bold text-amber-400 font-sans uppercase tracking-wider">
                  Virtual Sanctuary
                </Text>
              </View>
              <Text
                numberOfLines={1}
                className="text-base font-bold text-white font-sans"
              >
                {church.name}
              </Text>
              <Text
                numberOfLines={2}
                className="text-[11px] text-slate-400 font-sans mt-0.5 leading-4"
              >
                Live broadcast will resume during scheduled Sunday and weekday Masses.
              </Text>
            </View>

            {/* Bottom Actions */}
            <View className="flex-row items-center gap-2">
              {onLightCandle && (
                <TouchableOpacity
                  onPress={onLightCandle}
                  className="flex-1 bg-amber-500 active:bg-amber-600 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-1.5 shadow-sm shadow-amber-500/30"
                >
                  <Flame size={14} color="#0F172A" />
                  <Text className="text-xs font-bold text-slate-950 font-sans">
                    Light a Candle ({candleCount})
                  </Text>
                </TouchableOpacity>
              )}

              {onOpenOffertory && (church.gcash_number || church.maya_number || church.donation_qr_url) && (
                <TouchableOpacity
                  onPress={onOpenOffertory}
                  className="bg-rose-600/20 active:bg-rose-600/30 border border-rose-500/30 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-1.5"
                >
                  <Heart size={14} color="#F43F5E" />
                  <Text className="text-xs font-semibold text-rose-300 font-sans">
                    Offertory
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Fullscreen Player Modal */}
      <Modal
        visible={isFullscreen}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <StatusBar hidden />
        <View className="flex-1 bg-black">
          {/* Top Floating Close Bar */}
          <View className="absolute top-6 right-6 z-50">
            <TouchableOpacity
              onPress={() => setIsFullscreen(false)}
              className="w-10 h-10 rounded-full bg-black/70 border border-white/20 items-center justify-center"
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <WebView
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            style={{ flex: 1, backgroundColor: '#000000' }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        </View>
      </Modal>
    </View>
  );
}
