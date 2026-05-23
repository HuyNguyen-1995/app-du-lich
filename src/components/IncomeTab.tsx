import React, { useState, useRef } from 'react';
import { Participant, Income, IncomeType, Trip } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { Plus, Trash2, Wallet, UploadCloud, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CurrencyInput } from './ui/CurrencyInput';

type Props = {
  participants: Participant[];
  incomes: Income[];
  setIncomes: React.Dispatch<React.SetStateAction<Income[]>>;
  isLocked?: boolean;
  requestUnlock?: () => void;
  trip: Trip;
};

export function IncomeTab({ participants, incomes, setIncomes, isLocked, requestUnlock, trip }: Props) {
  const [incomeType, setIncomeType] = useState<IncomeType>('member');
  const [participantId, setParticipantId] = useState('');
  const [targetFund, setTargetFund] = useState('general');
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterParticipantId, setFilterParticipantId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIncomeType, setEditIncomeType] = useState<IncomeType>('member');
  const [editParticipantId, setEditParticipantId] = useState('');
  const [editTargetFund, setEditTargetFund] = useState('general');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');

  const addIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    if (incomeType === 'member' && !participantId) return;
    
    setIncomes([{
      id: generateId(),
      participantId: incomeType === 'member' ? participantId : '',
      type: incomeType,
      targetFund,
      amount: Number(amount),
      note,
      date: date || new Date().toISOString()
    }, ...incomes]);
    
    setAmount('');
    setNote('');
  };

  const saveEdit = () => {
    if (editingId && editAmount !== '') {
      if (editIncomeType === 'member' && !editParticipantId) {
         alert("Vui lòng chọn người đóng");
         return;
      }
      setIncomes(incomes.map(inc => inc.id === editingId ? { 
         ...inc, 
         type: editIncomeType,
         participantId: editIncomeType === 'member' ? editParticipantId : '',
         targetFund: editTargetFund,
         amount: Number(editAmount), 
         note: editNote,
         date: editDate || new Date().toISOString()
      } : inc));
    }
    setEditingId(null);
  };

  const startEdit = (inc: Income) => {
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }
    setEditingId(inc.id);
    setEditIncomeType(inc.type || 'member');
    setEditParticipantId(inc.participantId);
    setEditTargetFund(inc.targetFund || 'general');
    setEditAmount(inc.amount);
    setEditNote(inc.note);
    setEditDate(inc.date ? inc.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  };

  const removeIncome = (id: string) => {
    setIncomes(incomes.filter(i => i.id !== id));
  };

  const removeIncomeWrapper = (id: string) => {
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }
    removeIncome(id);
  };

  const totalGeneralIncome = incomes.filter(i => !i.targetFund || i.targetFund === 'general').reduce((sum, item) => sum + item.amount, 0);
  
  const groupIncomes = (trip.subGroups || []).map(group => ({
     id: group.id,
     name: group.name,
     total: incomes.filter(i => i.targetFund === group.id).reduce((sum, item) => sum + item.amount, 0)
  })).filter(g => g.total > 0);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
        
        const newIncomes: Income[] = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[0]) continue;
          
          const name = String(row[0]).trim();
          if (name.toLowerCase() === 'tên' || name.toLowerCase() === 'người đóng') continue;
          
          let fundName = row[1] ? String(row[1]).trim() : '';
          let amountValue = Number(row[2]);
          let noteText = row[3] ? String(row[3]) : 'Thu qua Excel';

          // Backward compatibility if user uses old format (Tên, Số tiền, Ghi chú)
          if (isNaN(amountValue)) {
            amountValue = Number(row[1]);
            if (!isNaN(amountValue)) {
              fundName = '';
              noteText = row[2] ? String(row[2]) : 'Thu qua Excel';
            }
          }

          if (isNaN(amountValue) || amountValue <= 0) continue;
          
          let groupObj = (trip.subGroups || []).find(g => g.name.toLowerCase() === fundName.toLowerCase());
          let targetFund = groupObj ? groupObj.id : 'general';

          // Find participant
          const p = participants.find(part => part.name.toLowerCase() === name.toLowerCase());
          if (p) {
            newIncomes.push({
              id: generateId() + i,
              participantId: p.id,
              type: 'member',
              targetFund,
              amount: amountValue,
              note: noteText,
              date: new Date().toISOString()
            });
          }
        }
        
        if (newIncomes.length > 0) {
          setIncomes(prev => [...newIncomes, ...prev]);
          alert(`Đã ghi nhận ${newIncomes.length} khoản thu từ Excel!`);
        } else {
          alert('Không tìm thấy dữ liệu hợp lệ hoặc tên không khớp với danh sách thành viên đoàn.');
        }
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra khi đọc file Excel.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const filteredIncomes = incomes.filter(inc => {
    let matchParticipant = true;
    if (filterParticipantId !== 'all') {
      matchParticipant = inc.participantId === filterParticipantId || inc.targetFund === filterParticipantId;
    }
    
    let matchSearch = true;
    if (searchQuery.trim() !== '') {
      const search = searchQuery.toLowerCase();
      const pName = participants.find(p => p.id === inc.participantId)?.name || '';
      const note = inc.note || '';
      matchSearch = pName.toLowerCase().includes(search) || note.toLowerCase().includes(search);
    }

    return matchParticipant && matchSearch;
  });

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'Ngày',
      'Người đóng / Loại khoản',
      'Quỹ nhận',
      'Ghi chú',
      'Số tiền (VNĐ)'
    ];
    
    const data = filteredIncomes.map(inc => {
      const isMember = (!inc.type || inc.type === 'member');
      const p = isMember ? participants.find(x => x.id === inc.participantId) : null;
      const g = (trip.subGroups || []).find(x => x.id === inc.targetFund);
      const isGeneral = !inc.targetFund || inc.targetFund === 'general';
      
      const time = inc.date ? new Date(inc.date).toLocaleDateString('vi-VN') : '';
      const payer = isMember ? (p?.name || 'Không xác định') : (inc.type === 'advance' ? 'Kế toán/Tạm ứng' : 'Nhà tài trợ');
      const fund = isGeneral ? 'Quỹ cả đoàn' : (`Quỹ ${g?.name || 'nhóm'}`);
      
      return [
        time,
        payer,
        fund,
        inc.note,
        inc.amount
      ];
    });
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, "NhatKyThu");
    XLSX.writeFile(wb, "NhatKyThuTien.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-sm">
          <p className="text-xs font-medium opacity-80 uppercase tracking-wider mb-1">Quỹ Cả Đoàn</p>
          <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(totalGeneralIncome)}</p>
        </div>
        {groupIncomes.map(g => (
          <div key={g.id} className="bg-sky-600 p-6 rounded-2xl text-white shadow-sm">
            <p className="text-xs font-medium opacity-80 uppercase tracking-wider mb-1">Quỹ {g.name}</p>
            <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(g.total)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thêm khoản tiền vào quỹ</h2>
          <div className="relative group">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImportExcel}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <UploadCloud className="w-4 h-4" /> Thu hàng loạt (Excel)
            </button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none">
              <p className="font-bold mb-1">Cấu trúc file Excel mẫu:</p>
              <ul className="list-disc pl-4 space-y-1 opacity-90">
                <li>Cột 1: Tên thành viên (VD: Huy)</li>
                <li>Cột 2: Quỹ đóng cho (Để trống = Cả đoàn, Hoặc tên Nhóm VD: Nhóm 1)</li>
                <li>Cột 3: Số tiền (VD: 150000)</li>
                <li>Cột 4: Ghi chú (VD: Tiền quỹ ngày 1)</li>
              </ul>
              <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>
        </div>

        <form onSubmit={addIncome} className="flex flex-col gap-3 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Loại người đóng</label>
              <select 
                value={incomeType}
                onChange={e => {
                  setIncomeType(e.target.value as IncomeType);
                  setParticipantId('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
              >
                <option value="member">Thành viên nộp</option>
                <option value="advance">Kế toán / Tạm ứng ngoài</option>
                <option value="sponsor">Nhà tài trợ</option>
              </select>
            </div>
            
            {incomeType === 'member' && (
               <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Người đóng</label>
                  <select 
                    value={participantId}
                    onChange={e => setParticipantId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                    required
                  >
                    <option value="">-- Chọn thành viên --</option>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
               </div>
            )}

            <div className={incomeType === 'member' ? "" : "md:col-span-2"}>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Đóng vào quỹ</label>
              <select 
                value={targetFund}
                onChange={e => setTargetFund(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors text-indigo-700 font-medium"
              >
                <option value="general">Quỹ chung cả đoàn</option>
                {(trip.subGroups || []).map(g => (
                  <option key={g.id} value={g.id}>Quỹ {g.name}</option>
                ))}
              </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Số tiền (VNĐ)</label>
               <CurrencyInput
                 value={amount} 
                 onChange={val => setAmount(val)}
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                 placeholder="VD: 500,000"
                 required
               />
            </div>
            
            <div>
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Ngày thu</label>
               <input 
                 type="date" 
                 value={date} 
                 onChange={e => setDate(e.target.value)}
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                 required
               />
            </div>
          </div>
          
          <div className="flex gap-3 items-end">
            <div className="flex-1">
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Ghi chú</label>
               <input 
                 type="text" 
                 value={note} 
                 onChange={e => setNote(e.target.value)}
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors"
                 placeholder="Ghi chú..."
               />
            </div>
            
            <button type="submit" disabled={incomeType === 'member' && !participantId} className="w-32 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors h-[38px]">
              <Plus className="w-4 h-4" /> Ghi nhận
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lịch sử thu tiền</h2>
            <button 
              onClick={exportExcel}
              className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-800 font-bold px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors"
            >
              <Download className="w-3 h-3" /> Xuất Excel
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="px-2 py-1 flex-1 min-w-[120px] max-w-[200px] bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase">Lọc theo:</span>
              <select 
                value={filterParticipantId}
                onChange={e => setFilterParticipantId(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Tất cả</option>
                <optgroup label="Thành viên">
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Nhóm riêng">
                  {(trip.subGroups || []).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>
        
        {filterParticipantId !== 'all' && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-between items-center">
            <span className="text-xs font-bold text-indigo-700 uppercase">
              {participants.find(p => p.id === filterParticipantId)?.name || (trip.subGroups || []).find(g => g.id === filterParticipantId)?.name}: {incomes.filter(i => (i.participantId === filterParticipantId || i.targetFund === filterParticipantId)).length} khoản
            </span>
            <span className="text-sm font-black text-indigo-800">
              Tổng: {formatCurrency(incomes.filter(i => (i.participantId === filterParticipantId || i.targetFund === filterParticipantId)).reduce((s, i) => s + i.amount, 0))}
            </span>
          </div>
        )}

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-xs font-bold text-slate-400 uppercase">
                <th className="py-3 px-4">Người đóng / Loại khoản</th>
                <th className="py-3 px-4">Đóng vào Quỹ</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 px-4 text-right">Số tiền</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {filteredIncomes.map(income => {
                const isMember = (!income.type || income.type === 'member');
                const p = isMember ? participants.find(x => x.id === income.participantId) : null;
                const g = (trip.subGroups || []).find(x => x.id === income.targetFund);
                const isGeneral = !income.targetFund || income.targetFund === 'general';
                
                if (editingId === income.id) {
                  return (
                    <tr key={income.id} className="bg-indigo-50/50">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <select 
                          value={editIncomeType}
                          onChange={e => setEditIncomeType(e.target.value as IncomeType)}
                          className="w-full px-2 py-1 mb-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500"
                        >
                          <option value="member">Thành viên nộp</option>
                          <option value="advance">Kế toán / Tạm ứng</option>
                          <option value="sponsor">Nhà tài trợ</option>
                        </select>
                        {editIncomeType === 'member' && (
                          <select 
                            value={editParticipantId}
                            onChange={e => setEditParticipantId(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Chọn --</option>
                            {participants.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <select 
                          value={editTargetFund}
                          onChange={e => setEditTargetFund(e.target.value)}
                          className="w-full px-2 py-1 mb-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500 text-indigo-700 font-bold"
                        >
                          <option value="general">Quỹ chung</option>
                          {(trip.subGroups || []).map(g => (
                            <option key={g.id} value={g.id}>Quỹ {g.name}</option>
                          ))}
                        </select>
                        <input 
                          type="date" 
                          value={editDate} 
                          onChange={e => setEditDate(e.target.value)}
                          className="w-full mt-2 px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500" 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input 
                          type="text" 
                          value={editNote} 
                          onChange={e => setEditNote(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-sm outline-none focus:border-indigo-500" 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <CurrencyInput
                          value={editAmount} 
                          onChange={val => setEditAmount(val)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-sm text-right outline-none focus:border-indigo-500" 
                        />
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 text-slate-500 hover:bg-slate-200 rounded font-bold transition-colors">Hủy</button>
                           <button onClick={saveEdit} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 transition-colors">Lưu</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={income.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {isMember ? (p?.name || 'Không xác định') : 
                       (income.type === 'advance' ? 'Kế toán/Tạm ứng' : 'Nhà tài trợ')}
                      <div className="mt-1 text-xs text-slate-500 font-normal">
                         Ngày: {income.date ? new Date(income.date).toLocaleDateString('vi-VN') : '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {isGeneral ? (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase font-bold border border-slate-200">Quỹ cả đoàn</span>
                      ) : (
                        <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded uppercase font-bold border border-sky-200">Quỹ {g?.name || 'nhóm'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate">{income.note || '-'}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(income.amount)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => startEdit(income)}
                          className="text-slate-400 hover:text-indigo-500 transition-colors p-1 inline-flex"
                          title="Sửa"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button 
                          onClick={() => removeIncomeWrapper(income.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1 inline-flex"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {incomes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm italic border-t border-slate-50">
                    Chưa có khoản thu nào.
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
