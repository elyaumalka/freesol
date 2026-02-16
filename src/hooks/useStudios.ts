import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Studio } from '@/types/database';
import { toast } from 'sonner';

export function useStudios() {
  return useQuery({
    queryKey: ['studios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studios')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Studio[];
    },
  });
}

export function useCreateStudio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (studio: Omit<Studio, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('studios')
        .insert(studio)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studios'] });
      toast.success('אולפן נוסף בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בהוספת אולפן');
      console.error(error);
    },
  });
}

export function useUpdateStudio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Studio> & { id: string }) => {
      const { data, error } = await supabase
        .from('studios')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studios'] });
      toast.success('אולפן עודכן בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון אולפן');
      console.error(error);
    },
  });
}

export function useDeleteStudio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('studios')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studios'] });
      toast.success('אולפן נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת אולפן');
      console.error(error);
    },
  });
}

export function useToggleStudioStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { data, error } = await supabase
        .from('studios')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studios'] });
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון סטטוס');
      console.error(error);
    },
  });
}
