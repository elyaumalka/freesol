import { NavLink, useLocation } from "react-router-dom";

// Import custom icons
import dashboardIcon from "@/assets/icons/dashboard.svg";
import customerIcon from "@/assets/icons/customer.svg";
import priceIcon from "@/assets/icons/price.svg";
import studioIcon from "@/assets/icons/studio.svg";
import playbackIcon from "@/assets/icons/playback.svg";
import clubIcon from "@/assets/icons/club.svg";
import couponIcon from "@/assets/icons/coupon.svg";
import campaignIcon from "@/assets/icons/campaign.svg";
import inquiriesIcon from "@/assets/icons/inquiries.svg";
import settingsIcon from "@/assets/icons/settings.svg";

const menuItems = [
  { title: "שולחן עבודה", url: "/dashboard", icon: dashboardIcon },
  { title: "אולפנים", url: "/studios", icon: studioIcon },
  { title: "לקוחות", url: "/customers", icon: customerIcon },
  { title: "מחירים", url: "/prices", icon: priceIcon },
  { title: "מועדונים", url: "/clubs", icon: clubIcon },
  { title: "פלייבקים", url: "/playbacks", icon: playbackIcon },
  { title: "פניות", url: "/inquiries", icon: inquiriesIcon },
  { title: "קופונים", url: "/coupons", icon: couponIcon },
  { title: "קמפיינים", url: "/campaigns", icon: campaignIcon },
  { title: "הגדרות", url: "/settings", icon: settingsIcon },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed top-16 lg:top-20 right-0 z-40">
      <nav 
        className="w-[220px] lg:w-[250px] xl:w-[264px] py-4 lg:py-6 flex flex-col items-start"
        style={{
          background: '#672148',
          borderTopLeftRadius: 30,
          borderBottomLeftRadius: 30,
        }}
      >
        <div className="space-y-2 lg:space-y-3 flex flex-col items-start w-full">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink 
                key={item.title}
                to={item.url} 
                className={`flex items-center gap-2 lg:gap-3 px-3 lg:px-4 h-[42px] lg:h-[46px] xl:h-[50px] w-[180px] lg:w-[200px] xl:w-[220px] transition-all ${
                  isActive 
                    ? "bg-white text-[#742551]" 
                    : "bg-[#742551] text-white hover:bg-[#742551]/80"
                }`}
                style={{
                  borderTopLeftRadius: 30,
                  borderBottomLeftRadius: 30,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }}
              >
                <img src={item.icon} alt="" className="h-6 w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8" />
                <span className="text-[14px] lg:text-[16px] xl:text-[18px] font-light">
                  {item.title}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
