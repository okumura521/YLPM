-- Remove unused columns from user_settings table
ALTER TABLE user_settings 
DROP COLUMN IF EXISTS images_comma_separated,
DROP COLUMN IF EXISTS images_json_array;
