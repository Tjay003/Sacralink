import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import {
  Church,
  Calendar,
  HeartHandshake,
  Bell,
  User,
  CalendarDays,
  Video,
  MessageSquare,
  Building2,
  CalendarCheck,
  HandCoins,
  BarChart3,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function TabsLayout() {
  const { profile } = useAuth();
  const role = profile?.role || 'user';

  const isPriest = role === 'priest';
  const isAdminOrChurchAdmin = role === 'admin' || (role as string) === 'church_admin';
  const isSuperAdmin = role === 'super_admin';
  const isParishioner = !isPriest && !isAdminOrChurchAdmin && !isSuperAdmin;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isSuperAdmin ? '#7C3AED' : '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* Route Root Redirector */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      {/* ======================================================= */}
      {/* PARISHIONER TABS (role: user)                          */}
      {/* ======================================================= */}
      <Tabs.Screen
        name="explore/index"
        options={{
          title: 'Explore',
          href: isParishioner ? '/explore' : null,
          tabBarIcon: ({ color, size }) => <Church size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments/index"
        options={{
          title: 'Appointments',
          href: isParishioner ? '/appointments' : null,
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="donations/index"
        options={{
          title: 'Donations',
          href: isParishioner ? '/donations' : null,
          tabBarIcon: ({ color, size }) => <HeartHandshake size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="announcements/index"
        options={{
          title: 'Announcements',
          href: (isParishioner || isSuperAdmin) ? '/announcements' : null,
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />

      {/* ======================================================= */}
      {/* PRIEST TABS (role: priest)                             */}
      {/* ======================================================= */}
      <Tabs.Screen
        name="priest/index"
        options={{
          title: 'Schedule',
          href: isPriest ? '/priest' : null,
          tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="priest/consultations"
        options={{
          title: 'Consultations',
          href: isPriest ? '/priest/consultations' : null,
          tabBarIcon: ({ color, size }) => <Video size={size} color={color} />,
        }}
      />

      {/* ======================================================= */}
      {/* CHURCH ADMIN / ADMIN TABS (role: church_admin | admin) */}
      {/* ======================================================= */}
      <Tabs.Screen
        name="admin/index"
        options={{
          title: 'Parish Hub',
          href: isAdminOrChurchAdmin ? '/admin' : null,
          tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin/appointments"
        options={{
          title: 'Appointments',
          href: isAdminOrChurchAdmin ? '/admin/appointments' : null,
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin/donations"
        options={{
          title: 'Donations',
          href: isAdminOrChurchAdmin ? '/admin/donations' : null,
          tabBarIcon: ({ color, size }) => <HandCoins size={size} color={color} />,
        }}
      />

      {/* ======================================================= */}
      {/* SHARED MESSAGES (priest, admin, church_admin)          */}
      {/* ======================================================= */}
      <Tabs.Screen
        name="messages/index"
        options={{
          title: 'Messages',
          href: (isPriest || isAdminOrChurchAdmin) ? '/messages' : null,
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />

      {/* ======================================================= */}
      {/* SUPER ADMIN TABS (role: super_admin)                   */}
      {/* ======================================================= */}
      <Tabs.Screen
        name="super-admin/index"
        options={{
          title: 'Metrics',
          href: isSuperAdmin ? '/super-admin' : null,
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="super-admin/applications"
        options={{
          title: 'Applications',
          href: isSuperAdmin ? '/super-admin/applications' : null,
          tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="super-admin/users"
        options={{
          title: 'Users',
          href: isSuperAdmin ? '/super-admin/users' : null,
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />

      {/* ======================================================= */}
      {/* PROFILE (Universal for all authenticated roles)        */}
      {/* ======================================================= */}
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          href: '/profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
