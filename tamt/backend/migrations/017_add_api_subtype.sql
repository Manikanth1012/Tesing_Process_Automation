-- Add api_sub_type column to features: Technical | Functional | Both
-- Only meaningful when feature_type = 'API'
ALTER TABLE features ADD COLUMN api_sub_type TEXT DEFAULT 'Both';
