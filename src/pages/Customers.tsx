import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Eye, Trash2, Loader2, MessageSquare } from "lucide-react";
import EditIcon from "@/assets/icons/edit.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { EditCustomerDialog } from "@/components/customers/EditCustomerDialog";
import { ViewCustomerDialog } from "@/components/customers/ViewCustomerDialog";
import { CustomerNotesDialog } from "@/components/customers/CustomerNotesDialog";
import { DeleteCustomerDialog } from "@/components/customers/DeleteCustomerDialog";
import { useAdminCustomers } from "@/hooks/useAdminData";
import { ExportButton } from "@/components/admin/ExportButton";

export default function Customers() {
  const { data: customers, isLoading } = useAdminCustomers();
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const handleView = (customer: any) => {
    setSelectedCustomer(customer);
    setViewDialogOpen(true);
  };

  const handleEdit = (customer: any) => {
    setSelectedCustomer(customer);
    setEditDialogOpen(true);
  };

  const handleNotes = (customer: any) => {
    setSelectedCustomer(customer);
    setNotesDialogOpen(true);
  };

  const handleDelete = (customer: any) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const filteredCustomers = customers?.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const exportColumns = [
    { key: 'customer_number' as const, label: 'מספר לקוח' },
    { key: 'full_name' as const, label: 'שם הלקוח' },
    { key: 'email' as const, label: 'כתובת מייל' },
    { key: 'phone' as const, label: 'טלפון' },
    { key: 'total_purchases' as const, label: 'סכום עסקאות' },
    { key: 'source' as const, label: 'מקור הגעה' },
    { key: 'notes' as const, label: 'הערות' },
  ];

  return (
    <AppLayout>
      <div className="space-y-4 lg:space-y-6 px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:gap-4">
            <button 
              onClick={() => setAddDialogOpen(true)}
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[#FFBF66] flex items-center justify-center hover:bg-[#FFBF66]/80 transition-colors"
            >
              <img src={PlusIcon} alt="Add" className="h-5 w-5 lg:h-6 lg:w-6" />
            </button>
            <h1 className="text-[20px] lg:text-[22px] xl:text-[25px] font-normal text-[#742551]">לקוחות המערכת</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:gap-4">
            <ExportButton 
              data={filteredCustomers as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="customers"
              title="לקוחות המערכת"
            />

            <div className="flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 rounded-full border border-[#215F66]">
              <Search className="h-4 w-4 lg:h-5 lg:w-5 text-[#215F66]" />
              <input 
                type="text" 
                placeholder="חיפוש לקוחות"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[14px] lg:text-[16px] xl:text-[18px] text-[#215F66] placeholder-[#215F66]/60 outline-none w-[140px] lg:w-[180px] xl:w-[200px]"
              />
            </div>

            <button 
              onClick={() => setAddDialogOpen(true)}
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[#FFBF66] flex items-center justify-center hover:bg-[#FFBF66]/80 transition-colors"
            >
              <img src={PlusIcon} alt="Add" className="h-5 w-5 lg:h-6 lg:w-6" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[20px] lg:rounded-[30px] overflow-hidden overflow-x-auto">
          <div className="flex items-center py-3 lg:py-4 px-4 lg:px-6 border-b border-[#742551]/20 min-w-[900px]">
            <div className="w-[80px] lg:w-[100px] text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-right">מספר לקוח</div>
            <div className="w-[100px] lg:w-[130px] text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">שם הלקוח</div>
            <div className="flex-1 text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">כתובת מייל</div>
            <div className="w-[100px] lg:w-[120px] text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">טלפון</div>
            <div className="w-[80px] lg:w-[100px] text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">סכום עסקאות</div>
            <div className="w-[100px] lg:w-[120px] text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">מקור הגעה</div>
            <div className="w-[160px] lg:w-[180px] text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">פעולות</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין לקוחות עדיין'}
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div 
                key={customer.id} 
                className="flex items-center py-3 lg:py-4 px-4 lg:px-6 bg-[#F7F7F7] mx-3 lg:mx-4 my-2 rounded-[20px] lg:rounded-[30px] min-w-[900px]"
              >
                <div className="w-[80px] lg:w-[100px] text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-right font-mono">{customer.customer_number || '-'}</div>
                <div className="w-[100px] lg:w-[130px] text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{customer.full_name}</div>
                <div className="flex-1 text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{customer.email}</div>
                <div className="w-[100px] lg:w-[120px] text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{customer.phone || '-'}</div>
                <div className="w-[80px] lg:w-[100px] text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">₪ {customer.total_purchases}</div>
                <div className="w-[100px] lg:w-[120px] text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{customer.source}</div>

                <div className="w-[160px] lg:w-[180px] flex items-center gap-1.5 lg:gap-2 justify-center">
                  <button 
                    onClick={() => handleNotes(customer)}
                    className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center transition-colors ${customer.notes ? 'bg-[#215F66]' : 'bg-transparent border border-[#215F66]'}`}
                    title={customer.notes ? 'יש הערות' : 'הוסף הערה'}
                  >
                    <MessageSquare className={`h-4 w-4 lg:h-5 lg:w-5 ${customer.notes ? 'text-white' : 'text-[#215F66]'}`} />
                  </button>
                  <button 
                    onClick={() => handleView(customer)}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-transparent flex items-center justify-center"
                  >
                    <Eye className="h-5 w-5 lg:h-6 lg:w-6 text-[#FFBF66]" />
                  </button>
                  <button 
                    onClick={() => handleEdit(customer)}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#742551] flex items-center justify-center hover:bg-[#742551]/80 transition-colors"
                  >
                    <img src={EditIcon} alt="Edit" className="h-4 w-4 lg:h-5 lg:w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(customer)}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#EE0004] flex items-center justify-center hover:bg-[#EE0004]/80 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddCustomerDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditCustomerDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} customer={selectedCustomer} />
      <ViewCustomerDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} customer={selectedCustomer} />
      <CustomerNotesDialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen} customer={selectedCustomer} />
      <DeleteCustomerDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} customer={selectedCustomer} />
    </AppLayout>
  );
}
