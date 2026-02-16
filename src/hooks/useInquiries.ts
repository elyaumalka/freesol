import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Inquiry } from '@/types/database';
import { toast } from 'sonner';

export function useInquiries() {
  return useQuery({
    queryKey: ['inquiries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Inquiry[];
    },
  });
}

export function useCreateInquiry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (inquiry: Omit<Inquiry, 'id' | 'created_at' | 'response' | 'responded_at'>) => {
      const { data, error } = await supabase
        .from('inquiries')
        .insert(inquiry)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      toast.success('פנייה נשלחה בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בשליחת פנייה');
      console.error(error);
    },
  });
}

export function useRespondToInquiry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const { data, error } = await supabase
        .from('inquiries')
        .update({ response, responded_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      toast.success('תשובה נשלחה בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בשליחת תשובה');
      console.error(error);
    },
  });
}
