-- Enable RLS on all other tables with proper policies

-- ============================================
-- CHURCHES TABLE
-- ============================================
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;

-- Everyone can view churches (public info)
CREATE POLICY "Anyone can view churches"
ON churches FOR SELECT
USING (true);

-- Only super admins can create churches
CREATE POLICY "Super admins can create churches"
ON churches FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Super admins and church admins can update their church
CREATE POLICY "Admins can update their church"
ON churches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR (role = 'admin' AND church_id = churches.id)
    )
  )
);

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Users can view their own appointments
CREATE POLICY "Users can view own appointments"
ON appointments FOR SELECT
USING (
  auth.uid() = user_id
  OR auth.uid() = priest_id
);

-- Church admins can view all appointments in their church
CREATE POLICY "Church admins can view church appointments"
ON appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = appointments.church_id)
  )
);

-- Users can create appointments
CREATE POLICY "Users can create appointments"
ON appointments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own appointments (before approval)
CREATE POLICY "Users can update own appointments"
ON appointments FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Church admins can update appointments in their church
CREATE POLICY "Church admins can update church appointments"
ON appointments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = appointments.church_id)
  )
);

-- ============================================
-- DONATIONS TABLE
-- ============================================
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Users can view their own donations
CREATE POLICY "Users can view own donations"
ON donations FOR SELECT
USING (auth.uid() = user_id);

-- Church admins can view donations to their church
CREATE POLICY "Church admins can view church donations"
ON donations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = donations.church_id)
  )
);

-- Users can create donations
CREATE POLICY "Users can create donations"
ON donations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ANNOUNCEMENTS TABLE
-- ============================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can view published announcements
CREATE POLICY "Anyone can view published announcements"
ON announcements FOR SELECT
USING (status = 'published');

-- Church admins can view all announcements in their church
CREATE POLICY "Church admins can view church announcements"
ON announcements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = announcements.church_id)
  )
);

-- Church admins can create announcements
CREATE POLICY "Church admins can create announcements"
ON announcements FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = announcements.church_id)
  )
);

-- Church admins can update their church's announcements
CREATE POLICY "Church admins can update church announcements"
ON announcements FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = announcements.church_id)
  )
);

-- ============================================
-- PRAYER REQUESTS TABLE
-- ============================================
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own prayer requests
CREATE POLICY "Users can view own prayer requests"
ON prayer_requests FOR SELECT
USING (auth.uid() = user_id);

-- Church members can view prayer requests in their church
CREATE POLICY "Church members can view church prayer requests"
ON prayer_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND church_id = prayer_requests.church_id
  )
);

-- Users can create prayer requests
CREATE POLICY "Users can create prayer requests"
ON prayer_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own prayer requests
CREATE POLICY "Users can update own prayer requests"
ON prayer_requests FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- EVENTS TABLE
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Everyone can view published events
CREATE POLICY "Anyone can view published events"
ON events FOR SELECT
USING (status = 'published');

-- Church admins can view all events in their church
CREATE POLICY "Church admins can view church events"
ON events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = events.church_id)
  )
);

-- Church admins can create events
CREATE POLICY "Church admins can create events"
ON events FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = events.church_id)
  )
);

-- Church admins can update their church's events
CREATE POLICY "Church admins can update church events"
ON events FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = events.church_id)
  )
);

-- ============================================
-- EVENT REGISTRATIONS TABLE
-- ============================================
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations"
ON event_registrations FOR SELECT
USING (auth.uid() = user_id);

-- Church admins can view registrations for their church's events
CREATE POLICY "Church admins can view church event registrations"
ON event_registrations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN profiles p ON p.id = auth.uid()
    WHERE e.id = event_registrations.event_id
    AND p.role IN ('admin', 'super_admin')
    AND (p.role = 'super_admin' OR p.church_id = e.church_id)
  )
);

-- Users can create registrations
CREATE POLICY "Users can create registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own registrations
CREATE POLICY "Users can update own registrations"
ON event_registrations FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- MASS SCHEDULES TABLE
-- ============================================
ALTER TABLE mass_schedules ENABLE ROW LEVEL SECURITY;

-- Everyone can view mass schedules
CREATE POLICY "Anyone can view mass schedules"
ON mass_schedules FOR SELECT
USING (true);

-- Church admins can create mass schedules
CREATE POLICY "Church admins can create mass schedules"
ON mass_schedules FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = mass_schedules.church_id)
  )
);

-- Church admins can update their church's mass schedules
CREATE POLICY "Church admins can update church mass schedules"
ON mass_schedules FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = mass_schedules.church_id)
  )
);

-- ============================================
-- SACRAMENT RECORDS TABLE
-- ============================================
ALTER TABLE sacrament_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own sacrament records
CREATE POLICY "Users can view own sacrament records"
ON sacrament_records FOR SELECT
USING (auth.uid() = user_id);

-- Church admins can view sacrament records in their church
CREATE POLICY "Church admins can view church sacrament records"
ON sacrament_records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = sacrament_records.church_id)
  )
);

-- Church admins can create sacrament records
CREATE POLICY "Church admins can create sacrament records"
ON sacrament_records FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = sacrament_records.church_id)
  )
);

-- Church admins can update sacrament records in their church
CREATE POLICY "Church admins can update church sacrament records"
ON sacrament_records FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR church_id = sacrament_records.church_id)
  )
);
