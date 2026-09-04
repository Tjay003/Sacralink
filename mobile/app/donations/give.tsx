import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Church,
  QrCode,
  Camera,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Search,
  Receipt,
  Heart,
  FileCheck,
  X,
  Sparkles,
} from 'lucide-react-native';
import { useChurches, type Church as ChurchType } from '@/lib/supabase/churches';
import {
  DONATION_PURPOSES,
  type DonationPurpose,
  submitDonation,
  compressDonationReceipt,
  useChurchPaymentInfo,
} from '@/lib/supabase/donations';
import QRCodeModal from '@/components/donations/QRCodeModal';

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2500];

export default function GiveDonationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    churchId?: string;
    churchName?: string;
  }>();

  // Queries
  const { data: churches = [], isLoading: churchesLoading } = useChurches();

  // Selected church state
  const [selectedChurchId, setSelectedChurchId] = useState<string>(
    params.churchId || ''
  );
  const [churchPickerVisible, setChurchPickerVisible] = useState(false);
  const [churchSearchQuery, setChurchSearchQuery] = useState('');

  // Preselect church from params or first church when loaded
  useEffect(() => {
    if (params.churchId) {
      setSelectedChurchId(params.churchId);
    } else if (!selectedChurchId && churches.length > 0) {
      setSelectedChurchId(churches[0].id);
    }
  }, [params.churchId, churches, selectedChurchId]);

  const selectedChurch = useMemo(() => {
    return churches.find((c) => c.id === selectedChurchId) || null;
  }, [churches, selectedChurchId]);

  const { data: paymentInfo } = useChurchPaymentInfo(selectedChurchId || undefined);

  // Form states
  const [purpose, setPurpose] = useState<DonationPurpose>('Mass Offering');
  const [amount, setAmount] = useState<string>('200');
  const [customAmountActive, setCustomAmountActive] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [donorNotes, setDonorNotes] = useState('');

  // Receipt image states
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [receiptSize, setReceiptSize] = useState<number | undefined>(undefined);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [imagePickerModalVisible, setImagePickerModalVisible] = useState(false);

  // Modals & submission
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter churches in selector
  const filteredChurches = useMemo(() => {
    if (!churchSearchQuery.trim()) return churches;
    const q = churchSearchQuery.toLowerCase().trim();
    return churches.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [churches, churchSearchQuery]);

  // Handle preset amount selection
  const handleSelectPreset = (preset: number) => {
    setAmount(preset.toString());
    setCustomAmountActive(false);
    if (formErrors.amount) {
      setFormErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  const handleAmountChange = (text: string) => {
    // Keep only numbers and optional single decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    setAmount(cleaned);
    const num = parseFloat(cleaned);
    setCustomAmountActive(!PRESET_AMOUNTS.includes(num));
    if (formErrors.amount) {
      setFormErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  // Image handlers
  const processSelectedImage = async (uri: string, name?: string) => {
    try {
      setImageCompressing(true);
      const compressed = await compressDonationReceipt(uri);
      setReceiptUri(compressed.uri);
      setReceiptSize(compressed.size);
      setReceiptFileName(name || `receipt_${Date.now()}.jpg`);
      if (formErrors.receipt) {
        setFormErrors((prev) => ({ ...prev, receipt: '' }));
      }
    } catch (err) {
      console.error('Error compressing receipt:', err);
      Alert.alert('Compression Error', 'Could not optimize screenshot. Using original image.');
      setReceiptUri(uri);
      setReceiptFileName(name || `receipt_${Date.now()}.jpg`);
    } finally {
      setImageCompressing(false);
    }
  };

  const handlePickFromGallery = async () => {
    setImagePickerModalVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow SacraLink access to select your payment screenshot.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processSelectedImage(asset.uri, asset.fileName || 'gallery_receipt.jpg');
      }
    } catch (err) {
      console.error('Error picking from gallery:', err);
      Alert.alert('Gallery Error', 'Failed to pick image from photo gallery.');
    }
  };

  const handleCaptureCamera = async () => {
    setImagePickerModalVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Access Required',
          'Please allow SacraLink access to take a photo of your receipt.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processSelectedImage(asset.uri, asset.fileName || 'camera_receipt.jpg');
      }
    } catch (err) {
      console.error('Error capturing from camera:', err);
      Alert.alert('Camera Error', 'Failed to open device camera.');
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptUri(null);
    setReceiptFileName(null);
    setReceiptSize(undefined);
  };

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedChurchId) {
      errors.church = 'Please select a recipient church.';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = 'Please enter a valid amount greater than ₱0.';
    }

    if (!referenceNumber.trim()) {
      errors.referenceNumber = 'Please enter your GCash or Maya transaction reference number.';
    } else if (referenceNumber.trim().length < 5) {
      errors.referenceNumber = 'Reference number should be at least 5 characters.';
    }

    if (!receiptUri) {
      errors.receipt = 'Please attach a screenshot of your transaction receipt.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      await submitDonation({
        churchId: selectedChurchId,
        amount: parseFloat(amount),
        purpose,
        referenceNumber: referenceNumber.trim(),
        donorNotes: donorNotes.trim() || undefined,
        receiptUri: receiptUri!,
        receiptFileName: receiptFileName || 'receipt.jpg',
      });

      setSuccessModalVisible(true);
    } catch (err: any) {
      console.error('Error submitting donation:', err);
      Alert.alert(
        'Submission Failed',
        err?.message || 'Unable to submit donation. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDone = () => {
    setSuccessModalVisible(false);
    router.replace('/(tabs)/donations' as any);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-5 py-3.5 bg-white border-b border-slate-200 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-slate-900 font-sans">
            Give Cashless Donation
          </Text>
          <View className="w-9" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recipient Church Card / Selector */}
          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              1. Recipient Parish
            </Text>

            <TouchableOpacity
              onPress={() => setChurchPickerVisible(true)}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex-row items-center justify-between"
            >
              <View className="flex-row items-center space-x-3 flex-1 pr-2">
                <View className="w-11 h-11 rounded-2xl bg-blue-50 items-center justify-center border border-blue-100">
                  <Church size={22} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    className="text-sm font-bold text-slate-900 font-sans"
                  >
                    {selectedChurch ? selectedChurch.name : 'Select a Parish'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="text-xs text-slate-500 font-sans mt-0.5"
                  >
                    {selectedChurch?.address || 'Tap to choose from diocesan churches'}
                  </Text>
                </View>
              </View>
              <View className="bg-slate-100 px-2.5 py-1.5 rounded-xl flex-row items-center space-x-1">
                <Text className="text-[11px] font-semibold text-slate-700 font-sans">
                  Change
                </Text>
                <ChevronDown size={14} color="#64748B" />
              </View>
            </TouchableOpacity>
            {formErrors.church && (
              <Text className="text-xs text-rose-500 font-sans mt-1.5">
                {formErrors.church}
              </Text>
            )}
          </View>

          {/* View Parish QR Code Banner */}
          <View className="mb-5">
            <TouchableOpacity
              onPress={() => setQrModalVisible(true)}
              className="bg-gradient-to-r bg-blue-600 rounded-2xl p-4 flex-row items-center justify-between shadow-md shadow-blue-600/20"
            >
              <View className="flex-row items-center space-x-3 flex-1 pr-2">
                <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
                  <QrCode size={22} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center space-x-1.5">
                    <Text className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                      View Parish QR Code
                    </Text>
                    <View className="bg-amber-400 px-1.5 py-0.5 rounded">
                      <Text className="text-[9px] font-bold text-slate-900">QR Ph</Text>
                    </View>
                  </View>
                  <Text className="text-[11px] text-blue-100 font-sans mt-0.5">
                    Scan official GCash or Maya code to transfer
                  </Text>
                </View>
              </View>
              <View className="bg-white px-3 py-1.5 rounded-xl">
                <Text className="text-xs font-bold text-blue-700 font-sans">
                  Open QR
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Purpose Selector Pills */}
          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              2. Donation Purpose
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DONATION_PURPOSES.map((item) => {
                const isSelected = purpose === item;
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setPurpose(item)}
                    className={`px-3.5 py-2.5 rounded-xl border ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 shadow-xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold font-sans ${
                        isSelected ? 'text-white' : 'text-slate-700'
                      }`}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Amount Section */}
          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              3. Donation Amount (₱)
            </Text>

            {/* Quick-Select Buttons */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {PRESET_AMOUNTS.map((preset) => {
                const isSelected =
                  !customAmountActive && parseFloat(amount) === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => handleSelectPreset(preset)}
                    className={`flex-1 min-w-[28%] py-2.5 rounded-xl items-center border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold font-sans ${
                        isSelected ? 'text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      ₱{preset.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount Input */}
            <View
              className={`bg-white rounded-2xl border px-4 py-3 flex-row items-center ${
                formErrors.amount
                  ? 'border-rose-300'
                  : 'border-slate-200'
              }`}
            >
              <Text className="text-xl font-bold text-slate-900 font-sans mr-2">
                ₱
              </Text>
              <TextInput
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                className="flex-1 text-xl font-bold text-slate-900 font-sans p-0"
              />
              {customAmountActive && (
                <View className="bg-amber-100 px-2 py-0.5 rounded-md">
                  <Text className="text-[10px] font-bold text-amber-800 uppercase font-sans">
                    Custom
                  </Text>
                </View>
              )}
            </View>
            {formErrors.amount && (
              <Text className="text-xs text-rose-500 font-sans mt-1.5">
                {formErrors.amount}
              </Text>
            )}
          </View>

          {/* Reference Number Input */}
          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              4. GCash / Maya Reference Number
            </Text>
            <View
              className={`bg-white rounded-2xl border px-4 py-3 flex-row items-center ${
                formErrors.referenceNumber
                  ? 'border-rose-300'
                  : 'border-slate-200'
              }`}
            >
              <Receipt size={18} color="#64748B" className="mr-2.5" />
              <TextInput
                value={referenceNumber}
                onChangeText={(text) => {
                  setReferenceNumber(text);
                  if (formErrors.referenceNumber) {
                    setFormErrors((prev) => ({ ...prev, referenceNumber: '' }));
                  }
                }}
                placeholder="e.g. 1029384756 or GCASH-991283"
                placeholderTextColor="#94A3B8"
                className="flex-1 text-sm font-semibold text-slate-900 font-sans p-0"
                autoCapitalize="characters"
              />
            </View>
            {formErrors.referenceNumber && (
              <Text className="text-xs text-rose-500 font-sans mt-1.5">
                {formErrors.referenceNumber}
              </Text>
            )}
            <Text className="text-[11px] text-slate-400 font-sans mt-1">
              Found on your transaction confirmation receipt screen.
            </Text>
          </View>

          {/* Screenshot Picker */}
          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              5. Receipt Screenshot Proof
            </Text>

            {receiptUri ? (
              <View className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
                <View className="flex-row items-center space-x-3">
                  <Image
                    source={{ uri: receiptUri }}
                    className="w-16 h-16 rounded-xl bg-slate-100"
                    resizeMode="cover"
                  />
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-xs font-bold text-slate-900 font-sans"
                    >
                      {receiptFileName || 'receipt_screenshot.jpg'}
                    </Text>
                    <View className="flex-row items-center space-x-2 mt-1">
                      <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex-row items-center space-x-1">
                        <CheckCircle2 size={10} color="#059669" />
                        <Text className="text-[10px] font-bold text-emerald-700 font-sans">
                          Compressed (&lt;200KB)
                        </Text>
                      </View>
                      {receiptSize && (
                        <Text className="text-[10px] text-slate-400 font-sans">
                          {(receiptSize / 1024).toFixed(0)} KB
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="flex-row items-center space-x-1">
                    <TouchableOpacity
                      onPress={() => setImagePickerModalVisible(true)}
                      className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                      accessibilityLabel="Replace receipt"
                    >
                      <RefreshCw size={14} color="#0F172A" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleRemoveReceipt}
                      className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center"
                      accessibilityLabel="Remove receipt"
                    >
                      <Trash2 size={14} color="#E11D48" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setImagePickerModalVisible(true)}
                className={`bg-white rounded-2xl border-2 border-dashed p-6 items-center justify-center ${
                  formErrors.receipt
                    ? 'border-rose-300 bg-rose-50/20'
                    : 'border-slate-200'
                }`}
              >
                {imageCompressing ? (
                  <View className="items-center">
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text className="text-xs text-slate-500 font-sans mt-2">
                      Optimizing screenshot...
                    </Text>
                  </View>
                ) : (
                  <>
                    <View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center mb-2">
                      <Camera size={24} color="#2563EB" />
                    </View>
                    <Text className="text-xs font-bold text-slate-800 font-sans">
                      Upload Payment Screenshot
                    </Text>
                    <Text className="text-[11px] text-slate-400 font-sans mt-0.5 text-center">
                      Take a photo or choose from photo gallery
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {formErrors.receipt && (
              <Text className="text-xs text-rose-500 font-sans mt-1.5">
                {formErrors.receipt}
              </Text>
            )}
          </View>

          {/* Prayer Intentions / Donor Notes */}
          <View className="mb-6">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans mb-2">
              6. Prayer Intentions / Donor Notes (Optional)
            </Text>
            <View className="bg-white rounded-2xl border border-slate-200 p-3">
              <TextInput
                value={donorNotes}
                onChangeText={setDonorNotes}
                placeholder="Include special intentions, thanksgiving prayers, or dedication for this offering..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="text-xs font-sans text-slate-900 min-h-[70px] p-0"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`w-full py-4 rounded-2xl items-center flex-row justify-center space-x-2 ${
              submitting
                ? 'bg-blue-400'
                : 'bg-blue-600 shadow-md shadow-blue-600/25'
            }`}
          >
            {submitting ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="text-xs font-bold text-white uppercase tracking-wider font-sans ml-2">
                  Submitting Donation...
                </Text>
              </>
            ) : (
              <>
                <Heart size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Submit Donation for Verification
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Parish Selector Modal */}
      <Modal
        visible={churchPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setChurchPickerVisible(false)}
      >
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View
            style={{ maxHeight: '85%' }}
            className="bg-white rounded-t-3xl border-t border-slate-200 overflow-hidden"
          >
            {/* Modal Header */}
            <View className="px-5 py-4 border-b border-slate-100 flex-row items-center justify-between">
              <Text className="text-base font-bold text-slate-900 font-sans">
                Select Recipient Parish
              </Text>
              <TouchableOpacity
                onPress={() => setChurchPickerVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="px-5 py-3 border-b border-slate-100">
              <View className="bg-slate-100 rounded-xl px-3 py-2 flex-row items-center space-x-2">
                <Search size={16} color="#64748B" />
                <TextInput
                  value={churchSearchQuery}
                  onChangeText={setChurchSearchQuery}
                  placeholder="Search church by name or address..."
                  placeholderTextColor="#94A3B8"
                  className="flex-1 text-xs font-sans text-slate-900 p-0"
                />
              </View>
            </View>

            {/* Church List */}
            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {churchesLoading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#2563EB" />
                </View>
              ) : filteredChurches.length === 0 ? (
                <View className="py-8 items-center">
                  <Text className="text-xs text-slate-400 font-sans">
                    No churches match your search.
                  </Text>
                </View>
              ) : (
                filteredChurches.map((c) => {
                  const isSelected = c.id === selectedChurchId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        setSelectedChurchId(c.id);
                        setChurchPickerVisible(false);
                        if (formErrors.church) {
                          setFormErrors((prev) => ({ ...prev, church: '' }));
                        }
                      }}
                      className={`p-3.5 rounded-2xl mb-2.5 border flex-row items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <View className="flex-row items-center space-x-3 flex-1 pr-2">
                        <View className="w-10 h-10 rounded-xl bg-blue-100/50 items-center justify-center">
                          <Church size={18} color="#2563EB" />
                        </View>
                        <View className="flex-1">
                          <Text
                            numberOfLines={1}
                            className={`text-xs font-bold font-sans ${
                              isSelected ? 'text-blue-900' : 'text-slate-900'
                            }`}
                          >
                            {c.name}
                          </Text>
                          <Text
                            numberOfLines={1}
                            className="text-[11px] text-slate-500 font-sans mt-0.5"
                          >
                            {c.address}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center">
                          <CheckCircle2 size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Picker Action Sheet Modal */}
      <Modal
        visible={imagePickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePickerModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View className="bg-white rounded-t-3xl p-5 border-t border-slate-200">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold text-slate-900 font-sans">
                Attach Payment Screenshot
              </Text>
              <TouchableOpacity
                onPress={() => setImagePickerModalVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handlePickFromGallery}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex-row items-center space-x-3 mb-3"
            >
              <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center">
                <ImageIcon size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-900 font-sans">
                  Choose from Photo Library
                </Text>
                <Text className="text-[11px] text-slate-500 font-sans">
                  Select saved GCash / Maya transaction receipt
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCaptureCamera}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex-row items-center space-x-3"
            >
              <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center">
                <Camera size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-900 font-sans">
                  Take Photo with Camera
                </Text>
                <Text className="text-[11px] text-slate-500 font-sans">
                  Capture receipt screen from another device
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Official Parish QR Modal */}
      <QRCodeModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        churchId={selectedChurchId}
        churchName={selectedChurch?.name}
        paymentInfo={paymentInfo}
      />

      {/* Submission Success Modal */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessDone}
      >
        <View className="flex-1 bg-slate-900/60 items-center justify-center p-5">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center shadow-xl border border-slate-100">
            <View className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 items-center justify-center mb-4">
              <Sparkles size={28} color="#059669" />
            </View>

            <Text className="text-lg font-bold text-slate-900 font-sans text-center mb-1">
              Donation Submitted!
            </Text>

            <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed mb-5">
              Thank you for your generosity! Your donation proof has been sent to{' '}
              <Text className="font-bold text-slate-700">
                {selectedChurch?.name || 'the parish'}
              </Text>{' '}
              for verification.
            </Text>

            <View className="bg-slate-50 rounded-2xl p-3 w-full mb-5 border border-slate-100 space-y-1.5">
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-slate-500 font-sans">Amount</Text>
                <Text className="text-[11px] font-bold text-slate-900 font-sans">
                  ₱{parseFloat(amount || '0').toLocaleString()}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-slate-500 font-sans">Purpose</Text>
                <Text className="text-[11px] font-bold text-slate-900 font-sans">
                  {purpose}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-slate-500 font-sans">Reference No.</Text>
                <Text className="text-[11px] font-bold text-slate-900 font-sans">
                  {referenceNumber}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSuccessDone}
              className="w-full bg-blue-600 py-3.5 rounded-2xl items-center shadow-md shadow-blue-600/20"
            >
              <Text className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                View in Donations Ledger
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
