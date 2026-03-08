'use client';

import { useState, useEffect } from 'react';
import { employeeApi, Employee, isAuthenticated, isAdmin as checkIsAdmin } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AdminHistory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | 'ALL'>('ALL');
  const [workData, setWorkData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState('ALL');
  const [clientOptions, setClientOptions] = useState<string[]>([]);

  // Pagination (10 per page by default; user can change)
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    project_name: '',
    project_code: '',
    work_date: '',
    hours_worked: '',
    description: ''
  });
  
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    if (!checkIsAdmin()) {
      router.push('/dashboard');
      return;
    }

    loadEmployees();
  }, [router]);

  useEffect(() => {
    loadWorkHistory(selectedEmployee);
  }, [selectedEmployee, employees]);

  useEffect(() => {
    setCurrentPage(1);
  }, [workData, recordsPerPage]);

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data.filter((e) => !e.is_admin));
      setSelectedEmployee('ALL');
    } catch (err) {
      setError('Failed to load employees');
    }
  };

  const loadWorkHistory = async (
    employeeId: number | 'ALL',
    filters?: { startDate?: string; endDate?: string; projectName?: string; clientName?: string }
  ) => {
    setLoading(true);
    setError(null);
    try {
      const effectiveStartDate = (filters?.startDate ?? startDate) || undefined;
      const effectiveEndDate = (filters?.endDate ?? endDate) || undefined;
      const selectedProject = filters?.projectName ?? projectFilter;
      const effectiveProjectName = selectedProject && selectedProject !== 'ALL' ? selectedProject : undefined;
      const selectedClient = filters?.clientName ?? clientFilter;
      const effectiveClientName = selectedClient && selectedClient !== 'ALL' ? selectedClient : undefined;

      let projectEntriesSource: any[] = [];
      if (employeeId === 'ALL') {
        if (employees.length === 0) {
          setWorkData(null);
          return;
        }
        const allEmployeeData = await Promise.all(
          employees.map((employee) =>
            employeeApi.getEmployeeWork(
              employee.id,
              effectiveStartDate,
              effectiveEndDate,
              effectiveProjectName,
              effectiveClientName
            )
          )
        );

        const combinedEntries = allEmployeeData
          .flatMap((item) =>
            item.work_entries.map((entry: any) => ({
              ...entry,
              employee_name: item.employee.name,
              employee_email: item.employee.email,
            }))
          )
          .sort((a: any, b: any) => {
            if (a.work_date !== b.work_date) {
              return a.work_date < b.work_date ? 1 : -1;
            }
            return (b.id || 0) - (a.id || 0);
          });

        const totalHours = allEmployeeData.reduce((sum, item) => sum + (item.total_hours || 0), 0);
        setWorkData({
          employee: { name: 'All Employees', email: `${employees.length} total` },
          total_hours: totalHours,
          work_entries: combinedEntries,
        });
        projectEntriesSource = combinedEntries;
      } else {
        const data = await employeeApi.getEmployeeWork(
          employeeId,
          effectiveStartDate,
          effectiveEndDate,
          effectiveProjectName,
          effectiveClientName
        );
        setWorkData(data);
        projectEntriesSource = data.work_entries || [];
      }

      if (!effectiveProjectName && !effectiveClientName) {
        const uniqueProjectNames = Array.from(
          new Set(
            (projectEntriesSource || [])
              .map((entry: any) => (entry.project_name || '').trim())
              .filter((name: string) => Boolean(name))
          )
        ).sort();
        setProjectOptions(uniqueProjectNames);

        const uniqueClientNames = Array.from(
          new Set(
            (projectEntriesSource || [])
              .map((entry: any) => (entry.client_name || '').trim())
              .filter((name: string) => Boolean(name))
          )
        ).sort();
        setClientOptions(uniqueClientNames);
      }
    } catch (err) {
      setError('Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditForm({
      project_name: entry.project_name,
      project_code: entry.project_code || '',
      work_date: entry.work_date,
      hours_worked: entry.hours_worked.toString(),
      description: entry.description || ''
    });
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const hours = parseFloat(editForm.hours_worked);
      if (isNaN(hours) || hours <= 0 || hours > 24) {
        setError('Hours must be between 0 and 24');
        setLoading(false);
        return;
      }

      await employeeApi.editWork(editingEntry.id, {
        project_name: editForm.project_name,
        project_code: editForm.project_code || undefined,
        work_date: editForm.work_date,
        hours_worked: hours,
        description: editForm.description
      });
      
      setSuccess('Work entry updated successfully!');
      setShowEditModal(false);
      setEditingEntry(null);
      
      if (selectedEmployee) {
        await loadWorkHistory(selectedEmployee);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update work entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm('Are you sure you want to delete this work entry?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await employeeApi.deleteWork(entryId);
      setSuccess('Work entry deleted successfully!');
      
      if (selectedEmployee) {
        await loadWorkHistory(selectedEmployee);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete work entry');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const downloadCsvFile = (filename: string, rows: string[][]) => {
    const escapeCell = (value: string | number | null | undefined) => {
      const text = String(value ?? '');
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    const csvContent = rows.map((row) => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // Pagination slice (computed from workData so JSX stays simple)
  const entries = workData?.work_entries ?? [];
  const totalRecords = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedEntries = entries.slice(startIndex, startIndex + recordsPerPage);
  const startItem = totalRecords === 0 ? 0 : startIndex + 1;
  const endItem = totalRecords === 0 ? 0 : Math.min(startIndex + recordsPerPage, totalRecords);

  const handleDownloadCsv = async () => {
    setDownloading('csv');
    setError(null);
    try {
      if (selectedEmployee === 'ALL') {
        if (!workData?.work_entries?.length) {
          setError('No data available to download');
          return;
        }
        const rows: string[][] = [[
          'Date',
          'Employee',
          'Project',
          'Hours',
          'Description',
          'Status',
        ]];

        workData.work_entries.forEach((entry: any) => {
          rows.push([
            formatDate(entry.work_date),
            entry.employee_name || '-',
            entry.project_name || '-',
            Number(entry.hours_worked || 0).toFixed(2),
            entry.description || '',
            entry.updated_by_admin ? 'Admin Edited' : 'Original',
          ]);
        });
        rows.push([]);
        rows.push(['Total Hours', '', '', Number(workData.total_hours || 0).toFixed(2), '', '']);

        downloadCsvFile('all_employees_work_history.csv', rows);
      } else {
        await employeeApi.exportEmployeeWork(
          selectedEmployee,
          'csv',
          startDate || undefined,
          endDate || undefined,
          projectFilter !== 'ALL' ? projectFilter : undefined
        );
      }
    } catch (err) {
      setError('Failed to download CSV file');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Success/Error Messages */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Employee Selection */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Employee</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
            <select
              value={selectedEmployee || ''}
              onChange={(e) => {
                const nextId = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setSelectedEmployee(nextId);
                setProjectFilter('ALL');
                setClientFilter('ALL');
                setProjectOptions([]);
                setClientOptions([]);
              }}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Projects</option>
              {projectOptions.map((projectName) => (
                <option key={projectName} value={projectName}>
                  {projectName}
                </option>
              ))}
            </select>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Clients</option>
              {clientOptions.map((clientName) => (
                <option key={clientName} value={clientName}>
                  {clientName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                if (selectedEmployee) {
                  loadWorkHistory(selectedEmployee);
                }
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
            >
              Apply Filters
            </button>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setProjectFilter('ALL');
                setClientFilter('ALL');
                if (selectedEmployee) {
                  loadWorkHistory(selectedEmployee, { startDate: '', endDate: '', projectName: '', clientName: '' });
                }
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Work Records */}
        {loading && !showEditModal ? (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : workData ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {workData.employee.name}
                  </h2>
                  <p className="text-gray-600">{workData.employee.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadCsv}
                    disabled={downloading !== null || loading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {downloading === 'csv' ? 'Downloading CSV...' : 'Download CSV'}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  Total Hours: {workData.total_hours.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Work Entries Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    {selectedEmployee === 'ALL' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {totalRecords === 0 ? (
                    <tr>
                      <td colSpan={selectedEmployee === 'ALL' ? 9 : 8} className="px-6 py-4 text-center text-gray-500">
                        No work entries found
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(entry.work_date)}
                        </td>
                        {selectedEmployee === 'ALL' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {entry.employee_name || '-'}
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {entry.project_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {entry.project_code || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {entry.client_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {entry.hours_worked.toFixed(2)} hrs
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {entry.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {entry.updated_by_admin ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Admin Edited
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Original
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination: rows per page + range + prev/next (at bottom) */}
            {totalRecords > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <label htmlFor="rows-per-page" className="text-sm text-gray-600">
                    Rows per page
                  </label>
                  <select
                    id="rows-per-page"
                    value={recordsPerPage}
                    onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">
                    Showing {startItem}–{endItem} of {totalRecords}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Work Entry</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={editForm.project_name}
                      onChange={(e) => setEditForm({...editForm, project_name: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Code
                    </label>
                    <input
                      type="text"
                      value={editForm.project_code}
                      onChange={(e) => setEditForm({...editForm, project_code: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Work Date *
                    </label>
                    <input
                      type="date"
                      value={editForm.work_date}
                      onChange={(e) => setEditForm({...editForm, work_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hours Worked *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={editForm.hours_worked}
                      onChange={(e) => setEditForm({...editForm, hours_worked: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEntry(null);
                    setError(null);
                  }}
                  disabled={loading}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition disabled:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
