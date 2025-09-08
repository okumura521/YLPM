-- Remove unused columns from user_settings table
ALTER TABLE user_settings 
DROP COLUMN IF EXISTS images_comma_separated,
DROP COLUMN IF EXISTS images_json_array,
DROP COLUMN IF EXISTS ai_service,
DROP COLUMN IF EXISTS ai_model,
DROP COLUMN IF EXISTS ai_api_token,
DROP COLUMN IF EXISTS ai_connection_status;
