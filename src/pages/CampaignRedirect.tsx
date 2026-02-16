import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function CampaignRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyCampaign = async () => {
      if (!code) {
        navigate('/customer/register');
        return;
      }

      // Check if campaign exists with this link code
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, name')
        .ilike('link', `%/${code}`)
        .maybeSingle();

      if (campaign) {
        // Store campaign ID in sessionStorage for purchase
        sessionStorage.setItem('campaign_id', campaign.id);
        sessionStorage.setItem('campaign_name', campaign.name);
      }

      // Redirect to registration
      navigate('/customer/register');
    };

    verifyCampaign();
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#742551]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#FFBF66] mx-auto mb-4" />
        <p className="text-white text-[20px]">מעביר אותך להרשמה...</p>
      </div>
    </div>
  );
}
