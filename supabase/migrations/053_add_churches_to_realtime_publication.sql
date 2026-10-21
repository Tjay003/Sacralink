-- ==============================================================================
-- MIGRATION 053: Enable Realtime for Churches Table
-- Enables instant, multi-client livestream status updates (Go Live / End Stream)
-- and real-time candle prayer updates without requiring page reloads
-- ==============================================================================

-- Set REPLICA IDENTITY FULL so all columns are included in Realtime CDC payloads
ALTER TABLE public.churches REPLICA IDENTITY FULL;

-- Add churches table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.churches;
