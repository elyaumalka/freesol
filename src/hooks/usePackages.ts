import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package } from '@/types/database';
import { toast } from 'sonner';

export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('price', { ascending: true });
      
      if (error) throw error;
      return data as Package[];
    },
  });
}

export function useCreatePackage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pkg: Omit<Package, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('packages')
        .insert(pkg)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('חבילה נוספה בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בהוספת חבילה');
      console.error(error);
    },
  });
}

export function useUpdatePackage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Package> & { id: string }) => {
      const { data, error } = await supabase
        .from('packages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('חבילה עודכנה בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון חבילה');
      console.error(error);
    },
  });
}

export function useDeletePackage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('חבילה נמחקה בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת חבילה');
      console.error(error);
    },
  });
}
