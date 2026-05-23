import React, { useState } from 'react';
import { Participant, EstimatedExpense, Trip } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import * as XLSX from 'xlsx';
import { Plus, Trash2, CheckSquare, Square, Lock, Calculator, Download, Users } from 'lucide-react';
import { CurrencyInput } from './ui/CurrencyInput';

type Props = {
  participants: Participant[];
  estimatedExpenses: EstimatedExpense[];
  setEstimatedExpenses: (val: EstimatedExpense[] | ((prev: EstimatedExpense[]) => EstimatedExpense[])) => void;
  trip: Trip;
  isLocked?: boolean;
  requestUnlock?: () => void;
};

export function EstimatedExpenseTab({ participants, estimatedExpenses, setEstimatedExpenses, trip, isLocked, requestUnlock }: Props) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sharedBy, setSharedBy] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editUnitPrice, setEditUnitPrice] = useState<number | ''>('');
  const [editQuantity, setEditQuantity] = useState<number | ''>('');
  const [editIsSponsored, setEditIsSponsored] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editSharedBy, setEditSharedBy] = useState<string[]>([]);
  const [editParticipantSearch, setEditParticipantSearch] = useState('');
  const [showMemberEstimates, setShowMemberEstimates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleShare = (id: string) => {
    if (sharedBy.includes(id)) setSharedBy(sharedBy.filter(x => x !== id));
    else setSharedBy([...sharedBy, id]);
  };

  const handleUnitPriceChange = (val: number | '') => {
    setUnitPrice(val);
    if (val !== '' && quantity !== '') {
      setAmount(val * Number(quantity));
    } else if (val !== '') {
       setAmount(val);
    }
  };

  const handleQuantityChange = (val: string) => {
    const q = val === '' ? '' : Number(val);
    setQuantity(q);
    if (q !== '' && unitPrice !== '') {
      setAmount(q * Number(unitPrice));
    }
  };

  const handleEditUnitPriceChange = (val: number | '') => {
    setEditUnitPrice(val);
    if (val !== '' && editQuantity !== '') {
      setEditAmount(val * Number(editQuantity));
    } else if (val !== '') {
      setEditAmount(val);
    }
  };

  const handleEditQuantityChange = (val: string) => {
    const q = val === '' ? '' : Number(val);
    setEditQuantity(q);
    if (q !== '' && editUnitPrice !== '') {
      setEditAmount(q * Number(editUnitPrice));
    }
  };

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }
    if (!desc || amount === '' || sharedBy.length === 0) {
      alert("Vui lòng nhập đủ thông tin và chọn ít nhất 1 người chia sẻ!");
      return;
    }

    if (unitPrice !== '' && quantity !== '') {
      if (Math.abs(Number(unitPrice) * Number(quantity) - Number(amount)) > 1) {
        alert("Tổng số tiền không khớp với đơn giá x số lượng. Vui lòng kiểm tra lại!");
        return;
      }
    }
    
    setEstimatedExpenses(prev => [{
      id: generateId(),
      description: desc,
      amount: Number(amount),
      unitPrice: unitPrice === '' ? undefined : Number(unitPrice),
      quantity: quantity === '' ? undefined : Number(quantity),
      sharedBy,
      isSponsored,
      date: date || new Date().toISOString()
    }, ...prev]);

    setDesc('');
    setAmount('');
    setUnitPrice('');
    setQuantity('');
    setIsSponsored(false);
  };

  const deleteExpense = (id: string) => {
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }
    if (window.confirm('Xóa khoản dự kiến này?')) {
      setEstimatedExpenses(prev => prev.filter(e => e.id !== id));
    }
  };

  const startEdit = (e: EstimatedExpense) => {
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }
    setEditingId(e.id);
    setEditAmount(e.amount);
    setEditUnitPrice(e.unitPrice !== undefined ? e.unitPrice : '');
    setEditQuantity(e.quantity !== undefined ? e.quantity : '');
    setEditDesc(e.description);
    setEditDate(e.date ? e.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditSharedBy(e.sharedBy || []);
    setEditParticipantSearch('');
    setEditIsSponsored(e.isSponsored || false);
  };

  const saveEdit = () => {
    if (editingId && editAmount !== '' && editSharedBy.length > 0) {
      if (editUnitPrice !== '' && editQuantity !== '') {
        if (Math.abs(Number(editUnitPrice) * Number(editQuantity) - Number(editAmount)) > 1) {
          alert("Tổng số tiền không khớp với đơn giá x số lượng. Vui lòng kiểm tra lại!");
          return;
        }
      }
      setEstimatedExpenses(prev => prev.map(e => e.id === editingId ? { 
         ...e, 
         amount: Number(editAmount), 
         unitPrice: editUnitPrice === '' ? undefined : Number(editUnitPrice),
         quantity: editQuantity === '' ? undefined : Number(editQuantity),
         description: editDesc, 
         date: editDate || e.date,
         sharedBy: editSharedBy,
         isSponsored: editIsSponsored
      } : e));
    }
    setEditingId(null);
  };

  const totalExpense = estimatedExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalSponsored = estimatedExpenses.filter(e => e.isSponsored).reduce((sum, e) => sum + e.amount, 0);

  const memberEstimates = participants.map(p => {
    const totalForP = estimatedExpenses.reduce((sum, exp) => {
      if (!exp.isSponsored && exp.sharedBy.includes(p.id)) {
        return sum + (exp.amount / exp.sharedBy.length);
      }
      return sum;
    }, 0);
    return { ...p, totalEstimated: totalForP };
  });

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'Ngày',
      'Nội dung',
      'Đối tượng áp dụng',
      'Đơn giá',
      'Số lượng',
      'Tổng tiền dự kiến (VNĐ)',
      'Mức / Người (VNĐ)'
    ];
    
    const data = estimatedExpenses.map(expense => {
      const time = expense.date ? new Date(expense.date).toLocaleDateString('vi-VN') : '';
      const sharedByNames = expense.sharedBy.length === participants.length ? 'Cả đoàn' : expense.sharedBy.map(id => participants.find(p => p.id === id)?.name).filter(Boolean).join(', ');
      
      return [
        time,
        expense.description + (expense.isSponsored ? ' (Tài trợ)' : ''),
        expense.isSponsored ? '-' : sharedByNames,
        expense.unitPrice || '',
        expense.quantity || '',
        expense.amount,
        (expense.sharedBy.length > 0 && !expense.isSponsored) ? (expense.amount / expense.sharedBy.length) : 0
      ];
    });
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, "DuKienChi");
    XLSX.writeFile(wb, "DuKienChi.xlsx");
  };

  const filteredEstimatedExpenses = estimatedExpenses.filter(inc => {
    if (searchQuery.trim() === '') return true;
    const search = searchQuery.toLowerCase();
    const pNames = inc.sharedBy.map(id => participants.find(p => p.id === id)?.name || '').join(' ').toLowerCase();
    return (inc.description || '').toLowerCase().includes(search) || pNames.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-500" />
            Thêm khoản dự kiến chi
          </h2>
          {isLocked && <Lock className="w-4 h-4 text-slate-400" />}
        </div>
        
        <form onSubmit={addExpense} className="space-y-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Ngày chi</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nội dung dự kiến chi</label>
              <input 
                type="text" 
                value={desc} 
                onChange={e => setDesc(e.target.value)}
                placeholder="VD: Thuê xe di chuyển, mua vé tham quan..." 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1 flex items-center justify-between">
                <span>Chia cho ai (Áp dụng cho khoản chi)</span>
                {sharedBy.length > 0 && <span className="text-indigo-600 font-bold">{sharedBy.length} người</span>}
              </label>
              <div className="flex gap-2 mb-2">
                <button 
                  type="button" 
                  onClick={() => setSharedBy(participants.map(p => p.id))}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex-1 shadow-sm"
                >
                  Cả đoàn
                </button>
                {trip.subGroups?.map(g => (
                  <button 
                    key={g.id}
                    type="button" 
                    onClick={() => setSharedBy(g.members)}
                    className="text-[10px] bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 px-3 py-1.5 rounded-lg transition-colors font-medium flex-1 shadow-sm"
                  >
                    Nhóm {g.name}
                  </button>
                ))}
                <button 
                  type="button" 
                  onClick={() => setSharedBy([])}
                  className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors font-medium shadow-sm"
                >
                  Bỏ chọn
                </button>
              </div>
              <input 
                type="text"
                placeholder="Tìm tên thành viên..."
                value={participantSearch}
                onChange={e => setParticipantSearch(e.target.value)}
                className="w-full mb-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto pr-1">
                {participants.filter(p => p.name.toLowerCase().includes(participantSearch.toLowerCase())).map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => toggleShare(p.id)}
                    className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-100 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    {sharedBy.includes(p.id) ? 
                      <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" /> : 
                      <Square className="w-5 h-5 text-slate-300 shrink-0" />
                    }
                    <span className="text-sm text-slate-700 truncate font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
               <div className="grid grid-cols-2 gap-3 mb-3">
                 <div>
                   <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Đơn giá</label>
                   <CurrencyInput
                      value={unitPrice}
                      onChange={handleUnitPriceChange}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-right"
                      placeholder="0"
                    />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Số lượng</label>
                   <input
                      type="number"
                      value={quantity}
                      onChange={e => handleQuantityChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-right"
                      placeholder="0"
                      min="0" step="any"
                    />
                 </div>
               </div>
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Số tiền chi (Tổng)</label>
               <div className="flex gap-3">
                 <CurrencyInput
                    value={amount}
                    onChange={val => setAmount(val)}
                    className="flex-1 px-4 py-3 bg-white border-2 border-indigo-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-xl font-bold text-slate-800 transition-all text-right shadow-inner"
                    placeholder="0"
                  />
                  <div className="w-16 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-500">
                    VNĐ
                  </div>
               </div>
               
               {amount !== '' && Number(amount) > 0 && sharedBy.length > 0 && !isSponsored && (
                 <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                   <div className="flex items-center gap-2 text-emerald-800 text-xs">
                     <Calculator className="w-4 h-4" />
                     <span className="font-medium">Ước tính / người</span>
                   </div>
                   <div className="text-sm font-bold text-emerald-700">
                     {formatCurrency(Number(amount) / sharedBy.length)} / người
                   </div>
                 </div>
               )}
            </div>
          </div>

          <div className="flex items-center gap-2 py-2 px-1">
             <input 
               type="checkbox" 
               id="isSponsored" 
               checked={isSponsored} 
               onChange={e => setIsSponsored(e.target.checked)}
               className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
             />
             <label htmlFor="isSponsored" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
               Đây là khoản tài trợ (Không chia cho các thành viên)
             </label>
          </div>
          
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isLocked}
              className={`w-full ${isLocked ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'} text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2`}
            >
              <Plus className="w-5 h-5" /> THÊM KHOẢN DỰ KIẾN CHI
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danh sách dự kiến chi</h2>
            <button 
              onClick={exportExcel}
              className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-800 font-bold px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors"
            >
              <Download className="w-3 h-3" /> Xuất Excel
            </button>
          </div>
          <div className="flex items-center">
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm nội dung, tên người..."
              className="px-2 py-1 min-w-[200px] w-full bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Tổng dự kiến chi:</span>
              <div className="text-right">
                <div className="text-2xl font-black text-indigo-600">{formatCurrency(totalExpense)}</div>
                {totalSponsored > 0 && <div className="text-xs font-semibold text-emerald-600 mt-1">(Khoản tài trợ: {formatCurrency(totalSponsored)})</div>}
              </div>
            </div>
            {totalExpense > 0 && (
              <div className="pt-2 border-t border-slate-200 transition-all">
                <button 
                  onClick={() => setShowMemberEstimates(!showMemberEstimates)}
                  className="w-full text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1 py-1"
                >
                  <Users className="w-4 h-4" /> 
                  {showMemberEstimates ? 'Ẩn chi tiết mỗi thành viên' : 'Hiển thị dự kiến chi cho mỗi thành viên'}
                </button>
              </div>
            )}
            
            {showMemberEstimates && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                {memberEstimates.map(me => (
                   <div key={me.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                     <span className="text-xs font-medium text-slate-500 truncate">{me.name}</span>
                     <span className="text-base font-bold text-indigo-600 mt-1">{formatCurrency(me.totalEstimated)}</span>
                   </div>
                ))}
              </div>
            )}
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-xs font-bold text-slate-400 uppercase">
                <th className="py-3 px-4">Ngày</th>
                <th className="py-3 px-4 w-48 max-w-sm">Nội dung</th>
                <th className="py-3 px-4">Đối tượng áp dụng</th>
                <th className="py-3 px-4 text-right">Tổng Cần Thu</th>
                <th className="py-3 px-4 text-right">Mức / Người</th>
                <th className="py-3 px-4 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {filteredEstimatedExpenses.map(expense => {
                const sharedByNames = expense.sharedBy.length === participants.length ? 'Cả đoàn' : expense.sharedBy.map(id => participants.find(p => p.id === id)?.name).filter(Boolean).join(', ');
                
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
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500" 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input 
                          type="text" 
                          value={editDesc} 
                          onChange={e => setEditDesc(e.target.value)}
                          className="w-full px-2 py-1 mb-2 bg-white border border-slate-300 rounded text-sm outline-none focus:border-indigo-500" 
                        />
                        <div className="flex items-center gap-2">
                           <input 
                             type="checkbox" 
                             id={`editIsSponsored-${expense.id}`} 
                             checked={editIsSponsored} 
                             onChange={e => setEditIsSponsored(e.target.checked)}
                             className="w-3 h-3 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                           />
                           <label htmlFor={`editIsSponsored-${expense.id}`} className="text-[10px] font-medium text-slate-700 cursor-pointer select-none">
                             Là khoản tài trợ
                           </label>
                        </div>
                      </td>
                      <td className="py-2 px-4 max-w-[200px]">
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
                              <input 
                                type="text"
                                placeholder="Tìm tên..."
                                value={editParticipantSearch}
                                onChange={e => setEditParticipantSearch(e.target.value)}
                                className="col-span-2 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                              {participants.filter(p => p.name.toLowerCase().includes(editParticipantSearch.toLowerCase())).map(p => (
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
                      </td>
                      <td className="py-2 px-4 text-right">
                         <div className="flex flex-col gap-1 w-24 ml-auto">
                           <CurrencyInput
                             value={editUnitPrice} 
                             onChange={handleEditUnitPriceChange}
                             placeholder="Đơn giá"
                             className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-right outline-none focus:border-indigo-500" 
                           />
                           <input
                             type="number"
                             value={editQuantity}
                             onChange={e => handleEditQuantityChange(e.target.value)}
                             placeholder="SL"
                             className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-right outline-none focus:border-indigo-500" 
                             min="0" step="any"
                           />
                           <CurrencyInput
                             value={editAmount} 
                             onChange={val => setEditAmount(val)}
                             placeholder="Tổng"
                             className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-sm text-right outline-none focus:border-indigo-500 font-bold text-slate-800 mt-1 shadow-sm" 
                           />
                         </div>
                      </td>
                      <td className="py-2 px-4 text-right">
                         <span className="text-xs font-medium text-slate-500">
                           {editSharedBy.length > 0 && editAmount !== '' ? formatCurrency(Number(editAmount) / editSharedBy.length) : '-'}
                         </span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={saveEdit} className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">Lưu</button>
                          <button onClick={() => setEditingId(null)} className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300">Hủy</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 text-slate-500 font-medium whitespace-nowrap">
                       {expense.date ? new Date(expense.date).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    <td className="py-4 px-4 max-w-sm">
                      <div className="font-bold text-slate-800 mb-1">
                        {expense.description}
                        {expense.isSponsored && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase inline-block">Tài trợ</span>}
                      </div>
                      {expense.isSponsored ? null : groupTypeLabel}
                    </td>
                    <td className="py-4 px-4">
                       <div className="font-medium text-slate-700">{expense.isSponsored ? '-' : `${expense.sharedBy.length} Người`}</div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-black text-rose-600">
                        {formatCurrency(expense.amount)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                        {expense.isSponsored ? '-' : (expense.sharedBy.length > 0 ? formatCurrency(expense.amount / expense.sharedBy.length) : 0)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center w-24">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => startEdit(expense)}
                          className="text-slate-400 hover:text-indigo-500 transition-colors p-1 flex items-center"
                          title="Sửa"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button 
                          onClick={() => deleteExpense(expense.id)}
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
              {estimatedExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    Chưa có khoản dự kiến chi nào
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
