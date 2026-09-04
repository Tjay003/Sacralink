import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function TabsIndex() {
  const { profile } = useAuth();
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
