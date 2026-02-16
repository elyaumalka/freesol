
-- Artists table (for playback creators)
CREATE TABLE public.artists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Playbacks table
CREATE TABLE public.playbacks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    song_name TEXT NOT NULL,
    artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL,
    duration TEXT NOT NULL DEFAULT '00:00',
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Studios table
CREATE TABLE public.studios (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    unique_id TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    status BOOLEAN NOT NULL DEFAULT true,
    activity_time TEXT NOT NULL DEFAULT '00:00:00',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Clubs table (organizations with discount codes)
CREATE TABLE public.clubs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'amount')),
    discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    coupon_code TEXT NOT NULL UNIQUE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Campaigns table (influencer/affiliate campaigns)
CREATE TABLE public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    link TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'amount')),
    discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Coupons table (individual discount codes)
CREATE TABLE public.coupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'amount')),
    discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Packages table (pricing packages)
CREATE TABLE public.packages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    recording_hours DECIMAL(5,2) NOT NULL,
    display_settings TEXT[] NOT NULL DEFAULT '{}',
    is_recommended BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customer hour balances
CREATE TABLE public.customer_hours (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    used_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Purchases table (customer purchase history)
CREATE TABLE public.purchases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    hours_purchased DECIMAL(5,2) NOT NULL,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Projects table (customer recording projects)
CREATE TABLE public.projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    playback_id UUID REFERENCES public.playbacks(id) ON DELETE SET NULL,
    song_name TEXT NOT NULL,
    project_type TEXT NOT NULL DEFAULT 'search' CHECK (project_type IN ('search', 'upload', 'ai')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'recording', 'processing', 'completed')),
    verses JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Recordings table (completed recordings)
CREATE TABLE public.recordings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    song_name TEXT NOT NULL,
    duration TEXT NOT NULL DEFAULT '00:00',
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inquiries table (customer support inquiries)
CREATE TABLE public.inquiries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    inquiry_type TEXT NOT NULL,
    content TEXT NOT NULL,
    response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Artists (admin/office worker can manage, everyone can read)
CREATE POLICY "Anyone can view artists" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Admins can manage artists" ON public.artists FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Playbacks (public read, admin manage)
CREATE POLICY "Anyone can view playbacks" ON public.playbacks FOR SELECT USING (true);
CREATE POLICY "Admins can manage playbacks" ON public.playbacks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Studios (admin/office worker only)
CREATE POLICY "Admins can view studios" ON public.studios FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_worker'));
CREATE POLICY "Admins can manage studios" ON public.studios FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Clubs (admin/office worker only)
CREATE POLICY "Staff can view clubs" ON public.clubs FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_worker'));
CREATE POLICY "Admins can manage clubs" ON public.clubs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Campaigns (admin/office worker only)
CREATE POLICY "Staff can view campaigns" ON public.campaigns FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_worker'));
CREATE POLICY "Admins can manage campaigns" ON public.campaigns FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Coupons (public can validate, admin can manage)
CREATE POLICY "Anyone can view coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Packages (public read, admin manage)
CREATE POLICY "Anyone can view packages" ON public.packages FOR SELECT USING (true);
CREATE POLICY "Admins can manage packages" ON public.packages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Customer Hours (user own data, admin all)
CREATE POLICY "Users can view own hours" ON public.customer_hours FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own hours" ON public.customer_hours FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all hours" ON public.customer_hours FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert hours" ON public.customer_hours FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for Purchases (user own data, admin all)
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create purchases" ON public.purchases FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all purchases" ON public.purchases FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_worker'));

-- RLS Policies for Projects (user own data, admin all)
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own projects" ON public.projects FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_worker'));

-- RLS Policies for Recordings (user own data, admin all)
CREATE POLICY "Users can view own recordings" ON public.recordings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create recordings" ON public.recordings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all recordings" ON public.recordings FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_worker'));

-- RLS Policies for Inquiries (user can create/view own, admin all)
CREATE POLICY "Users can view own inquiries" ON public.inquiries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create inquiries" ON public.inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage all inquiries" ON public.inquiries FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_worker'));

-- Triggers for updated_at
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON public.artists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_playbacks_updated_at BEFORE UPDATE ON public.playbacks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_studios_updated_at BEFORE UPDATE ON public.studios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_hours_updated_at BEFORE UPDATE ON public.customer_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create customer_hours record when a new customer is created
CREATE OR REPLACE FUNCTION public.handle_new_customer_hours()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.customer_hours (user_id, total_hours, used_hours)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER create_customer_hours_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_customer_hours();
