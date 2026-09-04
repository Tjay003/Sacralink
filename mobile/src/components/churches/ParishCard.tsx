import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Church as ChurchIcon,
  MapPin,
  ChevronRight,
  Video,
  Eye,
  Clock,
  Phone,
} from 'lucide-react-native';
import type { Church } from '@/lib/supabase/churches';

interface ParishCardProps {
  church: Church;
  onPress?: () => void;
}

export function ParishCard({ church, onPress }: ParishCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/church/${church.id}` as any);
    }
  };

  const hasPanorama = Boolean(church.panorama_url);
  const hasLivestream = Boolean(church.livestream_url);
  const imageUrl = church.cover_image_url || church.featured_image_url;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm shadow-slate-200 mb-4"
    >
      {/* Cover Image or Fallback */}
      <View className="h-44 w-full bg-slate-100 relative">
        {imageUrl && !imageError ? (
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900">
            <View className="w-16 h-16 rounded-2xl bg-white/10 items-center justify-center border border-white/20">
              <ChurchIcon size={32} color="#F59E0B" />
            </View>
            <Text className="text-xs font-semibold text-slate-300 mt-2 font-sans">
              SacraLink Parish
            </Text>
          </View>
        )}

        {/* Feature Badges Overlay */}
        <View className="absolute top-3 right-3 flex-row items-center gap-1.5">
          {hasPanorama && (
            <View className="flex-row items-center bg-blue-600/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-blue-400/30">
              <Eye size={12} color="#FFFFFF" />
              <Text className="text-[10px] font-bold text-white ml-1 font-sans uppercase">
                360° Tour
              </Text>
            </View>
          )}
          {hasLivestream && (
            <View className="flex-row items-center bg-rose-600/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-rose-400/30">
              <Video size={12} color="#FFFFFF" />
              <Text className="text-[10px] font-bold text-white ml-1 font-sans uppercase">
                Live
              </Text>
            </View>
          )}
        </View>

        {/* City Badge */}
        {church.city && (
          <View className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/50">
            <Text className="text-[11px] font-medium text-slate-200 font-sans">
              {church.city}
            </Text>
          </View>
        )}
      </View>

      {/* Card Content */}
      <View className="p-4">
        <Text
          numberOfLines={1}
          className="text-lg font-bold text-slate-900 font-sans tracking-tight mb-1"
        >
          {church.name}
        </Text>

        {/* Address with MapPin */}
        <View className="flex-row items-center mb-3">
          <MapPin size={14} color="#2563EB" />
          <Text
            numberOfLines={1}
            className="text-xs text-slate-500 font-sans ml-1.5 flex-1"
          >
            {church.address}
          </Text>
        </View>

        {/* Quick Highlights / Details */}
        <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
          <View className="flex-row items-center gap-3">
            {church.contact_number ? (
              <View className="flex-row items-center">
                <Phone size={12} color="#64748B" />
                <Text className="text-[11px] text-slate-500 ml-1 font-sans">
                  Available
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center">
              <Clock size={12} color="#64748B" />
              <Text className="text-[11px] text-slate-500 ml-1 font-sans">
                Mass Timetable
              </Text>
            </View>
          </View>

          {/* View Parish Button */}
          <TouchableOpacity
            onPress={handlePress}
            className="flex-row items-center bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-100"
          >
            <Text className="text-xs font-semibold text-blue-700 font-sans mr-0.5">
              View Parish
            </Text>
            <ChevronRight size={14} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
