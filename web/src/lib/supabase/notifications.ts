import { supabase } from '../supabase';

export interface CreateNotificationParams {
    userId?: string;
    user_id?: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    entity_id?: string;
    entityId?: string;
}

/**
 * Create a new notification for a user
 */
export async function createNotification({
    userId,
    user_id,
    type,
    title,
    message,
    link,
    entity_id,
    entityId,
}: CreateNotificationParams) {
    const targetUserId = userId || user_id;
    if (!targetUserId) {
        console.error('❌ Cannot create notification: Missing userId');
        return { data: null, error: new Error('Missing userId') };
    }
    const resolvedLink = link || (entity_id || entityId ? '/appointments' : undefined);

    try {
        console.log('📨 Creating notification:', { userId: targetUserId, type, title, message, link: resolvedLink });


        // Note: No .select() here — adding it would cause a 403 for cross-user notifications
        // because the SELECT RLS policy (user_id = auth.uid()) blocks the inserter
        // from seeing notification rows that belong to a different user.
        const { error } = await (supabase
            .from('notifications')
            // @ts-ignore - Supabase type inference issue with notifications table
            .insert({
                user_id: targetUserId,
                type,
                title,
                message,
                link: resolvedLink
            }) as any);

        if (error) {
            console.error('❌ Error inserting notification:', error);
            throw error;
        }

        console.log('✅ Notification created successfully');
        return { data: null, error: null };
    } catch (err: any) {
        console.error('❌ Error creating notification:', err);
        return { data: null, error: err };
    }
}

/**
 * Get all notifications for the current user
 * Ordered by created_at descending (newest first)
 */
export async function getNotifications(limit: number = 10) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: new Error('Not authenticated') };

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)  // Filter to only current user's notifications
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return { data, error: null };
    } catch (err: any) {
        console.error('Error fetching notifications:', err);
        return { data: null, error: err };
    }
}

/**
 * Get count of unread notifications for current user
 */
export async function getUnreadCount() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { count: 0, error: new Error('Not authenticated') };

        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)  // Only count current user's notifications
            .eq('is_read', false);

        if (error) throw error;
        return { count: count || 0, error: null };
    } catch (err: any) {
        console.error('Error fetching unread count:', err);
        return { count: 0, error: err };
    }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string) {
    try {

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return { error: null };
    } catch (err: any) {
        console.error('Error marking notification as read:', err);
        return { error: err };
    }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllAsRead() {
    try {

        const { error } = await supabase
            .from('notifications')
            // @ts-ignore - Supabase type inference issue
            .update({ is_read: true })
            .eq('is_read', false);

        if (error) throw error;
        return { error: null };
    } catch (err: any) {
        console.error('Error marking all as read:', err);
        return { error: err };
    }
}

/**
 * Helper function to notify church admins when a new appointment is created.
 * Note: Super admins are intentionally excluded — they are not responsible
 * for church-level appointment approvals.
 */
export async function notifyAdminsOfNewAppointment(
    _churchId: string,
    _userName: string,
    _serviceType: string,
    _appointmentId: string
) {
    void _churchId; void _userName; void _serviceType; void _appointmentId;
    // Handled automatically by database trigger tr_notify_admins_of_new_appointment (migration 081)
    return;
}

/**
 * Helper function to notify a user when their appointment status changes.
 * Called by admins when they approve or reject a booking.
 */
export async function notifyUserOfStatusChange(
    userId: string,
    serviceType: string,
    status: 'approved' | 'rejected',
    _appointmentId: string
) {
    void _appointmentId;
    console.log('🔔 Notifying user of status change:', { userId, serviceType, status });

    const title = status === 'approved'
        ? 'Appointment Approved'
        : 'Appointment Rejected';

    const message = status === 'approved'
        ? `Your ${serviceType} appointment has been approved!`
        : `Your ${serviceType} appointment has been rejected.`;

    const result = await createNotification({
        userId,
        type: `appointment_${status}`,
        title,
        message,
        link: `/appointments`,
    });

    if (result.error) {
        console.error('❌ Failed to notify user of status change:', result.error);
    } else {
        console.log('✅ User notified of status change:', result.data);
    }
}

/**
 * Notify a donor when their donation status changes (verified / rejected)
 */
export async function notifyDonorOfDonationStatus(
    donorUserId: string,
    churchName: string,
    amount: number,
    status: 'verified' | 'rejected',
    rejectionReason?: string
) {
    const formattedAmount = `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

    const title = status === 'verified'
        ? 'Donation Verified'
        : 'Donation Rejected';

    const message = status === 'verified'
        ? `Your ${formattedAmount} donation to ${churchName} has been verified. Thank you! 🙏`
        : `Your ${formattedAmount} donation to ${churchName} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;

    await createNotification({
        userId: donorUserId,
        type: `donation_${status}`,
        title,
        message,
        link: '/profile',
    });
}

/**
 * Notify all followers of a church when a new announcement is posted.
 * Called by AnnouncementForm after a successful church announcement insert.
 */
export async function notifyFollowersOfAnnouncement(
    churchId: string,
    churchName: string,
    announcementId: string,
    announcementTitle: string
) {
    try {
        const { getChurchFollowerIds } = await import('./churchFavorites');
        const followerIds = await getChurchFollowerIds(churchId);

        if (followerIds.length === 0) return;

        const link = `/churches/${churchId}?announcement=${announcementId}`;

        await Promise.all(
            followerIds.map((userId) =>
                createNotification({
                    userId,
                    type: 'church_announcement',
                    title: `📢 New announcement from ${churchName}`,
                    message: announcementTitle,
                    link,
                })
            )
        );

        console.log(`✅ Notified ${followerIds.length} followers of ${churchName}`);
    } catch (err) {
        console.error('❌ Error notifying followers of announcement:', err);
    }
}

