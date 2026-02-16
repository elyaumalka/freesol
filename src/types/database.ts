// Database types for the application

export interface Artist {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PlaybackSection {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  label: string;
  startTime: number;
  endTime: number;
  duration: number;
  instrumentalUrl?: string;
}

export interface Playback {
  id: string;
  song_name: string;
  artist_id: string | null;
  duration: string;
  cost: number;
  usage_count: number;
  audio_url: string | null;
  original_audio_url: string | null;
  instrumental_url: string | null;
  sections: PlaybackSection[] | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  artist?: Artist;
}

export interface Studio {
  id: string;
  name: string;
  unique_id: string;
  password: string;
  status: boolean;
  activity_time: string;
  created_at: string;
  updated_at: string;
}

export interface Club {
  id: string;
  name: string;
  discount_type: 'percentage' | 'amount';
  discount_value: number;
  coupon_code: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  link: string;
  discount_type: 'percentage' | 'amount';
  discount_value: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'amount';
  discount_value: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  recording_hours: number;
  display_settings: string[];
  is_recommended: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerHours {
  id: string;
  user_id: string;
  total_hours: number;
  used_hours: number;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  package_id: string | null;
  amount: number;
  hours_purchased: number;
  coupon_id: string | null;
  campaign_id: string | null;
  club_id: string | null;
  status: 'pending' | 'completed' | 'failed';
  document_id: string | null;
  document_url: string | null;
  created_at: string;
  package?: Package;
}

export interface Project {
  id: string;
  user_id: string;
  playback_id: string | null;
  song_name: string;
  project_type: 'search' | 'upload' | 'ai';
  status: 'open' | 'recording' | 'processing' | 'completed';
  verses: any;
  created_at: string;
  updated_at: string;
  playback?: Playback;
}

export interface Recording {
  id: string;
  user_id: string;
  project_id: string | null;
  song_name: string;
  duration: string;
  audio_url: string | null;
  created_at: string;
  project?: Project;
}

export interface Inquiry {
  id: string;
  user_id: string | null;
  customer_name: string;
  rating: number;
  inquiry_type: string;
  content: string;
  response: string | null;
  responded_at: string | null;
  created_at: string;
}

// Profile with hours info for customer dashboard
export interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  hours?: CustomerHours;
}
