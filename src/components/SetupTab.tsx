import React, { useState, useRef } from 'react';
import { Trip, Participant, SubGroup } from '../types';
import { generateId } from '../lib/utils';
import { Plus, Trash2, Users, UploadCloud, CheckSquare, Square } from 'lucide-react';
import * as XLSX from 'xlsx';

type Props = {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  isLocked?: boolean;
  requestUnlock?: () => void;
  onDeleteTrip?: (e: React.MouseEvent) => void;
};

export function SetupTab({ trip, setTrip, participants, setParticipants, isLocked, requestUnlock, onDeleteTrip }: Props) {
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantGender, setNewParticipantGender] = useState<'nam' | 'nữ'>('nam');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'nam' | 'nữ'>('all');
  const [message, setMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const maleCount = participants.filter(p => p.gender === 'nam').length;
  const femaleCount = participants.filter(p => p.gender === 'nữ').length;

  const addParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    if (!newParticipantName.trim()) return;

    // Check duplicate
    const isDuplicate = participants.some(p => 
      p.name.toLowerCase() === newParticipantName.trim().toLowerCase()
    );

    if (isDuplicate) {
      setMessage({ type: 'error', text: 'Đã có thành viên này!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setParticipants([...participants, {
      id: generateId(),
      name: newParticipantName.trim(),
      gender: newParticipantGender
    }]);
    setNewParticipantName('');
  };

  const removeParticipant = (id: string) => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    setParticipants(participants.filter(p => p.id !== id));
  };
  
  const addGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    if (!newGroupName.trim() || newGroupMembers.length === 0) return;
    
    const newGroup: SubGroup = {
      id: generateId(),
      name: newGroupName.trim(),
      members: newGroupMembers
    };
    
    setTrip({
      ...trip,
      subGroups: [...(trip.subGroups || []), newGroup]
    });
    
    setNewGroupName('');
    setNewGroupMembers([]);
  };
  
  const removeGroup = (id: string) => {
    setTrip({
      ...trip,
      subGroups: (trip.subGroups || []).filter(g => g.id !== id)
    });
  };
  
  const toggleGroupMember = (pId: string) => {
    if (newGroupMembers.includes(pId)) {
      setNewGroupMembers(newGroupMembers.filter(id => id !== pId));
    } else {
      setNewGroupMembers([...newGroupMembers, pId]);
    }
  };

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
        
        // Assume row 0 is header or just data. Let's just read col 0 as name, col 1 as gender (optional)
        const newParticipants: Participant[] = [];
        let duplicateCount = 0;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[0]) continue;
          
          const name = String(row[0]).trim();
          if (name.toLowerCase() === 'tên' || name.toLowerCase() === 'name') continue; // skip header
          
          let gender: 'nam' | 'nữ' = 'nam';
          if (row[1] && String(row[1]).toLowerCase().includes('nữ')) gender = 'nữ';
          
          if (name) {
            // Check if already in current list or freshly added list
            const isDuplicate = participants.some(p => p.name.toLowerCase() === name.toLowerCase()) ||
                              newParticipants.some(p => p.name.toLowerCase() === name.toLowerCase());
            
            if (isDuplicate) {
              duplicateCount++;
              continue;
            }

            newParticipants.push({
              id: generateId() + i, // prevent duplicate ids in fast loop
              name,
              gender
            });
          }
        }
        
        if (newParticipants.length > 0) {
          setParticipants(prev => [...prev, ...newParticipants]);
          setMessage({ type: 'success', text: `Đã thêm thành công ${newParticipants.length} thành viên!${duplicateCount > 0 ? ` (Bỏ qua ${duplicateCount} thành viên bị trùng)` : ''}` });
        } else if (duplicateCount > 0) {
          setMessage({ type: 'error', text: `Không có thành viên mới nào được thêm. Phát hiện ${duplicateCount} thành viên bị trùng.` });
        }
        setTimeout(() => setMessage(null), 4000);
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Có lỗi xảy ra khi đọc file Excel.' });
        setTimeout(() => setMessage(null), 3000);
      }
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin chuyến đi</h2>
           {onDeleteTrip && (
              <button 
                 onClick={(e) => {
                    if (isLocked) { if(requestUnlock) requestUnlock(); return; }
                    onDeleteTrip(e);
                 }}
                 className={`text-xs flex items-center gap-1 font-bold px-3 py-1.5 rounded-lg transition-colors ${isLocked ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-rose-600 bg-rose-50 hover:bg-rose-100'}`}
              >
                 <Trash2 className="w-4 h-4" /> Xóa chuyến đi
              </button>
           )}
        </div>
        
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Tên chuyến đi</label>
            <input 
              type="text" 
              value={trip.name} 
              onChange={e => {
                if (isLocked) { if (requestUnlock) requestUnlock(); return; }
                setTrip({...trip, name: e.target.value});
              }}
              disabled={isLocked}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
              placeholder="VD: Phú Quốc 3N2Đ"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Ngày đi</label>
            <input 
              type="date" 
              value={trip.startDate} 
              onChange={e => {
                if (isLocked) { if (requestUnlock) requestUnlock(); return; }
                setTrip({...trip, startDate: e.target.value});
              }}
              disabled={isLocked}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Ngày về</label>
            <input 
              type="date" 
              value={trip.endDate} 
              onChange={e => {
                if (isLocked) { if (requestUnlock) requestUnlock(); return; }
                setTrip({...trip, endDate: e.target.value});
              }}
              disabled={isLocked}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" />
              Thành viên đoàn ({participants.length})
            </h2>
            <div className="flex gap-3 text-[10px] sm:text-xs font-semibold uppercase tracking-tight">
              <span className="text-indigo-600">Nam: {maleCount}</span>
              <span className="text-rose-600">Nữ: {femaleCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              <UploadCloud className="w-4 h-4" /> Import Excel
            </button>
          </div>
        </div>
        
        <form onSubmit={addParticipant} className="flex gap-3 mb-6 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Tên thành viên</label>
            <input 
              type="text" 
              value={newParticipantName} 
              onChange={e => setNewParticipantName(e.target.value)}
              disabled={isLocked}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
              placeholder="Nhập tên..."
            />
          </div>
          <div className="w-24 sm:w-32">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Giới tính</label>
            <select 
              value={newParticipantGender} 
              onChange={e => setNewParticipantGender(e.target.value as 'nam' | 'nữ')}
              disabled={isLocked}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <option value="nam">Nam</option>
              <option value="nữ">Nữ</option>
            </select>
          </div>
          <button type="submit" disabled={isLocked || !newParticipantName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors h-[38px] disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm</span>
          </button>
        </form>

        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Tìm kiếm thành viên..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
            <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <div className="flex gap-1">
            {(['all', 'nam', 'nữ'] as const).map(g => (
              <button
                key={g}
                onClick={() => setFilterGender(g)}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all border ${filterGender === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {g === 'all' ? 'Tất cả' : g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {participants.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesGender = filterGender === 'all' || p.gender === filterGender;
            return matchesSearch && matchesGender;
          }).map(p => (
            <div key={p.id} className="flex flex-row items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${p.gender === 'nam' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-900">{p.name}</span>
              </div>
              <button 
                onClick={() => removeParticipant(p.id)}
                disabled={isLocked}
                className={`transition-colors p-1 ${isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500'}`}
                title="Xóa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {participants.length === 0 && (
            <div className="col-span-full text-center text-slate-400 text-sm py-4 italic">
              Chưa có thành viên nào.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Users className="w-4 h-4" />
          Tạo nhóm đi chơi riêng ({(trip.subGroups || []).length})
        </h2>
        
        <form onSubmit={addGroup} className="space-y-4 mb-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Tên nhóm / Hoạt động</label>
              <input 
                type="text" 
                value={newGroupName} 
                onChange={e => setNewGroupName(e.target.value)}
                disabled={isLocked}
                className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="VD: Team đi bar..."
              />
            </div>
            <button type="submit" disabled={isLocked || !newGroupName.trim() || newGroupMembers.length === 0} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors h-[38px]">
              <Plus className="w-4 h-4" /> Tạo nhóm
            </button>
          </div>
          
          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Chọn thành viên</label>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => {
                  const isSelected = newGroupMembers.includes(p.id);
                  return (
                    <div 
                      key={p.id}
                      onClick={() => {
                        if (isLocked) { if (requestUnlock) requestUnlock(); return; }
                        toggleGroupMember(p.id);
                      }} 
                      className={`flex items-center gap-2 p-1.5 px-3 rounded-lg border select-none transition-all ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${isSelected ? 'bg-purple-50 border-purple-200 text-purple-800 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4 text-purple-600" /> : <Square className="w-4 h-4" />}
                      <span className="text-xs font-medium truncate">{p.name}</span>
                    </div>
                  );
                })}
                {participants.length === 0 && <span className="text-xs text-slate-400 italic">Vui lòng thêm thành viên trước</span>}
            </div>
          </div>
        </form>

        <div className="space-y-3">
          {(trip.subGroups || []).map(g => (
            <div key={g.id} className="flex flex-row items-start justify-between bg-purple-50/50 p-3 rounded-xl border border-purple-100">
              <div className="space-y-1">
                <span className="text-sm font-bold text-purple-900">{g.name}</span>
                <p className="text-xs text-purple-700">
                  {g.members.map(id => participants.find(p => p.id === id)?.name).filter(Boolean).join(', ')}
                </p>
              </div>
              <button 
                onClick={() => removeGroup(g.id)}
                disabled={isLocked}
                className={`transition-colors p-1 shrink-0 ${isLocked ? 'text-purple-200 cursor-not-allowed' : 'text-purple-400 hover:text-rose-500'}`}
                title="Xóa nhóm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
