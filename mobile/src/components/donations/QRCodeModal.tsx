import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  Copy,
  Check,
  QrCode,
  Smartphone,
  Receipt,
  Maximize2,
  ShieldCheck,
  Info,
} from 'lucide-react-native';
import {
  useChurchPaymentInfo,
  type ChurchPaymentInfo,
} from '@/lib/supabase/donations';

export interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  churchId?: string;
  churchName?: string;
  paymentInfo?: ChurchPaymentInfo | null;
}

type PaymentTab = 'gcash' | 'maya';

const fallbackQrImage = require('../../../assets/qr-sample.png');

export default function QRCodeModal({
  visible,
  onClose,
  churchId,
  churchName,
  paymentInfo: initialPaymentInfo,
}: QRCodeModalProps) {
  const { data: fetchedInfo, isLoading } = useChurchPaymentInfo(churchId);
  const paymentInfo = initialPaymentInfo || fetchedInfo;

  const [activeTab, setActiveTab] = useState<PaymentTab>('gcash');
  const [copied, setCopied] = useState(false);
  const [zoomModalVisible, setZoomModalVisible] = useState(false);

  const displayName = churchName || paymentInfo?.churchName || 'Parish Office';

  // Determine active QR URL & account number
  const currentQrUrl =
    activeTab === 'gcash'
      ? paymentInfo?.gcashQrUrl || paymentInfo?.donationQrUrl
      : paymentInfo?.mayaQrUrl || paymentInfo?.donationQrUrl;

  const currentAccountNumber =
    activeTab === 'gcash'
      ? paymentInfo?.gcashNumber || '09123456789'
      : paymentInfo?.mayaNumber || '09123456789';

  const isConfigured = Boolean(
    activeTab === 'gcash'
      ? paymentInfo?.gcashQrUrl || paymentInfo?.gcashNumber
      : paymentInfo?.mayaQrUrl || paymentInfo?.mayaNumber
  );

  const handleCopy = async () => {
    if (!currentAccountNumber) return;
    await Clipboard.setStringAsync(currentAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const windowWidth = Dimensions.get('window').width;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View
            style={{ maxHeight: '92%' }}
            className="bg-white rounded-t-3xl border-t border-slate-200 overflow-hidden"
          >
            {/* Modal Header */}
            <View className="px-5 py-4 border-b border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2 flex-1 pr-3">
                <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                  <QrCode size={18} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans">
                    Official Parish QR
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="text-base font-bold text-slate-900 font-sans"
                  >
                    {displayName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                accessibilityLabel="Close QR Code modal"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Payment Method Selector Tabs */}
              <View className="flex-row bg-slate-100 p-1 rounded-2xl mb-4">
                <TouchableOpacity
                  onPress={() => setActiveTab('gcash')}
                  className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center space-x-2 ${
                    activeTab === 'gcash'
                      ? 'bg-blue-600 shadow-xs'
                      : 'bg-transparent'
                  }`}
                >
                  <View
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeTab === 'gcash' ? 'bg-blue-200' : 'bg-blue-600'
                    }`}
                  />
                  <Text
                    className={`text-xs font-bold font-sans ${
                      activeTab === 'gcash' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    GCash
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('maya')}
                  className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center space-x-2 ${
                    activeTab === 'maya'
                      ? 'bg-emerald-600 shadow-xs'
                      : 'bg-transparent'
                  }`}
                >
                  <View
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeTab === 'maya' ? 'bg-emerald-200' : 'bg-emerald-600'
                    }`}
                  />
                  <Text
                    className={`text-xs font-bold font-sans ${
                      activeTab === 'maya' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    Maya
                  </Text>
                </TouchableOpacity>
              </View>

              {/* QR Code Container */}
              <View className="bg-slate-50 rounded-3xl p-5 border border-slate-200 items-center mb-4">
                <View className="relative bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                  {currentQrUrl ? (
                    <Image
                      source={{ uri: currentQrUrl }}
                      className="w-56 h-56 rounded-xl"
                      resizeMode="contain"
                    />
                  ) : (
                    <View className="items-center justify-center">
                      <Image
                        source={fallbackQrImage}
                        className="w-56 h-56 rounded-xl opacity-70"
                        resizeMode="contain"
                      />
                      <View className="absolute inset-0 items-center justify-center bg-slate-900/10 rounded-xl">
                        <View className="bg-white/95 px-3 py-1.5 rounded-full border border-slate-200 shadow-xs flex-row items-center space-x-1.5">
                          <ShieldCheck size={14} color="#2563EB" />
                          <Text className="text-[11px] font-bold text-slate-800 font-sans">
                            Standard QR Ph
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Zoom tap indicator */}
                  <TouchableOpacity
                    onPress={() => setZoomModalVisible(true)}
                    className="absolute bottom-2 right-2 bg-slate-900/80 p-2 rounded-xl flex-row items-center space-x-1"
                  >
                    <Maximize2 size={13} color="#FFFFFF" />
                    <Text className="text-[10px] font-semibold text-white font-sans">
                      Zoom
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Status indicator */}
                <View className="flex-row items-center space-x-1.5 mt-3">
                  <ShieldCheck size={14} color="#059669" />
                  <Text className="text-xs font-semibold text-slate-600 font-sans">
                    Parish Verified {activeTab === 'gcash' ? 'GCash' : 'Maya'} Merchant
                  </Text>
                </View>
              </View>

              {/* Account Details Box */}
              <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-2xs">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-sans mb-3">
                  Merchant Account Details
                </Text>

                <View className="mb-3">
                  <Text className="text-[11px] text-slate-500 font-sans">
                    Account Name
                  </Text>
                  <Text className="text-sm font-bold text-slate-900 font-sans">
                    {paymentInfo?.accountName || displayName}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
                  <View className="flex-1 pr-2">
                    <Text className="text-[11px] text-slate-500 font-sans">
                      {activeTab === 'gcash' ? 'GCash Mobile Number' : 'Maya Mobile Number'}
                    </Text>
                    <Text className="text-base font-bold text-slate-900 font-sans tracking-wide">
                      {currentAccountNumber}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleCopy}
                    className={`px-3.5 py-2 rounded-xl flex-row items-center space-x-1.5 ${
                      copied ? 'bg-emerald-50 border border-emerald-300' : 'bg-slate-100'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={14} color="#059669" />
                        <Text className="text-xs font-bold text-emerald-700 font-sans">
                          Copied!
                        </Text>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color="#0F172A" />
                        <Text className="text-xs font-bold text-slate-800 font-sans">
                          Copy
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* How to Pay 3-Step Guide */}
              <View className="bg-blue-50/70 rounded-2xl p-4 border border-blue-100 mb-4">
                <View className="flex-row items-center space-x-1.5 mb-3">
                  <Info size={15} color="#2563EB" />
                  <Text className="text-xs font-bold text-blue-900 font-sans uppercase tracking-wider">
                    How to Pay in 3 Easy Steps
                  </Text>
                </View>

                {/* Step 1 */}
                <View className="flex-row items-start space-x-3 mb-2.5">
                  <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center">
                    <Text className="text-xs font-bold text-white font-sans">1</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-900 font-sans">
                      Scan QR or Copy Number
                    </Text>
                    <Text className="text-[11px] text-slate-600 font-sans leading-relaxed">
                      Open your {activeTab === 'gcash' ? 'GCash' : 'Maya'} app, scan the parish QR code, or paste the mobile account number.
                    </Text>
                  </View>
                </View>

                {/* Step 2 */}
                <View className="flex-row items-start space-x-3 mb-2.5">
                  <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center">
                    <Text className="text-xs font-bold text-white font-sans">2</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-900 font-sans">
                      Complete E-Wallet Transfer
                    </Text>
                    <Text className="text-[11px] text-slate-600 font-sans leading-relaxed">
                      Enter your desired donation amount and confirm your transaction.
                    </Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View className="flex-row items-start space-x-3">
                  <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center">
                    <Text className="text-xs font-bold text-white font-sans">3</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-900 font-sans">
                      Save Receipt & Reference No.
                    </Text>
                    <Text className="text-[11px] text-slate-600 font-sans leading-relaxed">
                      Capture a screenshot of your successful transfer with the reference number clearly legible.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Close / Proceed button */}
              <TouchableOpacity
                onPress={onClose}
                className="w-full bg-blue-600 py-3.5 rounded-2xl items-center shadow-md shadow-blue-600/20"
              >
                <Text className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                  I Have Completed Payment
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Zoom Lightbox Modal */}
      <Modal
        visible={zoomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomModalVisible(false)}
      >
        <View className="flex-1 bg-black/95 items-center justify-center p-4">
          <TouchableOpacity
            onPress={() => setZoomModalVisible(false)}
            className="absolute top-12 right-6 w-10 h-10 rounded-full bg-white/20 items-center justify-center z-10"
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="items-center">
            <Text className="text-white text-base font-bold font-sans mb-1 text-center">
              {displayName}
            </Text>
            <Text className="text-blue-300 text-xs font-sans mb-6 text-center">
              {activeTab === 'gcash' ? 'GCash' : 'Maya'} Official QR
            </Text>

            <View className="bg-white p-4 rounded-3xl">
              {currentQrUrl ? (
                <Image
                  source={{ uri: currentQrUrl }}
                  style={{ width: windowWidth * 0.8, height: windowWidth * 0.8 }}
                  resizeMode="contain"
                />
              ) : (
                <Image
                  source={fallbackQrImage}
                  style={{ width: windowWidth * 0.8, height: windowWidth * 0.8 }}
                  resizeMode="contain"
                />
              )}
            </View>

            <Text className="text-slate-400 text-xs font-sans mt-4 text-center">
              Tap the close button above when finished scanning
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
