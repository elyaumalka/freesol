import { useState, useEffect } from "react";
import { CustomerLayout } from "@/components/customer/CustomerLayout";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CustomerPersonalDetails() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: ""
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setFormData({
          fullName: data.full_name || "",
          phone: data.phone || "",
          email: data.email || user.email || ""
        });
      } else {
        setFormData({
          fullName: user.user_metadata?.full_name || "",
          phone: "",
          email: user.email || ""
        });
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.fullName,
        phone: formData.phone,
        email: formData.email
      })
      .eq('user_id', user.id);
    
    setIsSaving(false);
    
    if (error) {
      toast.error('שגיאה בעדכון הפרטים');
      console.error(error);
    } else {
      toast.success('הפרטים עודכנו בהצלחה');
    }
  };

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center" style={{ padding: 'var(--space-2xl) 0' }}>
          <Loader2 style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} className="animate-spin text-[#742551]" />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      {/* Header */}
      <div className="text-right" style={{ marginBottom: 'var(--space-md)' }}>
        <h1 
          className="text-[#215F66]"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-3xl)' }}
        >
          <span className="font-light">שלום,</span>{" "}
          <span className="font-bold">{formData.fullName || 'משתמש'}!</span>
        </h1>
        {user && (
          <p 
            className="text-[#215F66]/60"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
          >
            מזהה משתמש: {user.id.slice(0, 8)}...
          </p>
        )}
      </div>

      {/* Form Card */}
      <div 
        className="bg-white"
        style={{ 
          borderRadius: 'var(--radius-xl)', 
          padding: 'var(--space-xl)',
          maxWidth: 'clamp(600px, 50vw, 900px)'
        }}
      >
        <h2 
          className="font-bold text-[#742551] text-right"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-lg)' }}
        >
          עריכת פרטים אישיים
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Full Name */}
          <div className="text-right">
            <label 
              className="block text-[#742551]"
              style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)', marginBottom: 'var(--space-sm)' }}
            >
              שם מלא
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full text-right"
              style={{ 
                background: '#F7F7F7',
                fontFamily: 'Discovery_Fs',
                fontSize: 'var(--text-base)',
                border: 'none',
                outline: 'none',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)'
              }}
            />
          </div>

          {/* Phone */}
          <div className="text-right">
            <label 
              className="block text-[#742551]"
              style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)', marginBottom: 'var(--space-sm)' }}
            >
              מספר טלפון
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full text-right"
              style={{ 
                background: '#F7F7F7',
                fontFamily: 'Discovery_Fs',
                fontSize: 'var(--text-base)',
                border: 'none',
                outline: 'none',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)'
              }}
            />
          </div>

          {/* Email */}
          <div className="text-right">
            <label 
              className="block text-[#742551]"
              style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)', marginBottom: 'var(--space-sm)' }}
            >
              כתובת מייל
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full text-right"
              style={{ 
                background: '#F7F7F7',
                fontFamily: 'Discovery_Fs',
                fontSize: 'var(--text-base)',
                border: 'none',
                outline: 'none',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)'
              }}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center rounded-full font-bold text-[#742551] hover:opacity-90 transition-all disabled:opacity-50"
              style={{ 
                background: '#FFBF66',
                fontFamily: 'Discovery_Fs',
                fontSize: 'var(--text-base)',
                padding: 'var(--space-md) var(--space-xl)',
                gap: 'var(--space-sm)'
              }}
            >
              {isSaving && <Loader2 style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="animate-spin" />}
              <span>{isSaving ? 'שומר...' : 'עדכון ושמירה'}</span>
              <ArrowLeft style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
            </button>
          </div>
        </form>
      </div>
    </CustomerLayout>
  );
}