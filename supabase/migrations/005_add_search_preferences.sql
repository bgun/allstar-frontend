-- Add search_preferences JSONB column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS search_preferences JSONB DEFAULT '{
  "category_id": "33710",
  "condition_ids": ["3000", "7000"],
  "excluded_keywords": ["parting out", "whole car", "complete vehicle"],
  "buying_options": ["FIXED_PRICE", "BEST_OFFER", "AUCTION"],
  "vehicle_year": null,
  "vehicle_make": null,
  "vehicle_model": null,
  "sort": "newlyListed",
  "max_price": null,
  "craigslist_city": "newyork"
}'::jsonb;
