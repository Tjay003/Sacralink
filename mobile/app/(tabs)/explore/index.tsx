import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Church,
  MapPin,
  Search,
  Navigation,
  Sparkles,
  Clock,
  Compass,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function ExploreScreen() {
  const { profile } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top App Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans">
              SacraLink Parishes
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Explore Churches
            </Text>
          </View>
          <RoleBadge role={profile?.role} />
        </View>

        {/* Search & Location Bar */}
        <View className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex-row items-center space-x-2.5 mb-5">
          <Search size={18} color="#64748B" />
          <Text className="flex-1 text-sm text-slate-400 font-sans">
            Search diocese, parish, or municipality...
          </Text>
          <TouchableOpacity className="bg-blue-50 p-2 rounded-xl">
            <Compass size={16} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* Interactive Map Banner Preview */}
        <View className="bg-blue-600 rounded-3xl p-5 mb-5 overflow-hidden relative shadow-md shadow-blue-600/30">
          <View className="flex-row items-center space-x-2 mb-2">
            <View className="bg-white/20 p-2 rounded-xl">
              <Navigation size={18} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-bold text-blue-100 uppercase tracking-wider">
              Interactive Parish Map
            </Text>
          </View>
          <Text className="text-lg font-bold text-white font-heading mb-1">
            Discover Parishes Near You
          </Text>
          <Text className="text-xs text-blue-100 font-sans leading-relaxed mb-4">
            Locate Catholic churches across the diocese with real-time GPS distance and 360° virtual interior photo spheres.
          </Text>
          <View className="bg-white/10 self-start px-3 py-1.5 rounded-full border border-white/20">
            <Text className="text-xs font-semibold text-white">OpenStreetMap Powered</Text>
          </View>
        </View>

        {/* Featured Parishes Section */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Diocese Parishes
        </Text>

        <View className="space-y-3">
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900 font-heading">
                  San Pedro Cathedral
                </Text>
                <View className="flex-row items-center space-x-1 mt-1">
                  <MapPin size={13} color="#64748B" />
                  <Text className="text-xs text-slate-500 font-sans">
                    San Pedro St., Davao City
                  </Text>
                </View>
              </View>
              <View className="bg-blue-50 px-2 py-1 rounded-lg">
                <Text className="text-xs font-bold text-blue-700">Cathedral</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
              <View className="flex-row items-center space-x-1">
                <Clock size={13} color="#64748B" />
                <Text className="text-xs text-slate-500 font-sans">Daily: 6:00 AM - 6:30 PM</Text>
              </View>
              <Text className="text-xs font-semibold text-blue-600">View Schedule & Virtual Tour →</Text>
            </View>
          </View>

          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900 font-heading">
                  Santa Ana Shrine Parish
                </Text>
                <View className="flex-row items-center space-x-1 mt-1">
                  <MapPin size={13} color="#64748B" />
                  <Text className="text-xs text-slate-500 font-sans">
                    Santa Ana Ave., Davao City
                  </Text>
                </View>
              </View>
              <View className="bg-amber-50 px-2 py-1 rounded-lg">
                <Text className="text-xs font-bold text-amber-700">Shrine</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
              <View className="flex-row items-center space-x-1">
                <Clock size={13} color="#64748B" />
                <Text className="text-xs text-slate-500 font-sans">Daily: 6:00 AM - 7:00 PM</Text>
              </View>
              <Text className="text-xs font-semibold text-blue-600">View Schedule & Virtual Tour →</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
