import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSystemSettings() {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');
      
      if (error) throw error;
      
      // Convert array to object for easier access
      const settings: Record<string, string | null> = {};
      data?.forEach(item => {
        settings[item.setting_key] = item.setting_value;
      });
      
      return settings;
    }
  });
}

export function useWelcomePopupImage() {
  return useQuery({
    queryKey: ['welcome-popup-image'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'welcome_popup_image')
        .maybeSingle();
      
      if (error) throw error;
      return data?.setting_value || null;
    }
  });
}

export function useUpdateWelcomePopup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (imageUrl: string | null) => {
      // Use upsert to ensure the record exists and is updated
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { 
            setting_key: 'welcome_popup_image', 
            setting_value: imageUrl,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'setting_key' }
        );
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['welcome-popup-image'] });
    }
  });
}
