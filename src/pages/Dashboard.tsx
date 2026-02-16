import { AppLayout } from "@/components/layout/AppLayout";
import { Star, ArrowLeft, Eye, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminStats } from "@/hooks/useAdminData";
import { useInquiries } from "@/hooks/useInquiries";
import { useAuth } from "@/hooks/useAuth";

import customerIcon from "@/assets/icons/customer.svg";
import playbackIcon from "@/assets/icons/playback.svg";
import priceIcon from "@/assets/icons/price.svg";
import studioIcon from "@/assets/icons/studio.svg";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: inquiries, isLoading: inquiriesLoading } = useInquiries();

  const statsCards = [
    { title: "לקוחות פעילים", value: stats?.activeCustomers || 0, icon: customerIcon },
    { title: "לקוחות חדשים", value: stats?.newCustomers || 0, icon: customerIcon },
    { title: "ממוצע הכנסה לחודש", value: `₪${stats?.monthlyRevenue?.toLocaleString() || 0}`, icon: priceIcon },
    { title: "סה\"כ הקלטות", value: stats?.totalRecordings || 0, icon: playbackIcon },
    { title: "אולפנים פעילים", value: stats?.activeStudios || 0, icon: studioIcon },
  ];

  const recentInquiries = inquiries?.slice(0, 4) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  return (
    <AppLayout>
      <div className="space-y-6 lg:space-y-8 px-4 lg:px-6">
        <div className="text-right">
          <h1 className="text-[26px] lg:text-[30px] xl:text-[35px] font-extrabold text-[#742551]">
            ברוך הבא!
          </h1>
          <p className="text-[26px] lg:text-[30px] xl:text-[35px] font-light text-[#742551]">
            {user?.email}, לניהול המערכת שלך!
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
          {statsLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : (
            statsCards.map((stat) => (
              <div 
                key={stat.title} 
                className="bg-white rounded-[20px] lg:rounded-[30px] shadow-[0px_4px_8px_3px_rgba(0,0,0,0.04)] p-4 lg:p-6 flex flex-col items-center text-center min-h-[160px] lg:min-h-[180px] xl:min-h-[208px]"
              >
                <div className="h-[36px] w-[36px] lg:h-[42px] lg:w-[42px] xl:h-[50px] xl:w-[50px] flex items-center justify-center mb-2 lg:mb-4">
                  <img src={stat.icon} alt="" className="h-full w-full" />
                </div>
                <p className="text-[26px] lg:text-[30px] xl:text-[35px] font-extrabold text-[#742551] mb-1 lg:mb-2">{stat.value}</p>
                <p className="text-[16px] lg:text-[18px] xl:text-[20px] font-extralight text-[#742551]">{stat.title}</p>
              </div>
            ))
          )}
        </div>

        <div className="bg-white rounded-[20px] lg:rounded-[30px] p-4 lg:p-6">
          <div className="flex items-center justify-between mb-3 lg:mb-4 pb-3 lg:pb-4 border-b border-[#742551]/25">
            <h2 className="text-[20px] lg:text-[22px] xl:text-[25px] font-normal text-[#742551]">
              פניות אחרונות
            </h2>
            <button 
              onClick={() => navigate('/inquiries')}
              className="text-[20px] lg:text-[22px] xl:text-[25px] font-extrabold text-[#742551] flex items-center gap-1"
            >
              לכל הפניות
              <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5" />
            </button>
          </div>

          {inquiriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : recentInquiries.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              אין פניות עדיין
            </div>
          ) : (
            <div className="space-y-3 lg:space-y-4">
              {recentInquiries.map((inquiry) => (
                <div 
                  key={inquiry.id} 
                  className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:gap-0 py-3 lg:py-4 px-4 lg:px-6 bg-[#F7F7F7] rounded-[20px] lg:rounded-[30px] min-h-[48px] lg:min-h-[64px]"
                >
                  <span className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] w-[100px] lg:w-[140px] text-right">{inquiry.customer_name}</span>

                  <span className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] w-[80px] lg:w-[140px] text-center hidden lg:block">-</span>

                  <div className="flex gap-0.5 lg:gap-1 w-[120px] lg:w-[160px] justify-center" dir="ltr">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-[20px] w-[20px] lg:h-[25px] lg:w-[25px] xl:h-[30px] xl:w-[30px]"
                        fill={i < inquiry.rating ? "#FFBF66" : "rgba(255, 191, 102, 0.33)"}
                        stroke="none"
                      />
                    ))}
                  </div>

                  <span className="text-[16px] lg:text-[18px] xl:text-[20px] font-extrabold text-[#742551] w-[60px] lg:w-[80px] text-center">{inquiry.inquiry_type}</span>

                  <span className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] w-[80px] lg:w-[120px] text-right">{formatDate(inquiry.created_at)}</span>

                  <button 
                    onClick={() => navigate('/inquiries')}
                    className="w-[30px] lg:w-[40px] flex justify-center"
                  >
                    <Eye className="h-[24px] w-[24px] lg:h-[28px] lg:w-[28px] xl:h-[30px] xl:w-[30px] text-[#FFBF66]" />
                  </button>

                  <button 
                    onClick={() => navigate('/inquiries')}
                    className="bg-[#672148] text-white rounded-[20px] lg:rounded-[30px] px-4 lg:px-6 h-[26px] lg:h-[30px] flex items-center gap-1 text-[16px] lg:text-[18px] xl:text-[20px] font-normal mr-auto"
                  >
                    מענה
                    <ArrowLeft className="h-3 w-3 lg:h-4 lg:w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
