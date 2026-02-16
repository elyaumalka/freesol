import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Campaign } from '@/types/database';
import { toast } from 'sonner';

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Campaign[];
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert(campaign)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('קמפיין נוסף בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בהוספת קמפיין');
      console.error(error);
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('קמפיין עודכן בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון קמפיין');
      console.error(error);
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('קמפיין נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת קמפיין');
      console.error(error);
    },
  });
}
