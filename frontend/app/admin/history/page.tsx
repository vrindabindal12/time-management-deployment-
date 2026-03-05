'use client';

import { useState, useEffect } from 'react';
import { employeeApi, Employee, isAuthenticated, isAdmin as checkIsAdmin } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AdminHistory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeNameFilter, setEmployeeNameFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [workData, setWorkData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'csv' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  
  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    project_name: '',
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
    if (selectedEmployee) {
      loadWorkHistory(selectedEmployee);
    }
  }, [selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data);
      if (data.length > 0) {
        setSelectedEmployee(data[0].id);
      }
    } catch (err) {
      setError('Failed to load employees');
    }
  };

  const loadWorkHistory = async (
    employeeId: number,
    filters?: { startDate?: string; endDate?: string; projectName?: string }
  ) => {
    setLoading(true);
    setError(null);
    try {
      const effectiveStartDate = (filters?.startDate ?? startDate) || undefined;
      const effectiveEndDate = (filters?.endDate ?? endDate) || undefined;
      const effectiveProjectName = (filters?.projectName ?? projectFilter.trim()) || undefined;

      const data = await employeeApi.getEmployeeWork(
        employeeId,
        effectiveStartDate,
        effectiveEndDate,
        effectiveProjectName
      );
      setWorkData(data);
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

  const handleDownload = async (format: 'csv' | 'excel') => {
    if (!selectedEmployee) {
      setError('Please select an employee first');
      return;
    }

    setDownloading(format);
    setError(null);
    try {
      await employeeApi.exportEmployeeWork(
        selectedEmployee,
        format,
        startDate || undefined,
        endDate || undefined,
        projectFilter.trim() || undefined
      );
    } catch (err) {
      setError(`Failed to download ${format.toUpperCase()} file`);
    } finally {
      setDownloading(null);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    if (!employeeNameFilter.trim()) return true;
    const query = employeeNameFilter.trim().toLowerCase();
    return (
      employee.name.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query)
    );
  });

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <input
              type="text"
              value={employeeNameFilter}
              onChange={(e) => setEmployeeNameFilter(e.target.value)}
              placeholder="Employee name or email"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
            <input
              type="text"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Project name"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedEmployee || ''}
            onChange={(e) => setSelectedEmployee(e.target.value ? Number(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {filteredEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.email})
              </option>
            ))}
          </select>
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
                setEmployeeNameFilter('');
                setStartDate('');
                setEndDate('');
                setProjectFilter('');
                if (selectedEmployee) {
                  loadWorkHistory(selectedEmployee, { startDate: '', endDate: '', projectName: '' });
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
                    onClick={() => handleDownload('csv')}
                    disabled={downloading !== null || loading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {downloading === 'csv' ? 'Downloading CSV...' : 'Download CSV'}
                  </button>
                  <button
                    onClick={() => handleDownload('excel')}
                    disabled={downloading !== null || loading}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {downloading === 'excel' ? 'Downloading Excel...' : 'Download Excel'}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
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
                  {workData.work_entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No work entries found
                      </td>
                    </tr>
                  ) : (
                    workData.work_entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(entry.work_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {entry.project_name}
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
          </div>
        ) : null}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Work Entry</h3>
              
              <div className="space-y-4">
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
