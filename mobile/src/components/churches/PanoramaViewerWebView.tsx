import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  Maximize2,
  Minimize2,
  X,
  Compass,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';

interface PanoramaViewerWebViewProps {
  panoramaUrl: string;
  churchName?: string;
  isModalVisible?: boolean;
  onClose?: () => void;
}

// Fallback sample equirectangular photo sphere from SacraLink Supabase storage
const SAMPLE_PANORAMA =
  'https://oaczurouvaevebpimply.supabase.co/storage/v1/object/public/church-images/panoramas/b2tabj6xh1v.jpg';

export function PanoramaViewerWebView({
  panoramaUrl,
  churchName = 'Parish Sanctuary 360°',
  isModalVisible = false,
  onClose,
}: PanoramaViewerWebViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const activeUrl = panoramaUrl || SAMPLE_PANORAMA;

  // Generate HTML for Pannellum 360° viewer
  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>SacraLink 360 Panorama Tour</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #panorama {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .pnlm-load-button {
      border: 2px solid #F59E0B !important;
      background-color: rgba(37, 99, 235, 0.9) !important;
      border-radius: 50% !important;
    }
    .pnlm-ui {
      font-family: inherit;
    }
    .pnlm-compass {
      display: block !important;
    }
    .badge-indicator {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 10;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      color: #F8FAFC;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.15);
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="panorama"></div>
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <script>
    var viewer = pannellum.viewer('panorama', {
      type: 'equirectangular',
      panorama: '${activeUrl}',
      autoLoad: true,
      autoRotate: -2,
      compass: false,
      showZoomCtrl: true,
      showFullscreenCtrl: false,
      mouseZoom: true,
      hfov: 100,
      pitch: -3,
      yaw: 0,
      friction: 0.12
    });

    viewer.on('load', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PANORAMA_LOADED' }));
      }
    });

    viewer.on('error', function(err) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PANORAMA_ERROR', error: err }));
      }
    });
  </script>
</body>
</html>
    `;
  }, [activeUrl]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'PANORAMA_LOADED') {
        setIsLoading(false);
      }
    } catch {
      // Ignored
    }
  };

  const renderViewer = (fullscreen: boolean) => (
    <View className="w-full h-full bg-slate-950 relative overflow-hidden">
      {/* WebView */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        className="w-full h-full"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-slate-950/90 items-center justify-center">
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text className="text-xs font-semibold text-slate-300 mt-3 font-sans">
            Loading 360° Interior Tour...
          </Text>
          <Text className="text-[11px] text-slate-500 mt-1 font-sans">
            Drag across screen to look around
          </Text>
        </View>
      )}

      {/* Top Header Overlay */}
      <View className="absolute top-4 left-4 right-4 flex-row items-center justify-between z-10">
        <View className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex-row items-center gap-1.5">
          <Sparkles size={12} color="#F59E0B" />
          <Text
            numberOfLines={1}
            className="text-xs font-bold text-white font-sans tracking-wide max-w-[200px]"
          >
            {churchName}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Reload / Reset */}
          <TouchableOpacity
            onPress={() => {
              setIsLoading(true);
              webViewRef.current?.reload();
            }}
            className="w-9 h-9 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 items-center justify-center"
          >
            <RotateCcw size={15} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Fullscreen Toggle */}
          <TouchableOpacity
            onPress={() => setIsFullscreen(!fullscreen)}
            className="w-9 h-9 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 items-center justify-center"
          >
            {fullscreen ? (
              <Minimize2 size={16} color="#FFFFFF" />
            ) : (
              <Maximize2 size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Close button if in modal or external close supplied */}
          {(fullscreen || onClose) && (
            <TouchableOpacity
              onPress={() => {
                if (fullscreen) setIsFullscreen(false);
                if (onClose) onClose();
              }}
              className="w-9 h-9 rounded-full bg-rose-600/90 backdrop-blur-md border border-rose-400/40 items-center justify-center"
            >
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom Hint Banner */}
      <View className="absolute bottom-3 left-4 right-4 items-center pointer-events-none">
        <View className="bg-slate-900/75 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 flex-row items-center gap-1.5">
          <Compass size={12} color="#94A3B8" />
          <Text className="text-[11px] text-slate-300 font-sans">
            Touch & drag in any direction • Pinch to zoom
          </Text>
        </View>
      </View>
    </View>
  );

  // If opened via modal prop or internal fullscreen
  if (isModalVisible || isFullscreen) {
    return (
      <Modal
        visible={isModalVisible || isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setIsFullscreen(false);
          if (onClose) onClose();
        }}
      >
        <StatusBar hidden />
        {renderViewer(true)}
      </Modal>
    );
  }

  // Inline preview container
  return (
    <View className="w-full h-64 rounded-3xl overflow-hidden border border-slate-200 bg-slate-950 shadow-sm">
      {renderViewer(false)}
    </View>
  );
}
