import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useRouter } from 'expo-router';
import {
  MapPin,
  X,
  Navigation,
  ChevronRight,
  Church as ChurchIcon,
  Video,
  Eye,
} from 'lucide-react-native';
import type { Church } from '@/lib/supabase/churches';

interface ParishMapWebViewProps {
  churches: Church[];
  initialSelectedChurchId?: string;
  onSelectChurch?: (church: Church) => void;
}

export function ParishMapWebView({
  churches,
  initialSelectedChurchId,
  onSelectChurch,
}: ParishMapWebViewProps) {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(() => {
    if (initialSelectedChurchId) {
      return churches.find((c) => c.id === initialSelectedChurchId) || null;
    }
    return null;
  });
  const [isMapReady, setIsMapReady] = useState(false);

  // Filter churches with valid coordinates
  const validChurches = useMemo(
    () =>
      churches.filter(
        (c) =>
          typeof c.latitude === 'number' &&
          typeof c.longitude === 'number' &&
          !isNaN(c.latitude) &&
          !isNaN(c.longitude)
      ),
    [churches]
  );

  // Compute map center (average of coordinates or default SJDM center)
  const mapCenter = useMemo(() => {
    if (validChurches.length > 0) {
      const avgLat =
        validChurches.reduce((sum, c) => sum + (c.latitude as number), 0) /
        validChurches.length;
      const avgLng =
        validChurches.reduce((sum, c) => sum + (c.longitude as number), 0) /
        validChurches.length;
      return { lat: avgLat, lng: avgLng, zoom: 13 };
    }
    // Default Diocese of Malolos / San Jose del Monte coordinates
    return { lat: 14.8028, lng: 121.0332, zoom: 13 };
  }, [validChurches]);

  // Leaflet HTML template
  const leafletHtml = useMemo(() => {
    const churchesJson = JSON.stringify(
      validChurches.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        city: c.city,
        lat: c.latitude,
        lng: c.longitude,
        hasPanorama: Boolean(c.panorama_url),
        hasLivestream: Boolean(c.livestream_url),
        imageUrl: c.cover_image_url || c.featured_image_url,
      }))
    ).replace(/</g, '\\u003c');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>SacraLink Parish Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .custom-parish-pin {
      background: #2563EB;
      border: 3px solid #F59E0B;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
      cursor: pointer;
    }
    .custom-parish-pin-inner {
      transform: rotate(45deg);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 18px;
      padding: 4px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.15);
      border: 1px solid #E2E8F0;
    }
    .leaflet-popup-content {
      margin: 10px 12px;
      line-height: 1.4;
    }
    .popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #0F172A;
      margin-bottom: 3px;
    }
    .popup-address {
      font-size: 11px;
      color: #64748B;
      margin-bottom: 8px;
    }
    .popup-btn {
      display: inline-block;
      width: 100%;
      text-align: center;
      background: #2563EB;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 8px;
      text-decoration: none;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function() {
      var churches = ${churchesJson};
      var centerLat = ${mapCenter.lat};
      var centerLng = ${mapCenter.lng};
      var zoom = ${mapCenter.zoom};

      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([centerLat, centerLng], zoom);

      // Add CartoDB Positron / OSM tiles for clean modern aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      // SVG Church Cross Icon for Pin
      var pinHtml = '<div class="custom-parish-pin"><div class="custom-parish-pin-inner">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 2v6m-4-3h8"></path>' +
          '<path d="M4 10l8-6 8 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path>' +
        '</svg>' +
      '</div></div>';

      var churchIcon = L.divIcon({
        className: 'parish-marker',
        html: pinHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
      });

      var markers = [];

      churches.forEach(function(c) {
        var marker = L.marker([c.lat, c.lng], { icon: churchIcon }).addTo(map);
        markers.push(marker);

        var popupContent = document.createElement('div');
        popupContent.innerHTML =
          '<div class="popup-title">' + c.name + '</div>' +
          '<div class="popup-address">' + c.address + '</div>' +
          '<button class="popup-btn" id="btn-' + c.id + '">View Details & Schedule</button>';

        marker.bindPopup(popupContent);

        marker.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SELECT_CHURCH',
              churchId: c.id
            }));
          }
        });

        marker.on('popupopen', function() {
          var btn = document.getElementById('btn-' + c.id);
          if (btn) {
            btn.onclick = function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'OPEN_CHURCH',
                  churchId: c.id
                }));
              }
            };
          }
        });
      });

      // Fit bounds if multiple churches
      if (markers.length > 1) {
        var group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      }

      // Signal ready to RN
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    })();
  </script>
</body>
</html>
    `;
  }, [validChurches, mapCenter]);

  // Handle messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        setIsMapReady(true);
      } else if (data.type === 'SELECT_CHURCH') {
        const found = churches.find((c) => c.id === data.churchId);
        if (found) {
          setSelectedChurch(found);
          if (onSelectChurch) onSelectChurch(found);
        }
      } else if (data.type === 'OPEN_CHURCH') {
        router.push(`/church/${data.churchId}` as any);
      }
    } catch (e) {
      console.error('Failed to parse WebView message:', e);
    }
  };

  const handleRecenter = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return (
    <View className="flex-1 w-full h-full relative bg-slate-100">
      {/* Map WebView */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        className="flex-1"
      />

      {/* Loading Overlay */}
      {!isMapReady && (
        <View className="absolute inset-0 bg-slate-50 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-xs font-semibold text-slate-500 mt-2 font-sans">
            Loading Interactive Parish Map...
          </Text>
        </View>
      )}

      {/* Recenter / Info Controls on Top Right */}
      <View className="absolute top-4 right-4 z-10 flex-col gap-2">
        <TouchableOpacity
          onPress={handleRecenter}
          className="w-11 h-11 rounded-2xl bg-white shadow-md shadow-slate-900/15 items-center justify-center border border-slate-200"
          accessibilityLabel="Recenter Map"
        >
          <Navigation size={18} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Selected Parish Quick-View Card (Bottom Sheet Modal Preview) */}
      {selectedChurch && (
        <View className="absolute bottom-6 left-4 right-4 z-20">
          <View className="bg-white rounded-3xl p-4 shadow-xl shadow-slate-900/20 border border-slate-200/90">
            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setSelectedChurch(null)}
              className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-slate-100 items-center justify-center"
            >
              <X size={14} color="#64748B" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-3">
              {/* Church Avatar / Cover */}
              <View className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                {selectedChurch.cover_image_url || selectedChurch.featured_image_url ? (
                  <Image
                    source={{
                      uri:
                        selectedChurch.cover_image_url ||
                        (selectedChurch.featured_image_url as string),
                    }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center bg-blue-600">
                    <ChurchIcon size={24} color="#F59E0B" />
                  </View>
                )}
              </View>

              {/* Church Details */}
              <View className="flex-1 pr-6">
                <Text
                  numberOfLines={1}
                  className="text-sm font-bold text-slate-900 font-sans tracking-tight"
                >
                  {selectedChurch.name}
                </Text>
                <View className="flex-row items-center mt-0.5 mb-1.5">
                  <MapPin size={11} color="#2563EB" />
                  <Text
                    numberOfLines={1}
                    className="text-[11px] text-slate-500 font-sans ml-1 flex-1"
                  >
                    {selectedChurch.address}
                  </Text>
                </View>

                {/* Badges */}
                <View className="flex-row items-center gap-1.5">
                  {selectedChurch.panorama_url && (
                    <View className="flex-row items-center bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                      <Eye size={10} color="#2563EB" />
                      <Text className="text-[9px] font-bold text-blue-700 ml-1">
                        360° TOUR
                      </Text>
                    </View>
                  )}
                  {selectedChurch.livestream_url && (
                    <View className="flex-row items-center bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                      <Video size={10} color="#E11D48" />
                      <Text className="text-[9px] font-bold text-rose-700 ml-1">
                        LIVE
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              <TouchableOpacity
                onPress={() => setSelectedChurch(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 items-center justify-center"
              >
                <Text className="text-xs font-semibold text-slate-700 font-sans">
                  Dismiss
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const id = selectedChurch.id;
                  setSelectedChurch(null);
                  router.push(`/church/${id}` as any);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 flex-row items-center justify-center shadow-sm shadow-blue-500/30"
              >
                <Text className="text-xs font-bold text-white font-sans mr-1">
                  View Full Parish
                </Text>
                <ChevronRight size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
