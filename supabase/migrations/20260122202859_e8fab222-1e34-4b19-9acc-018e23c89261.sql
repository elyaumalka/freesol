-- Drop existing foreign key and add new one with CASCADE
ALTER TABLE public.playback_purchases 
DROP CONSTRAINT IF EXISTS playback_purchases_playback_id_fkey;

ALTER TABLE public.playback_purchases 
ADD CONSTRAINT playback_purchases_playback_id_fkey 
FOREIGN KEY (playback_id) REFERENCES public.playbacks(id) ON DELETE CASCADE;