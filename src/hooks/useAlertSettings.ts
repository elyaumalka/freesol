import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AlertSettings {
  id: string;
  first_alert_minutes: number;
  second_alert_minutes: number;
}

export function useAlertSettings() {
  return useQuery({
    queryKey: ['alert-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alert_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching alert settings:', error);
        return { id: '', first_alert_minutes: 15, second_alert_minutes: 5 } as AlertSettings;
      }

      return data as AlertSettings || { id: '', first_alert_minutes: 15, second_alert_minutes: 5 };
    },
  });
}
