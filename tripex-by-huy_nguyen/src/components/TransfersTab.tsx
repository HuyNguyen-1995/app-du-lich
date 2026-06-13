import React, { useMemo } from 'react';
import { Participant, Income, Expense, Trip } from '../types';
import { ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface Props {
  participants: Participant[];
  incomes: Income[];
  expenses: Expense[];
  trip: Trip;
}

export function TransfersTab({ participants, incomes, expenses, trip }: Props) {

  // We recalculate summary details exactly like SummaryTab basically, but we only really care about subgroups here (or general, but "chỉ dành riêng cho các team").
  const { summaryMatrix } = useMemo(() => {
    const scopes = ['general', ...(trip.subGroups?.map(g => g.id) || [])];
    const sMat: Record<string, Record<string, { deposited: number; share: number; balance: number }>> = {};
    const sCredits: Record<string, Record<string, number>> = {};
    
    scopes.forEach(scope => {
      sMat[scope] = {};
      sCredits[scope] = {};
      participants.forEach(p => {
        sMat[scope][p.id] = { deposited: 0, share: 0, balance: 0 };
        sCredits[scope][p.id] = 0;
      });
    });

    const getExpenseScope = (exp: Expense) => {
      if (exp.paidBy === 'fund' || exp.paidBy === 'advance') return 'general';
      if (trip.subGroups?.some(g => g.id === exp.paidBy)) return exp.paidBy;
      if (trip.subGroups && exp.sharedBy.length > 0) {
          for (const g of trip.subGroups) {
              const allSharedInGroup = exp.sharedBy.every(id => g.members.includes(id));
              const payerInGroup = exp.paidBy && participants.some(p => p.id === exp.paidBy) ? g.members.includes(exp.paidBy) : true;
              if (allSharedInGroup && payerInGroup) {
                  return g.id;
              }
          }
      }
      return 'general';
    };

    incomes.forEach(inc => {
      if (inc.type === 'member' || !inc.type) {
        const scope = (inc.targetFund && trip.subGroups?.some(g => g.id === inc.targetFund)) ? inc.targetFund : 'general';
        if (sMat[scope] && sMat[scope][inc.participantId]) {
          sMat[scope][inc.participantId].deposited += inc.amount;
        }
      }
    });

    expenses.forEach(exp => {
      const scope = getExpenseScope(exp);
      if (exp.paidBy && participants.some(p => p.id === exp.paidBy) && !exp.isSponsored) {
        if (sMat[scope] && sMat[scope][exp.paidBy]) {
          sMat[scope][exp.paidBy].deposited += exp.amount;
        }
      }

      if (!exp.isSponsored && exp.sharedBy.length > 0) {
        const splitAmount = exp.amount / exp.sharedBy.length;
        exp.sharedBy.forEach(pId => {
          if (sMat[scope] && sMat[scope][pId]) {
            sMat[scope][pId].share += splitAmount;
          }
        });
      }
    });

    scopes.forEach(scope => {
      const sponsorIncome = incomes.filter(i => i.type === 'sponsor' && (
        (scope === 'general' && (!i.targetFund || i.targetFund === 'general')) ||
        (i.targetFund === scope)
      )).reduce((s, i) => s + i.amount, 0);

      const applicableMembers = scope === 'general' ? participants.map(p => p.id) : (trip.subGroups?.find(g => g.id === scope)?.members || []);
      const validMembers = applicableMembers.filter(id => participants.some(p => p.id === id));
      
      if (validMembers.length > 0 && sponsorIncome > 0) {
        const perPerson = sponsorIncome / validMembers.length;
        validMembers.forEach(pId => {
          if (sCredits[scope][pId] !== undefined) {
            sCredits[scope][pId] += perPerson;
          }
        });
      }

      participants.forEach(p => {
        if (sMat[scope][p.id]) {
          sMat[scope][p.id].balance = sMat[scope][p.id].deposited + sCredits[scope][p.id] - sMat[scope][p.id].share;
        }
      });
    });

    return { summaryMatrix: sMat };
  }, [participants, incomes, expenses, trip.subGroups]);


  const calculateTransfers = (scope: string) => {
    const data = summaryMatrix[scope];
    if (!data) return [];

    let debtors = participants.map(p => ({
      id: p.id,
      name: p.name,
      owes: data[p.id] ? -data[p.id].balance : 0
    })).filter(p => p.owes > 0.5); // Using 0.5 to prevent floating point issues

    let creditors = participants.map(p => ({
      id: p.id,
      name: p.name,
      owed: data[p.id] ? data[p.id].balance : 0
    })).filter(p => p.owed > 0.5);

    // Sort to optimize minimum transactions (simple greedy approach: largest debtor pays largest creditor)
    debtors.sort((a, b) => b.owes - a.owes);
    creditors.sort((a, b) => b.owed - a.owed);

    const transfers: { from: string; to: string; amount: number }[] = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const amountToTransfer = Math.min(debtor.owes, creditor.owed);

      if (amountToTransfer > 0) {
         transfers.push({
            from: debtor.name,
            to: creditor.name,
            amount: amountToTransfer
         });
      }

      debtor.owes -= amountToTransfer;
      creditor.owed -= amountToTransfer;

      if (debtor.owes < 0.5) i++;
      if (creditor.owed < 0.5) j++;
    }

    return transfers;
  };

  const hasGroups = trip.subGroups && trip.subGroups.length > 0;

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2 mb-2">
         <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Đề Xuất Chuyển Khoản Nhóm</h2>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex gap-3 items-start mb-6 border-b border-slate-100 pb-5">
           <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0">
             <Info className="w-5 h-5 text-indigo-600" />
           </div>
           <div>
             <h3 className="text-base font-bold text-slate-800">Căn cứ vào quyết toán chi tiết từng Team</h3>
             <p className="text-sm text-slate-500 mt-1">Gợi ý dưới đây giúp các thành viên trong từng Team/Nhóm chuyển tiền qua lại với nhau một cách ngắn gọn nhất (người âm tiền chuyển cho người dương tiền).</p>
           </div>
        </div>

        {!hasGroups && (
           <div className="text-center py-6 text-slate-400 italic text-sm">
             Chưa có nhóm (team) nào được tạo trong chuyến đi này. Bạn có thể tạo tại phần Cài đặt.
           </div>
        )}

        {hasGroups && trip.subGroups?.map(sg => {
           const transfers = calculateTransfers(sg.id);

           return (
             <div key={sg.id} className="mb-8 last:mb-0">
               <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider bg-slate-50 px-3 py-2 rounded-lg inline-block mb-3"># Nhóm: {sg.name}</h4>
               
               {transfers.length === 0 ? (
                 <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium ml-2 px-3 py-2 bg-emerald-50 rounded-lg inline-flex">
                    <CheckCircle2 className="w-4 h-4" />
                    Nhóm đã hoàn tất (Cân bằng, không cần chuyển khoản)
                 </div>
               ) : (
                 <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                   {transfers.map((t, idx) => (
                     <div key={idx} className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col gap-2 relative group hover:border-indigo-300 transition-colors">
                       <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-700">{t.from}</span>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0 mx-2" />
                          <span className="font-bold text-indigo-700 text-right">{t.to}</span>
                       </div>
                       <div className="md:mt-1 pt-2 border-t border-slate-200/60 flex justify-between items-center text-rose-600 font-bold bg-white -mx-2 px-2 py-1 rounded">
                         <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Chuyển</span>
                         {formatCurrency(t.amount)}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           );
        })}
      </div>
    </div>
  );
}
