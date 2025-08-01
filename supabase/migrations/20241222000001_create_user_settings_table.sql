CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  google_client_id TEXT,
  google_client_secret TEXT,
  google_redirect_uri TEXT,
  google_connection_status BOOLEAN DEFAULT FALSE,
  ai_service TEXT,
  ai_model TEXT,
  ai_api_token TEXT,
  ai_connection_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'user_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;
    END IF;
END $;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();