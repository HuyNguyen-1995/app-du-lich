import React, { useState, useMemo, useRef } from 'react';
import { Trip, Participant, Hotel, Room, RoomType, FixedGroup } from '../types';
import { generateId } from '../lib/utils';
import { toPng } from 'html-to-image';
import { 
  Plus, Trash2, Bed, User, LayoutGrid, CheckCircle2, 
  Users, UserPlus, UserMinus, ShieldCheck, BookmarkPlus, 
  ChevronRight, Save, Download, Filter, Settings
} from 'lucide-react';

type Props = {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  participants: Participant[];
  isLocked?: boolean;
  requestUnlock?: () => void;
};

const ROOM_TYPES: { type: RoomType; capacity: number }[] = [
  { type: 'Phòng 2', capacity: 2 },
  { type: 'Phòng 3', capacity: 3 },
  { type: 'Phòng 4', capacity: 4 },
  { type: 'Phòng 6', capacity: 6 },
  { type: 'Phòng 8', capacity: 8 },
  { type: 'Phòng 10', capacity: 10 },
  { type: 'Phòng 12', capacity: 12 },
  { type: 'Phòng tài xế', capacity: 2 },
];

export function HotelTab({ trip, setTrip, participants, isLocked, requestUnlock }: Props) {
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [newHotelName, setNewHotelName] = useState('');
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(trip.hotels?.[0]?.id || null);
  const [showFixedGroups, setShowFixedGroups] = useState(false);
  const [filterGender, setFilterGender] = useState<'all' | 'nam' | 'nữ'>('all');
  const [fixedGroupPrompt, setFixedGroupPrompt] = useState<{ isOpen: boolean, memberIds: string[] }>({ isOpen: false, memberIds: [] });
  const [newFixedGroupName, setNewFixedGroupName] = useState('');
  const [overcapacityPrompt, setOvercapacityPrompt] = useState<{ isOpen: boolean, roomId: string, toAssign: string[] }>({ isOpen: false, roomId: '', toAssign: [] });

  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [participantSearchFilter, setParticipantSearchFilter] = useState('');
  
  const [managingFixedGroup, setManagingFixedGroup] = useState<FixedGroup | null>(null);
  const [managedGroupSort, setManagedGroupSort] = useState<'name' | 'gender' | 'default'>('default');
  const summaryRef = useRef<HTMLDivElement>(null);

  const hotels = trip.hotels || [];
  const fixedGroups = trip.fixedGroups || [];
  const currentHotel = hotels.find(h => h.id === selectedHotelId);

  const assignedMemberIds = useMemo(() => {
    if (!currentHotel) return new Set<string>();
    const ids = new Set<string>();
    currentHotel.rooms.forEach(room => {
      room.assignedMemberIds.forEach(id => ids.add(id));
    });
    return ids;
  }, [currentHotel]);

  const unassignedParticipants = participants.filter(p => !assignedMemberIds.has(p.id));
  const filteredUnassignedParticipants = unassignedParticipants.filter(p => filterGender === 'all' || p.gender === filterGender);

  const toggleSelect = (id: string) => {
    setSelectedPersonnel(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllUnassigned = () => {
    setSelectedPersonnel(filteredUnassignedParticipants.map(p => p.id));
  };

  const deselectAll = () => setSelectedPersonnel([]);

  const addHotel = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    if (!newHotelName.trim()) return;
    const hotelId = generateId();
    const newHotels = [...hotels, { id: hotelId, name: newHotelName.trim(), rooms: [] }];
    setTrip({ ...trip, hotels: newHotels });
    setNewHotelName('');
    if (!selectedHotelId) setSelectedHotelId(hotelId);
  };

  const removeHotel = (id: string) => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    const newHotels = hotels.filter(h => h.id !== id);
    setTrip({ ...trip, hotels: newHotels });
    if (selectedHotelId === id) setSelectedHotelId(newHotels[0]?.id || null);
  };

  const addRoom = (hotelId: string, typeInfo: typeof ROOM_TYPES[0]) => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    const updatedHotels = hotels.map(h => {
      if (h.id === hotelId) {
        const roomCount = h.rooms.filter(r => r.type === typeInfo.type).length + 1;
        return {
          ...h,
          rooms: [
            ...h.rooms,
            {
              id: generateId(),
              name: `${typeInfo.type} - ${roomCount}`,
              type: typeInfo.type,
              capacity: typeInfo.capacity,
              assignedMemberIds: []
            }
          ]
        };
      }
      return h;
    });
    setTrip({ ...trip, hotels: updatedHotels });
  };

  const removeRoom = (hotelId: string, roomId: string) => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    const updatedHotels = hotels.map(h => {
      if (h.id === hotelId) {
        return { ...h, rooms: h.rooms.filter(r => r.id !== roomId) };
      }
      return h;
    });
    setTrip({ ...trip, hotels: updatedHotels });
  };

  const assignToRoom = (roomId: string) => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    if (!currentHotel || selectedPersonnel.length === 0) return;

    const room = currentHotel.rooms.find(r => r.id === roomId);
    if (!room) return;

    let toAssign = selectedPersonnel;
    if (room.assignedMemberIds.length + toAssign.length > room.capacity) {
      setOvercapacityPrompt({ isOpen: true, roomId, toAssign });
      return;
    }

    executeAssign(roomId, toAssign);
  };

  const executeAssign = (roomId: string, toAssign: string[]) => {
    if (!currentHotel) return;
    const updatedHotels = hotels.map(h => {
      if (h.id === currentHotel.id) {
        const updatedRooms = h.rooms.map(r => {
          if (r.id === roomId) {
            return { ...r, assignedMemberIds: [...r.assignedMemberIds, ...toAssign] };
          }
          return r;
        });
        return { ...h, rooms: updatedRooms };
      }
      return h;
    });
    
    setTrip({ ...trip, hotels: updatedHotels });
    setSelectedPersonnel(prev => prev.filter(id => !toAssign.includes(id)));
    setOvercapacityPrompt({ isOpen: false, roomId: '', toAssign: [] });
  };

  const removeFromRoom = (roomId: string, memberId: string) => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    if (!currentHotel) return;
    const updatedHotels = hotels.map(h => {
      if (h.id === currentHotel.id) {
        const updatedRooms = h.rooms.map(r => {
          if (r.id === roomId) {
            return { ...r, assignedMemberIds: r.assignedMemberIds.filter(id => id !== memberId) };
          }
          return r;
        });
        return { ...h, rooms: updatedRooms };
      }
      return h;
    });
    setTrip({ ...trip, hotels: updatedHotels });
  };

  const saveAsFixedGroup = (memberIds: string[]) => {
    if (memberIds.length === 0) return;
    setFixedGroupPrompt({ isOpen: true, memberIds });
    setNewFixedGroupName('');
  };

  const confirmSaveFixedGroup = () => {
    if (!newFixedGroupName.trim()) return;
    const newGroup: FixedGroup = {
      id: generateId(),
      name: newFixedGroupName.trim(),
      memberIds: [...fixedGroupPrompt.memberIds]
    };
    setTrip({ ...trip, fixedGroups: [...fixedGroups, newGroup] });
    setFixedGroupPrompt({ isOpen: false, memberIds: [] });
  };

  const removeFixedGroup = (id: string) => {
    setTrip({ ...trip, fixedGroups: fixedGroups.filter(g => g.id !== id) });
  };

  const selectFixedGroup = (memberIds: string[]) => {
    // Only select members that are currently unassigned
    const validIds = memberIds.filter(id => assignedMemberIds.has(id) === false);
    setSelectedPersonnel(prev => {
      const combined = new Set([...prev, ...validIds]);
      return Array.from(combined);
    });
  };

  const filteredRooms = useMemo(() => {
    if (!currentHotel) return [];
    return currentHotel.rooms.filter(room => {
      if (roomTypeFilter !== 'all' && room.type !== roomTypeFilter) return false;
      if (participantSearchFilter.trim() !== '') {
        const search = participantSearchFilter.toLowerCase();
        const hasMatchingParticipant = room.assignedMemberIds.some(id => {
          const p = participants.find(part => part.id === id);
          return p && p.name.toLowerCase().includes(search);
        });
        if (!hasMatchingParticipant && !room.name.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [currentHotel, roomTypeFilter, participantSearchFilter, participants]);

  const saveManagedFixedGroup = () => {
    if (!managingFixedGroup) return;
    const updatedGroups = fixedGroups.map(g => g.id === managingFixedGroup.id ? managingFixedGroup : g);
    setTrip({ ...trip, fixedGroups: updatedGroups });
    setManagingFixedGroup(null);
  };

  const autoAssign = () => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    if (!currentHotel) return;
    
    let currentMale = unassignedParticipants.filter(p => p.gender === 'nam');
    let currentFemale = unassignedParticipants.filter(p => p.gender === 'nữ');
    
    const updatedHotels = hotels.map(h => {
      if (h.id === currentHotel.id) {
        const updatedRooms = h.rooms.map(room => {
          if (room.assignedMemberIds.length >= room.capacity) return room;
          
          const vacancy = room.capacity - room.assignedMemberIds.length;
          const currentIds = [...room.assignedMemberIds];
          
          const roomGender = room.assignedMemberIds.length > 0 ? 
            participants.find(p => p.id === room.assignedMemberIds[0])?.gender : 
            null;
            
          if (roomGender === 'nam' || (!roomGender && currentMale.length > currentFemale.length)) {
            const batch = currentMale.splice(0, vacancy);
            currentIds.push(...batch.map(p => p.id));
          } else {
            const batch = currentFemale.splice(0, vacancy);
            currentIds.push(...batch.map(p => p.id));
          }
          
          return { ...room, assignedMemberIds: currentIds };
        });
        return { ...h, rooms: updatedRooms };
      }
      return h;
    });
    setTrip({ ...trip, hotels: updatedHotels });
  };

  const updateRoomName = (hotelId: string, roomId: string, newName: string) => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    const updatedHotels = hotels.map(h => {
      if (h.id === hotelId) {
        return {
          ...h,
          rooms: h.rooms.map(r => r.id === roomId ? { ...r, name: newName } : r)
        };
      }
      return h;
    });
    setTrip({ ...trip, hotels: updatedHotels });
  };

  const [confirmClear, setConfirmClear] = useState(false);
  const clearAssignments = () => {
    if (isLocked) { if (requestUnlock) requestUnlock(); return; }
    if (!currentHotel) return;
    const updatedHotels = hotels.map(h => {
      if (h.id === currentHotel.id) {
        return { ...h, rooms: h.rooms.map(r => ({ ...r, assignedMemberIds: [] })) };
      }
      return h;
    });
    setTrip({ ...trip, hotels: updatedHotels });
    setConfirmClear(false);
  };

  const downloadSummaryAsImage = async () => {
    if (!summaryRef.current) return;
    
    try {
      const dataUrl = await toPng(summaryRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `phan-phong-${currentHotel?.name || 'khach-san'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating image', err);
    }
  };

  return (
    <div className="space-y-6">
      {overcapacityPrompt.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Phòng đã đầy</h3>
            <p className="text-slate-600 text-sm mb-6">Phòng đã đầy, bạn muốn thêm thành viên không?</p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setOvercapacityPrompt({ isOpen: false, roomId: '', toAssign: [] })}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
               >
                No
              </button>
              <button 
                onClick={() => executeAssign(overcapacityPrompt.roomId, overcapacityPrompt.toAssign)}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
               >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {fixedGroupPrompt.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Lưu nhóm cố định</h3>
            <p className="text-xs text-slate-500 mb-4">Nhập tên cho nhóm ({fixedGroupPrompt.memberIds.length} thành viên):</p>
            <input 
              type="text" 
              autoFocus
              value={newFixedGroupName}
              onChange={e => setNewFixedGroupName(e.target.value)}
              placeholder="VD: Gia đình A, Nhóm bạn B..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4 outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSaveFixedGroup();
                if (e.key === 'Escape') setFixedGroupPrompt({ isOpen: false, memberIds: [] });
              }}
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setFixedGroupPrompt({ isOpen: false, memberIds: [] })}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={confirmSaveFixedGroup}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Lưu nhóm
              </button>
            </div>
          </div>
        </div>
      )}

      {managingFixedGroup && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col max-h-[85vh]">
             <h3 className="text-sm font-bold text-slate-800 mb-4">Quản lý nhóm cố định</h3>
             
             <div className="mb-4">
               <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tên nhóm</label>
               <input 
                 type="text" 
                 value={managingFixedGroup.name}
                 onChange={e => setManagingFixedGroup({ ...managingFixedGroup, name: e.target.value })}
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
               />
             </div>

             <div className="flex gap-2 mb-2 items-center flex-wrap">
               <span className="text-[10px] font-bold text-slate-400 uppercase">Thêm thành viên:</span>
               <select 
                 className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 flex-1 outline-none font-medium"
                 onChange={(e) => {
                    if (!e.target.value) return;
                    if (!managingFixedGroup.memberIds.includes(e.target.value)) {
                       setManagingFixedGroup({ ...managingFixedGroup, memberIds: [...managingFixedGroup.memberIds, e.target.value] });
                    }
                    e.target.value = '';
                 }}
               >
                 <option value="">-- Chọn thành viên --</option>
                 {participants.filter(p => !managingFixedGroup.memberIds.includes(p.id)).map(p => (
                   <option key={p.id} value={p.id}>{p.name} - {p.gender}</option>
                 ))}
               </select>
             </div>

             <div className="flex justify-between items-center mb-2 mt-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase">Danh sách thành viên ({managingFixedGroup.memberIds.length})</span>
               <div className="flex gap-1 items-center">
                 <span className="text-[10px] font-medium text-slate-400">Sắp xếp:</span>
                 <select 
                   value={managedGroupSort} 
                   onChange={(e) => setManagedGroupSort(e.target.value as any)}
                   className="text-[10px] bg-slate-50 border border-slate-200 rounded outline-none p-0.5"
                 >
                   <option value="default">- Mặc định -</option>
                   <option value="name">Tên A-Z</option>
                   <option value="gender">Giới tính</option>
                 </select>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto mb-4 border border-slate-100 rounded-lg p-2 space-y-1">
               {[...managingFixedGroup.memberIds]
                 .map(id => participants.find(p => p.id === id))
                 .filter(Boolean)
                 .sort((a, b) => {
                   if (managedGroupSort === 'name') return a!.name.localeCompare(b!.name);
                   if (managedGroupSort === 'gender') return a!.gender.localeCompare(b!.gender);
                   return 0;
                 })
                 .map(p => p ? (
                 <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                   <div className="flex items-center gap-2">
                     <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${p.gender === 'nam' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                        {p.gender === 'nam' ? 'M' : 'F'}
                     </span>
                     <span className="text-sm font-bold text-slate-700">{p.name}</span>
                   </div>
                   <button 
                     onClick={() => setManagingFixedGroup({ ...managingFixedGroup, memberIds: managingFixedGroup.memberIds.filter(id => id !== p.id) })}
                     className="text-slate-400 hover:text-rose-500"
                   >
                     <UserMinus className="w-4 h-4" />
                   </button>
                 </div>
               ) : null)}
               {managingFixedGroup.memberIds.length === 0 && (
                 <p className="text-xs text-center p-4 text-slate-400 italic">Nhóm trống</p>
               )}
             </div>

             <div className="flex gap-2 justify-end mt-auto pt-4 border-t border-slate-100">
               <button 
                 onClick={() => setManagingFixedGroup(null)}
                 className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
               >
                 Hủy
               </button>
               <button 
                 onClick={saveManagedFixedGroup}
                 className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
               >
                 <Save className="w-4 h-4" /> Lưu nhóm
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Hotel Management */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Bed className="w-4 h-4" /> Quản lý khách sạn
          </h2>
          <button 
            onClick={() => setShowFixedGroups(!showFixedGroups)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${showFixedGroups ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}
          >
            <ShieldCheck className="w-3 h-3" /> {showFixedGroups ? 'Đóng' : 'Nhóm cố định'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {hotels.map(h => (
            <div key={h.id} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedHotelId(h.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${selectedHotelId === h.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {h.name}
              </button>
              <button 
                onClick={() => removeHotel(h.id)}
                className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <form onSubmit={addHotel} className="flex gap-2">
            <input 
              type="text" 
              value={newHotelName}
              onChange={e => setNewHotelName(e.target.value)}
              placeholder="Tên khách sạn mới..."
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 p-2 rounded-xl transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>

        {showFixedGroups && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Nhóm thành viên cố định</h3>
            {fixedGroups.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có nhóm cố định. Hãy phân phòng rồi nhấn "Lưu nhóm" để ghi nhớ.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {fixedGroups.map(g => (
                  <div key={g.id} className="bg-white p-2 border border-slate-100 rounded-lg flex items-center justify-between group">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => selectFixedGroup(g.memberIds)}
                    >
                      <p className="text-xs font-bold text-slate-700">{g.name}</p>
                      <p className="text-[10px] text-slate-400">{g.memberIds.length} người ({g.memberIds.map(id => participants.find(p => p.id === id)?.name).join(', ')})</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setManagingFixedGroup(g)} className="p-1 text-slate-300 hover:text-indigo-500 transition-all">
                        <Settings className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeFixedGroup(g.id)} className="p-1 text-slate-300 hover:text-rose-500 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentHotel && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase w-full mb-1">Thêm nhanh loại phòng:</span>
                {ROOM_TYPES.map(rt => (
                  <button
                    key={rt.type}
                    onClick={() => addRoom(currentHotel.id, rt)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200"
                  >
                    + {rt.type}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={autoAssign}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-bold transition-colors border border-emerald-200 flex items-center gap-1"
                >
                  <LayoutGrid className="w-3 h-3" /> Tự động phân
                </button>
                <button 
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-xs font-bold transition-colors border border-rose-200 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Xóa tất cả
                </button>
              </div>
            </div>
            {confirmClear && (
               <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between animate-in fade-in">
                 <span className="text-sm font-medium text-rose-700">Bạn có chắc chắn muốn xóa tất cả phân phòng?</span>
                 <div className="flex gap-2">
                   <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-white rounded-md transition-colors">Hủy</button>
                   <button onClick={clearAssignments} className="px-3 py-1.5 text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-md transition-colors">Xóa</button>
                 </div>
               </div>
            )}
          </div>
        )}
      </div>

      {currentHotel && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
               <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                 <Filter className="w-4 h-4" /> Lọc phòng:
               </div>
               <select 
                 value={roomTypeFilter} 
                 onChange={e => setRoomTypeFilter(e.target.value)}
                 className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
               >
                 <option value="all">Tất cả loại phòng</option>
                 {ROOM_TYPES.map(rt => <option key={rt.type} value={rt.type}>{rt.type}</option>)}
               </select>
               <input 
                 type="text"
                 value={participantSearchFilter}
                 onChange={e => setParticipantSearchFilter(e.target.value)}
                 placeholder="Tìm tên người..."
                 className="px-3 py-1.5 flex-1 max-w-[200px] bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
               />
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
               {filteredRooms.map(room => (
              <div 
                key={room.id} 
                className={`bg-white p-4 rounded-2xl border-2 transition-all min-h-[160px] flex flex-col ${room.assignedMemberIds.length >= room.capacity ? 'border-emerald-100' : 'border-slate-100 shadow-sm'}`}
              >
                <div className="flex items-start justify-between mb-3 border-b border-slate-50 pb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={room.name}
                        onChange={(e) => updateRoomName(currentHotel.id, room.id, e.target.value)}
                        className="text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full transition-colors truncate"
                        title="Nhấn để đổi tên"
                      />
                      {fixedGroups.some(g => g.memberIds.length > 0 && g.memberIds.length === room.assignedMemberIds.length && g.memberIds.every(id => room.assignedMemberIds.includes(id))) && (
                        <div title="Phòng này khớp với một Nhóm cố định" className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase flex items-center gap-1 whitespace-nowrap shrink-0">
                          <ShieldCheck className="w-3 h-3" /> Nhóm
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-1">
                      {room.type} • Sức chứa: {room.capacity}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => saveAsFixedGroup(room.assignedMemberIds)}
                      className="text-slate-300 hover:text-indigo-500 transition-colors p-1"
                      title="Lưu thành nhóm cố định"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => removeRoom(currentHotel.id, room.id)}
                      className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-2 py-2">
                  {room.assignedMemberIds.map(id => {
                    const p = participants.find(x => x.id === id);
                    if (!p) return null;
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[8px] ${p.gender === 'nam' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                            {p.gender === 'nam' ? 'M' : 'F'}
                          </div>
                          <span className="text-xs font-medium text-slate-700">{p.name}</span>
                        </div>
                        <button onClick={() => removeFromRoom(room.id, p.id)} className="text-slate-300 hover:text-rose-500 p-0.5">
                          <UserMinus className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  <button 
                    onClick={() => assignToRoom(room.id)}
                    disabled={selectedPersonnel.length === 0}
                    className={`w-full py-2 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase transition-all mt-2 ${selectedPersonnel.length > 0 ? 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'border-slate-100 text-slate-300'}`}
                  >
                    <UserPlus className="w-3 h-3" />
                    Thêm {selectedPersonnel.length > 0 ? selectedPersonnel.length : ''} người đã chọn
                  </button>
                  
                  {room.assignedMemberIds.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                       <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 transition-all" 
                            style={{ width: `${(room.assignedMemberIds.length / room.capacity) * 100}%` }}
                          />
                       </div>
                       <span className="text-[9px] font-bold text-slate-400">{room.assignedMemberIds.length}/{room.capacity}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {currentHotel.rooms.length === 0 && (
              <div className="col-span-full py-12 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                <Bed className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm font-medium">Chưa có phòng nào. Hãy thêm loại phòng ở trên.</p>
              </div>
            )}
            </div>
          </div>

          {/* Selector Panel */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" /> Chưa phân phòng ({filteredUnassignedParticipants.length})
              </h3>
              <div className="flex gap-2 items-center">
                 <select 
                   value={filterGender} 
                   onChange={(e) => setFilterGender(e.target.value as any)}
                   className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 outline-none font-medium"
                 >
                   <option value="all">Tất cả</option>
                   <option value="nam">Nam</option>
                   <option value="nữ">Nữ</option>
                 </select>
                 <button onClick={selectAllUnassigned} className="text-[10px] font-bold text-indigo-600 hover:underline">Tất cả</button>
                 <button onClick={deselectAll} className="text-[10px] font-bold text-slate-400 hover:underline">Bỏ chọn</button>
              </div>
            </div>
            
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredUnassignedParticipants.map(p => (
                <label 
                  key={p.id} 
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${selectedPersonnel.includes(p.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedPersonnel.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] ${p.gender === 'nam' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold text-slate-700 truncate">{p.name}</p>
                    <p className="text-[9px] text-slate-400 font-medium uppercase">{p.gender}</p>
                  </div>
                </label>
              ))}
              {unassignedParticipants.length === 0 && (
                <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-50" />
                  <p className="text-xs font-medium italic">Tất cả đã có phòng!</p>
                </div>
              )}
            </div>

            {selectedPersonnel.length > 0 && (
               <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-indigo-600 mb-2">Đang chọn {selectedPersonnel.length} người:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedPersonnel.map(id => (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[9px] font-bold">
                        {participants.find(p => p.id === id)?.name}
                        <button onClick={() => toggleSelect(id)} className="hover:text-indigo-900"><Plus className="w-2.5 h-2.5 rotate-45" /></button>
                      </span>
                    ))}
                  </div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Summary List */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danh sách phân phòng tổng hợp</h2>
          <button 
             onClick={downloadSummaryAsImage}
             className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-indigo-100"
           >
             <Download className="w-3 h-3" /> Tải về ảnh
           </button>
        </div>
        
        <div ref={summaryRef} className="bg-white p-6 rounded-xl border border-slate-100">
          <h2 className="text-xl font-bold text-center mb-8 uppercase text-slate-800">
            Danh sách phân phòng ở Khách sạn: {currentHotel?.name || 'Chưa chọn'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentHotel?.rooms.map((room) => {
               if (room.assignedMemberIds.length === 0) return null;
               return (
                 <div key={room.id} className="border border-slate-200 rounded-xl overflow-hidden break-inside-avoid">
                   <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                     <h3 className="font-bold text-indigo-900">{room.name}</h3>
                     <p className="text-[10px] uppercase font-bold text-indigo-600 tracking-wide mt-1">
                       {room.type} • {room.assignedMemberIds.length}/{room.capacity} người
                     </p>
                   </div>
                   <div className="p-0">
                     <table className="w-full text-left text-sm">
                       <tbody>
                         {room.assignedMemberIds.map((id, index) => {
                           const p = participants.find(x => x.id === id);
                           if (!p) return null;
                           return (
                             <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                               <td className="py-2.5 px-4 text-slate-400 w-8">{index + 1}</td>
                               <td className="py-2.5 px-4 font-bold text-slate-800">{p.name}</td>
                               <td className="py-2.5 px-4 text-right">
                                 <span className={`text-[10px] font-bold uppercase ${p.gender === 'nam' ? 'text-indigo-600' : 'text-rose-600'}`}>{p.gender}</span>
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   </div>
                 </div>
               );
            })}
            {(!currentHotel || currentHotel.rooms.every(r => r.assignedMemberIds.length === 0)) && (
               <div className="col-span-full text-center text-slate-400 py-10 italic">
                 Danh sách phân phòng trống.
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
