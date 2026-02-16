import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Club } from '@/types/database';
import { toast } from 'sonner';

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Club[];
    },
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (club: Omit<Club, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => {
      const { data, error } = await supabase
        .from('clubs')
        .insert(club)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('מועדון נוסף בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בהוספת מועדון');
      console.error(error);
    },
  });
}

export function useUpdateClub() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Club> & { id: string }) => {
      const { data, error } = await supabase
        .from('clubs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('מועדון עודכן בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון מועדון');
      console.error(error);
    },
  });
}

export function useDeleteClub() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clubs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('מועדון נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת מועדון');
      console.error(error);
    },
  });
}
