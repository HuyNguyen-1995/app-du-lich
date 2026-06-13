import React, { useState, useMemo } from 'react';
import { Trip, ScheduleItem } from '../types';
import { formatCurrency, generateId, removeVietnameseTones } from '../lib/utils';
import { Plus, Trash2, Edit2, Check, X, Calendar, Clock, MapPin, AlignLeft, Search, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';

type Props = {
  trip: Trip;
  schedules: ScheduleItem[];
  setSchedules: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;
  isLocked?: boolean;
  requestUnlock?: () => void;
};

export function PlanTab({ trip, schedules, setSchedules, isLocked, requestUnlock }: Props) {
  // Add item form states
  const [date, setDate] = useState(trip.startDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:30');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('all');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNote, setEditNote] = useState('');

  // Format date helper
  const formatDateVi = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = days[d.getDay()];
      return `${dayName}, ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return dateStr;
    }
  };

  // Pre-sorted schedules list
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = a.startTime.localeCompare(b.startTime);
      if (timeCompare !== 0) return timeCompare;
      return a.endTime.localeCompare(b.endTime);
    });
  }, [schedules]);

  // Unique dates of the schedules for quick filtering
  const scheduleDates = useMemo(() => {
    const dates = new Set<string>();
    schedules.forEach(s => {
      if (s.date) dates.add(s.date);
    });
    return Array.from(dates).sort();
  }, [schedules]);

  // Filter schedules bases on Search and Selected filter Date
  const filteredSchedules = useMemo(() => {
    return sortedSchedules.filter(sch => {
      let matchDate = true;
      if (filterDate !== 'all') {
        matchDate = sch.date === filterDate;
      }

      let matchSearch = true;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const searchLocation = (sch.location || '').toLowerCase();
        const searchNote = (sch.note || '').toLowerCase();
        const searchDateStr = formatDateVi(sch.date).toLowerCase();
        matchSearch = searchLocation.includes(query) || searchNote.includes(query) || searchDateStr.includes(query);
      }

      return matchDate && matchSearch;
    });
  }, [sortedSchedules, filterDate, searchQuery]);

  // Add a schedule item
  const addSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }

    if (!location.trim()) return;

    const newItem: ScheduleItem = {
      id: generateId(),
      date,
      startTime,
      endTime,
      location: location.trim(),
      note: note.trim()
    };

    setSchedules([...schedules, newItem]);

    // Reset fields except date to make adding easier
    setLocation('');
    setNote('');
  };

  // Edit item helpers
  const startEditing = (sch: ScheduleItem) => {
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }
    setEditingId(sch.id);
    setEditDate(sch.date);
    setEditStartTime(sch.startTime);
    setEditEndTime(sch.endTime);
    setEditLocation(sch.location);
    setEditNote(sch.note || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }

    if (!editLocation.trim()) return;

    setSchedules(schedules.map(sch => {
      if (sch.id === editingId) {
        return {
          ...sch,
          date: editDate,
          startTime: editStartTime,
          endTime: editEndTime,
          location: editLocation.trim(),
          note: editNote.trim()
        };
      }
      return sch;
    }));

    setEditingId(null);
  };

  const deleteSchedule = (id: string) => {
    if (isLocked) {
      if (requestUnlock) requestUnlock();
      return;
    }
    if (window.confirm('Bạn có chắc chắn muốn xóa lịch trình này?')) {
      setSchedules(schedules.filter(s => s.id !== id));
    }
  };

  // Export excel helper
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Ngày', 'Từ giờ', 'Đến giờ', 'Địa điểm tham quan', 'Ghi chú chi tiết'];
    const data = sortedSchedules.map(sch => [
      formatDateVi(sch.date),
      sch.startTime,
      sch.endTime,
      sch.location,
      sch.note || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, "KeHoachLichTrinh");
    XLSX.writeFile(wb, "KeHoach_ChuyenDi.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* 1. Planning Form */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            Thêm kế hoạch mới
          </h2>
          {trip.startDate && trip.endDate && (
            <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full">
              Khung chuyến đi: {new Date(trip.startDate).toLocaleDateString('vi-VN')} - {new Date(trip.endDate).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        <form onSubmit={addSchedule} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Ngày thực hiện
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={trip.startDate}
                max={trip.endDate}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors font-medium text-slate-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Giờ bắt đầu
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors text-slate-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Giờ kết thúc
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors text-slate-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Địa điểm tham quan
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="VD: Dinh Độc Lập"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors text-slate-700 font-medium"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <AlignLeft className="w-3.5 h-3.5" /> Ghi chú lịch trình
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-colors text-slate-700"
                placeholder="Ghi chú chi tiết, lưu ý chuẩn bị trang phục..."
              />
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-colors h-[38px] shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Thêm mới
            </button>
          </div>
        </form>
      </div>

      {/* 2. List Planning & Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              Lịch trình chi tiết
            </h2>
            <button
              onClick={exportExcel}
              disabled={schedules.length === 0}
              className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-800 disabled:opacity-50 font-semibold px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors"
            >
              Xuất Excel
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm địa điểm, ghi chú..."
                className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48 transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">Ngày:</span>
              <select
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Tất cả ngày</option>
                {scheduleDates.map(d => (
                  <option key={d} value={d}>
                    {formatDateVi(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredSchedules.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            {schedules.length === 0 ? (
              <p>Chưa có lịch trình nào được ghi nhận. Hãy thêm từ form trên!</p>
            ) : (
              <p>Không tìm thấy kế hoạch lịch trình phù hợp với bộ lọc.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr className="text-xs font-bold text-slate-400 uppercase">
                  <th className="py-3 px-4 w-1/4">Ngày thực hiện</th>
                  <th className="py-3 px-4 w-1/5">Khung giờ</th>
                  <th className="py-3 px-4 w-1/4">Địa điểm</th>
                  <th className="py-3 px-4 w-1/4">Ghi chú</th>
                  <th className="py-3 px-4 text-right w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredSchedules.map(sch => {
                  const isEditing = editingId === sch.id;

                  if (isEditing) {
                    return (
                      <tr key={sch.id} className="bg-indigo-50/50">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <input
                            type="date"
                            value={editDate}
                            onChange={e => setEditDate(e.target.value)}
                            min={trip.startDate}
                            max={trip.endDate}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500 text-slate-700"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={editStartTime}
                              onChange={e => setEditStartTime(e.target.value)}
                              className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500 text-slate-700"
                            />
                            <span className="text-xs text-slate-400">-</span>
                            <input
                              type="time"
                              value={editEndTime}
                              onChange={e => setEditEndTime(e.target.value)}
                              className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500 text-slate-700"
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editLocation}
                            onChange={e => setEditLocation(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500 font-bold text-slate-700"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editNote}
                            onChange={e => setEditNote(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-indigo-500 text-slate-700"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={saveEdit}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Lưu"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                              title="Hủy"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={sch.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        {formatDateVi(sch.date)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          {sch.startTime} - {sch.endTime}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-900 font-bold">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                          {sch.location}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 italic">
                        {sch.note || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEditing(sch)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteSchedule(sch.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
