'use client';

import { useState, useEffect } from 'react';
import { employeeApi, Employee, EmployeePunches, isAuthenticated, isAdmin as checkIsAdmin } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function History() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [punchData, setPunchData] = useState<EmployeePunches | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      loadPunchHistory(selectedEmployee);
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

  const loadPunchHistory = async (employeeId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await employeeApi.getEmployeePunches(employeeId);
      setPunchData(data);
    } catch (err) {
      setError('Failed to load punch history');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="glass-panel rounded-3xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-black text-slate-900">Employee Punch History</h1>
            <Link
              href="/admin"
              className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl transition"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-panel bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* Employee Selection */}
        <div className="glass-panel rounded-3xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Select Employee</h2>
          <select
            value={selectedEmployee || ''}
            onChange={(e) => setSelectedEmployee(Number(e.target.value))}
            className="w-full border border-slate-300 bg-white/80 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.email})
              </option>
            ))}
          </select>
        </div>

        {/* Punch Records */}
        {loading ? (
          <div className="glass-panel rounded-3xl p-6 text-center">
            <p className="text-slate-600">Loading...</p>
          </div>
        ) : punchData ? (
          <div className="glass-panel rounded-3xl p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {punchData.employee.name}
              </h2>
              <p className="text-slate-600 mb-4">{punchData.employee.email}</p>
              <div className="glass-subtle p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-700">
                  Total Hours: {punchData.total_hours.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Punch Records Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/55">
              <table className="w-full">
                <thead className="bg-slate-100/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Punch In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Punch Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Hours Worked
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/70 divide-y divide-slate-100">
                  {punchData.punches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-slate-500">
                        No punch records found
                      </td>
                    </tr>
                  ) : (
                    punchData.punches.map((punch, index) => (
                      <tr key={punch.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {punchData.punches.length - index}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {formatDateTime(punch.punch_in)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {punch.punch_out ? formatDateTime(punch.punch_out) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {punch.total_hours ? `${punch.total_hours.toFixed(2)} hrs` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {punch.punch_out ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Completed
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
