import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UserNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Fetch all notifications for a specific user, ordered by created_at DESC.
 */
export async function fetchUserNotifications(userId: string): Promise<UserNotification[]> {
  try {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Notifications] Error fetching user notifications:', error);
      throw error;
    }

    return (data || []) as UserNotification[];
  } catch (err) {
    console.error('[Notifications] Failed to fetch notifications:', err);
    return [];
  }
}

/**
 * Mark an individual notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error('[Notifications] Error marking notification as read:', error);
      throw error;
    }
  } catch (err) {
    console.error('[Notifications] Failed to mark as read:', err);
  }
}

/**
 * Mark all unread notifications as read for a given user.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    if (!userId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('[Notifications] Error marking all notifications as read:', error);
      throw error;
    }
  } catch (err) {
    console.error('[Notifications] Failed to mark all as read:', err);
  }
}

/**
 * Subscribes to real-time notification inserts/updates for a user.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToUserNotifications(
  userId: string,
  onNotification: (notification: UserNotification) => void
): () => void {
  if (!userId) return () => {};

  const channelName = `user_notifications_${userId}_${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onNotification(payload.new as UserNotification);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * TanStack Query hook to access user notifications with automatic realtime cache invalidation.
 */
export function useUserNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => (userId ? fetchUserNotifications(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Realtime subscription setup
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToUserNotifications(userId, () => {
      // Invalidate queries so unread badges and inbox refresh immediately
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    });

    return () => {
      unsubscribe();
    };
  }, [userId, queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => (userId ? markAllNotificationsAsRead(userId) : Promise.resolve()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const notifications = query.data || [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    ...query,
    notifications,
    unreadCount,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingRead: markAsReadMutation.isPending || markAllAsReadMutation.isPending,
  };
}
