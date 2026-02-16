import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Coupon } from '@/types/database';
import { toast } from 'sonner';

export function useCoupons() {
  return useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Coupon[];
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (coupon: Omit<Coupon, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => {
      const { data, error } = await supabase
        .from('coupons')
        .insert(coupon)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('קופון נוסף בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בהוספת קופון');
      console.error(error);
    },
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Coupon> & { id: string }) => {
      const { data, error } = await supabase
        .from('coupons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('קופון עודכן בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון קופון');
      console.error(error);
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('קופון נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת קופון');
      console.error(error);
    },
  });
}
