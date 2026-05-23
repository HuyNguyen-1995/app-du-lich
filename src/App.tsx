import React, { useState, useEffect } from 'react';
import { Trip, Participant, Income, Expense, SubGroup, Hotel, FixedGroup, EstimatedExpense } from './types';
import { SetupTab } from './components/SetupTab';
import { IncomeTab } from './components/IncomeTab';
import { ExpenseTab } from './components/ExpenseTab';
import { SummaryTab } from './components/SummaryTab';
import { HotelTab } from './components/HotelTab';
import { TransfersTab } from './components/TransfersTab';
import { EstimatedExpenseTab } from './components/EstimatedExpenseTab';
import { Settings, Wallet, Receipt, Calculator, Map, LogOut, Bed, Lock, Unlock, Users, ClipboardList } from 'lucide-react';
import { auth, db, loginWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, getDocs, query, where, writeBatch, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { generateId } from './lib/utils';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [activeTab, setActiveTab] = useState('setup');
  
  const [user, setUser] = useState<User | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripsList, setTripsList] = useState<{id: string, name: string, isLocked?: boolean}[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);

  const attemptUnlock = () => {
    if (unlockPassword === '13112801') {
      if (tripId) {
        setDoc(doc(db, 'trips', tripId), { isLocked: false, updatedAt: serverTimestamp() }, { merge: true });
      }
      setShowUnlockPrompt(false);
      setUnlockPassword('');
    } else {
      alert('Sai mật khẩu!');
    }
  };

  const requestUnlock = () => setShowUnlockPrompt(true);
  
  const toggleLock = () => {
    if (trip.isLocked) {
       requestUnlock();
    } else {
       if (tripId) {
          setDoc(doc(db, 'trips', tripId), { isLocked: true, updatedAt: serverTimestamp() }, { merge: true });
       }
    }
  };
  
  // State
  const [trip, setTrip] = useState<Trip>({ name: '', startDate: '', endDate: '', isLocked: false });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [estimatedExpenses, setEstimatedExpenses] = useState<EstimatedExpense[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
         try {
           const unsubTripsList = onSnapshot(
             query(collection(db, 'trips'), where('ownerId', '==', u.uid)), // Removed orderby because requires index potentially, but let's test. actually, snapshot without order is fine
             (snap) => {
                const list = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'Chuyến đi mới', isLocked: doc.data().isLocked || false }));
                setTripsList(list);
                setTripId(current => {
                   if (list.length > 0 && (!current || !list.find(t => t.id === current))) {
                      return list[0].id;
                   } else if (list.length === 0) {
                      const newTripId = generateId();
                      handleCreateTrip(newTripId, u.uid);
                      return newTripId;
                   }
                   return current;
                });
             },  
             (error) => {
                handleFirestoreError(error, OperationType.GET, 'trips');
             }
           );
           setLoading(false);
           return () => unsubTripsList();
         } catch (err) {
           handleFirestoreError(err, OperationType.GET, 'trips');
           setLoading(false);
         }
      } else {
         setTripId(null);
         setTripsList([]);
         setTrip({ name: '', startDate: '', endDate: '', isLocked: false });
         setParticipants([]);
         setIncomes([]);
         setExpenses([]);
         setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []); // eslint-disable-line

  const handleCreateTrip = async (id: string, uid: string) => {
    try {
      await setDoc(doc(db, 'trips', id), {
        name: 'Chuyến đi mới',
        startDate: '',
        endDate: '',
        isLocked: false,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setTripId(id);
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'trips');
    }
  };

  const handleCreateNewTrip = () => {
    if (!user) return;
    const newId = generateId();
    handleCreateTrip(newId, user.uid);
  };

  const handleDeleteTrip = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTripToDelete(id);
  };

  const confirmDeleteTrip = async () => {
    if (!tripToDelete) return;
    try {
      await deleteDoc(doc(db, 'trips', tripToDelete));
      setTripToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${tripToDelete}`);
    }
  };

  useEffect(() => {
    if (!tripId) return;

    // Clear state before loading new trip
    setTrip({ name: '', startDate: '', endDate: '', isLocked: false });
    setParticipants([]);
    setIncomes([]);
    setExpenses([]);
    setLoading(true);

    // Listen to Trip
    const unsubTrip = onSnapshot(doc(db, 'trips', tripId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTrip(prev => ({
          ...prev, 
          name: data.name || '', 
          startDate: data.startDate || '', 
          endDate: data.endDate || '',
          isLocked: data.isLocked || false
        }));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `trips/${tripId}`);
      setLoading(false);
    });

    const unsubSubGroups = onSnapshot(collection(db, `trips/${tripId}/subGroups`), (snap) => {
      const groups: SubGroup[] = [];
      snap.forEach(d => groups.push({ id: d.id, ...d.data() } as SubGroup));
      setTrip(prev => ({ ...prev, subGroups: groups }));
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}/subGroups`));

    const unsubHotels = onSnapshot(collection(db, `trips/${tripId}/hotels`), (snap) => {
      const hots: Hotel[] = [];
      snap.forEach(d => hots.push({ id: d.id, ...d.data() } as Hotel));
      setTrip(prev => ({ ...prev, hotels: hots }));
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}/hotels`));

    const unsubFixedGroups = onSnapshot(collection(db, `trips/${tripId}/fixedGroups`), (snap) => {
      const groups: FixedGroup[] = [];
      snap.forEach(d => groups.push({ id: d.id, ...d.data() } as FixedGroup));
      setTrip(prev => ({ ...prev, fixedGroups: groups }));
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}/fixedGroups`));

    const unsubParts = onSnapshot(collection(db, `trips/${tripId}/participants`), (snap) => {
      const parts: Participant[] = [];
      snap.forEach(d => parts.push({ id: d.id, ...d.data() } as Participant));
      setParticipants(parts);
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}/participants`));

    const unsubIncomes = onSnapshot(collection(db, `trips/${tripId}/incomes`), (snap) => {
      const incs: Income[] = [];
      snap.forEach(d => {
        const _data = d.data();
        let fund = _data.targetFund || 'general';
        if (_data.type === 'group') fund = _data.participantId;
        incs.push({ 
          id: d.id, 
          ..._data,
          targetFund: fund,
          type: _data.type === 'group' ? 'member' : _data.type
        } as Income);
      });
      // Sort desc by date
      incs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setIncomes(incs);
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}/incomes`));

    const unsubExpenses = onSnapshot(collection(db, `trips/${tripId}/expenses`), (snap) => {
      const exps: Expense[] = [];
      snap.forEach(d => exps.push({ id: d.id, ...d.data() } as Expense));
      exps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(exps);
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}/expenses`));

    const unsubEstimatedExpenses = onSnapshot(collection(db, `trips/${tripId}/estimatedExpenses`), (snap) => {
      const estExps: EstimatedExpense[] = [];
      snap.forEach(d => estExps.push({ id: d.id, ...d.data() } as EstimatedExpense));
      estExps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEstimatedExpenses(estExps);
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}/estimatedExpenses`));

    return () => {
      unsubTrip();
      unsubSubGroups();
      unsubHotels();
      unsubFixedGroups();
      unsubParts();
      unsubIncomes();
      unsubExpenses();
      unsubEstimatedExpenses();
    };
  }, [tripId]);

  // Wrappers to update Firestore when state changes are requested
  const handleTripChange = async (newTripOrUpdater: React.SetStateAction<Trip>) => {
    if (!tripId) return;
    const resolvedTrip = typeof newTripOrUpdater === 'function' ? newTripOrUpdater(trip) : newTripOrUpdater;
    // We optimism update local state
    setTrip(resolvedTrip);

    // Sync remote Trip core fields
    try {
      await setDoc(doc(db, 'trips', tripId), {
        name: resolvedTrip.name,
        startDate: resolvedTrip.startDate,
        endDate: resolvedTrip.endDate,
        isLocked: resolvedTrip.isLocked || false,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
    }

    // Sync remote Subgroups
    const subGroupsRef = collection(db, `trips/${tripId}/subGroups`);
    const currentSnap = await getDocs(subGroupsRef);
    const existingIds = new Set(currentSnap.docs.map(d => d.id));
    
    const batch = writeBatch(db);
    const incomingSubGroups = resolvedTrip.subGroups || [];
    incomingSubGroups.forEach(sg => {
      batch.set(doc(db, `trips/${tripId}/subGroups`, sg.id), {
        name: sg.name,
        members: sg.members
      });
      existingIds.delete(sg.id);
    });
    
    // Delete removed ones
    existingIds.forEach(id => {
      batch.delete(doc(db, `trips/${tripId}/subGroups`, id));
    });

    // Sync remote hotels
    const hotelsRef = collection(db, `trips/${tripId}/hotels`);
    const hotelsSnap = await getDocs(hotelsRef);
    const existingHotelIds = new Set(hotelsSnap.docs.map(d => d.id));
    
    const incomingHotels = resolvedTrip.hotels || [];
    incomingHotels.forEach(h => {
      batch.set(doc(db, `trips/${tripId}/hotels`, h.id), {
        name: h.name,
        rooms: h.rooms
      });
      existingHotelIds.delete(h.id);
    });
    
    existingHotelIds.forEach(id => {
      batch.delete(doc(db, `trips/${tripId}/hotels`, id));
    });

    // Sync remote FixedGroups
    const fixedGroupsRef = collection(db, `trips/${tripId}/fixedGroups`);
    const fixedGroupsSnap = await getDocs(fixedGroupsRef);
    const existingFixedGroupIds = new Set(fixedGroupsSnap.docs.map(d => d.id));
    
    const incomingFixedGroups = resolvedTrip.fixedGroups || [];
    incomingFixedGroups.forEach(fg => {
      batch.set(doc(db, `trips/${tripId}/fixedGroups`, fg.id), {
        name: fg.name,
        memberIds: fg.memberIds
      });
      existingFixedGroupIds.delete(fg.id);
    });
    
    existingFixedGroupIds.forEach(id => {
      batch.delete(doc(db, `trips/${tripId}/fixedGroups`, id));
    });

    await batch.commit();
  };

  const handleParticipantsChange = async (newPartsOrUpdater: React.SetStateAction<Participant[]>) => {
    if (!tripId) return;
    const resolvedParts = typeof newPartsOrUpdater === 'function' ? newPartsOrUpdater(participants) : newPartsOrUpdater;
    setParticipants(resolvedParts);

    const partsRef = collection(db, `trips/${tripId}/participants`);
    const currentSnap = await getDocs(partsRef);
    const existingIds = new Set(currentSnap.docs.map(d => d.id));

    const batch = writeBatch(db);
    resolvedParts.forEach(p => {
      batch.set(doc(db, `trips/${tripId}/participants`, p.id), {
        name: p.name,
        gender: p.gender
      });
      existingIds.delete(p.id);
    });

    existingIds.forEach(id => {
      batch.delete(doc(db, `trips/${tripId}/participants`, id));
    });
    await batch.commit();
  };

  const handleIncomesChange = async (newIncomesOrUpdater: React.SetStateAction<Income[]>) => {
    if (!tripId) return;
    const resolvedIncomes = typeof newIncomesOrUpdater === 'function' ? newIncomesOrUpdater(incomes) : newIncomesOrUpdater;
    setIncomes(resolvedIncomes);

    const incomesRef = collection(db, `trips/${tripId}/incomes`);
    const currentSnap = await getDocs(incomesRef);
    const existingIds = new Set(currentSnap.docs.map(d => d.id));

    const batch = writeBatch(db);
    resolvedIncomes.forEach(inc => {
      batch.set(doc(db, `trips/${tripId}/incomes`, inc.id), {
        participantId: inc.participantId,
        type: inc.type,
        targetFund: inc.targetFund || 'general',
        amount: inc.amount,
        note: inc.note,
        date: inc.date
      });
      existingIds.delete(inc.id);
    });

    existingIds.forEach(id => {
      batch.delete(doc(db, `trips/${tripId}/incomes`, id));
    });
    await batch.commit();
  };

  const handleExpensesChange = async (newExpensesOrUpdater: React.SetStateAction<Expense[]>) => {
    if (!tripId) return;
    const resolvedExpenses = typeof newExpensesOrUpdater === 'function' ? newExpensesOrUpdater(expenses) : newExpensesOrUpdater;
    setExpenses(resolvedExpenses);

    const expensesRef = collection(db, `trips/${tripId}/expenses`);
    const currentSnap = await getDocs(expensesRef);
    const existingIds = new Set(currentSnap.docs.map(d => d.id));

    const batch = writeBatch(db);
    resolvedExpenses.forEach(exp => {
      batch.set(doc(db, `trips/${tripId}/expenses`, exp.id), {
        description: exp.description,
        amount: exp.amount,
        isSponsored: exp.isSponsored,
        sharedBy: exp.sharedBy,
        paidBy: exp.paidBy || '',
        date: exp.date
      });
      existingIds.delete(exp.id);
    });

    existingIds.forEach(id => {
      batch.delete(doc(db, `trips/${tripId}/expenses`, id));
    });
    await batch.commit();
  };

  const handleEstimatedExpensesChange = async (newExpensesOrUpdater: React.SetStateAction<EstimatedExpense[]>) => {
    if (!tripId) return;
    const resolvedExpenses = typeof newExpensesOrUpdater === 'function' ? newExpensesOrUpdater(estimatedExpenses) : newExpensesOrUpdater;
    setEstimatedExpenses(resolvedExpenses);

    try {
      const expensesRef = collection(db, `trips/${tripId}/estimatedExpenses`);
      const currentSnap = await getDocs(expensesRef);
      const existingIds = new Set(currentSnap.docs.map(d => d.id));

      const batch = writeBatch(db);
      resolvedExpenses.forEach((exp: any) => {
        const data: any = {
          description: String(exp.description).slice(0, 500),
          amount: Number(exp.amount) || 0,
          sharedBy: Array.isArray(exp.sharedBy) ? exp.sharedBy : [],
          date: exp.date || new Date().toISOString()
        };
        if (typeof exp.unitPrice === 'number' && !isNaN(exp.unitPrice)) data.unitPrice = exp.unitPrice;
        if (typeof exp.quantity === 'number' && !isNaN(exp.quantity)) data.quantity = exp.quantity;
        if (typeof exp.isSponsored === 'boolean') data.isSponsored = exp.isSponsored;
        
        batch.set(doc(db, `trips/${tripId}/estimatedExpenses`, exp.id), data);
        existingIds.delete(exp.id);
      });

      existingIds.forEach(id => {
        batch.delete(doc(db, `trips/${tripId}/estimatedExpenses`, id));
      });
      await batch.commit();
    } catch (e) {
      console.error("Error saving estimated expenses:", e);
      handleFirestoreError(e, OperationType.UPDATE, `trips/${tripId}/estimatedExpenses`);
    }
  };

  const tabs = [
    { id: 'setup', label: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
    { id: 'income', label: 'Tiền thu', icon: <Wallet className="w-5 h-5" /> },
    { id: 'estimate', label: 'Dự kiến chi', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'expense', label: 'Tiền chi', icon: <Receipt className="w-5 h-5" /> },
    { id: 'hotel', label: 'Phân phòng', icon: <Bed className="w-5 h-5" /> },
    { id: 'summary', label: 'Quyết toán', icon: <Calculator className="w-5 h-5" /> },
    { id: 'transfers', label: 'Chuyển khoản Team', icon: <Users className="w-5 h-5" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
          <Map className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 mb-2">TripEx by Huy_Nguyen</h1>
        <p className="text-sm text-slate-500 mb-8 text-center max-w-sm">
          Đăng nhập để quản lý chi tiêu nhóm, đồng bộ dữ liệu đa nền tảng và chia sẻ chuyến đi.
        </p>
        <button 
          onClick={loginWithGoogle}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
          Đăng nhập bằng Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-auto min-h-[3.5rem] sm:min-h-[4rem] pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:pb-3 sm:pt-[max(1rem,env(safe-area-inset-top))] bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 z-20 shadow-sm relative">
         <div className="flex items-center gap-2 sm:gap-3">
             <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
               <Map className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
             </div>
             <div className="flex flex-col min-w-0 max-w-[150px] sm:max-w-xs">
                <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">{trip.name || "Đang tải..."}</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                   {trip.startDate && trip.endDate ? `${new Date(trip.startDate).toLocaleDateString('vi-VN')} - ${new Date(trip.endDate).toLocaleDateString('vi-VN')} • ` : ''}
                   {participants.length} Thành viên
                </p>
             </div>
         </div>
         <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={toggleLock} 
              className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-bold transition-all border ${trip.isLocked ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}
            >
              {trip.isLocked ? <><Lock className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Đã khóa</span></> : <><Unlock className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Mở khóa</span></>}
            </button>

            {/* Menu */}
            <div className="relative">
               <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)} 
                  className="flex items-center justify-center p-2 sm:p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors"
               >
                  <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
               </button>
               
               {sidebarOpen && (
                 <>
                   <div 
                     className="fixed inset-0 z-40" 
                     onClick={() => setSidebarOpen(false)}
                   ></div>
                   <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                       <div className="px-3 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách chuyến đi</span>
                         <button onClick={() => { setSidebarOpen(false); handleCreateNewTrip(); }} className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors" title="Thêm chuyến đi mới">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                         </button>
                       </div>
                       <div className="max-h-[60vh] overflow-y-auto py-1">
                         {tripsList.map(t => (
                           <div key={t.id} className={`flex items-center px-1 my-0.5 mx-1 rounded-lg ${tripId === t.id ? 'bg-indigo-50/50' : ''}`}>
                             <button
                               onClick={() => { setTripId(t.id); setSidebarOpen(false); }}
                               className={`flex-1 text-left px-3 py-3 text-sm truncate ${tripId === t.id ? 'font-bold text-indigo-700' : 'text-slate-700 hover:bg-slate-50 rounded-lg'}`}
                             >
                               {t.name}
                             </button>
                             {tripId !== t.id && (
                               <button onClick={(e) => { setSidebarOpen(false); handleDeleteTrip(e, t.id); }} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 transition-colors">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                               </button>
                             )}
                           </div>
                         ))}
                       </div>
                       <div className="border-t border-slate-100 p-1 bg-slate-50/50">
                         <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm text-rose-600 font-bold hover:bg-rose-100 rounded-lg transition-colors">
                           <LogOut className="w-4 h-4" /> Đăng xuất
                         </button>
                       </div>
                   </div>
                 </>
               )}
            </div>
         </div>
      </header>

      {/* Navigation Tabs (Horizontal Scroll) */}
      <nav className="bg-white border-b border-slate-200 z-10 shrink-0">
         <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
           <div className="flex px-2 py-1 sm:px-4 sm:py-2 gap-1 sm:gap-2 min-w-max">
             {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-sm font-bold transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {React.cloneElement(tab.icon, { className: 'w-4 h-4 sm:w-5 sm:h-5 shrink-0' })}
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
             ))}
           </div>
         </div>
      </nav>

      {/* Modals and Prompts */}
      {showUnlockPrompt && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2"><Lock className="w-4 h-4" /> Nhập mật khẩu</h3>
            <input 
              type="password" 
              autoFocus
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              placeholder="Nhập 13112801"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4 outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') attemptUnlock();
                if (e.key === 'Escape') { setShowUnlockPrompt(false); setUnlockPassword(''); }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowUnlockPrompt(false); setUnlockPassword(''); }} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Hủy</button>
              <button onClick={attemptUnlock} className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Mở Khóa</button>
            </div>
          </div>
        </div>
      )}

      {tripToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-600 text-sm mb-6">Bạn có chắc chắn muốn xóa chuyến đi này? Dữ liệu sẽ không thể khôi phục.</p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setTripToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={confirmDeleteTrip}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-50/50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
           <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-6">
            {activeTab === 'setup' && (
              <SetupTab 
                trip={trip} setTrip={handleTripChange} 
                participants={participants} setParticipants={handleParticipantsChange} 
                isLocked={trip.isLocked}
                requestUnlock={requestUnlock}
                onDeleteTrip={(e) => tripId && handleDeleteTrip(e, tripId)}
              />
            )}
            
            {activeTab === 'income' && (
              <IncomeTab 
                participants={participants} 
                incomes={incomes} setIncomes={handleIncomesChange} 
                isLocked={trip.isLocked}
                requestUnlock={requestUnlock}
                trip={trip}
              />
            )}

            {activeTab === 'estimate' && (
              <EstimatedExpenseTab 
                participants={participants} 
                estimatedExpenses={estimatedExpenses} setEstimatedExpenses={handleEstimatedExpensesChange} 
                trip={trip}
                isLocked={trip.isLocked}
                requestUnlock={requestUnlock}
              />
            )}

            {activeTab === 'expense' && (
              <ExpenseTab 
                participants={participants} 
                expenses={expenses} setExpenses={handleExpensesChange} 
                trip={trip}
                isLocked={trip.isLocked}
                requestUnlock={requestUnlock}
              />
            )}

            {activeTab === 'hotel' && (
              <HotelTab 
                participants={participants} 
                trip={trip} setTrip={handleTripChange} 
                isLocked={trip.isLocked}
                requestUnlock={requestUnlock}
              />
            )}

            {activeTab === 'summary' && (
              <SummaryTab 
                participants={participants} 
                incomes={incomes} 
                expenses={expenses}
                trip={trip}
              />
            )}

            {activeTab === 'transfers' && (
              <TransfersTab 
                participants={participants} 
                incomes={incomes} 
                expenses={expenses}
                trip={trip}
              />
            )}
           </div>
      </main>
    </div>
  );
}