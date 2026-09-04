import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Church as ChurchIcon,
  MapPin,
  Search,
  Map as MapIcon,
  List as ListIcon,
  X,
  Compass,
  AlertCircle,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import { useChurches, type Church } from '@/lib/supabase/churches';
import { ParishCard } from '@/components/churches/ParishCard';
import { ParishMapWebView } from '@/components/maps/ParishMapWebView';
import { AIAssistantFAB } from '@/components/ai/AIAssistantFAB';

export default function ExploreScreen() {
  const { profile } = useAuth();
  const { data: churches = [], isLoading, isError, error, refetch, isRefetching } = useChurches();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  // Distinct cities from fetched churches
  const cities = useMemo(() => {
    const set = new Set<string>();
    churches.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set).sort();
  }, [churches]);

  // Filtered churches based on search & city
  const filteredChurches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return churches.filter((church) => {
      const matchesSearch =
        !query ||
        church.name.toLowerCase().includes(query) ||
        church.address.toLowerCase().includes(query) ||
        church.city.toLowerCase().includes(query);

      const matchesCity =
        selectedCity === 'all' ||
        church.city.toLowerCase() === selectedCity.toLowerCase();

      return matchesSearch && matchesCity;
    });
  }, [churches, searchQuery, selectedCity]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="px-5 pt-3 pb-2 bg-white border-b border-slate-200/80">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <View className="flex-row items-center gap-1.5">
              <Sparkles size={13} color="#2563EB" />
              <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-sans">
                SacraLink Diocese
              </Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
              Explore Churches
            </Text>
          </View>
          <RoleBadge role={profile?.role} />
        </View>

        {/* View Mode Switcher Pill */}
        <View className="flex-row bg-slate-100 p-1 rounded-2xl mb-2">
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            className={`flex-1 flex-row items-center justify-center py-2 rounded-xl ${
              viewMode === 'list'
                ? 'bg-blue-600 shadow-sm shadow-blue-600/30'
                : 'bg-transparent'
            }`}
          >
            <ListIcon
              size={16}
              color={viewMode === 'list' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              className={`text-xs font-bold ml-1.5 font-sans ${
                viewMode === 'list' ? 'text-white' : 'text-slate-600'
              }`}
            >
              List View ({filteredChurches.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode('map')}
            className={`flex-1 flex-row items-center justify-center py-2 rounded-xl ${
              viewMode === 'map'
                ? 'bg-blue-600 shadow-sm shadow-blue-600/30'
                : 'bg-transparent'
            }`}
          >
            <MapIcon
              size={16}
              color={viewMode === 'map' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              className={`text-xs font-bold ml-1.5 font-sans ${
                viewMode === 'map' ? 'text-white' : 'text-slate-600'
              }`}
            >
              Interactive Map
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-100 rounded-2xl px-3.5 py-2.5 border border-slate-200/60 mb-2">
          <Search size={16} color="#64748B" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search parish name or city..."
            placeholderTextColor="#94A3B8"
            className="flex-1 text-sm text-slate-800 font-sans ml-2.5 py-0"
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          ) : (
            <Compass size={16} color="#2563EB" />
          )}
        </View>

        {/* City Filter Pills */}
        {cities.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row pt-1 pb-2"
            contentContainerStyle={{ gap: 6 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedCity('all')}
              className={`px-3 py-1.5 rounded-full border ${
                selectedCity === 'all'
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <Text
                className={`text-xs font-semibold font-sans ${
                  selectedCity === 'all' ? 'text-blue-700' : 'text-slate-600'
                }`}
              >
                All Regions ({churches.length})
              </Text>
            </TouchableOpacity>

            {cities.map((city) => (
              <TouchableOpacity
                key={city}
                onPress={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-full border ${
                  selectedCity === city
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-xs font-semibold font-sans ${
                    selectedCity === city ? 'text-blue-700' : 'text-slate-600'
                  }`}
                >
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Main Content Area */}
      {viewMode === 'map' ? (
        <View className="flex-1 w-full h-full">
          <ParishMapWebView churches={filteredChurches} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor="#2563EB"
              colors={['#2563EB']}
            />
          }
        >
          {/* Loading State */}
          {isLoading && !isRefetching && (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-xs font-semibold text-slate-500 mt-3 font-sans">
                Fetching Diocese Churches...
              </Text>
            </View>
          )}

          {/* Error State */}
          {isError && (
            <View className="bg-rose-50 border border-rose-200 rounded-3xl p-5 items-center my-6">
              <AlertCircle size={28} color="#E11D48" />
              <Text className="text-sm font-bold text-rose-800 mt-2 font-sans">
                Failed to load churches
              </Text>
              <Text className="text-xs text-rose-600 text-center mt-1 font-sans">
                {(error as Error)?.message || 'Please check your internet connection'}
              </Text>
              <TouchableOpacity
                onPress={() => refetch()}
                className="mt-3 bg-rose-600 px-4 py-2 rounded-xl"
              >
                <Text className="text-xs font-semibold text-white font-sans">
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Empty Results State */}
          {!isLoading && !isError && filteredChurches.length === 0 && (
            <View className="bg-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6">
              <View className="w-14 h-14 rounded-2xl bg-blue-50 items-center justify-center mb-3">
                <ChurchIcon size={26} color="#2563EB" />
              </View>
              <Text className="text-base font-bold text-slate-800 font-sans text-center">
                No Parishes Found
              </Text>
              <Text className="text-xs text-slate-500 text-center mt-1 font-sans max-w-[240px]">
                {searchQuery
                  ? `No churches matching "${searchQuery}". Try clearing search keywords.`
                  : 'There are no active churches listed at the moment.'}
              </Text>
              {searchQuery ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCity('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200"
                >
                  <Text className="text-xs font-semibold text-blue-700 font-sans">
                    Clear Filters
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Churches List */}
          {!isLoading &&
            filteredChurches.map((church) => (
              <ParishCard key={church.id} church={church} />
            ))}
        </ScrollView>
      )}

      {/* Floating Parish AI Knowledge Assistant */}
      <AIAssistantFAB bottomOffset={82} />
    </SafeAreaView>
  );
}
