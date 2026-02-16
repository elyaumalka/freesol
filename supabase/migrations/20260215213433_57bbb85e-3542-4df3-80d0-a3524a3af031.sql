CREATE TABLE public.roex_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  project_name TEXT,
  mode TEXT NOT NULL DEFAULT 'mixing',
  status TEXT NOT NULL DEFAULT 'processing',
  output_url TEXT,
  error TEXT,
  webhook_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roex_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks" ON public.roex_tasks FOR SELECT USING (true);
CREATE POLICY "Service role can insert" ON public.roex_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update" ON public.roex_tasks FOR UPDATE USING (true);