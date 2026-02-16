import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Project, Recording, Purchase, CustomerHours } from '@/types/database';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export function useCustomerHours() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['customer-hours', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('customer_hours')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as CustomerHours | null;
    },
    enabled: !!user,
  });
}

export function useCustomerProjects() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['customer-projects', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          playback:playbacks(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Project[];
    },
    enabled: !!user,
  });
}

export function useCustomerRecordings() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['customer-recordings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Recording[];
    },
    enabled: !!user,
  });
}

export function useCustomerPurchases() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['customer-purchases', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          package:packages(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!user,
  });
}

export function useCustomerPlaybackPurchases() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['customer-playback-purchases', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('playback_purchases')
        .select(`
          *,
          playback:playbacks(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...project, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-projects'] });
      toast.success('פרויקט נוצר בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה ביצירת פרויקט');
      console.error(error);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-projects'] });
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון פרויקט');
      console.error(error);
    },
  });
}

export function useCreateRecording() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (recording: Omit<Recording, 'id' | 'created_at' | 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('recordings')
        .insert({ ...recording, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-recordings'] });
      toast.success('הקלטה נשמרה בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת הקלטה');
      console.error(error);
    },
  });
}
