import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
  TextInput,
  Vibration,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Share2,
  Calendar,
  Clock,
  Heart,
  MessageCircle,
  Video,
  Eye,
  ExternalLink,
  Church as ChurchIcon,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Globe,
  Flame,
  Radio,
  Copy,
  Check,
  X,
  HeartHandshake,
  QrCode,
} from 'lucide-react-native';
import { useChurch, lightChurchCandle, type MassSchedule } from '@/lib/supabase/churches';
import { supabase } from '@/lib/supabase';
import { PanoramaViewerWebView } from '@/components/churches/PanoramaViewerWebView';
import { MobileLivestreamPlayer } from '@/components/livestream/MobileLivestreamPlayer';
import { AIAssistantFAB } from '@/components/ai/AIAssistantFAB';
import { ParishionerChatbotModal } from '@/components/ai/ParishionerChatbotModal';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Format 24-hour time "17:00:00" or "08:30" to "5:00 PM" / "8:30 AM"
 */
function formatTime12(timeStr?: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

export default function ChurchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: church, isLoading, isError, error } = useChurch(id);

  const [selectedDay, setSelectedDay] = useState<string>('Sunday');
  const [showTourModal, setShowTourModal] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Livestream & Virtual Sanctuary states
  const [isCandleModalOpen, setIsCandleModalOpen] = useState<boolean>(false);
  const [intentionText, setIntentionText] = useState<string>('');
  const [isLightingCandle, setIsLightingCandle] = useState<boolean>(false);
  const [candleSuccess, setCandleSuccess] = useState<boolean>(false);
  const [candleCount, setCandleCount] = useState<number>(0);

  const [isOffertoryModalOpen, setIsOffertoryModalOpen] = useState<boolean>(false);
  const [copiedGcash, setCopiedGcash] = useState<boolean>(false);
  const [copiedMaya, setCopiedMaya] = useState<boolean>(false);

  // Sync candle count with church data
  useEffect(() => {
    if (church && typeof church.candle_count === 'number') {
      setCandleCount(church.candle_count);
    }
  }, [church?.candle_count]);

  // Subscribe to realtime updates for church candle count and live status
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`church-detail-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'churches',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new.candle_count === 'number') {
            setCandleCount(payload.new.candle_count);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleLightCandleSubmit = async () => {
    if (!church) return;
    setIsLightingCandle(true);
    try {
      try {
        Vibration.vibrate(50);
      } catch {
        // Ignored on unsupported platforms
      }
      setCandleCount((prev) => prev + 1);
      await lightChurchCandle(church.id, intentionText);
      setCandleSuccess(true);
      setTimeout(() => {
        setIntentionText('');
        setCandleSuccess(false);
        setIsCandleModalOpen(false);
      }, 1400);
    } catch (err: any) {
      Alert.alert('Unable to Light Candle', err?.message || 'Please check your connection and try again.');
    } finally {
      setIsLightingCandle(false);
    }
  };

  const handleCopyGcash = async () => {
    if (church?.gcash_number) {
      await Clipboard.setStringAsync(church.gcash_number);
      setCopiedGcash(true);
      setTimeout(() => setCopiedGcash(false), 2000);
    }
  };

  const handleCopyMaya = async () => {
    if (church?.maya_number) {
      await Clipboard.setStringAsync(church.maya_number);
      setCopiedMaya(true);
      setTimeout(() => setCopiedMaya(false), 2000);
    }
  };

  // Group mass schedules by day of the week
  const groupedSchedules = useMemo(() => {
    const map: Record<string, MassSchedule[]> = {
      Sunday: [],
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
    };

    if (church?.mass_schedules) {
      church.mass_schedules.forEach((s) => {
        const day = s.day_of_week;
        if (map[day]) {
          map[day].push(s);
        } else {
          // If day string is irregular, group under Sunday or capitalized
          const matched = DAYS_OF_WEEK.find(
            (d) => d.toLowerCase() === day.toLowerCase()
          );
          if (matched) {
            map[matched].push(s);
          } else {
            map['Sunday'].push(s);
          }
        }
      });
    }

    return map;
  }, [church?.mass_schedules]);

  // Current day's mass schedule list
  const currentDaySchedules = groupedSchedules[selectedDay] || [];

  const handleShare = async () => {
    if (!church) return;
    try {
      await Share.share({
        title: church.name,
        message: `Visit ${church.name} on SacraLink: ${church.address}`,
      });
    } catch {
      // Ignored
    }
  };

  const handleCall = () => {
    if (!church?.contact_number) return;
    const cleanNumber = church.contact_number.replace(/\s+/g, '');
    Linking.openURL(`tel:${cleanNumber}`);
  };

  const handleEmail = () => {
    if (!church?.email) return;
    Linking.openURL(`mailto:${church.email}`);
  };

  const handleFacebook = () => {
    if (!church?.facebook_url) return;
    Linking.openURL(church.facebook_url);
  };

  const handleLivestream = () => {
    if (!church?.livestream_url) return;
    Linking.openURL(church.livestream_url);
  };

  const handleBookSacrament = () => {
    router.push({
      pathname: '/appointments/book',
      params: { churchId: church?.id, churchName: church?.name },
    } as any);
  };

  const handleGiveDonation = () => {
    router.push({
      pathname: '/donations/give',
      params: { churchId: church?.id, churchName: church?.name },
    } as any);
  };

  const handleChat = () => {
    router.push({
      pathname: '/(tabs)/messages',
      params: { churchId: church?.id, recipientName: church?.name },
    } as any);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-xs font-semibold text-slate-400 mt-3 font-sans">
          Loading Church Details...
        </Text>
      </SafeAreaView>
    );
  }

  if (isError || !church) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center px-6">
        <View className="w-16 h-16 rounded-2xl bg-rose-50 items-center justify-center mb-3">
          <ChurchIcon size={32} color="#E11D48" />
        </View>
        <Text className="text-lg font-bold text-slate-800 font-sans text-center">
          Church Not Found
        </Text>
        <Text className="text-xs text-slate-500 text-center mt-1 mb-5 font-sans">
          {(error as Error)?.message || 'This parish could not be loaded.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-600 px-5 py-2.5 rounded-xl"
        >
          <Text className="text-xs font-semibold text-white font-sans">
            Go Back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const imageUrl = church.cover_image_url || church.featured_image_url;

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Hero Header with Cover Image */}
        <View className="h-72 w-full bg-slate-900 relative">
          {imageUrl && !imageError ? (
            <Image
              source={{ uri: imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-gradient-to-br from-blue-950 via-indigo-900 to-slate-900">
              <ChurchIcon size={56} color="#F59E0B" />
              <Text className="text-xs font-bold text-blue-200 uppercase tracking-widest mt-2">
                SacraLink Diocese
              </Text>
            </View>
          )}

          {/* Dark Gradient Overlay */}
          <View className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-black/30" />

          {/* Top Navigation Bar Over Hero */}
          <SafeAreaView
            edges={['top']}
            className="absolute top-0 left-0 right-0 px-4 pt-2 flex-row items-center justify-between"
          >
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 items-center justify-center"
            >
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 items-center justify-center"
            >
              <Share2 size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Parish Header Title & Badges on Hero */}
          <View className="absolute bottom-4 left-5 right-5">
            <View className="flex-row items-center gap-2 mb-1.5">
              <View className="bg-blue-600/90 backdrop-blur-md px-2.5 py-0.5 rounded-md border border-blue-400/40 flex-row items-center gap-1">
                <ShieldCheck size={11} color="#FFFFFF" />
                <Text className="text-[10px] font-bold text-white uppercase tracking-wider font-sans">
                  Verified Parish
                </Text>
              </View>
              {church.city && (
                <View className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/20">
                  <Text className="text-[10px] font-semibold text-white font-sans">
                    {church.city}
                  </Text>
                </View>
              )}
            </View>

            <Text
              numberOfLines={2}
              className="text-2xl font-bold text-white font-sans tracking-tight"
            >
              {church.name}
            </Text>

            <View className="flex-row items-center mt-1">
              <MapPin size={13} color="#93C5FD" />
              <Text
                numberOfLines={1}
                className="text-xs text-blue-100 font-sans ml-1 flex-1"
              >
                {church.address}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Contact & Action Ribbon */}
        <View className="bg-white px-5 py-3.5 border-b border-slate-200 flex-row items-center justify-around">
          {church.contact_number ? (
            <TouchableOpacity
              onPress={handleCall}
              className="items-center justify-center px-2 py-1"
            >
              <View className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 items-center justify-center mb-1">
                <Phone size={17} color="#2563EB" />
              </View>
              <Text className="text-[11px] font-semibold text-slate-700 font-sans">
                Call Parish
              </Text>
            </TouchableOpacity>
          ) : null}

          {church.email ? (
            <TouchableOpacity
              onPress={handleEmail}
              className="items-center justify-center px-2 py-1"
            >
              <View className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 items-center justify-center mb-1">
                <Mail size={17} color="#2563EB" />
              </View>
              <Text className="text-[11px] font-semibold text-slate-700 font-sans">
                Email
              </Text>
            </TouchableOpacity>
          ) : null}

          {church.facebook_url ? (
            <TouchableOpacity
              onPress={handleFacebook}
              className="items-center justify-center px-2 py-1"
            >
              <View className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 items-center justify-center mb-1">
                <Globe size={17} color="#2563EB" />
              </View>
              <Text className="text-[11px] font-semibold text-slate-700 font-sans">
                Facebook
              </Text>
            </TouchableOpacity>
          ) : null}

          {church.livestream_url ? (
            <TouchableOpacity
              onPress={handleLivestream}
              className="items-center justify-center px-2 py-1"
            >
              <View className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 items-center justify-center mb-1">
                <Video size={17} color="#E11D48" />
              </View>
              <Text className="text-[11px] font-semibold text-rose-700 font-sans">
                Livestream
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Primary Action Buttons: Book Sacrament, Give Donation, Chat */}
        <View className="px-5 pt-5 pb-2">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-3">
            Parish Services & Giving
          </Text>

          {/* Ask Parish AI Assistant Action Card */}
          <TouchableOpacity
            onPress={() => setIsAiModalOpen(true)}
            activeOpacity={0.88}
            className="w-full bg-slate-900 active:bg-slate-800 border border-amber-500/40 rounded-2xl p-3.5 flex-row items-center justify-between shadow-sm mb-3"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 items-center justify-center">
                <Sparkles size={18} color="#F59E0B" />
              </View>
              <View>
                <Text className="text-sm font-bold text-amber-400 font-sans">
                  Ask Parish AI Assistant
                </Text>
                <Text className="text-[11px] text-slate-400 font-sans">
                  Instant answers on mass times & sacrament guides
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#F59E0B" />
          </TouchableOpacity>

          {/* Book Sacrament Button */}
          <TouchableOpacity
            onPress={handleBookSacrament}
            className="w-full bg-blue-600 active:bg-blue-700 rounded-2xl p-4 flex-row items-center justify-between shadow-md shadow-blue-600/25 mb-3"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
                <Calendar size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-sm font-bold text-white font-sans">
                  Book Sacrament Appointment
                </Text>
                <Text className="text-[11px] text-blue-100 font-sans">
                  Baptism, Wedding, Funeral, Confirmation
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="flex-row items-center gap-3">
            {/* Give Donation Button */}
            <TouchableOpacity
              onPress={handleGiveDonation}
              className="flex-1 bg-amber-500 active:bg-amber-600 rounded-2xl p-3.5 flex-row items-center justify-between shadow-sm shadow-amber-500/20"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
                  <Heart size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text className="text-xs font-bold text-white font-sans">
                    Give Donation
                  </Text>
                  <Text className="text-[10px] text-amber-100 font-sans">
                    Cashless QR
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Chat with Parish Button */}
            <TouchableOpacity
              onPress={handleChat}
              className="flex-1 bg-slate-900 active:bg-slate-800 rounded-2xl p-3.5 flex-row items-center justify-between shadow-sm"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center">
                  <MessageCircle size={18} color="#60A5FA" />
                </View>
                <View>
                  <Text className="text-xs font-bold text-white font-sans">
                    Chat Parish
                  </Text>
                  <Text className="text-[10px] text-slate-400 font-sans">
                    Realtime Staff
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 360° Virtual Interior Tour Section */}
        <View className="px-5 pt-5 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-1.5">
              <Eye size={16} color="#2563EB" />
              <Text className="text-sm font-bold text-slate-900 font-sans">
                360° Virtual Interior Tour
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTourModal(true)}
              className="bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
            >
              <Text className="text-[11px] font-bold text-blue-700 font-sans">
                Fullscreen View
              </Text>
            </TouchableOpacity>
          </View>

          <View className="rounded-3xl overflow-hidden shadow-sm">
            <PanoramaViewerWebView
              panoramaUrl={church.panorama_url || ''}
              churchName={church.name}
              isModalVisible={showTourModal}
              onClose={() => setShowTourModal(false)}
            />
          </View>
          <Text className="text-[11px] text-slate-500 font-sans mt-1.5 px-1">
            Explore the sacred altar, nave, and interior architecture using 360° panoramic navigation.
          </Text>
        </View>

        {/* Virtual Sanctuary & Livestream Section */}
        <View className="px-5 pt-5 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-1.5">
              <Radio size={16} color={church.is_live ? '#DC2626' : '#2563EB'} />
              <Text className="text-sm font-bold text-slate-900 font-sans">
                {church.is_live ? 'Live Sanctuary Broadcast' : 'Virtual Sanctuary & Mass Stream'}
              </Text>
            </View>
            {church.is_live ? (
              <View className="bg-red-600 px-2.5 py-0.5 rounded-full flex-row items-center gap-1 shadow-xs shadow-red-500/40">
                <View className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <Text className="text-[10px] font-black text-white uppercase tracking-wider font-sans">
                  LIVE MASS
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsCandleModalOpen(true)}
                className="flex-row items-center bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200"
              >
                <Flame size={12} color="#D97706" />
                <Text className="text-[10px] font-bold text-amber-800 ml-1 font-sans">
                  {candleCount} Candles
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <MobileLivestreamPlayer
            church={church}
            candleCount={candleCount}
            onLightCandle={() => setIsCandleModalOpen(true)}
            onOpenOffertory={() => setIsOffertoryModalOpen(true)}
          />
        </View>

        {/* Weekly Mass Schedules Section */}
        <View className="px-5 pt-5 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-1.5">
              <Clock size={16} color="#2563EB" />
              <Text className="text-sm font-bold text-slate-900 font-sans">
                Weekly Mass Schedules
              </Text>
            </View>
            <Text className="text-xs font-semibold text-slate-400 font-sans">
              Timetable
            </Text>
          </View>

          {/* Day of Week Selector Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row pb-3"
            contentContainerStyle={{ gap: 6 }}
          >
            {DAYS_OF_WEEK.map((day) => {
              const count = (groupedSchedules[day] || []).length;
              const isSelected = selectedDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDay(day)}
                  className={`px-3 py-2 rounded-2xl border ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-600/20'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold font-sans ${
                      isSelected ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </Text>
                  <Text
                    className={`text-[10px] font-medium text-center font-sans ${
                      isSelected ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {count} {count === 1 ? 'mass' : 'masses'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Schedule List for Selected Day */}
          <View className="space-y-2">
            {currentDaySchedules.length > 0 ? (
              currentDaySchedules.map((schedule) => (
                <View
                  key={schedule.id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200/80 flex-row items-center justify-between shadow-xs mb-2"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center border border-blue-100">
                      <Clock size={16} color="#2563EB" />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-slate-900 font-sans">
                        {formatTime12(schedule.time || schedule.time_start)}
                      </Text>
                      {schedule.celebrant ? (
                        <Text className="text-[11px] text-slate-500 font-sans">
                          Celebrant: {schedule.celebrant}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Language Tag */}
                  <View className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    <Text className="text-[11px] font-semibold text-slate-700 font-sans">
                      {schedule.language || 'English'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View className="bg-white rounded-2xl p-6 border border-slate-200 items-center justify-center">
                <Clock size={24} color="#94A3B8" />
                <Text className="text-xs font-semibold text-slate-600 mt-2 font-sans">
                  No public masses scheduled on {selectedDay}s.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Parish Overview / Description */}
        {church.description && (
          <View className="px-5 pt-4 pb-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2">
              About the Parish
            </Text>
            <View className="bg-white rounded-2xl p-4 border border-slate-200/80">
              <Text className="text-xs text-slate-700 leading-relaxed font-sans">
                {church.description}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Parish AI Knowledge Assistant FAB */}
      {church && (
        <AIAssistantFAB
          churchId={church.id}
          churchName={church.name}
          bottomOffset={Platform.OS === 'ios' ? 36 : 24}
        />
      )}

      {/* Controlled Parishioner AI Chatbot Modal for in-page action card */}
      {church && (
        <ParishionerChatbotModal
          visible={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          initialChurchId={church.id}
          initialChurchName={church.name}
        />
      )}

      {/* Virtual Candle Lighting Modal */}
      {church && (
        <Modal
          visible={isCandleModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCandleModalOpen(false)}
        >
          <View className="flex-1 bg-black/70 items-center justify-center p-4">
            <View className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl">
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 items-center justify-center">
                    <Flame size={20} color="#F59E0B" />
                  </View>
                  <View>
                    <Text className="text-base font-bold text-white font-sans">
                      Light a Virtual Candle
                    </Text>
                    <Text className="text-[11px] text-amber-300 font-sans">
                      {candleCount} Candles Lit for {church.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsCandleModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {candleSuccess ? (
                <View className="py-8 items-center justify-center">
                  <View className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 items-center justify-center mb-3">
                    <Sparkles size={32} color="#F59E0B" />
                  </View>
                  <Text className="text-lg font-bold text-white font-sans text-center">
                    Candle Lit & Intention Offered
                  </Text>
                  <Text className="text-xs text-amber-200/80 font-sans text-center mt-1">
                    May your prayers and intentions be heard. Amen.
                  </Text>
                </View>
              ) : (
                <>
                  <Text className="text-xs text-slate-300 font-sans mb-2">
                    Leave your prayer petition or special intention (optional):
                  </Text>

                  <TextInput
                    value={intentionText}
                    onChangeText={setIntentionText}
                    placeholder="e.g., Thanksgiving for family blessings, healing for our loved ones..."
                    placeholderTextColor="#64748B"
                    multiline
                    numberOfLines={3}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 text-xs text-white font-sans mb-4 text-left align-top"
                    style={{ minHeight: 80, textAlignVertical: 'top' }}
                  />

                  <View className="flex-row items-center gap-2.5">
                    <TouchableOpacity
                      onPress={() => setIsCandleModalOpen(false)}
                      className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 items-center justify-center"
                    >
                      <Text className="text-xs font-semibold text-slate-300 font-sans">
                        Cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleLightCandleSubmit}
                      disabled={isLightingCandle}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r bg-amber-500 active:bg-amber-600 flex-row items-center justify-center gap-1.5 shadow-md shadow-amber-500/25"
                    >
                      {isLightingCandle ? (
                        <ActivityIndicator size="small" color="#0F172A" />
                      ) : (
                        <>
                          <Flame size={15} color="#0F172A" />
                          <Text className="text-xs font-bold text-slate-950 font-sans">
                            Light Candle
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Cashless Offertory / Love Offering Modal */}
      {church && (
        <Modal
          visible={isOffertoryModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsOffertoryModalOpen(false)}
        >
          <View className="flex-1 bg-black/70 justify-end">
            <View className="bg-slate-900 border-t border-rose-500/30 rounded-t-3xl p-5 max-h-[85%]">
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 items-center justify-center">
                    <HeartHandshake size={20} color="#F43F5E" />
                  </View>
                  <View>
                    <Text className="text-base font-bold text-white font-sans">
                      Love Offering & Tithes
                    </Text>
                    <Text className="text-[11px] text-rose-300 font-sans" numberOfLines={1}>
                      {church.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsOffertoryModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
                {/* QR Code if present */}
                {church.donation_qr_url && (
                  <View className="bg-white rounded-2xl p-4 items-center justify-center border border-slate-700">
                    <Image
                      source={{ uri: church.donation_qr_url }}
                      className="w-48 h-48"
                      resizeMode="contain"
                    />
                    <Text className="text-[11px] font-semibold text-slate-700 mt-2 font-sans">
                      Scan QR with GCash / Maya app
                    </Text>
                  </View>
                )}

                {/* GCash Box */}
                {church.gcash_number && (
                  <View className="bg-blue-950/60 border border-blue-600/40 rounded-2xl p-3.5 flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-[10px] font-bold text-blue-400 uppercase font-sans">
                        GCash Mobile Account
                      </Text>
                      <Text className="text-sm font-bold text-white font-sans mt-0.5">
                        {church.gcash_number}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleCopyGcash}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 flex-row items-center gap-1"
                    >
                      {copiedGcash ? (
                        <>
                          <Check size={12} color="#FFFFFF" />
                          <Text className="text-[11px] font-bold text-white font-sans">Copied</Text>
                        </>
                      ) : (
                        <>
                          <Copy size={12} color="#FFFFFF" />
                          <Text className="text-[11px] font-bold text-white font-sans">Copy</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Maya Box */}
                {church.maya_number && (
                  <View className="bg-emerald-950/60 border border-emerald-600/40 rounded-2xl p-3.5 flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-[10px] font-bold text-emerald-400 uppercase font-sans">
                        Maya Account
                      </Text>
                      <Text className="text-sm font-bold text-white font-sans mt-0.5">
                        {church.maya_number}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleCopyMaya}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 flex-row items-center gap-1"
                    >
                      {copiedMaya ? (
                        <>
                          <Check size={12} color="#FFFFFF" />
                          <Text className="text-[11px] font-bold text-white font-sans">Copied</Text>
                        </>
                      ) : (
                        <>
                          <Copy size={12} color="#FFFFFF" />
                          <Text className="text-[11px] font-bold text-white font-sans">Copy</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Submit Proof of Offering button */}
                <TouchableOpacity
                  onPress={() => {
                    setIsOffertoryModalOpen(false);
                    router.push({
                      pathname: '/donations/give',
                      params: { churchId: church.id, churchName: church.name },
                    } as any);
                  }}
                  className="w-full bg-rose-600 active:bg-rose-700 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5 shadow-md shadow-rose-600/25 mt-2 mb-4"
                >
                  <Text className="text-xs font-bold text-white font-sans">
                    Submit Offering Slip / Receipt
                  </Text>
                  <ChevronRight size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
