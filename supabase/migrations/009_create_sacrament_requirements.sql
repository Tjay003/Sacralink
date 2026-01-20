-- Migration: Create sacrament_requirements and appointment_documents tables
-- Purpose: Enable document requirements system for appointments

-- Table: sacrament_requirements
-- Stores customizable requirement templates per church and service type
CREATE TABLE sacrament_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  requirement_name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  allowed_file_types TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png'],
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by church and service type
CREATE INDEX idx_requirements_church_service 
  ON sacrament_requirements(church_id, service_type);

-- Table: appointment_documents
-- Stores user-uploaded documents linked to appointments
CREATE TABLE appointment_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES sacrament_requirements(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for fast lookups by appointment
CREATE INDEX idx_documents_appointment 
  ON appointment_documents(appointment_id);

-- RLS Policies for sacrament_requirements
ALTER TABLE sacrament_requirements ENABLE ROW LEVEL SECURITY;

-- Anyone can view requirements (needed for booking flow)
CREATE POLICY "Requirements are viewable by everyone"
  ON sacrament_requirements FOR SELECT
  USING (true);

-- Church admins can manage requirements for their church
CREATE POLICY "Church admins can insert requirements for their church"
  ON sacrament_requirements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_role IN ('super_admin', 'admin', 'church_admin')
      AND (
        profiles.user_role IN ('super_admin', 'admin')
        OR profiles.assigned_church_id = church_id
      )
    )
  );

CREATE POLICY "Church admins can update requirements for their church"
  ON sacrament_requirements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_role IN ('super_admin', 'admin', 'church_admin')
      AND (
        profiles.user_role IN ('super_admin', 'admin')
        OR profiles.assigned_church_id = church_id
      )
    )
  );

CREATE POLICY "Church admins can delete requirements for their church"
  ON sacrament_requirements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_role IN ('super_admin', 'admin', 'church_admin')
      AND (
        profiles.user_role IN ('super_admin', 'admin')
        OR profiles.assigned_church_id = church_id
      )
    )
  );

-- RLS Policies for appointment_documents
ALTER TABLE appointment_documents ENABLE ROW LEVEL SECURITY;

-- Users can see their own uploads, church admins can see all for their church
CREATE POLICY "Users can view their own documents and admins can view church documents"
  ON appointment_documents FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM appointments a
      JOIN churches c ON a.church_id = c.id
      JOIN profiles p ON p.id = auth.uid()
      WHERE a.id = appointment_id
      AND p.user_role IN ('super_admin', 'admin', 'church_admin', 'volunteer')
      AND (
        p.user_role IN ('super_admin', 'admin')
        OR p.assigned_church_id = c.id
      )
    )
  );

-- Authenticated users can upload documents for their own appointments
CREATE POLICY "Users can upload documents for their appointments"
  ON appointment_documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.id = appointment_id
      AND appointments.user_id = auth.uid()
    )
  );

-- Users can delete their own uploads, admins can delete for their church
CREATE POLICY "Users can delete their own documents"
  ON appointment_documents FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM appointments a
      JOIN churches c ON a.church_id = c.id
      JOIN profiles p ON p.id = auth.uid()
      WHERE a.id = appointment_id
      AND p.user_role IN ('super_admin', 'admin', 'church_admin')
      AND (
        p.user_role IN ('super_admin', 'admin')
        OR p.assigned_church_id = c.id
      )
    )
  );

-- Seed default requirements for existing churches
-- Baptism requirements
INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id as church_id,
  'Baptism' as service_type,
  'Birth Certificate' as requirement_name,
  true as is_required,
  1 as display_order
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Baptism',
  'Godparent Certificate',
  true,
  2
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Baptism',
  'Parent Marriage Certificate',
  false,
  3
FROM churches;

-- Wedding requirements
INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Wedding',
  'Baptismal Certificate (Bride)',
  true,
  1
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Wedding',
  'Baptismal Certificate (Groom)',
  true,
  2
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Wedding',
  'Confirmation Certificate',
  true,
  3
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Wedding',
  'CENOMAR (Certificate of No Marriage)',
  true,
  4
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Wedding',
  'Pre-Cana Certificate',
  true,
  5
FROM churches;

-- Confirmation requirements
INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Confirmation',
  'Baptismal Certificate',
  true,
  1
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Confirmation',
  'First Communion Certificate',
  true,
  2
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'Confirmation',
  'Sponsor Certificate',
  true,
  3
FROM churches;

-- First Communion requirements
INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'First Communion',
  'Baptismal Certificate',
  true,
  1
FROM churches;

INSERT INTO sacrament_requirements (church_id, service_type, requirement_name, is_required, display_order)
SELECT 
  id,
  'First Communion',
  'Attendance Record',
  true,
  2
FROM churches;
