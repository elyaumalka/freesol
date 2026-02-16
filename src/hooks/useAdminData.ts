import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CustomerWithProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  customer_number: string | null;
  notes: string | null;
  created_at: string;
  total_purchases: number;
  source: string | null;
}

export function useAdminCustomers() {
  return useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      // Get profiles with customer role
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (profilesError) throw profilesError;

      // Get purchase totals for each user (only completed purchases)
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('user_id, amount')
        .eq('status', 'completed');
      if (purchasesError) throw purchasesError;

      // Calculate totals per user
      const purchaseTotals: Record<string, number> = {};
      purchases?.forEach(p => {
        purchaseTotals[p.user_id] = (purchaseTotals[p.user_id] || 0) + Number(p.amount);
      });

      // Get campaign sources from purchases
      const { data: campaignPurchases, error: campaignError } = await supabase
        .from('purchases')
        .select(`
          user_id,
          campaign:campaigns(name)
        `)
        .not('campaign_id', 'is', null);
      
      if (campaignError) throw campaignError;

      const userSources: Record<string, string> = {};
      campaignPurchases?.forEach(p => {
        if (p.campaign && !userSources[p.user_id]) {
          userSources[p.user_id] = `קמפיין ${(p.campaign as any).name}`;
        }
      });

      // Get notes count per profile
      const { data: notesData, error: notesError } = await supabase
        .from('customer_notes')
        .select('profile_id');
      
      if (notesError) throw notesError;
      
      const notesCountMap: Record<string, boolean> = {};
      notesData?.forEach(n => {
        notesCountMap[n.profile_id] = true;
      });

      const customers: CustomerWithProfile[] = profiles?.map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        customer_number: profile.customer_number,
        notes: notesCountMap[profile.id] ? 'has_notes' : null,
        created_at: profile.created_at,
        total_purchases: purchaseTotals[profile.user_id] || 0,
        source: userSources[profile.user_id] || 'ישיר',
      })) || [];

      return customers;
    },
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Get total active customers (with at least one purchase)
      const { data: purchasers, error: purchasersError } = await supabase
        .from('purchases')
        .select('user_id');
      
      if (purchasersError) throw purchasersError;
      
      const uniquePurchasers = new Set(purchasers?.map(p => p.user_id));
      
      // Get new customers this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: newCustomers, error: newCustomersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());
      
      if (newCustomersError) throw newCustomersError;

      // Get monthly revenue
      const { data: monthlyPurchases, error: monthlyPurchasesError } = await supabase
        .from('purchases')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString());
      
      if (monthlyPurchasesError) throw monthlyPurchasesError;
      
      const monthlyRevenue = monthlyPurchases?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Get total recordings count
      const { count: totalRecordings, error: recordingsError } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true });
      
      if (recordingsError) throw recordingsError;

      // Get active studios count
      const { count: activeStudios, error: studiosError } = await supabase
        .from('studios')
        .select('*', { count: 'exact', head: true })
        .eq('status', true);
      
      if (studiosError) throw studiosError;

      return {
        activeCustomers: uniquePurchasers.size,
        newCustomers: newCustomers || 0,
        monthlyRevenue,
        totalRecordings: totalRecordings || 0,
        activeStudios: activeStudios || 0,
      };
    },
  });
}
