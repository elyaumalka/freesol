import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface CustomerNote {
  id: string;
  note: string;
  created_at: string;
}

interface CustomerNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    user_id: string;
    full_name: string;
    notes: string | null;
  } | null;
}

export function CustomerNotesDialog({ open, onOpenChange, customer }: CustomerNotesDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [newNote, setNewNote] = useState("");

  // Fetch notes history
  const { data: notesHistory, isLoading: isLoadingNotes, refetch } = useQuery({
    queryKey: ['customer-notes', customer?.id],
    queryFn: async () => {
      if (!customer) return [];
      
      const { data, error } = await supabase
        .from('customer_notes')
        .select('*')
        .eq('profile_id', customer.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CustomerNote[];
    },
    enabled: !!customer && open,
  });

  useEffect(() => {
    if (open && customer) {
      refetch();
    }
  }, [open, customer, refetch]);

  const handleAddNote = async () => {
    if (!customer || !newNote.trim()) return;
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('customer_notes')
        .insert({
          profile_id: customer.id,
          note: newNote.trim(),
          created_by: user?.id
        });

      if (error) throw error;

      toast.success("ההערה נוספה בהצלחה");
      setNewNote("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    } catch (error: any) {
      toast.error(error.message || "שגיאה בהוספת הערה");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success("ההערה נמחקה");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "שגיאה במחיקת הערה");
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[80vh] p-0 bg-white rounded-[30px] border-none [&>button]:hidden overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">הערות על {customer.full_name}</h2>
          <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {/* Add new note section */}
          <div className="space-y-3">
            <label className="block text-[18px] font-bold text-[#742551] text-right">הוסף הערה חדשה</label>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="כתוב הערה חדשה..."
              className="w-full min-h-[100px] px-6 py-4 bg-[#F7F7F7] rounded-[20px] text-[16px] text-[#742551] text-right outline-none border-none resize-none"
              dir="rtl"
            />
            <button
              onClick={handleAddNote}
              disabled={isLoading || !newNote.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-[#215F66] text-white rounded-full text-[16px] hover:bg-[#215F66]/90 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              הוסף הערה
            </button>
          </div>

          {/* Notes history */}
          <div className="space-y-3">
            <label className="block text-[18px] font-bold text-[#742551] text-right">היסטוריית הערות</label>
            
            {isLoadingNotes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
              </div>
            ) : notesHistory && notesHistory.length > 0 ? (
              <div className="space-y-3">
                {notesHistory.map((note) => (
                  <div 
                    key={note.id} 
                    className="bg-[#F7F7F7] rounded-[15px] p-4 relative group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-white" />
                      </button>
                      <div className="flex-1 text-right">
                        <p className="text-[15px] text-[#742551] whitespace-pre-wrap">{note.note}</p>
                        <p className="text-[13px] text-[#742551]/60 mt-2">
                          {format(new Date(note.created_at), 'dd/MM/yyyy בשעה HH:mm', { locale: he })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#742551]/60">
                אין הערות עדיין
              </div>
            )}
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90"
          >
            סגור
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
