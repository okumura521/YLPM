-- Remove Google OAuth credential columns and add Google Sheet URL column
ALTER TABLE user_settings 
DROP COLUMN IF EXISTS google_client_id,
DROP COLUMN IF EXISTS google_client_secret,
DROP COLUMN IF EXISTS google_redirect_uri,
DROP COLUMN IF EXISTS google_connection_status;

-- Add Google Sheet URL column
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS google_sheet_url TEXT,
ADD COLUMN IF NOT EXISTS google_sheet_id TEXT;


