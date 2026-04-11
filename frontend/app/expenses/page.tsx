'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { employeeApi, getCurrentUser, logout, isAuthenticated, isAdmin, Project } from '@/lib/api';
import { useRouter } from 'next/navigation';
import LiveClock from '@/components/LiveClock';

const formatLocalDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateShort = (date: Date) => {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
};

interface ExpenseWeeklyRow {
  projectCode: string;
  projectName: string;
  expenseType: string;
  projectId: number | null;
  dayEntries: Record<string, { id?: number; amount: number } | null>; 
  rowTotal: number;
  isNew?: boolean;
}

const EXPENSE_TYPES = ['Travel', 'Food', 'Accommodation', 'Others'] as const;
type ExpenseType = typeof EXPENSE_TYPES[number];

export default function Expenses() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [weekAnchorDate, setWeekAnchorDate] = useState(() => getWeekStart(new Date()));
  const [weeklyRows, setWeeklyRows] = useState<ExpenseWeeklyRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

  // Add Row state
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowProject, setNewRowProject] = useState<Project | null>(null);
  const [newRowExpenseType, setNewRowExpenseType] = useState<ExpenseType>('Travel');
  const [projectSearch, setProjectSearch] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Delete Confirmation state
  const [deleteConfirmRowIdx, setDeleteConfirmRowIdx] = useState<number | null>(null);

  // Hide Project Confirmation state
  const [hideConfirmProject, setHideConfirmProject] = useState<Project | null>(null);
  
  // Unhide Project Confirmation state - NEW
  const [unhideConfirmProject, setUnhideConfirmProject] = useState<Project | null>(null);

  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oldestAllowed = new Date(today);
  oldestAllowed.setDate(today.getDate() - 14);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getCurrentUser();
    if (isAdmin()) {
      router.push('/admin');
      return;
    }

    setUser(currentUser);
    loadProjects();
    loadWeeklyData(weekAnchorDate);
  }, [router, weekAnchorDate]);

  const loadProjects = async () => {
    try {
      const data = await employeeApi.getAllProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const handleHideProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setHideConfirmProject(project);
  };

  const executeHideProject = async (projectId: number) => {
    try {
      setSaving(true);
      await employeeApi.hideProject(projectId);
      // Reload projects to get fresh hidden status
      await loadProjects();
      setFilteredProjects([]);
      setSuccess('Project hidden from your list');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to hide project:', err);
      setError('Failed to hide project');
    } finally {
      setSaving(false);
      setHideConfirmProject(null);
    }
  };

  // NEW: Unhide handlers
  const handleUnhideProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setUnhideConfirmProject(project);
  };

  const executeUnhideProject = async (projectId: number) => {
    try {
      setSaving(true);
      await employeeApi.unhideProject(projectId);
      // Reload projects to restore visibility
      await loadProjects();
      setFilteredProjects(prev => prev.filter(p => p.id !== projectId ? p : { ...p, hidden: false }));
      setSuccess('Project unhidden and restored to normal');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to unhide project:', err);
      setError('Failed to unhide project');
    } finally {
      setSaving(false);
      setUnhideConfirmProject(null);
    }
  };

  const loadWeeklyData = async (anchor: Date) => {
    setLoading(true);
    setError(null);
    try {
      const weekStr = formatLocalDate(anchor);
      const data = await employeeApi.getMyExpenses(weekStr);
      
      const rowsMap = new Map<string, ExpenseWeeklyRow>();
      
      (data.expenses || []).forEach((entry: any) => {
        const key = `${entry.project_code || '-'}||${entry.project_name || '-'}||${entry.expense_type}`;
        if (!rowsMap.has(key)) {
          rowsMap.set(key, {
            projectCode: entry.project_code || '-',
            projectName: entry.project_name || '-',
            expenseType: entry.expense_type,
            projectId: entry.project_id,
            dayEntries: {},
            rowTotal: 0,
          });
        }
        const row = rowsMap.get(key)!;
        row.dayEntries[entry.date] = { id: entry.id, amount: entry.amount };
        row.rowTotal += entry.amount;
      });

      setWeeklyRows(Array.from(rowsMap.values()).sort((a, b) =>
        `${a.projectCode}-${a.projectName}`.localeCompare(`${b.projectCode}-${b.projectName}`)
      ));
    } catch (err) {
      setError('Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRow = async (rowIdx: number) => {
    const row = weeklyRows[rowIdx];
    const hasEntries = Object.values(row.dayEntries).some(e => e !== null && e !== undefined);
    
    setSaving(true);
    setError(null);
    try {
      if (hasEntries) {
        for (const entry of Object.values(row.dayEntries)) {
          if (entry && entry.id) {
            await employeeApi.deleteExpense(entry.id);
          }
        }
      }
      
      const updated = [...weeklyRows];
      updated.splice(rowIdx, 1);
      setWeeklyRows(updated);
      setSuccess('Row deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete row entries');
    } finally {
      setSaving(false);
      setDeleteConfirmRowIdx(null);
    }
  };

  const confirmDelete = (rowIdx: number) => {
    setDeleteConfirmRowIdx(rowIdx);
  };

  const weekDates = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(weekAnchorDate);
    d.setDate(d.getDate() + idx);
    return d;
  });

  const handleCellChange = async (rowIdx: number, dateKey: string, value: string) => {
    const amount = value === '' ? 0 : parseFloat(value);
    if (isNaN(amount) || amount < 0) return;

    const updatedRows = [...weeklyRows];
    const row = updatedRows[rowIdx];
    const existingEntry = row.dayEntries[dateKey];

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const weekStr = formatLocalDate(weekAnchorDate);
      
      if (amount === 0) {
        if (existingEntry && existingEntry.id) {
          await employeeApi.deleteExpense(existingEntry.id);
          delete row.dayEntries[dateKey];
        }
      } else {
        const saveData = {
          ...(existingEntry?.id && { id: existingEntry.id }),
          project_id: row.projectId!,
          expense_type: row.expenseType,
          date: dateKey,
          amount,
          week_start_date: weekStr
        };
        
        await employeeApi.saveExpense(saveData);
        
        row.dayEntries[dateKey] = { id: existingEntry?.id, amount };
      }

      // Recalculate row total
      row.rowTotal = Object.values(row.dayEntries).reduce((sum, entry) => sum + (entry?.amount || 0), 0);
      setWeeklyRows(updatedRows);
      setSuccess('Updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = () => {
    if (!newRowProject) {
      setError('Project is required');
      return;
    }

    const key = `${newRowProject.code}||${newRowProject.name}||${newRowExpenseType}`;
    if (weeklyRows.some(r => `${r.projectCode}||${r.projectName}||${r.expenseType}` === key)) {
      setError('This project and expense type combination already exists');
      return;
    }

    const newRow: ExpenseWeeklyRow = {
      projectCode: newRowProject.code,
      projectName: newRowProject.name,
      expenseType: newRowExpenseType,
      projectId: newRowProject.id,
      dayEntries: {},
      rowTotal: 0,
    };

    setWeeklyRows([...weeklyRows, newRow].sort((a, b) =>
      `${a.projectCode}-${a.projectName}`.localeCompare(`${b.projectCode}-${b.projectName}`)
    ));

    setNewRowProject(null);
    setNewRowExpenseType('Travel');
    setProjectSearch('');
    setShowAddRow(false);
    setError(null);
  };

  const handleProjectSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setProjectSearch(val);
    if (!val.trim()) {
      setFilteredProjects([]);
      setShowProjectDropdown(false);
      return;
    }
    const filtered = projects.filter(p =>
      p.code.toLowerCase().includes(val.toLowerCase()) ||
      p.name.toLowerCase().includes(val.toLowerCase())
    );
    setFilteredProjects(filtered);
    setShowProjectDropdown(true);
  };

  const selectProject = (p: Project) => {
    setNewRowProject(p);
    setProjectSearch(`${p.code} - ${p.name}`);
    setShowProjectDropdown(false);
  };

  const isDateEditable = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d >= oldestAllowed && d <= today;
  };

  const dailyTotals = weekDates.map(date => {
    const key = formatLocalDate(date);
    return weeklyRows.reduce((sum, row) => sum + (row.dayEntries[key]?.amount || 0), 0);
  });
  const grandTotal = dailyTotals.reduce((sum, t) => sum + t, 0);

  // Pagination logic
  const totalRows = weeklyRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = weeklyRows.slice(startIndex, startIndex + rowsPerPage);
  const startItem = totalRows === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + rowsPerPage, totalRows);

  useEffect(() => {
    setCurrentPage(1);
  }, [weeklyRows]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="glass-panel flex-1 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Expenses</h2>
              <p className="text-slate-600">Log your weekly expenses by project</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-800">{user.name}</p>
              <p className="text-sm text-slate-500"><LiveClock /></p>
            </div>
          </div>
        </div>

        {/* Global Messages */}
        {error && (
          <div className="glass-panel bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="glass-panel bg-emerald-50/80 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-4 text-center">
            {success}
          </div>
        )}

        {/* Week Selector */}
        <div className="flex justify-center items-center gap-4 mb-6">
          <button
            onClick={() => {
              const prev = new Date(weekAnchorDate);
              prev.setDate(prev.getDate() - 7);
              setWeekAnchorDate(prev);
            }}
            className="p-2 rounded-xl bg-white/80 border border-slate-200 hover:bg-slate-50 transition shadow-sm"
          >
            ◀ Previous Week
          </button>
          <div className="glass-panel px-6 py-2 rounded-2xl font-bold text-slate-800 shadow-sm border border-white/60">
            {formatDateShort(weekDates[0])} — {formatDateShort(weekDates[6])}
          </div>
          <button
            onClick={() => {
              const next = new Date(weekAnchorDate);
              next.setDate(next.getDate() + 7);
              setWeekAnchorDate(next);
            }}
            className="p-2 rounded-xl bg-white/80 border border-slate-200 hover:bg-slate-50 transition shadow-sm"
          >
            Next Week ▶
          </button>
        </div>

        {/* Weekly Grid */}
        <div className="glass-panel rounded-3xl p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Weekly Expenses</h3>
            <button
              onClick={() => setShowAddRow(true)}
              className="glass-primary-btn px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              <span className="text-lg">+</span> Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-2 py-2 text-left font-bold text-slate-600 border-b border-slate-100 min-w-[80px]">Project Code</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600 border-b border-slate-100 min-w-[120px]">Project Name</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600 border-b border-slate-100 min-w-[140px]">Expense Type</th>
                  {weekDates.map((date) => (
                    <th key={date.toISOString()} className="px-1 py-2 text-center font-bold text-slate-600 border-b border-slate-100 min-w-[65px]">
                      <div className="text-[10px] uppercase opacity-70 leading-none">{date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="text-xs">{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold text-slate-600 border-b border-slate-100 min-w-[70px]">Total</th>
                  <th className="px-2 py-2 text-center font-bold text-slate-600 border-b border-slate-100 min-w-[40px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {totalRows === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400 italic">
                      No expense rows added for this week. Click "Add Row" to start logging.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, pIdx) => {
                    const rowIdx = startIndex + pIdx;
                    return (
                      <tr key={`${row.projectCode}-${row.expenseType}-${rowIdx}`} className="hover:bg-slate-50/40 transition">
                        <td className="px-2 py-2 text-slate-700 font-medium">{row.projectCode}</td>
                        <td className="px-2 py-2 text-slate-600 text-xs truncate max-w-[120px]" title={row.projectName}>{row.projectName}</td>
                        <td className="px-2 py-2 text-slate-600 font-medium">{row.expenseType}</td>
                        {weekDates.map((date) => {
                          const dateKey = formatLocalDate(date);
                          const entry = row.dayEntries[dateKey];
                          const editable = isDateEditable(date);
                          return (
                            <td key={dateKey} className="px-1 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="999.99"
                                defaultValue={entry ? entry.amount.toFixed(2) : ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (entry ? entry.amount.toFixed(2) : '')) {
                                    handleCellChange(rowIdx, dateKey, e.target.value);
                                  }
                                }}
                                disabled={!editable || saving}
                                placeholder="0.00"
                                className={`w-full text-right py-1.5 rounded-lg border focus:outline-none transition-all
                                  ${!editable ? 'bg-slate-50 border-transparent text-slate-400 cursor-not-allowed' :
                                    'bg-white border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100'}`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-bold text-emerald-700">
${row.rowTotal.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => confirmDelete(rowIdx)}
                            disabled={saving}
                            className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-50"
                            title="Delete Row"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {totalRows > 0 && (
                <tfoot className="bg-slate-50/50">
                  <tr className="font-bold border-t-2 border-slate-200">
                    <td className="px-2 py-4 text-slate-800" colSpan={3}>Totals</td>
                    {dailyTotals.map((total, idx) => (
                      <td key={idx} className="px-1 py-4 text-center text-emerald-700">
{total > 0 ? `${total.toFixed(2)}` : '-'}
                      </td>
                    ))}
                    <td className="px-2 py-4 text-center text-emerald-900 bg-emerald-50/50">
${grandTotal.toFixed(2)}
                    </td>
                    <td className="px-2 py-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination Controls */}
          {totalRows > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-4">
                <label htmlFor="rows-per-page" className="text-sm text-slate-600 font-medium">
                  Rows per page
                </label>
                <select
                  id="rows-per-page"
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold text-slate-700"
                >
                  {ROWS_PER_PAGE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-slate-500 font-medium">
                  Showing <span className="text-slate-900 font-bold">{startItem}–{endItem}</span> of <span className="text-slate-900 font-bold">{totalRows}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  ← Previous
                </button>
                <div className="flex items-center px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-2">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-slate-700">💡 Tip: Expenses are automatically included in client invoices (always billable).</p>
              <p>* You can only edit entries for the last 14 days.</p>
            </div>
<p className="text-right">All amounts in $. Step: $0.01 | Max: $999.99 per day</p>
          </div>
        </div>

        {/* Add Row Modal */}
        {showAddRow && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Add Expense Row</h3>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Project</label>
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={handleProjectSearchChange}
                    onFocus={() => projectSearch.trim().length > 0 && setShowProjectDropdown(true)}
                    placeholder="Search by code or name..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white/50"
                  />
                  {showProjectDropdown && filteredProjects.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 glass-panel border border-slate-200 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
{filteredProjects.map(p => (
                        <div
                          key={p.id}
                          onClick={() => selectProject(p)}
                          className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition border-b border-slate-50 last:border-0 flex justify-between items-center group cursor-pointer
                            ${p.hidden ? 'opacity-50 text-gray-400' : ''}`}
                        >
                          <div>
                            <div className={`font-bold ${p.hidden ? 'text-gray-500' : 'text-slate-800'}`}>{p.code}</div>
                            <div className={`text-xs ${p.hidden ? 'text-gray-400' : 'text-slate-500'}`}>{p.name}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {p.hidden ? (
                              <button
                                onClick={(e) => handleUnhideProject(e, p)}
                                className="text-green-600 hover:text-green-800 p-1.5 rounded-lg hover:bg-green-50 transition ml-1"
                                title="Unhide Project (✔)"
                              >
                                ✔
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleHideProject(e, p)}
                                className="p-1.5 opacity-40 hover:opacity-100 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition ml-2"
                                title="Hide from my list"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Expense Type</label>
                  <select
                    value={newRowExpenseType}
                    onChange={(e) => setNewRowExpenseType(e.target.value as ExpenseType)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white/50"
                  >
                    {EXPENSE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowAddRow(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRow}
                  className="flex-1 glass-primary-btn px-4 py-3 rounded-xl text-white font-bold transition"
                >
                  Create Row
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmRowIdx !== null && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Row?</h3>
                <p className="text-slate-600 mb-6 text-sm">
                  Are you sure you want to delete this expense row?
                  {weeklyRows[deleteConfirmRowIdx]?.rowTotal > 0 && " This row has expense amounts which will also be removed."}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteConfirmRowIdx(null)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteRow(deleteConfirmRowIdx)}
                    className="flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-red-600 transition shadow-lg shadow-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hide Project Confirmation Modal */}
        {hideConfirmProject !== null && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Hide Project?</h3>
                <p className="text-slate-600 mb-6 text-sm">
                  This will remove <strong>{hideConfirmProject.code}</strong> from your future selection dropdown. You can still see past entries for this project.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setHideConfirmProject(null)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeHideProject(hideConfirmProject.id)}
                    className="flex-1 bg-slate-800 text-white px-4 py-3 rounded-xl font-bold hover:bg-slate-900 transition shadow-lg shadow-slate-200"
                  >
                    Hide
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unhide Project Confirmation Modal - NEW */}
        {unhideConfirmProject !== null && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Unhide Project?</h3>
                <p className="text-slate-600 mb-6 text-sm">
                  Unhide <strong>{unhideConfirmProject.code}</strong> so it appears normally in your project list?
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setUnhideConfirmProject(null)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeUnhideProject(unhideConfirmProject.id)}
                    className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
                  >
                    Unhide ✔
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

