'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { employeeApi, getCurrentUser, logout, isAuthenticated, isAdmin, Project, WorkEntry } from '@/lib/api';
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
  const day = d.getDay(); // 0 Sun, 1 Mon...
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateShort = (date: Date) => {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
};

interface WeeklyRow {
  projectCode: string;
  projectName: string;
  task: string;
  projectId: number | null;
  dayEntries: Record<string, WorkEntry | null>; // dateKey -> WorkEntry
  rowTotal: number;
  isNew?: boolean;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [weekAnchorDate, setWeekAnchorDate] = useState(() => getWeekStart(new Date()));
  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [todaysTotal, setTodaysTotal] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

  // Add Row state
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowProject, setNewRowProject] = useState<Project | null>(null);
  const [newRowTask, setNewRowTask] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oldestAllowed = new Date(today);
  oldestAllowed.setDate(today.getDate() - 7);

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
    fetchTodaysTotal();
  }, [router, weekAnchorDate]);

  const fetchTodaysTotal = async () => {
    try {
      const todayStr = formatLocalDate(new Date());
      const data = await employeeApi.getMyWork(todayStr, todayStr);
      const total = (data.work_entries || []).reduce((sum: number, e: any) => sum + e.hours_worked, 0);
      setTodaysTotal(total);
    } catch (err) {
      console.error('Failed to fetch today total:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await employeeApi.getAllProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadWeeklyData = async (anchor: Date) => {
    setLoading(true);
    setError(null);
    try {
      const start = formatLocalDate(anchor);
      const end = new Date(anchor);
      end.setDate(end.getDate() + 6);
      const endStr = formatLocalDate(end);

      const data = await employeeApi.getMyWork(start, endStr);

      // Process entries into rows
      const rowsMap = new Map<string, WeeklyRow>();
      const entries = data.work_entries || [];

      entries.forEach((entry) => {
        const key = `${entry.project_code || '-'}||${entry.project_name || '-'}||${entry.description || ''}`;
        if (!rowsMap.has(key)) {
          rowsMap.set(key, {
            projectCode: entry.project_code || '-',
            projectName: entry.project_name || '-',
            task: entry.description || '',
            projectId: entry.project_id,
            dayEntries: {},
            rowTotal: 0,
          });
        }
        const row = rowsMap.get(key)!;
        row.dayEntries[entry.work_date] = entry;
        row.rowTotal += entry.hours_worked;
      });

      setWeeklyRows(Array.from(rowsMap.values()).sort((a, b) =>
        `${a.projectCode}-${a.projectName}`.localeCompare(`${b.projectCode}-${b.projectName}`)
      ));
    } catch (err) {
      setError('Failed to load work data');
    } finally {
      setLoading(false);
    }
  };

  const weekDates = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(weekAnchorDate);
    d.setDate(d.getDate() + idx);
    return d;
  });

  const handleCellChange = async (rowIdx: number, dateKey: string, value: string) => {
    const hours = value === '' ? 0 : parseFloat(value);
    if (isNaN(hours) || hours < 0 || hours > 24) return;

    const updatedRows = [...weeklyRows];
    const row = updatedRows[rowIdx];
    const existingEntry = row.dayEntries[dateKey];

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (hours === 0) {
        if (existingEntry) {
          await employeeApi.deleteWork(existingEntry.id);
          delete row.dayEntries[dateKey];
        }
      } else {
        if (existingEntry) {
          const updated = await employeeApi.editWork(existingEntry.id, {
            hours_worked: hours,
          });
          row.dayEntries[dateKey] = updated;
        } else {
          const created = await employeeApi.addWork({
            project_code: row.projectCode !== '-' ? row.projectCode : undefined,
            project_name: row.projectCode === '-' ? row.projectName : undefined,
            work_date: dateKey,
            hours_worked: hours,
            description: row.task,
            client_today: formatLocalDate(new Date())
          });
          row.dayEntries[dateKey] = created;
        }
      }

      // Recalculate row total
      row.rowTotal = Object.values(row.dayEntries).reduce((sum, entry) => sum + (entry?.hours_worked || 0), 0);
      setWeeklyRows(updatedRows);
      setSuccess('Updated successfully');

      // If the edited date is today, refresh the global "Today's Hours" card
      if (dateKey === formatLocalDate(new Date())) {
        fetchTodaysTotal();
      }

      // Clear success after a delay
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = () => {
    if (!newRowProject || !newRowTask.trim()) {
      setError('Project and Task are required');
      return;
    }

    const key = `${newRowProject.code}||${newRowProject.name}||${newRowTask.trim()}`;
    if (weeklyRows.some(r => `${r.projectCode}||${r.projectName}||${r.task}` === key)) {
      setError('This project and task combination already exists in the grid');
      return;
    }

    const newRow: WeeklyRow = {
      projectCode: newRowProject.code,
      projectName: newRowProject.name,
      task: newRowTask.trim(),
      projectId: newRowProject.id,
      dayEntries: {},
      rowTotal: 0,
    };

    setWeeklyRows([...weeklyRows, newRow].sort((a, b) =>
      `${a.projectCode}-${a.projectName}`.localeCompare(`${b.projectCode}-${b.projectName}`)
    ));

    // Reset add row state
    setNewRowProject(null);
    setNewRowTask('');
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
    return weeklyRows.reduce((sum, row) => sum + (row.dayEntries[key]?.hours_worked || 0), 0);
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
              <h2 className="text-2xl font-black text-slate-900">Timesheet</h2>
              <p className="text-slate-600">Log your working hours for the week</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-800">{user.name}</p>
              <p className="text-sm text-slate-500"><LiveClock /></p>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6 flex flex-col items-center justify-center min-w-[180px] bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100/50">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1">Today's Hours</p>
            <p className="text-4xl font-black text-slate-900">
              {todaysTotal.toFixed(1)}
            </p>
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
            <h3 className="text-lg font-bold text-slate-800">Weekly Hours</h3>
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
                  <th className="px-4 py-3 text-left font-bold text-slate-600 border-b border-slate-100 min-w-[120px]">Project Code</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 border-b border-slate-100 min-w-[150px]">Project Name</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 border-b border-slate-100 min-w-[200px]">Task performed</th>
                  {weekDates.map((date) => (
                    <th key={date.toISOString()} className="px-2 py-3 text-center font-bold text-slate-600 border-b border-slate-100 min-w-[80px]">
                      <div className="text-xs uppercase opacity-70">{date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div>{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-bold text-slate-600 border-b border-slate-100 min-w-[80px]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {totalRows === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400 italic">
                      No rows added for this week. Click "Add Row" to start logging.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, pIdx) => {
                    const rowIdx = startIndex + pIdx;
                    return (
                      <tr key={`${row.projectCode}-${row.task}-${rowIdx}`} className="hover:bg-slate-50/40 transition">
                        <td className="px-4 py-3 text-slate-700 font-medium">{row.projectCode}</td>
                        <td className="px-4 py-3 text-slate-600">{row.projectName}</td>
                        <td className="px-4 py-3 text-slate-600 group align-top">
                          <span className="block whitespace-pre-line break-words max-w-[200px]" title={row.task}>{row.task}</span>
                        </td>
                        {weekDates.map((date) => {
                          const dateKey = formatLocalDate(date);
                          const entry = row.dayEntries[dateKey];
                          const editable = isDateEditable(date);
                          return (
                            <td key={dateKey} className="px-1 py-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                defaultValue={entry ? entry.hours_worked : ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (entry ? entry.hours_worked.toString() : '')) {
                                    handleCellChange(rowIdx, dateKey, e.target.value);
                                  }
                                }}
                                disabled={!editable || saving}
                                placeholder="-"
                                className={`w-full text-center py-1.5 rounded-lg border focus:outline-none transition-all
                                  ${!editable ? 'bg-slate-50 border-transparent text-slate-400 cursor-not-allowed' :
                                    'bg-white border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100'}`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center font-bold text-slate-800">
                          {row.rowTotal.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {totalRows > 0 && (
                <tfoot className="bg-slate-50/50">
                  <tr className="font-bold border-t-2 border-slate-200">
                    <td className="px-4 py-4 text-slate-800" colSpan={3}>Totals</td>
                    {dailyTotals.map((total, idx) => (
                      <td key={idx} className="px-2 py-4 text-center text-blue-700">
                        {total > 0 ? total.toFixed(1) : '-'}
                      </td>
                    ))}
                    <td className="px-4 py-4 text-center text-blue-900 bg-blue-50/50">
                      {grandTotal.toFixed(1)}
                    </td>
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
              <p className="font-semibold text-slate-700">💡 Tip: Clicking anywhere on the screen after typing will automatically save your entry.</p>
              <p>* You can only edit entries for the last 7 days.</p>
            </div>
            <p className="text-right">Entries older than 7 days or in the future are locked.</p>
          </div>
        </div>

        {/* Add Row Modal */}
        {showAddRow && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Add New Row</h3>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Project Code/Name</label>
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={handleProjectSearchChange}
                    onFocus={() => projectSearch && setShowProjectDropdown(true)}
                    placeholder="Search by code or name..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50"
                  />
                  {showProjectDropdown && filteredProjects.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 glass-panel border border-slate-200 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                      {filteredProjects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => selectProject(p)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition border-b border-slate-50 last:border-0"
                        >
                          <div className="font-bold text-slate-800">{p.code}</div>
                          <div className="text-xs text-slate-500">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Task Performed</label>
                  <textarea
                    value={newRowTask}
                    onChange={(e) => setNewRowTask(e.target.value)}
                    placeholder="Describe what you worked on..."
                    rows={3}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50"
                  />
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
      </div>
    </div>
  );
}
