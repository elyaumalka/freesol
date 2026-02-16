-- Create table to store Suno generation tasks and results
CREATE TABLE public.suno_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  audio_url TEXT,
  stream_audio_url TEXT,
  image_url TEXT,
  title TEXT,
  tags TEXT,
  error TEXT,
  callback_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.suno_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own tasks" 
ON public.suno_tasks 
FOR SELECT 
USING (auth.uid() = user_id);

-- Service role can insert/update (from edge functions)
CREATE POLICY "Service role can manage all tasks" 
ON public.suno_tasks 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index on task_id for faster lookups
CREATE INDEX idx_suno_tasks_task_id ON public.suno_tasks(task_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_suno_tasks_updated_at
BEFORE UPDATE ON public.suno_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();