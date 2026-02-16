-- Add notes column to profiles table for admin notes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update RLS policy to allow admins to update notes
-- (existing policy already covers this as admins can update all profiles)