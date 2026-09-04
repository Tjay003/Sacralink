import React from 'react';
import { View, Text } from 'react-native';
import type { UserRole } from '@/shared/types';

interface RoleBadgeProps {
  role?: UserRole | string | null;
  size?: 'sm' | 'md';
}

export function RoleBadge({ role = 'user', size = 'md' }: RoleBadgeProps) {
  const normalizedRole = role || 'user';

  let label = 'Parishioner';
  let badgeBg = 'bg-emerald-50';
  let badgeBorder = 'border-emerald-200';
  let textColor = 'text-emerald-700';

  if (normalizedRole === 'priest') {
    label = 'Parish Priest';
    badgeBg = 'bg-amber-50';
    badgeBorder = 'border-amber-200';
    textColor = 'text-amber-800';
  } else if (normalizedRole === 'admin' || normalizedRole === 'church_admin') {
    label = 'Church Admin';
    badgeBg = 'bg-blue-50';
    badgeBorder = 'border-blue-200';
    textColor = 'text-blue-700';
  } else if (normalizedRole === 'super_admin') {
    label = 'Super Admin';
    badgeBg = 'bg-purple-50';
    badgeBorder = 'border-purple-200';
    textColor = 'text-purple-700';
  } else if (normalizedRole === 'volunteer') {
    label = 'Volunteer';
    badgeBg = 'bg-teal-50';
    badgeBorder = 'border-teal-200';
    textColor = 'text-teal-700';
  }

  const isSmall = size === 'sm';

  return (
    <View
      className={`rounded-full border self-start ${badgeBg} ${badgeBorder} ${
        isSmall ? 'px-2 py-0.5' : 'px-3 py-1'
      }`}
    >
      <Text
        className={`font-semibold font-sans tracking-wide ${textColor} ${
          isSmall ? 'text-[10px]' : 'text-xs'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
