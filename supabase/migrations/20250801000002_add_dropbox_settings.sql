-- Add Dropbox settings to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS dropbox_access_token TEXT,
ADD COLUMN IF NOT EXISTS dropbox_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS dropbox_folder_name TEXT,
ADD COLUMN IF NOT EXISTS dropbox_connected BOOLEAN DEFAULT FALSE;