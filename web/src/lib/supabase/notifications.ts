import { supabase } from '../supabase';

export interface CreateNotificationParams {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
}

/**
 * Create a new notification for a user
 */
export async function createNotification({
    userId,
    type,
    title,
    message,
    link
}: CreateNotificationParams) {
    try {
        console.log('📨 Creating notification:', { userId, type, title, message, link });


        const { data, error } = await (supabase
            .from('notifications')
            // @ts-ignore - Supabase type inference issue with notifications table
            .insert({
                user_id: userId,
                type,
                title,
                message,
                link
            })
            .select()
            .single() as any);

        if (error) {
            console.error('❌ Error inserting notification:', error);
            throw error;
        }

        console.log('✅ Notification created successfully:', data);
        return { data, error: null };
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
 * Helper function to notify admins when a new appointment is created
 */
export async function notifyAdminsOfNewAppointment(
    churchId: string,
    userName: string,
    serviceType: string,
    _appointmentId: string
) {
    try {
        console.log('🔔 Notifying admins of new appointment:', { churchId, userName, serviceType });

        // Get all admins for this church
        const { data: admins, error: adminError } = await supabase
            .from('profiles')
            .select('id')
            .or(`role.eq.super_admin,and(role.in.(admin,church_admin,volunteer),or(church_id.eq.${churchId},assigned_church_id.eq.${churchId}))`);

        console.log('📋 Found admins:', admins, 'Error:', adminError);

        if (adminError) {
            console.error('❌ Error fetching admins:', adminError);
            return;
        }

        if (!admins || admins.length === 0) {
            console.warn('⚠️ No admins found for church:', churchId);
            return;
        }

        // Create notification for each admin
        console.log(`✉️ Creating ${admins.length} notifications...`);
        const notifications = admins.map((admin: any) =>
            createNotification({
                userId: admin.id,
                type: 'appointment_created',
                title: 'New Appointment Request',
                message: `${userName} requested a ${serviceType} appointment`,
                link: `/appointments`
            })
        );

        const results = await Promise.all(notifications);
        console.log('✅ Notification results:', results);
    } catch (err) {
        console.error('❌ Error notifying admins:', err);
    }
}

/**
 * Helper function to notify user when appointment status changes
 */
export async function notifyUserOfStatusChange(
    userId: string,
    serviceType: string,
    status: 'approved' | 'rejected',
    _appointmentId: string
) {
    console.log('🔔 Notifying user of status change:', { userId, serviceType, status });

    const title = status === 'approved'
        ? '✅ Appointment Approved'
        : '❌ Appointment Rejected';

    const message = status === 'approved'
        ? `Your ${serviceType} appointment has been approved!`
        : `Your ${serviceType} appointment has been rejected.`;

    const result = await createNotification({
        userId,
        type: `appointment_${status}`,
        title,
        message,
        link: `/appointments`
    });

    console.log('📬 User notification result:', result);
}
