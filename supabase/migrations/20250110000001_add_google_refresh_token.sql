-- Add encrypted Google refresh token to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS google_refresh_token_encrypted TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
