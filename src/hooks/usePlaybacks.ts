import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Playback, PlaybackSection } from '@/types/database';
import { toast } from 'sonner';

export function usePlaybacks() {
  return useQuery({
    queryKey: ['playbacks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbacks')
        .select(`
          *,
          artist:artists(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Map the response to properly type the sections field
      return (data || []).map(item => ({
        ...item,
        sections: item.sections as unknown as PlaybackSection[] | null,
        processing_status: item.processing_status as Playback['processing_status'],
      })) as Playback[];
    },
  });
}

export function useCreatePlayback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (playback: {
      song_name: string;
      artist_id?: string | null;
      cost?: number;
      duration?: string;
      audio_url?: string | null;
      original_audio_url?: string | null;
      processing_status?: string;
    }) => {
      const { data, error } = await supabase
        .from('playbacks')
        .insert(playback)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbacks'] });
      toast.success('פלייבק נוסף בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בהוספת פלייבק');
      console.error(error);
    },
  });
}

export function useUpdatePlayback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      // Filter out undefined values to prevent overwriting existing data
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const { data, error } = await supabase
        .from('playbacks')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbacks'] });
      toast.success('פלייבק עודכן בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון פלייבק');
      console.error(error);
    },
  });
}

export function useDeletePlayback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('playbacks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbacks'] });
      toast.success('פלייבק נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת פלייבק');
      console.error(error);
    },
  });
}

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateArtist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('artists')
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      toast.success('אמן נוסף בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בהוספת אמן');
      console.error(error);
    },
  });
}

export function useDeleteArtist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('artists')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      toast.success('אמן נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת אמן');
      console.error(error);
    },
  });
}
