'use client';

import { useState, useEffect, useMemo } from 'react';
import { employeeApi, getCurrentUser, isAuthenticated } from '@/lib/api';
import { useRouter } from 'next/navigation';

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

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Weekly data
  const [weekAnchorDate, setWeekAnchorDate] = useState(() => getWeekStart(new Date()));
  const [workEntries, setWorkEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [localRows, setLocalRows] = useState<any[]>([]);

  // New row form
  const [newRowProjectCode, setNewRowProjectCode] = useState('');
  const [newRowProjectName, setNewRowProjectName] = useState('');
  const [newRowDescription, setNewRowDescription] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getCurrentUser();
    if (currentUser?.is_admin) {
      router.push('/admin');
      return;
    }

    setUser(currentUser);
    loadWeeklyData(weekAnchorDate);
    loadProjects();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router]);

  const loadWeeklyData = async (weekStart: Date) => {
    setLoading(true);
    setError(null);
    try {
      const start = formatLocalDate(weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const end = formatLocalDate(weekEnd);
      const data = await employeeApi.getMyWork(start, end);
      setWorkEntries(data.work_entries || []);
    } catch (err) {
      setError('Failed to load work data');
    } finally {
      setLoading(false);
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

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(weekAnchorDate);
      date.setDate(date.getDate() + idx);
      return date;
    });
  }, [weekAnchorDate]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oldestAllowed = new Date(today);
  oldestAllowed.setDate(today.getDate() - 7);

  const isDateEditable = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d >= oldestAllowed && d <= today;
  };

  // Group entries into rows for the grid
  const gridRows = useMemo(() => {
    const rowsMap = new Map<string, {
      projectCode: string;
      projectName: string;
      description: string;
      cells: Record<string, { totalHours: number; entries: any[] }>;
    }>();

    workEntries.forEach(entry => {
      const key = `${entry.project_code || ''}||${entry.description || ''}`;
      if (!rowsMap.has(key)) {
        rowsMap.set(key, {
          projectCode: entry.project_code || '',
          projectName: entry.project_name || '',
          description: entry.description || '',
          cells: {}
        });
      }

      const row = rowsMap.get(key)!;
      const dateKey = entry.work_date;
      if (!row.cells[dateKey]) {
        row.cells[dateKey] = { totalHours: 0, entries: [] };
      }
      row.cells[dateKey].totalHours += entry.hours_worked;
      row.cells[dateKey].entries.push(entry);
    });

    return Array.from(rowsMap.values()).sort((a, b) =>
      `${a.projectCode}-${a.description}`.localeCompare(`${b.projectCode}-${b.description}`)
    );
  }, [workEntries]);

  const handleCellChange = async (row: any, dateStr: string, newValue: string) => {
    const hours = parseFloat(newValue);
    if (isNaN(hours) && newValue !== '') return;

    // Valid hours check
    if (!isNaN(hours) && (hours < 0 || hours > 24)) {
      setError('Hours must be between 0 and 24');
      return;
    }

    const currentCell = row.cells[dateStr] || { totalHours: 0, entries: [] };
    const oldHours = currentCell.totalHours;
    const targetHours = isNaN(hours) ? 0 : hours;

    if (targetHours === oldHours) return;

    setSaving(`${row.projectCode}-${row.description}-${dateStr}`);
    setError(null);
    setSuccess(null);

    try {
      if (targetHours === 0) {
        // Delete all entries for this cell
        for (const entry of currentCell.entries) {
          await employeeApi.deleteWork(entry.id);
        }
      } else if (currentCell.entries.length > 0) {
        // Update first entry, delete others if any
        await employeeApi.editWork(currentCell.entries[0].id, {
          hours_worked: targetHours
        });
        for (let i = 1; i < currentCell.entries.length; i++) {
          await employeeApi.deleteWork(currentCell.entries[i].id);
        }
      } else {
        // Create new entry
        await employeeApi.addWork({
          project_code: row.projectCode,
          work_date: dateStr,
          hours_worked: targetHours,
          description: row.description,
          client_today: formatLocalDate(new Date())
        });
      }

      // Reload weekly data to reflect changes
      await loadWeeklyData(weekAnchorDate);
      setSuccess('Updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update hours');
    } finally {
      setSaving(null);
    }
  };

  const handleProjectCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setNewRowProjectCode(code);
    const filtered = projects.filter(p => p.code.toUpperCase().includes(code.toUpperCase()));
    setFilteredProjects(filtered);
    setShowProjectDropdown(true);
  };

  const selectProject = (project: any) => {
    setNewRowProjectCode(project.code);
    setNewRowProjectName(project.name);
    setShowProjectDropdown(false);
  };

  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRowProjectCode || !newRowDescription) {
      setError('Please select a project and enter a task description');
      return;
    }

    // Just check if the row already exists in the grid to avoid duplicates
    const key = `${newRowProjectCode}||${newRowDescription}`;
    if (gridRows.some(row => `${row.projectCode}||${row.description}` === key)) {
      setError('This project/task combination already exists in the grid');
      return;
    }

    // Add a virtual row or just reset form and let user type in the grid?
    // The user needs an entry to exist in the grid. To show a row, we need at least one entry?
    // Actually, we can maintain a "additionalRows" state for rows with 0 hours.
    // For now, let's just clear the form and let the grid render handle it if we add a "dummy" entry?
    // No, cleaner to just reset form and the user can now see it if we store it in a local state.

    // To make it simple, let's just add the row to the display and wait for them to enter hours.
    setNewRowProjectCode('');
    setNewRowProjectName('');
    setNewRowDescription('');
    setError(null);
    setSuccess('New line added. Enter hours in the grid.');

    // We'll need a way to show rows that have 0 hours but were "added".
    // I'll add a 'localRows' state.
    setLocalRows(prev => [...prev, {
      projectCode: newRowProjectCode,
      projectName: newRowProjectName,
      description: newRowDescription
    }]);
  };

  const allRows = useMemo(() => {
    const combined = [...gridRows];
    localRows.forEach(local => {
      const exists = gridRows.some(r => r.projectCode === local.projectCode && r.description === local.description);
      if (!exists) {
        combined.push({
          ...local,
          cells: {}
        });
      }
    });
    return combined.sort((a, b) =>
      `${a.projectCode}-${a.description}`.localeCompare(`${b.projectCode}-${b.description}`)
    );
  }, [gridRows, localRows]);

  if (!user) return null;

  return (
    <div className="min-h-screen py-8 px-4 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="glass-panel rounded-3xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Weekly Time Logging</h2>
            <p className="text-slate-600">Welcome, {user.name} | {currentTime.toLocaleTimeString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const prev = new Date(weekAnchorDate);
                prev.setDate(prev.getDate() - 7);
                setWeekAnchorDate(prev);
                loadWeeklyData(prev);
                setLocalRows([]);
              }}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              ◀
            </button>
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700">
              {formatLocalDate(weekDates[0])} - {formatLocalDate(weekDates[6])}
            </div>
            <button
              onClick={() => {
                const next = new Date(weekAnchorDate);
                next.setDate(next.getDate() + 7);
                setWeekAnchorDate(next);
                loadWeeklyData(next);
                setLocalRows([]);
              }}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              ▶
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        <div className="glass-panel rounded-3xl overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider">Task Description</th>
                  {weekDates.map(date => (
                    <th key={date.toISOString()} className="px-2 py-3 text-center font-bold text-slate-700 min-w-[80px]">
                      <div className="text-[10px] uppercase text-slate-500 font-medium">
                        {date.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="text-sm">
                        {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {allRows.map((row, idx) => {
                  let rowTotal = 0;
                  return (
                    <tr key={`${row.projectCode}-${row.description}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-slate-800">{row.projectCode}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{row.projectName}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-slate-700 whitespace-pre-wrap">{row.description}</div>
                      </td>
                      {weekDates.map(date => {
                        const dateStr = formatLocalDate(date);
                        const isEditable = isDateEditable(date);
                        const cellData = row.cells[dateStr] || { totalHours: 0 };
                        rowTotal += cellData.totalHours;
                        const isThisCellSaving = saving === `${row.projectCode}-${row.description}-${dateStr}`;

                        return (
                          <td key={dateStr} className="px-1 py-3 text-center">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              disabled={!isEditable || isThisCellSaving}
                              defaultValue={cellData.totalHours || ''}
                              onBlur={(e) => handleCellChange(row, dateStr, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className={`w-14 text-center py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${!isEditable
                                ? 'bg-slate-50 text-slate-400 border-transparent cursor-not-allowed'
                                : isThisCellSaving
                                  ? 'bg-blue-50 border-blue-200 animate-pulse'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              placeholder="-"
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center align-middle">
                        <span className="font-black text-slate-900 text-lg">
                          {rowTotal > 0 ? rowTotal.toFixed(1) : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {allRows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500 bg-white italic">
                      No entries for this week. Use the form below to add a new line.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500 bg-white">
                      Loading your week...
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-black">
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-slate-700 uppercase tracking-wider">Daily Totals</td>
                  {weekDates.map(date => {
                    const dateStr = formatLocalDate(date);
                    const dayTotal = allRows.reduce((sum, row) => sum + (row.cells[dateStr]?.totalHours || 0), 0);
                    return (
                      <td key={dateStr} className="px-2 py-4 text-center text-blue-700">
                        {dayTotal > 0 ? dayTotal.toFixed(1) : '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 text-center text-blue-900 text-xl">
                    {allRows.reduce((sum, row) => sum + Object.values(row.cells).reduce((s: number, c: any) => s + (c.totalHours || 0), 0), 0).toFixed(1)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Add New Line Form */}
        <div className="glass-panel rounded-3xl p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Add New Activity Line</h3>
          <form onSubmit={handleAddRow} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4 relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Project Code</label>
              <input
                type="text"
                value={newRowProjectCode}
                onChange={handleProjectCodeChange}
                onFocus={() => setShowProjectDropdown(true)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search Project Code..."
              />
              {newRowProjectName && <div className="text-[10px] text-blue-600 mt-1 ml-1 font-medium">{newRowProjectName}</div>}

              {showProjectDropdown && filteredProjects.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 bg-white border border-slate-200 rounded-xl mb-1 shadow-xl z-20 max-h-48 overflow-y-auto">
                  {filteredProjects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProject(p)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b last:border-0"
                    >
                      <div className="font-bold text-slate-800">{p.code}</div>
                      <div className="text-xs text-slate-500">{p.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Task Description</label>
              <input
                type="text"
                value={newRowDescription}
                onChange={(e) => setNewRowDescription(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What task are you logging for?"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
              >
                <span>Add Line</span>
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
          <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
            <span className="text-xl">ℹ️</span>
            Hours are saved automatically when you click outside the input field or press Enter. You can edit entries for the past 7 days.
          </p>
        </div>
      </div>
    </div>
  );
}
