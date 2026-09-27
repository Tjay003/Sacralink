import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const role = profile?.role || 'user';
  if (role === 'priest') {
    return <Redirect href="/(tabs)/priest" />;
  }
  if (role === 'admin' || (role as string) === 'church_admin') {
    return <Redirect href="/(tabs)/admin" />;
  }
  if (role === 'super_admin') {
    return <Redirect href="/(tabs)/super-admin" />;
  }
  return <Redirect href="/(tabs)/explore" />;
}
