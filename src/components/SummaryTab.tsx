import React, { useMemo, useRef, useState } from 'react';
import { Participant, Income, Expense, Trip } from '../types';
import { formatCurrency, removeVietnameseTones } from '../lib/utils';
import { Calculator, ArrowDownRight, ArrowUpRight, Ban, Download, Users } from 'lucide-react';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Props = {
  participants: Participant[];
  incomes: Income[];
  expenses: Expense[];
  trip: Trip;
};

export function SummaryTab({ participants, incomes, expenses, trip }: Props) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. FUND STATISTICS (Quỹ Tiền Mặt)
  const fundStats = useMemo(() => {
    const stats: {
       general: { income: number; sponsor: number; advance: number; expense: number; balance: number };
       groups: Record<string, { income: number; sponsor: number; advance: number; expense: number; balance: number; name: string }>;
    } = {
      general: { income: 0, sponsor: 0, advance: 0, expense: 0, balance: 0 },
      groups: {}
    };
    
    trip.subGroups?.forEach(g => {
      stats.groups[g.id] = { income: 0, sponsor: 0, advance: 0, expense: 0, balance: 0, name: g.name };
    });

    incomes.forEach(inc => {
      const target = (inc.targetFund && trip.subGroups?.some(g => g.id === inc.targetFund)) ? inc.targetFund : 'general';
      const dest = target === 'general' ? stats.general : stats.groups[target];
      if (inc.type === 'sponsor') dest.sponsor += inc.amount;
      else if (inc.type === 'advance') dest.advance += inc.amount;
      else dest.income += inc.amount; // member
    });

    expenses.forEach(exp => {
      if (exp.paidBy === 'fund' || exp.paidBy === 'advance') {
         stats.general.expense += exp.amount;
      } else if (stats.groups[exp.paidBy]) {
         stats.groups[exp.paidBy].expense += exp.amount;
      }
    });

    stats.general.balance = stats.general.income + stats.general.sponsor + stats.general.advance - stats.general.expense;
    Object.values(stats.groups).forEach(g => {
      g.balance = g.income + g.sponsor + g.advance - g.expense;
    });

    return stats;
  }, [incomes, expenses, trip.subGroups]);

  // 2. SETTLEMENT MATRIX (Quyết Toán Từng Người)
  const { summaryMatrix, globalStats } = useMemo(() => {
    const scopes = ['general', ...(trip.subGroups?.map(g => g.id) || [])];
    const sMat: Record<string, Record<string, { deposited: number; share: number; balance: number }>> = {};
    const gStats: Record<string, { deposited: number; share: number; balance: number }> = {};
    const sCredits: Record<string, Record<string, number>> = {};
    
    scopes.forEach(scope => {
      sMat[scope] = {};
      sCredits[scope] = {};
      participants.forEach(p => {
        sMat[scope][p.id] = { deposited: 0, share: 0, balance: 0 };
        sCredits[scope][p.id] = 0;
      });
    });
    
    participants.forEach(p => {
      gStats[p.id] = { deposited: 0, share: 0, balance: 0 };
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
          
          gStats[p.id].deposited += sMat[scope][p.id].deposited;
          gStats[p.id].share += sMat[scope][p.id].share;
          gStats[p.id].balance += sMat[scope][p.id].balance;
        }
      });
    });

    return { summaryMatrix: sMat, globalStats: gStats };
  }, [participants, incomes, expenses, trip.subGroups]);
  
  const totalSpent = expenses.filter(e => !e.isSponsored).reduce((sum, item) => sum + item.amount, 0);
  const totalSponsored = expenses.filter(e => e.isSponsored).reduce((sum, item) => sum + item.amount, 0);
  const totalSponsorIncome = incomes.filter(i => i.type === 'sponsor').reduce((sum, item) => sum + item.amount, 0);
  
  const totalAdvanceIncome = incomes.filter(i => i.type === 'advance').reduce((sum, item) => sum + item.amount, 0);
  const totalAdvanceExpense = expenses.filter(e => e.paidBy === 'advance').reduce((sum, item) => sum + item.amount, 0);
  const advanceRemaining = totalAdvanceIncome - totalAdvanceExpense;
  
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Global sheet
    const wsDataGlobal = participants.map(p => {
      const data = globalStats[p.id];
      if (!data) return {};
      return {
        'Thành viên': p.name,
        'Tổng đã đóng / hỗ trợ (VNĐ)': data.deposited,
        'Tổng thực chi phần mình (VNĐ)': data.share,
        'Trạng thái': data.balance === 0 ? 'Vừa đủ' : (data.balance < 0 ? 'Cần đóng thêm' : 'Được hoàn lại'),
        'Cần thu / Trả lại (VNĐ)': Math.abs(data.balance)
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsDataGlobal), "Tổng Hợp Quyết Toán");

    // 2. General sheet
    const wsDataGeneral = participants.map(p => {
      const data = summaryMatrix['general']?.[p.id];
      if (!data) return null;
      if (data.deposited === 0 && data.share === 0 && data.balance === 0) return null;
      return {
        'Thành viên': p.name,
        'Đã đóng / tự xử lý (VNĐ)': data.deposited,
        'Thực chi phần chịu (VNĐ)': data.share,
        'Trạng thái': data.balance === 0 ? 'Vừa đủ' : (data.balance < 0 ? 'Cần đóng thêm' : 'Được hoàn lại'),
        'Cần thu / Trả lại (VNĐ)': Math.abs(data.balance)
      };
    }).filter(Boolean);
    if (wsDataGeneral.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsDataGeneral), "Quỹ Cả Đoàn");
    }

    // 3. Subgroups sheet
    trip.subGroups?.forEach(g => {
       const sgParts = participants.filter(p => g.members.includes(p.id));
       const wsDataGroup = sgParts.map(p => {
          const data = summaryMatrix[g.id]?.[p.id];
          if (!data) return null;
          if (data.deposited === 0 && data.share === 0 && data.balance === 0) return null;
          return {
            'Thành viên': p.name,
            'Đã đóng / tự xử lý (VNĐ)': data.deposited,
            'Thực chi phần chịu (VNĐ)': data.share,
            'Trạng thái': data.balance === 0 ? 'Vừa đủ' : (data.balance < 0 ? 'Cần đóng thêm' : 'Được hoàn lại'),
            'Cần thu / Trả lại (VNĐ)': Math.abs(data.balance)
          };
       }).filter(Boolean);
       if (wsDataGroup.length > 0) {
         // Sheet name max 31 chars limit in excel
         const sheetName = `Quỹ ${g.name}`.substring(0, 31);
         XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsDataGroup), sheetName);
       }
    });

    XLSX.writeFile(wb, "QuyetToan.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(removeVietnameseTones("BAO CAO QUYET TOAN TOAN CHIEN DI"), 14, 15);
    doc.setFontSize(10);
    doc.text(removeVietnameseTones(`Tong thu nhom: ${formatCurrency(fundStats.general.income)}`), 14, 25);
    doc.text(removeVietnameseTones(`Tong chi nhom: ${formatCurrency(fundStats.general.expense)}`), 14, 30);
    doc.text(removeVietnameseTones(`Tong tai tro: ${formatCurrency(totalSponsored + totalSponsorIncome)}`), 14, 35);
    
    if (advanceRemaining !== 0) {
      doc.text(removeVietnameseTones(`Ke toan/Tam ung can hoan: ${formatCurrency(advanceRemaining)}`), 14, 40);
    }
    
    let startY = advanceRemaining !== 0 ? 45 : 40;
    
    autoTable(doc, {
      startY,
      head: [[
        removeVietnameseTones('Thanh vien'), 
        removeVietnameseTones('Tong dong'), 
        removeVietnameseTones('Tong thuc chi'), 
        removeVietnameseTones('Can thu/Tra lai')
      ]],
      body: participants.map(p => {
        const data = globalStats[p.id];
        if (!data) return [removeVietnameseTones(p.name), "0", "0", ""];
        let status = '';
        if (data.balance === 0) status = 'Vua du';
        else if (data.balance < 0) status = `- ${formatCurrency(Math.abs(data.balance))} (Thu them)`;
        else status = `+ ${formatCurrency(Math.abs(data.balance))} (Tra lai)`;
        return [removeVietnameseTones(p.name), formatCurrency(data.deposited), formatCurrency(data.share), status];
      }),
    });

    doc.save("QuyetToan.pdf");
  };

  const exportImage = async () => {
    if (!summaryRef.current) return;
    try {
      const dataUrl = await toPng(summaryRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `quyet-toan-${removeVietnameseTones(trip.name || 'chuyen-di')}.png`;
      link.href = dataUrl;
      link.click();
    } catch(err) {
      console.error(err);
      alert('Lỗi xuất ảnh!');
    }
  };

  const exportImageById = async (id: string, fileName: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch(err) {
      console.error(err);
      alert('Lỗi xuất ảnh chi tiết!');
    }
  };

  const renderTable = (parts: Participant[], title: string, dataSource: Record<string, { deposited: number; share: number; balance: number }>, key: string) => {
    let filteredParts = parts;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filteredParts = parts.filter(p => p.name.toLowerCase().includes(q));
    }

    if (filteredParts.length === 0) return null;
    
    let totalDeposited = 0;
    let totalShare = 0;
    let totalBalance = 0;
    
    filteredParts.forEach(p => {
      if (dataSource[p.id]) {
        totalDeposited += dataSource[p.id].deposited;
        totalShare += dataSource[p.id].share;
        totalBalance += dataSource[p.id].balance;
      }
    });

    if (totalDeposited === 0 && totalShare === 0 && totalBalance === 0 && key !== 'global') {
       return null; // Don't render empty sub-tables if no activity
    }

    return (
      <div id={`export-table-${key}`} key={key} className="mb-8 last:mb-0 border border-slate-200 rounded-xl overflow-hidden shadow-sm mx-4 sm:mx-6 mb-6 pb-2 bg-white">
        <div className="bg-slate-100/80 px-4 py-3 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold">{filteredParts.length} thành viên</span>
          </div>
          <button 
             onClick={() => exportImageById(`export-table-${key}`, `quyet-toan-${removeVietnameseTones(key)}`)}
             title="Xuất ảnh bảng này"
             className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded flex items-center gap-1 transition-colors"
          >
             <Download className="w-3 h-3" />
             <span className="text-[10px] font-bold">Xuất Ảnh</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-slate-100">
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-1/4">Thành viên</th>
                <th className="py-3 px-4 text-right w-1/4">Đã đóng / Tự xử lý</th>
                <th className="py-3 px-4 text-right w-1/4">Thực chi (Phần chịu)</th>
                <th className="py-3 px-4 text-right w-1/4">Cần thu / Hoàn trả</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {filteredParts.map(p => {
                const data = dataSource[p.id];
                if (!data) return null;
                const absBalance = Math.abs(data.balance);
                const isOwe = data.balance <= -0.5; 
                const isRefund = data.balance >= 0.5; 
                
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors bg-white">
                    <td className="py-3 px-4 font-bold text-slate-700">{p.name}</td>
                    <td className="py-3 px-4 text-right">
                       <span className="text-emerald-600 font-medium">{formatCurrency(data.deposited)}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 font-medium">{formatCurrency(data.share)}</td>
                    <td className="py-3 px-4 text-right">
                      {isOwe && (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-rose-600">- {formatCurrency(absBalance)}</span>
                          <span className="text-[10px] text-slate-400 italic">Cần thu thêm</span>
                        </div>
                      )}
                      {isRefund && (
                         <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-indigo-600">+ {formatCurrency(absBalance)}</span>
                          <span className="text-[10px] text-slate-400 italic">Hoàn trả lại</span>
                        </div>
                      )}
                      {!isOwe && !isRefund && (
                        <div className="flex flex-col items-end mt-1.5">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded">Vừa đủ / Cân bằng</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t border-slate-200">
              <tr>
                <td className="py-3 px-4 font-bold text-slate-700 text-xs uppercase">TỔNG CỘNG</td>
                <td className="py-3 px-4 text-right">
                   <div className="font-bold text-emerald-600">{formatCurrency(totalDeposited)}</div>
                </td>
                <td className="py-3 px-4 text-right font-bold text-rose-600">{formatCurrency(totalShare)}</td>
                <td className="py-3 px-4 text-right">
                   {totalBalance <= -0.5 ? (
                      <span className="text-xs font-bold text-rose-600">- {formatCurrency(Math.abs(totalBalance))}</span>
                   ) : totalBalance >= 0.5 ? (
                      <span className="text-xs font-bold text-indigo-600">+ {formatCurrency(Math.abs(totalBalance))}</span>
                   ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Cân bằng</span>
                   )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
         <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Tình Hình Quỹ (Tiền mặt / Chuyển khoản thu vào)</h2>
      </div>

      {/* Quỹ Đoàn */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
         <div className="bg-indigo-600 p-5 rounded-2xl text-white shadow-sm relative overflow-hidden">
           <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
           <p className="text-xs font-medium opacity-80 uppercase tracking-wider mb-1">Cả đoàn - Đã Thu</p>
           <p className="text-2xl font-bold">{formatCurrency(fundStats.general.income + fundStats.general.sponsor)}</p>
           {fundStats.general.sponsor > 0 && <p className="text-[10px] bg-white/20 px-2 py-0.5 rounded mt-1 inline-block">Gồm {formatCurrency(fundStats.general.sponsor)} tài trợ</p>}
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
           <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Cả đoàn - Đã Chi</p>
           <p className="text-2xl font-bold text-rose-600">{formatCurrency(fundStats.general.expense)}</p>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
           <div className={`absolute left-0 top-0 bottom-0 w-1 ${fundStats.general.balance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
           <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Cả đoàn - Còn Lại</p>
           <p className={`text-2xl font-bold ${fundStats.general.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
             {formatCurrency(fundStats.general.balance)}
           </p>
         </div>
      </div>

      {/* Quỹ Từng Nhóm */}
      {Object.values(fundStats.groups).map((g: any) => (
        <div key={g.name} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
           <div className="bg-sky-600 p-4 rounded-xl text-white shadow-sm relative overflow-hidden">
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
             <p className="text-[10px] font-medium opacity-80 uppercase tracking-wider mb-1">Nhóm {g.name} - Đã Thu</p>
             <p className="text-xl font-bold">{formatCurrency(g.income + g.sponsor)}</p>
             {g.sponsor > 0 && <p className="text-[10px] bg-white/20 px-2 py-0.5 rounded mt-1 inline-block">Gồm {formatCurrency(g.sponsor)} tài trợ</p>}
           </div>
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Nhóm {g.name} - Đã Chi</p>
             <p className="text-xl font-bold text-rose-600">{formatCurrency(g.expense)}</p>
           </div>
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className={`absolute left-0 top-0 bottom-0 w-1 ${g.balance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
             <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Nhóm {g.name} - Còn Lại</p>
             <p className={`text-xl font-bold ${g.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
               {formatCurrency(g.balance)}
             </p>
           </div>
        </div>
      ))}

      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        {advanceRemaining !== 0 && (
          <div className="flex-1 bg-orange-50 p-4 rounded-xl border border-orange-200 flex items-center justify-between shadow-sm">
            <span className="text-sm font-bold text-orange-800 uppercase tracking-wider">Kế toán / Tạm ứng cần hoàn lại:</span>
            <span className="font-bold text-orange-600">{formatCurrency(advanceRemaining)}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Bảng Quyết Toán Cá Nhân</h2>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm tên thành viên..."
              className="px-3 py-1.5 min-w-[200px] bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button 
              onClick={exportImage}
              className="text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 flex items-center gap-1 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Download className="w-4 h-4" /> Xuất Ảnh
            </button>
            <button 
              onClick={exportExcel}
              className="text-xs font-bold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              Xuất Excel
            </button>
            <button 
               onClick={exportPDF}
              className="text-xs font-bold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              Xuất PDF
            </button>
          </div>
        </div>
        
        {participants.length === 0 ? (
           <div className="p-8 text-center text-slate-400 flex flex-col items-center">
             <Ban className="w-12 h-12 text-slate-200 mb-2" />
             <p className="text-sm italic">Chưa có thành viên nào.</p>
           </div>
        ) : (
          <div ref={summaryRef} className="bg-white">
            <div className="p-4 sm:p-6 pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">{trip.name?.toUpperCase() || 'QUYẾT TOÁN CÁ NHÂN'}</h3>
                <p className="text-sm text-slate-500">
                  Tổng hợp mọi khoản đóng góp, ứng trước và đối trừ phần chịu chi phí.
                </p>
              </div>
            </div>
            <div className="p-0">
               {renderTable(participants, 'TỔNG TOÀN BỘ (DÀNH CHO CÁ NHÂN)', globalStats, 'global')}

               <div className="px-4 py-3 mx-4 sm:mx-6 mt-6 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase rounded-lg mb-4 text-center tracking-wider">
                  Bảng Chi Tiết Phần Phân Bổ (Tham khảo)
               </div>

               {renderTable(participants, 'Chi tiết: Quỹ Cả Đoàn', summaryMatrix['general'], 'general')}

               {/* Render subgroups */}
               {trip.subGroups?.map(sg => {
                 const sgParts = participants.filter(p => sg.members.includes(p.id));
                 return renderTable(sgParts, `Chi tiết: Quỹ Nhóm ${sg.name}`, summaryMatrix[sg.id] || {}, sg.id);
               })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
