import React, { useState, useEffect, useRef } from 'react';
import { Participant, Expense, Trip } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { Plus, Trash2, Users, CheckSquare, Square, Upload, Download } from 'lucide-react';
import { CurrencyInput } from './ui/CurrencyInput';
import * as XLSX from 'xlsx';

type Props = {
  participants: Participant[];
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  trip: Trip;
  isLocked?: boolean;
  requestUnlock?: () => void;
};

export function ExpenseTab({ participants, expenses, setExpenses, trip, isLocked, requestUnlock }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSponsored, setIsSponsored] = useState(false);
  const [sharedBy, setSharedBy] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string>(''); // empty means pay from fund

  const [payerSearch, setPayerSearch] = useState('');
  const [sharedSearch, setSharedSearch] = useState('');
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editDate, setEditDate] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editSharedBy, setEditSharedBy] = useState<string[]>([]);
  const [editIsSponsored, setEditIsSponsored] = useState(false);

  const [filters, setFilters] = useState({
    text: '',
    dateFrom: '',
    dateTo: '',
    groupType: 'all'
  });

  // Default to selecting all when participants change
  useEffect(() => {
    if (participants.length > 0 && sharedBy.length === 0) {
      setSharedBy(participants.map(p => p.id));
    }
  }, [participants]); // eslint-disable-line

  const toggleParticipant = (id: string) => {
    if (sharedBy.includes(id)) {
      setSharedBy(sharedBy.filter(pId => pId !== id));
    } else {
      setSharedBy([...sharedBy, id]);
    }
  };

  const selectAll = () => setSharedBy(participants.map(p => p.id));
  const deselectAll = () => setSharedBy([]);
  
  const selectSubGroup = (members: string[]) => {
    setSharedBy(members);
  };

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    if (!isSponsored && sharedBy.length === 0) {
      alert("Vui lòng chọn ít nhất 1 người chia tiền, hoặc đánh dấu là 'Tài trợ'.");
      return;
    }
    
    setExpenses([{
      id: generateId(),
      description,
      amount: Number(amount),
      isSponsored,
      sharedBy: isSponsored ? [] : sharedBy,
      paidBy: paidBy || 'fund',
      date: date || new Date().toISOString()
    }, ...expenses]);
    
    setDescription('');
    setAmount('');
    setIsSponsored(false);
    setPayerSearch('');
    // keeping current sharedBy for next expense makes UX slightly better usually.
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const newExpenses: Expense[] = [];
      let skippedCount = 0;

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || !row[0] || !row[1]) continue;
        
        const name = String(row[0]).trim().toLowerCase();
        const amount = Number(row[1]) || 0;
        const description = String(row[2] || 'Chi phí từ Excel').trim();
        const source = String(row[3] || '').trim().toLowerCase(); 
        
        const participant = participants.find(p => p.name.toLowerCase() === name);
        if (!participant) {
          skippedCount++;
          continue; 
        }
        
        let filePaidBy = 'fund'; 
        if (source === 'kế toán ứng trước' || source === 'ứng trước') filePaidBy = 'advance';
        else if (source && source !== 'quỹ nhóm' && source !== 'quỹ') {
           const payer = participants.find(p => p.name.toLowerCase() === source);
           if (payer) filePaidBy = payer.id;
        }

        newExpenses.push({
          id: generateId() + '-' + i,
          description,
          amount,
          isSponsored: false,
          sharedBy: [participant.id],
          paidBy: filePaidBy,
          date: new Date().toISOString()
        });
      }

      if (newExpenses.length > 0) {
        setExpenses([...newExpenses, ...expenses]);
        alert(`Đã thêm ${newExpenses.length} khoản chi.` + (skippedCount ? ` Bỏ qua ${skippedCount} dòng không hợp lệ.` : ''));
      }
    } catch(err) {
      console.error(err);
      alert('Có lỗi xảy ra khi đọc file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleSponsor = (expense: Expense) => {
    if (isLocked) {
       if (requestUnlock) requestUnlock();
       return;
    }
    setExpenses(expenses.map(e => e.id === expense.id ? { ...e, isSponsored: !e.isSponsored, sharedBy: !e.isSponsored ? [] : (e.sharedBy.length > 0 ? e.sharedBy : participants.map(p => p.id)) } : e));
  };

  const removeExpense = (id: string) => {
    if (isLocked) {
       if (requestUnlock) requestUnlock();
       return;
    }
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const startEdit = (e: Expense) => {
    if (isLocked) {
       if (requestUnlock) requestUnlock();
       return;
    }
    setEditingId(e.id);
    setEditAmount(e.amount);
    setEditDesc(e.description);
    setEditDate(e.date ? e.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditPaidBy(e.paidBy || 'fund');
    setEditSharedBy(e.sharedBy || []);
    setEditIsSponsored(e.isSponsored || false);
  };

  const saveEdit = () => {
    if (editingId && editAmount !== '') {
      setExpenses(expenses.map(e => e.id === editingId ? { 
         ...e, 
         amount: Number(editAmount), 
         description: editDesc, 
         date: editDate || e.date,
         paidBy: editPaidBy,
         sharedBy: editIsSponsored ? [] : editSharedBy,
         isSponsored: editIsSponsored
      } : e));
    }
    setEditingId(null);
  };

  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);

  const filteredExpenses = expenses.filter(expense => {
    if (filters.text) {
      const searchTerm = filters.text.toLowerCase();
      const payerName = participants.find(p => p.id === expense.paidBy)?.name || trip.subGroups?.find(g => g.id === expense.paidBy)?.name || (expense.paidBy === 'advance' ? 'Kế toán' : 'Quỹ');
      const sharedNames = expense.sharedBy.map(id => participants.find(p => p.id === id)?.name).join(' ');
      if (
          !expense.description.toLowerCase().includes(searchTerm) &&
          !payerName.toLowerCase().includes(searchTerm) &&
          !sharedNames.toLowerCase().includes(searchTerm)
      ) {
          return false;
      }
    }
    
    if (filters.dateFrom && expense.date) {
       if (expense.date.split('T')[0] < filters.dateFrom) return false;
    }
    if (filters.dateTo && expense.date) {
       if (expense.date.split('T')[0] > filters.dateTo) return false;
    }
    
    if (filters.groupType !== 'all') {
       if (filters.groupType === 'sponsored' && !expense.isSponsored) return false;
       if (filters.groupType === 'personal' && (expense.isSponsored || expense.sharedBy.length !== 1)) return false;
       if (filters.groupType === 'group' && (expense.isSponsored || expense.sharedBy.length <= 1 || expense.sharedBy.length === participants.length)) return false;
       if (filters.groupType === 'all_squad' && (expense.isSponsored || expense.sharedBy.length !== participants.length)) return false;
    }
    
    return true;
  });

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'Ngày',
      'Người trả / Nguồn chi',
      'Nội dung',
      'Sinh hoạt phí / Chia cho ai',
      'Phân loại',
      'Số tiền (VNĐ)'
    ];
    
    const data = filteredExpenses.map(expense => {
      const time = expense.date ? new Date(expense.date).toLocaleDateString('vi-VN') : '';
      const payer = expense.paidBy === 'fund' ? 'Quỹ cả đoàn' : (expense.paidBy === 'advance' ? 'Kế toán/Tạm ứng' : (participants.find(p => p.id === expense.paidBy)?.name || trip.subGroups?.find(g => g.id === expense.paidBy)?.name || 'Không rõ'));
      const sharedByNames = expense.isSponsored ? 'Không chia (Tài trợ)' : (expense.sharedBy.length === participants.length ? 'Cả đoàn' : expense.sharedBy.map(id => participants.find(p => p.id === id)?.name).filter(Boolean).join(', '));
      
      let typeLabel = 'Cá nhân';
      if (expense.isSponsored) typeLabel = 'Tài trợ';
      else if (expense.sharedBy.length === participants.length) typeLabel = 'Cả đoàn';
      else if (expense.sharedBy.length > 1) typeLabel = 'Nhóm';
      
      return [
        time,
        payer,
        expense.description,
        sharedByNames,
        typeLabel,
        expense.amount
      ];
    });
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, "NhatKyChi");
    XLSX.writeFile(wb, "NhatKyChiTieu.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Đã Chi (Thực tế)</p>
        <p className="text-3xl font-bold text-rose-600">{formatCurrency(totalExpense)}</p>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thêm khoản chi mới</h2>
          <div className="relative group">
             <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
             <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100 uppercase tracking-wide">
               <Upload className="w-3 h-3" /> Import Excel
             </button>
             <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none">
              <p className="font-bold mb-1">Cấu trúc file Excel mẫu:</p>
              <ul className="list-disc pl-4 space-y-1 opacity-90">
                <li>Cột 1: Người trong đoàn sử dụng (VD: Huy)</li>
                <li>Cột 2: Số tiền chi (VD: 100000)</li>
                <li>Cột 3: Nội dung chi (VD: Cafe sáng)</li>
                <li>Cột 4: Nguồn chi trả (VD: Quỹ / [Tên người ứng trả])</li>
              </ul>
              <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>
        </div>
        <form onSubmit={addExpense} className="space-y-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nguồn chi / Người trả</label>
              <div 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer"
                onClick={() => setShowPayerDropdown(!showPayerDropdown)}
              >
                {paidBy === 'fund' ? 'Quỹ cả đoàn' : paidBy === 'advance' ? 'Kế toán ứng trước' : participants.find(p => p.id === paidBy)?.name || (trip.subGroups?.find(g => g.id === paidBy) ? `Quỹ ${trip.subGroups!.find(g => g.id === paidBy)!.name}` : '-- Chọn nguồn chi --')}
              </div>
              {showPayerDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                  <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                    <input 
                      type="text" 
                      autoFocus
                      placeholder="Tìm kiếm..." 
                      value={payerSearch} 
                      onChange={e => setPayerSearch(e.target.value)} 
                      className="w-full px-2 py-1 text-sm border border-slate-200 rounded outline-none" 
                    />
                  </div>
                  <div 
                    className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer font-medium text-emerald-700"
                    onClick={() => { setPaidBy('fund'); setShowPayerDropdown(false); }}
                  >
                    Quỹ cả đoàn
                  </div>
                  {trip.subGroups?.filter(g => g.name.toLowerCase().includes(payerSearch.toLowerCase())).map(g => (
                    <div 
                      key={g.id}
                      className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer font-medium text-sky-600"
                      onClick={() => { setPaidBy(g.id); setShowPayerDropdown(false); }}
                    >
                      Quỹ {g.name}
                    </div>
                  ))}
                  <div 
                    className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer font-medium text-amber-600"
                    onClick={() => { setPaidBy('advance'); setShowPayerDropdown(false); }}
                  >
                    Kế toán ứng trước
                  </div>
                  {participants.filter(p => p.name.toLowerCase().includes(payerSearch.toLowerCase())).map(p => (
                    <div 
                      key={p.id}
                      className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"
                      onClick={() => { setPaidBy(p.id); setShowPayerDropdown(false); }}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nội dung chi</label>
              <input 
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                placeholder="Khách sạn, ăn uống..."
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Số tiền (VNĐ)</label>
               <CurrencyInput
                value={amount} 
                onChange={val => setAmount(val)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                placeholder="VD: 1,500,000"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Ngày chi</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isSponsored"
              checked={isSponsored}
              onChange={e => setIsSponsored(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="isSponsored" className="text-sm font-medium text-slate-700 cursor-pointer">
              Khoản này được tài trợ (Không chia cho ai)
            </label>
          </div>

          {!isSponsored && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <div className="flex flex-col gap-3 mb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4" /> Thành viên tham gia chi ({sharedBy.length}/{participants.length})
                  </label>
                  <input
                    type="text"
                    placeholder="Lọc tên..."
                    value={sharedSearch}
                    onChange={(e) => setSharedSearch(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={selectAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 bg-indigo-50 rounded">Cả đoàn</button>
                  {trip.subGroups?.map(sg => (
                    <button key={sg.id} type="button" onClick={() => selectSubGroup(sg.members)} className="text-xs text-purple-600 hover:text-purple-800 font-bold px-2 py-1 bg-purple-50 rounded">Nhóm: {sg.name}</button>
                  ))}
                  <button type="button" onClick={deselectAll} className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-200 rounded">Bỏ chọn</button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {participants.filter(p => !sharedSearch || p.name.toLowerCase().includes(sharedSearch.toLowerCase())).map(p => {
                  const isSelected = sharedBy.includes(p.id);
                  return (
                    <div 
                      key={p.id}
                      onClick={() => toggleParticipant(p.id)} 
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer select-none transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-800 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                      <span className="text-sm font-medium truncate">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
             <button type="submit" disabled={participants.length === 0} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Ghi nhận chi tiêu
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nhật ký Chi</h2>
            <button 
              onClick={exportExcel}
              className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-800 font-bold px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors"
            >
              <Download className="w-3 h-3" /> Xuất Excel
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
            <span className="text-xs font-bold text-slate-500 uppercase">Bộ lọc</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
               <input 
                 type="text" 
                 placeholder="Tìm nội dung, người trả..." 
                 value={filters.text}
                 onChange={e => setFilters({...filters, text: e.target.value})}
                 className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
               />
            </div>
            <div>
               <select
                 value={filters.groupType}
                 onChange={e => setFilters({...filters, groupType: e.target.value})}
                 className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-white"
               >
                 <option value="all">Tất cả Nhóm/Đoàn</option>
                 <option value="all_squad">Cả đoàn</option>
                 <option value="group">Nhóm</option>
                 <option value="personal">Cá nhân</option>
                 <option value="sponsored">Tài trợ</option>
               </select>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-slate-500">Từ</span>
               <input 
                 type="date" 
                 value={filters.dateFrom}
                 onChange={e => setFilters({...filters, dateFrom: e.target.value})}
                 className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
               />
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-slate-500">Đến</span>
               <input 
                 type="date" 
                 value={filters.dateTo}
                 onChange={e => setFilters({...filters, dateTo: e.target.value})}
                 className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
               />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-xs font-bold text-slate-400 uppercase">
                <th className="py-3 px-4">Ngày chi</th>
                <th className="py-3 px-4">Nội dung</th>
                <th className="py-3 px-4">Người trả</th>
                <th className="py-3 px-4">Chia cho ai</th>
                <th className="py-3 px-4 text-right">Số tiền</th>
                <th className="py-3 px-4 text-center">Nhóm/Đoàn</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {filteredExpenses.map(expense => {
                const payer = participants.find(p => p.id === expense.paidBy)?.name || (trip.subGroups?.find(g => g.id === expense.paidBy) ? `Quỹ ${trip.subGroups!.find(g => g.id === expense.paidBy)!.name}` : (expense.paidBy === 'advance' ? 'Kế toán' : 'Quỹ cả đoàn'));
                const sharedByNames = expense.sharedBy.map(id => participants.find(p => p.id === id)?.name).filter(Boolean).join(', ');

                let groupTypeLabel = <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold uppercase">Nhóm</span>;
                if (expense.sharedBy.length === participants.length) {
                   groupTypeLabel = <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Cả đoàn</span>;
                } else if (expense.sharedBy.length === 1) {
                   groupTypeLabel = <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">Cá nhân</span>;
                }

                if (editingId === expense.id) {
                  return (
                    <tr key={expense.id} className="bg-indigo-50/50">
                      <td className="py-2 px-4">
                        <input 
                          type="date" 
                          value={editDate} 
                          onChange={e => setEditDate(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-sm outline-none focus:border-indigo-500" 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input 
                          type="text" 
                          value={editDesc} 
                          onChange={e => setEditDesc(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-sm outline-none focus:border-indigo-500" 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <select 
                          value={editPaidBy}
                          onChange={e => setEditPaidBy(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500"
                        >
                          <option value="fund">Quỹ cả đoàn</option>
                          <option value="advance">Kế toán ứng trước</option>
                          {(trip.subGroups || []).map(g => (
                            <option key={`g_${g.id}`} value={g.id}>Quỹ {g.name}</option>
                          ))}
                          {participants.map(p => (
                            <option key={`p_${p.id}`} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-4 max-w-[200px]">
                        {!editIsSponsored && (
                          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                            <div className="flex items-center gap-1 mb-1">
                              <button 
                                type="button" 
                                onClick={() => setEditSharedBy(participants.map(p => p.id))}
                                className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded transition-colors flex-1"
                              >
                                Cả đoàn
                              </button>
                            </div>
                            {trip.subGroups && trip.subGroups.length > 0 && (
                               <div className="flex items-center gap-1 mb-1 flex-wrap">
                                 {trip.subGroups.map(g => (
                                    <button 
                                      key={g.id}
                                      type="button" 
                                      onClick={() => setEditSharedBy(g.members)}
                                      className="text-[10px] bg-sky-100 hover:bg-sky-200 text-sky-700 px-2 py-0.5 rounded transition-colors flex-1"
                                    >
                                      Nhóm {g.name}
                                    </button>
                                 ))}
                               </div>
                            )}
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              {participants.map(p => (
                                <label key={p.id} className="flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 p-1 rounded hover:bg-slate-50 text-[10px]">
                                  <input 
                                    type="checkbox" 
                                    className="w-3 h-3 text-indigo-600 rounded border-slate-300"
                                    checked={editSharedBy.includes(p.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setEditSharedBy([...editSharedBy, p.id]);
                                      else setEditSharedBy(editSharedBy.filter(id => id !== p.id));
                                    }}
                                  />
                                  <span className="truncate">{p.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {editIsSponsored && <span className="text-[10px] text-slate-400 italic">Không chia (Tài trợ)</span>}
                      </td>
                      <td className="py-2 px-4">
                        <CurrencyInput
                          value={editAmount} 
                          onChange={val => setEditAmount(val)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-sm text-right outline-none focus:border-indigo-500" 
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <label className="flex flex-col items-center gap-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                            checked={editIsSponsored}
                            onChange={(e) => setEditIsSponsored(e.target.checked)}
                          />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Tài trợ</span>
                        </label>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <div className="flex justify-center gap-2">
                           <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 text-slate-500 hover:bg-slate-200 rounded font-bold transition-colors">Hủy</button>
                           <button onClick={saveEdit} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 transition-colors">Lưu</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 text-slate-500 text-xs">
                      {expense.date ? new Date(expense.date).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800">
                      {expense.description}
                      {expense.isSponsored && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">Tài trợ</span>}
                    </td>
                    <td className="py-4 px-4 text-slate-700 font-medium">
                      {payer}
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-sm max-w-[200px] truncate" title={expense.isSponsored ? 'Không chia' : sharedByNames}>
                      {expense.isSponsored ? <span className="italic">Không chia</span> : 
                       (expense.sharedBy.length === participants.length ? 'Cả đoàn' : sharedByNames)
                      }
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-rose-600">{formatCurrency(expense.amount)}</td>
                    <td className="py-4 px-4 text-center">
                      {expense.isSponsored ? '-' : groupTypeLabel}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => startEdit(expense)}
                          className="text-slate-400 hover:text-indigo-500 transition-colors p-1 flex items-center"
                          title="Sửa"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button 
                          onClick={() => handleToggleSponsor(expense)}
                          className={`text-xs px-2 py-1 rounded font-bold transition-colors ${expense.isSponsored ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          title={expense.isSponsored ? "Bỏ đánh dấu Tài trợ" : "Đánh dấu là Tài trợ"}
                        >
                          {expense.isSponsored ? 'Bỏ tài trợ' : 'Tài trợ'}
                        </button>
                        <button 
                          onClick={() => removeExpense(expense.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1 flex items-center"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-sm italic border-t border-slate-50">
                    Chưa có khoản chi nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
