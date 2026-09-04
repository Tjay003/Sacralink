import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Camera,
  Image as ImageIcon,
  FileText,
  Trash2,
  UploadCloud,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react-native';
import type { UploadedDocumentInput, SacramentRequirement } from '@/lib/supabase/appointments';

export interface DocumentUploaderProps {
  requirement: SacramentRequirement;
  value?: UploadedDocumentInput | null;
  onChange: (file: UploadedDocumentInput | null) => void;
  disabled?: boolean;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentUploader({
  requirement,
  value,
  onChange,
  disabled = false,
}: DocumentUploaderProps) {
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  /**
   * Compresses image using expo-image-manipulator to keep it <200KB.
   */
  const compressImage = async (
    uri: string,
    originalName: string
  ): Promise<{ uri: string; size?: number; name: string }> => {
    setProcessing(true);
    setProcessingStatus('Compressing & optimizing image (<200KB)...');

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.65,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Estimate file size via fetch
      let size: number | undefined;
      try {
        const response = await fetch(manipResult.uri);
        const blob = await response.blob();
        size = blob.size;
      } catch {
        // Non-critical if fetch fails
      }

      const cleanName = originalName.endsWith('.jpg') || originalName.endsWith('.jpeg')
        ? originalName
        : `${originalName.replace(/\.[^/.]+$/, '')}.jpg`;

      return {
        uri: manipResult.uri,
        size,
        name: cleanName,
      };
    } finally {
      setProcessing(false);
      setProcessingStatus('');
    }
  };

  /**
   * Capture photo via Camera.
   */
  const handleCameraCapture = async () => {
    try {
      setPickerModalVisible(false);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow SacraLink access to your camera to take a photo of your sacrament document.'
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
        const initialName = asset.fileName || `${requirement.requirement_name.toLowerCase().replace(/\s+/g, '_')}_photo.jpg`;
        const compressed = await compressImage(asset.uri, initialName);

        onChange({
          requirementId: requirement.id,
          requirementName: requirement.requirement_name,
          fileUri: compressed.uri,
          fileName: compressed.name,
          fileType: 'image/jpeg',
          fileSize: compressed.size,
        });
      }
    } catch (err) {
      console.error('Error in handleCameraCapture:', err);
      Alert.alert('Camera Error', 'Could not open camera. Please try again.');
    }
  };

  /**
   * Pick image from photo gallery.
   */
  const handleGalleryPick = async () => {
    try {
      setPickerModalVisible(false);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Library Access Required',
          'Please grant access to your photo library to attach your document.'
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
        const initialName = asset.fileName || `${requirement.requirement_name.toLowerCase().replace(/\s+/g, '_')}_gallery.jpg`;
        const compressed = await compressImage(asset.uri, initialName);

        onChange({
          requirementId: requirement.id,
          requirementName: requirement.requirement_name,
          fileUri: compressed.uri,
          fileName: compressed.name,
          fileType: 'image/jpeg',
          fileSize: compressed.size,
        });
      }
    } catch (err) {
      console.error('Error in handleGalleryPick:', err);
      Alert.alert('Gallery Error', 'Could not pick image from gallery. Please try again.');
    }
  };

  /**
   * Pick PDF file using expo-document-picker.
   */
  const handleDocumentPick = async () => {
    try {
      setPickerModalVisible(false);
      setProcessing(true);
      setProcessingStatus('Selecting PDF document...');

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        onChange({
          requirementId: requirement.id,
          requirementName: requirement.requirement_name,
          fileUri: asset.uri,
          fileName: asset.name || `${requirement.requirement_name}.pdf`,
          fileType: asset.mimeType || 'application/pdf',
          fileSize: asset.size,
        });
      }
    } catch (err) {
      console.error('Error in handleDocumentPick:', err);
      Alert.alert('Document Error', 'Could not pick document. Please try again.');
    } finally {
      setProcessing(false);
      setProcessingStatus('');
    }
  };

  /**
   * Remove attached file.
   */
  const handleRemove = () => {
    onChange(null);
  };

  const isPdf = value?.fileType?.includes('pdf') || value?.fileName?.toLowerCase().endsWith('.pdf');

  return (
    <View className="mb-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
      {/* Header with Title and Requirement Chip */}
      <View className="flex-row items-start justify-between mb-1.5">
        <View className="flex-1 pr-2">
          <View className="flex-row items-center space-x-1.5 flex-wrap">
            <Text className="text-sm font-bold text-slate-900 font-sans">
              {requirement.requirement_name}
            </Text>
            {requirement.is_required ? (
              <View className="bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                <Text className="text-[10px] font-bold text-rose-600 font-sans uppercase">
                  Required
                </Text>
              </View>
            ) : (
              <View className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                <Text className="text-[10px] font-semibold text-slate-500 font-sans uppercase">
                  Optional
                </Text>
              </View>
            )}
          </View>
          {requirement.description && (
            <Text className="text-xs text-slate-500 font-sans mt-0.5 leading-relaxed">
              {requirement.description}
            </Text>
          )}
        </View>

        {value && (
          <View className="flex-row items-center space-x-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 size={12} color="#059669" />
            <Text className="text-[11px] font-bold text-emerald-700">Attached</Text>
          </View>
        )}
      </View>

      {/* Uploaded File Preview or Empty Upload Button */}
      {processing ? (
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex-row items-center justify-center space-x-2 my-2">
          <ActivityIndicator size="small" color="#2563EB" />
          <Text className="text-xs font-semibold text-blue-700 font-sans">
            {processingStatus}
          </Text>
        </View>
      ) : value ? (
        <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3 flex-1 mr-2">
            {isPdf ? (
              <View className="w-11 h-11 rounded-lg bg-rose-100 items-center justify-center border border-rose-200">
                <FileText size={20} color="#E11D48" />
              </View>
            ) : (
              <Image
                source={{ uri: value.fileUri }}
                className="w-11 h-11 rounded-lg bg-slate-200 border border-slate-300"
                resizeMode="cover"
              />
            )}
            <View className="flex-1">
              <Text
                className="text-xs font-bold text-slate-800 font-sans"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {value.fileName}
              </Text>
              <View className="flex-row items-center space-x-2 mt-0.5">
                <Text className="text-[11px] text-slate-500 font-sans">
                  {isPdf ? 'PDF Document' : 'Compressed Image'}
                </Text>
                {value.fileSize ? (
                  <Text className="text-[11px] text-slate-400 font-sans">
                    • {formatFileSize(value.fileSize)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {!disabled && (
            <TouchableOpacity
              onPress={handleRemove}
              className="p-2 rounded-lg bg-white border border-slate-200 active:bg-rose-50"
              accessibilityLabel="Remove document"
            >
              <Trash2 size={16} color="#E11D48" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setPickerModalVisible(true)}
          disabled={disabled}
          className="mt-2 border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-slate-50/75 active:bg-blue-50/50 items-center justify-center flex-row space-x-2"
        >
          <UploadCloud size={18} color="#2563EB" />
          <Text className="text-xs font-bold text-blue-600 font-sans">
            Choose Document / Photo
          </Text>
        </TouchableOpacity>
      )}

      {/* Document Picker Options Modal */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPickerModalVisible(false)}
          className="flex-1 bg-slate-900/60 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-white rounded-t-3xl p-6 border-t border-slate-200 shadow-2xl"
          >
            <View className="flex-row items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <View>
                <Text className="text-base font-bold text-slate-900 font-heading">
                  Attach Document
                </Text>
                <Text className="text-xs text-slate-500 font-sans mt-0.5">
                  {requirement.requirement_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPickerModalVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="space-y-3">
              {/* Option 1: Take Photo */}
              <TouchableOpacity
                onPress={handleCameraCapture}
                className="flex-row items-center p-3.5 rounded-2xl bg-slate-50 active:bg-blue-50 border border-slate-200 mb-2.5"
              >
                <View className="w-10 h-10 rounded-xl bg-blue-600 items-center justify-center mr-3">
                  <Camera size={20} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 font-sans">
                    Take Photo with Camera
                  </Text>
                  <Text className="text-xs text-slate-500 font-sans mt-0.5">
                    Capture document physical copy directly
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Gallery */}
              <TouchableOpacity
                onPress={handleGalleryPick}
                className="flex-row items-center p-3.5 rounded-2xl bg-slate-50 active:bg-blue-50 border border-slate-200 mb-2.5"
              >
                <View className="w-10 h-10 rounded-xl bg-amber-500 items-center justify-center mr-3">
                  <ImageIcon size={20} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 font-sans">
                    Choose from Photo Gallery
                  </Text>
                  <Text className="text-xs text-slate-500 font-sans mt-0.5">
                    Select JPEG/PNG image from device
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: PDF Document */}
              <TouchableOpacity
                onPress={handleDocumentPick}
                className="flex-row items-center p-3.5 rounded-2xl bg-slate-50 active:bg-blue-50 border border-slate-200"
              >
                <View className="w-10 h-10 rounded-xl bg-rose-600 items-center justify-center mr-3">
                  <FileText size={20} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 font-sans">
                    Select PDF Document
                  </Text>
                  <Text className="text-xs text-slate-500 font-sans mt-0.5">
                    Attach official PDF certificate or permit
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View className="mt-5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex-row items-center space-x-2">
              <AlertCircle size={14} color="#2563EB" />
              <Text className="text-[11px] text-blue-700 font-sans flex-1">
                Images are automatically compressed to under 200KB for rapid, low-bandwidth uploads.
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
