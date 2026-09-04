import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Clock,
  Church,
  FileText,
  AlertTriangle,
  User,
  Phone,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Info,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useChurches } from '@/lib/supabase/churches';
import {
  SACRAMENTS_META,
  STANDARD_TIME_SLOTS,
  formatAppointmentTime,
  formatAppointmentDate,
  useSacramentRequirements,
  useCheckSlotAvailability,
  createAppointment,
  type UploadedDocumentInput,
} from '@/lib/supabase/appointments';
import DocumentUploader from '@/components/appointments/DocumentUploader';

export default function BookAppointmentScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    churchId?: string;
    churchName?: string;
    sacrament?: string;
  }>();

  // Queries
  const { data: churches = [], isLoading: loadingChurches } = useChurches();

  // Form State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedChurchId, setSelectedChurchId] = useState<string>(params.churchId || '');
  const [selectedSacrament, setSelectedSacrament] = useState<string>(params.sacrament || 'Baptism');
  const [churchSelectorVisible, setChurchSelectorVisible] = useState(false);

  // Date and Time State
  const todayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Default to tomorrow
    return d.toISOString().split('T')[0];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTime, setSelectedTime] = useState<string>('09:00');

  // Next 14 days list for date picker
  const upcomingDates = useMemo(() => {
    const dates: { dateStr: string; dayName: string; dayNum: number; monthName: string }[] = [];
    const base = new Date();
    base.setDate(base.getDate() + 1); // start tomorrow

    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      dates.push({
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return dates;
  }, []);

  // Uploaded documents state (keyed by requirement ID or fallback ID)
  const [uploadedDocsMap, setUploadedDocsMap] = useState<Record<string, UploadedDocumentInput>>({});

  // Notes and Contact
  const [notes, setNotes] = useState('');
  const [contactPerson, setContactPerson] = useState(profile?.full_name || '');
  const [contactPhone, setContactPhone] = useState(profile?.phone_number || '');
  const [submitting, setSubmitting] = useState(false);

  // Auto-select first church if none specified and churches are loaded
  useEffect(() => {
    if (!selectedChurchId && churches.length > 0) {
      if (params.churchId) {
        setSelectedChurchId(params.churchId);
      } else {
        setSelectedChurchId(churches[0].id);
      }
    }
  }, [churches, params.churchId, selectedChurchId]);

  // Selected church object
  const currentChurch = useMemo(() => {
    return churches.find((c) => c.id === selectedChurchId) || null;
  }, [churches, selectedChurchId]);

  // Selected sacrament metadata
  const currentSacramentMeta = useMemo(() => {
    return (
      SACRAMENTS_META.find(
        (s) => s.type.toLowerCase() === selectedSacrament.toLowerCase()
      ) || SACRAMENTS_META[0]
    );
  }, [selectedSacrament]);

  // Slot Availability Check
  const { data: slotAvailability, isLoading: checkingSlot } = useCheckSlotAvailability(
    selectedChurchId,
    selectedDate,
    selectedTime,
    selectedSacrament
  );

  // Requirements Query
  const { data: requirements = [], isLoading: loadingRequirements } = useSacramentRequirements(
    selectedSacrament,
    selectedChurchId
  );

  // Check how many required documents are satisfied
  const requiredCount = useMemo(() => {
    return requirements.filter((r) => r.is_required).length;
  }, [requirements]);

  const satisfiedRequiredCount = useMemo(() => {
    return requirements.filter(
      (r) => r.is_required && Boolean(uploadedDocsMap[r.id])
    ).length;
  }, [requirements, uploadedDocsMap]);

  const allRequiredUploaded = requiredCount === 0 || satisfiedRequiredCount >= requiredCount;

  // Step Validation & Navigation
  const canProceedStep1 = Boolean(selectedChurchId && selectedSacrament);
  const canProceedStep2 = Boolean(
    selectedDate &&
      selectedTime &&
      !checkingSlot &&
      slotAvailability?.available !== false
  );
  const canProceedStep3 = allRequiredUploaded;

  const handleNext = () => {
    if (currentStep === 1) {
      if (!canProceedStep1) {
        Alert.alert('Selection Required', 'Please select a parish church and a sacrament.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!canProceedStep2) {
        Alert.alert(
          'Slot Unavailable',
          slotAvailability?.reason || 'Please select an available date and time slot.'
        );
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!canProceedStep3) {
        Alert.alert(
          'Required Documents Missing',
          `Please attach all ${requiredCount} required documents before proceeding to final confirmation.`
        );
        return;
      }
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as any);
    } else {
      router.back();
    }
  };

  // Final Submission
  const handleSubmitBooking = async () => {
    if (!profile?.id) {
      Alert.alert('Session Expired', 'Please sign in to complete your booking.');
      return;
    }
    if (!selectedChurchId) {
      Alert.alert('Missing Parish', 'Please select a valid parish church.');
      return;
    }

    setSubmitting(true);
    try {
      const docsList = Object.values(uploadedDocsMap);
      await createAppointment(
        {
          userId: profile.id,
          churchId: selectedChurchId,
          serviceType: currentSacramentMeta.type,
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          notes,
          contactPerson,
          contactPhone,
        },
        docsList
      );

      Alert.alert(
        'Booking Submitted!',
        'Your sacrament appointment request has been submitted successfully to the parish office for review.',
        [
          {
            text: 'View My Appointments',
            onPress: () => router.replace('/(tabs)/appointments' as any),
          },
        ]
      );
    } catch (err: any) {
      console.error('Error submitting appointment:', err);
      Alert.alert(
        'Submission Failed',
        err.message || 'Could not submit your booking request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-5 py-3.5 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={handleBack}
          className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
        >
          <ArrowLeft size={18} color="#0F172A" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-xs font-semibold text-blue-600 uppercase tracking-wider font-sans">
            Step {currentStep} of 4
          </Text>
          <Text className="text-base font-bold text-slate-900 font-heading">
            {currentStep === 1 && 'Select Church & Sacrament'}
            {currentStep === 2 && 'Date & Time Schedule'}
            {currentStep === 3 && 'Document Requirements'}
            {currentStep === 4 && 'Review & Confirm'}
          </Text>
        </View>
        <View className="w-9" />
      </View>

      {/* Progress Bar */}
      <View className="w-full bg-slate-200 h-1.5">
        <View
          className="bg-blue-600 h-1.5 transition-all"
          style={{ width: `${(currentStep / 4) * 100}%` }}
        />
      </View>

      {/* Main Body */}
      <ScrollView
        className="flex-1 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= STEP 1: CHURCH & SACRAMENT ================= */}
        {currentStep === 1 && (
          <View>
            {/* Parish Selection Picker */}
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              1. Parish Church
            </Text>

            {loadingChurches ? (
              <View className="bg-white p-4 rounded-2xl border border-slate-200 items-center mb-6">
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setChurchSelectorVisible(true)}
                className="bg-white p-4 rounded-2xl border border-slate-200 flex-row items-center justify-between shadow-xs mb-6 active:bg-slate-50"
              >
                <View className="flex-row items-center space-x-3 flex-1 mr-2">
                  <View className="w-11 h-11 rounded-xl bg-blue-50 items-center justify-center border border-blue-100">
                    <Church size={22} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-blue-600 font-semibold uppercase font-sans">
                      Selected Parish
                    </Text>
                    <Text
                      className="text-sm font-bold text-slate-900 font-sans"
                      numberOfLines={1}
                    >
                      {currentChurch?.name || 'Choose a Catholic Parish'}
                    </Text>
                    <Text
                      className="text-xs text-slate-500 font-sans"
                      numberOfLines={1}
                    >
                      {currentChurch?.city || currentChurch?.address || 'San Jose Del Monte'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center space-x-1 bg-slate-100 px-2.5 py-1.5 rounded-xl">
                  <Text className="text-xs font-semibold text-slate-600 font-sans">Change</Text>
                  <ChevronDown size={14} color="#64748B" />
                </View>
              </TouchableOpacity>
            )}

            {/* Sacrament Types Grid / List */}
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              2. Choose Sacrament / Liturgical Service
            </Text>

            <View className="space-y-3">
              {SACRAMENTS_META.map((sacrament) => {
                const isSelected =
                  selectedSacrament.toLowerCase() === sacrament.type.toLowerCase();

                return (
                  <TouchableOpacity
                    key={sacrament.type}
                    onPress={() => setSelectedSacrament(sacrament.type)}
                    className={`p-4 rounded-2xl border mb-3 transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-600 shadow-sm shadow-blue-600/10'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center space-x-2 mb-1">
                          <Text
                            className={`text-base font-bold font-sans ${
                              isSelected ? 'text-blue-900' : 'text-slate-900'
                            }`}
                          >
                            {sacrament.title}
                          </Text>
                          <View
                            className={`px-2 py-0.5 rounded-full ${
                              isSelected ? 'bg-blue-200/70' : 'bg-slate-100'
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-bold uppercase ${
                                isSelected ? 'text-blue-800' : 'text-slate-600'
                              }`}
                            >
                              {sacrament.badge}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-xs text-slate-500 font-sans leading-relaxed mb-2">
                          {sacrament.description}
                        </Text>
                        <View className="flex-row items-center space-x-1.5">
                          <Clock size={13} color="#64748B" />
                          <Text className="text-xs font-medium text-slate-600 font-sans">
                            Typical Duration: {sacrament.durationText}
                          </Text>
                        </View>
                      </View>

                      <View
                        className={`w-6 h-6 rounded-full border items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <CheckCircle2 size={16} color="#FFFFFF" />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ================= STEP 2: DATE & TIME ================= */}
        {currentStep === 2 && (
          <View>
            {/* Header info */}
            <View className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex-row items-center space-x-3 mb-5">
              <View className="w-10 h-10 rounded-xl bg-blue-600 items-center justify-center">
                <Sparkles size={20} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-blue-900 font-sans">
                  {currentSacramentMeta.title} • {currentChurch?.name}
                </Text>
                <Text className="text-[11px] text-blue-700 font-sans mt-0.5">
                  Duration: {currentSacramentMeta.durationText}
                </Text>
              </View>
            </View>

            {/* Date Selection */}
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              Select Appointment Date
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row space-x-2.5 mb-6 py-1"
            >
              {upcomingDates.map((item) => {
                const isSelected = selectedDate === item.dateStr;
                return (
                  <TouchableOpacity
                    key={item.dateStr}
                    onPress={() => setSelectedDate(item.dateStr)}
                    className={`w-18 py-3.5 px-3 rounded-2xl items-center border mr-2.5 ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-600/30'
                        : 'bg-white border-slate-200 active:bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-semibold uppercase ${
                        isSelected ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {item.dayName}
                    </Text>
                    <Text
                      className={`text-xl font-bold my-0.5 ${
                        isSelected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {item.dayNum}
                    </Text>
                    <Text
                      className={`text-[11px] font-medium ${
                        isSelected ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {item.monthName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time Slot Picker */}
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              Select Time Slot
            </Text>

            <View className="flex-row flex-wrap justify-between mb-5">
              {STANDARD_TIME_SLOTS.map((slot) => {
                const isSelected = selectedTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setSelectedTime(slot)}
                    className={`w-[31%] py-3 rounded-xl items-center border mb-3 ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-600/25'
                        : 'bg-white border-slate-200 active:bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      {formatAppointmentTime(slot)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Real-time Availability Status Banner */}
            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center space-x-2">
                  <Calendar size={16} color="#2563EB" />
                  <Text className="text-xs font-bold text-slate-800 font-sans">
                    {formatAppointmentDate(selectedDate)} at {formatAppointmentTime(selectedTime)}
                  </Text>
                </View>

                {checkingSlot ? (
                  <View className="flex-row items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-full">
                    <ActivityIndicator size="small" color="#64748B" />
                    <Text className="text-[11px] font-semibold text-slate-600 font-sans">
                      Checking...
                    </Text>
                  </View>
                ) : slotAvailability?.available !== false ? (
                  <View className="flex-row items-center space-x-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 size={12} color="#059669" />
                    <Text className="text-[11px] font-bold text-emerald-700 font-sans">
                      Slot Available
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center space-x-1 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    <AlertTriangle size={12} color="#E11D48" />
                    <Text className="text-[11px] font-bold text-rose-700 font-sans">
                      Slot Blocked
                    </Text>
                  </View>
                )}
              </View>

              {slotAvailability?.available === false && (
                <View className="mt-3 pt-3 border-t border-slate-100">
                  <Text className="text-xs text-rose-600 font-sans">
                    ⚠️ {slotAvailability.reason || 'This slot cannot be reserved. Please select another time or date.'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ================= STEP 3: DOCUMENTS ================= */}
        {currentStep === 3 && (
          <View>
            <View className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-bold text-blue-900 font-sans">
                  Document Requirements
                </Text>
                <View className="bg-blue-600 px-2.5 py-0.5 rounded-full">
                  <Text className="text-[11px] font-bold text-white font-sans">
                    {satisfiedRequiredCount} of {requiredCount} Required
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-blue-700 font-sans leading-relaxed">
                Upload official certificates or clearance documents for {currentSacramentMeta.title}. You can capture photos using your camera or attach PDF copies.
              </Text>
            </View>

            {loadingRequirements ? (
              <View className="bg-white p-8 rounded-2xl border border-slate-200 items-center my-4">
                <ActivityIndicator size="small" color="#2563EB" />
                <Text className="text-xs text-slate-500 font-sans mt-2">
                  Loading requirement checklist...
                </Text>
              </View>
            ) : requirements.length === 0 ? (
              <View className="bg-white p-6 rounded-2xl border border-slate-200 items-center my-4">
                <Info size={24} color="#64748B" />
                <Text className="text-sm font-bold text-slate-800 font-sans mt-2">
                  No Documents Required
                </Text>
                <Text className="text-xs text-slate-500 font-sans text-center mt-1">
                  This parish service does not require advance document submissions.
                </Text>
              </View>
            ) : (
              requirements.map((req) => (
                <DocumentUploader
                  key={req.id}
                  requirement={req}
                  value={uploadedDocsMap[req.id] || null}
                  onChange={(file) => {
                    setUploadedDocsMap((prev) => {
                      const updated = { ...prev };
                      if (file) {
                        updated[req.id] = file;
                      } else {
                        delete updated[req.id];
                      }
                      return updated;
                    });
                  }}
                />
              ))
            )}
          </View>
        )}

        {/* ================= STEP 4: REVIEW & CONFIRM ================= */}
        {currentStep === 4 && (
          <View>
            {/* Contact Person Details */}
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              Contact Person Information
            </Text>

            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs mb-5">
              <View className="mb-3">
                <View className="flex-row items-center space-x-1.5 mb-1">
                  <User size={14} color="#64748B" />
                  <Text className="text-xs font-bold text-slate-700 font-sans">
                    Full Name
                  </Text>
                </View>
                <TextInput
                  value={contactPerson}
                  onChangeText={setContactPerson}
                  placeholder="e.g., Juan Dela Cruz"
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-sans"
                />
              </View>

              <View>
                <View className="flex-row items-center space-x-1.5 mb-1">
                  <Phone size={14} color="#64748B" />
                  <Text className="text-xs font-bold text-slate-700 font-sans">
                    Contact Phone / Mobile
                  </Text>
                </View>
                <TextInput
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="e.g., 09171234567"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-sans"
                />
              </View>
            </View>

            {/* Special Intentions & Notes */}
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              Special Intentions & Notes (Optional)
            </Text>

            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs mb-5">
              <View className="flex-row items-center space-x-1.5 mb-2">
                <MessageSquare size={14} color="#64748B" />
                <Text className="text-xs font-bold text-slate-700 font-sans">
                  Intentions / Instructions for the Parish Office
                </Text>
              </View>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add names for mass intentions, special prayer requests, sponsor notes, or pastoral considerations..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-sans h-24"
              />
            </View>

            {/* Booking Summary Card */}
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              Booking Summary
            </Text>

            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs mb-6">
              {/* Church & Sacrament */}
              <View className="flex-row items-center space-x-3 pb-3 border-b border-slate-100">
                <View className="w-12 h-12 rounded-xl bg-blue-600 items-center justify-center">
                  <Church size={22} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 font-heading">
                    {currentSacramentMeta.title}
                  </Text>
                  <Text className="text-xs text-slate-600 font-sans">
                    {currentChurch?.name}
                  </Text>
                  <Text className="text-[11px] text-slate-400 font-sans">
                    {currentChurch?.city}
                  </Text>
                </View>
              </View>

              {/* Schedule */}
              <View className="py-3 border-b border-slate-100 flex-row items-center justify-between">
                <View className="flex-row items-center space-x-2">
                  <Calendar size={15} color="#2563EB" />
                  <Text className="text-xs font-semibold text-slate-800 font-sans">
                    {formatAppointmentDate(selectedDate)}
                  </Text>
                </View>
                <View className="flex-row items-center space-x-1">
                  <Clock size={15} color="#64748B" />
                  <Text className="text-xs font-bold text-blue-700 font-sans">
                    {formatAppointmentTime(selectedTime)}
                  </Text>
                </View>
              </View>

              {/* Documents count */}
              <View className="pt-3 flex-row items-center justify-between">
                <View className="flex-row items-center space-x-2">
                  <FileText size={15} color="#64748B" />
                  <Text className="text-xs text-slate-700 font-sans">
                    Uploaded Documents
                  </Text>
                </View>
                <Text className="text-xs font-bold text-emerald-700 font-sans">
                  {Object.keys(uploadedDocsMap).length} Attached
                </Text>
              </View>
            </View>

            {/* Disclaimer */}
            <View className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex-row items-start space-x-2 mb-4">
              <Info size={14} color="#D97706" style={{ marginTop: 2 }} />
              <Text className="text-[11px] text-amber-800 font-sans leading-relaxed flex-1">
                Your booking will be placed in &quot;Pending Review&quot; status. The parish secretary will verify schedules and submitted documents before final confirmation.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Navigation Actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-5 py-4 flex-row items-center justify-between shadow-lg">
        {currentStep > 1 ? (
          <TouchableOpacity
            onPress={handleBack}
            className="px-4 py-3 rounded-xl border border-slate-200 active:bg-slate-100 mr-3"
          >
            <Text className="text-xs font-bold text-slate-700 font-sans">Back</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}

        {currentStep < 4 ? (
          <TouchableOpacity
            onPress={handleNext}
            className="flex-1 bg-blue-600 py-3.5 rounded-xl flex-row items-center justify-center space-x-2 shadow-md shadow-blue-600/25 active:bg-blue-700"
          >
            <Text className="text-xs font-bold text-white uppercase tracking-wider font-sans">
              Continue to Step {currentStep + 1}
            </Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmitBooking}
            disabled={submitting}
            className="flex-1 bg-blue-600 py-3.5 rounded-xl flex-row items-center justify-center space-x-2 shadow-md shadow-blue-600/25 active:bg-blue-700"
          >
            {submitting ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Submitting Booking...
                </Text>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Confirm & Submit Booking
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Parish Selector Modal */}
      <Modal
        visible={churchSelectorVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setChurchSelectorVisible(false)}
      >
        <SafeAreaView edges={['bottom']} className="flex-1 bg-slate-900/60 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[80%] p-6 border-t border-slate-200">
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <Text className="text-base font-bold text-slate-900 font-heading">
                Select Parish Church
              </Text>
              <TouchableOpacity
                onPress={() => setChurchSelectorVisible(false)}
                className="px-3 py-1 rounded-lg bg-slate-100"
              >
                <Text className="text-xs font-bold text-slate-600 font-sans">Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {churches.map((church) => {
                const isSelected = church.id === selectedChurchId;
                return (
                  <TouchableOpacity
                    key={church.id}
                    onPress={() => {
                      setSelectedChurchId(church.id);
                      setChurchSelectorVisible(false);
                    }}
                    className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-slate-50 border-slate-200 active:bg-slate-100'
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-bold text-slate-900 font-sans">
                        {church.name}
                      </Text>
                      <Text className="text-xs text-slate-500 font-sans mt-0.5">
                        {church.city}
                      </Text>
                    </View>
                    {isSelected && <CheckCircle2 size={18} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
