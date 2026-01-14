-- Create appointments table
DROP TABLE IF EXISTS appointments CASCADE;
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('Baptism', 'Wedding', 'Funeral', 'Confirmation', 'Blessing', 'Other')),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Users can view their OWN appointments
CREATE POLICY "Users can view their own appointments"
    ON appointments
    FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Admins can view ALL appointments (or ideally, filtered by church, but for now ALL for simplicity as we implemented role = admin)
CREATE POLICY "Admins can view all appointments"
    ON appointments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
        )
    );

-- 3. Users can create appointments (for any church)
CREATE POLICY "Users can create appointments"
    ON appointments
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 4. Admins can update appointments (e.g. change status)
CREATE POLICY "Admins can update appointments"
    ON appointments
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
        )
    );

-- 5. Users can DELETE their OWN appointments (e.g. cancel) if status is pending
CREATE POLICY "Users can cancel pending appointments"
    ON appointments
    FOR DELETE
    USING (
        auth.uid() = user_id 
        AND status = 'pending'
    );
