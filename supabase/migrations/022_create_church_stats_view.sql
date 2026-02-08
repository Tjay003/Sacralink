-- Migration: Create church statistics materialized view
-- Provides cached statistics for each church to improve performance

-- Create materialized view for church statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.church_stats AS
SELECT 
    c.id as church_id,
    c.name as church_name,
    c.status as church_status,
    
    -- Appointment statistics
    COUNT(DISTINCT a.id) as total_appointments,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'pending') as pending_appointments,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'approved') as approved_appointments,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'approved' AND a.appointment_date >= CURRENT_DATE) as upcoming_appointments,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed') as completed_appointments,
    
    -- Staff count (church admins and volunteers assigned to this church)
    COUNT(DISTINCT p.id) FILTER (WHERE p.assigned_church_id = c.id AND p.role IN ('church_admin', 'volunteer')) as staff_count,
    
    -- Recent activity (last 30 days)
    COUNT(DISTINCT a.id) FILTER (WHERE a.created_at >= NOW() - INTERVAL '30 days') as appointments_last_30_days,
    
    -- Last updated
    NOW() as last_updated
    
FROM public.churches c
LEFT JOIN public.appointments a ON a.church_id = c.id
LEFT JOIN public.profiles p ON true -- For staff count
GROUP BY c.id, c.name, c.status;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_church_stats_church_id ON public.church_stats(church_id);
CREATE INDEX IF NOT EXISTS idx_church_stats_status ON public.church_stats(church_status);

-- Create function to refresh stats
CREATE OR REPLACE FUNCTION refresh_church_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.church_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_church_stats() TO authenticated;

-- Add comments
COMMENT ON MATERIALIZED VIEW public.church_stats IS 'Cached statistics for each church. Refresh hourly or manually.';
COMMENT ON FUNCTION refresh_church_stats() IS 'Refreshes the church statistics materialized view. Can be called manually or via cron job.';

-- Note: To set up automatic refresh, you can use pg_cron or call this function from your application
-- For example, to refresh every hour:
-- SELECT cron.schedule('refresh-church-stats', '0 * * * *', 'SELECT refresh_church_stats();');
