-- Create a dedicated Activity Feed table to ensure 100% data visibility for clients
CREATE TABLE IF NOT EXISTS client_activity_feed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id TEXT, -- Can be UUID or Name/Email for fallback
    plate TEXT,
    expediente_id TEXT,
    activity_type TEXT DEFAULT 'request',
    summary TEXT,
    file_assets JSONB DEFAULT '[]'::jsonb, -- Stores [{url, name, type}]
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE client_activity_feed ENABLE ROW LEVEL SECURITY;

-- Policy: Workshop owners can see their own activity feed
DROP POLICY IF EXISTS "Workshop Activity Isolation" ON client_activity_feed;
CREATE POLICY "Workshop Activity Isolation" ON client_activity_feed 
FOR ALL USING (auth.uid() = workshop_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_activity_plate ON client_activity_feed(plate);
CREATE INDEX IF NOT EXISTS idx_activity_client ON client_activity_feed(client_id);
