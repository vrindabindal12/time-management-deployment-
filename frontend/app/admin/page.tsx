'use client';

import { useState, useEffect } from 'react';
import { employeeApi, clientApi, projectApi, getCurrentUser, isAuthenticated, isAdmin } from '@/lib/api';
import type { Client, ClientInvoiceReport, Employee, EmployeePayablesReport, Project, ProjectRate } from '@/lib/api';
import { useRouter } from 'next/navigation';

const DESIGNATIONS = ['Managing Director', 'Associate Director', 'Senior Consultant'];

const emptyOnboardingForm = {
  name: '',
  email: '',
  password: '',
  designation: '',
  start_date: '',
  current_hourly_rate: '',
  promotion_1_date: '',
  promotion_1_rate: '',
  promotion_1_designation: '',
  promotion_2_date: '',
  promotion_2_rate: '',
  promotion_2_designation: '',
  promotion_3_date: '',
  promotion_3_rate: '',
  promotion_3_designation: '',
  promotion_4_date: '',
  promotion_4_rate: '',
  promotion_4_designation: '',
  promotion_5_date: '',
  promotion_5_rate: '',
  promotion_5_designation: '',
};

type EmployeeProfileEdit = {
  designation: string;
  start_date: string;
  current_hourly_rate: string;
  promotion_1_date: string;
  promotion_1_rate: string;
  promotion_1_designation: string;
  promotion_2_date: string;
  promotion_2_rate: string;
  promotion_2_designation: string;
  promotion_3_date: string;
  promotion_3_rate: string;
  promotion_3_designation: string;
  promotion_4_date: string;
  promotion_4_rate: string;
  promotion_4_designation: string;
  promotion_5_date: string;
  promotion_5_rate: string;
  promotion_5_designation: string;
};

const buildEmployeeProfileEdit = (employee: Employee): EmployeeProfileEdit => ({
  designation: employee.designation || '',
  start_date: employee.start_date || '',
  current_hourly_rate: employee.current_hourly_rate != null ? String(employee.current_hourly_rate) : '',
  promotion_1_date: employee.promotion_1_date || '',
  promotion_1_rate: employee.promotion_1_rate != null ? String(employee.promotion_1_rate) : '',
  promotion_1_designation: employee.promotion_1_designation || '',
  promotion_2_date: employee.promotion_2_date || '',
  promotion_2_rate: employee.promotion_2_rate != null ? String(employee.promotion_2_rate) : '',
  promotion_2_designation: employee.promotion_2_designation || '',
  promotion_3_date: employee.promotion_3_date || '',
  promotion_3_rate: employee.promotion_3_rate != null ? String(employee.promotion_3_rate) : '',
  promotion_3_designation: employee.promotion_3_designation || '',
  promotion_4_date: employee.promotion_4_date || '',
  promotion_4_rate: employee.promotion_4_rate != null ? String(employee.promotion_4_rate) : '',
  promotion_4_designation: employee.promotion_4_designation || '',
  promotion_5_date: employee.promotion_5_date || '',
  promotion_5_rate: employee.promotion_5_rate != null ? String(employee.promotion_5_rate) : '',
  promotion_5_designation: employee.promotion_5_designation || '',
});

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('employees');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Employee states
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<any>(null);
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', password: '' });
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState(emptyOnboardingForm);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [employeeProfileEdits, setEmployeeProfileEdits] = useState<Record<number, EmployeeProfileEdit>>({});
  const [savingEmployeeProfileId, setSavingEmployeeProfileId] = useState<number | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [deleteEmployeeModal, setDeleteEmployeeModal] = useState<{
    open: boolean;
    employeeId: number | null;
    employeeName: string;
  }>({
    open: false,
    employeeId: null,
    employeeName: '',
  });
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Client & Project states
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', code: '' });
  const [invoiceClientId, setInvoiceClientId] = useState<number | null>(null);
  const [invoiceStartDate, setInvoiceStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [invoiceEndDate, setInvoiceEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceReport, setInvoiceReport] = useState<ClientInvoiceReport | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceEdits, setInvoiceEdits] = useState<Record<number, { gross_rate: string; discount: string; hours: string }>>({});
  const [savingInvoiceRowId, setSavingInvoiceRowId] = useState<number | null>(null);
  const [payableEmployeeId, setPayableEmployeeId] = useState<number | null>(null);
  const [payableStartDate, setPayableStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [payableEndDate, setPayableEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payablesReport, setPayablesReport] = useState<EmployeePayablesReport | null>(null);
  const [payablesLoading, setPayablesLoading] = useState(false);

  // Project states
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', code: '' });

  // Project Rate states
  const [projectRates, setProjectRates] = useState<ProjectRate[]>([]);
  const [showAddRateForm, setShowAddRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ designation: DESIGNATIONS[0], grossRate: '', discount: '0' });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser?.is_admin) {
      router.push('/dashboard');
      return;
    }

    setUser(currentUser);
    loadEmployees();
    loadClients();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeStatus(selectedEmployee);
    }
  }, [selectedEmployee]);

  useEffect(() => {
    if (selectedClient) {
      loadClientProjects(selectedClient);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (!invoiceClientId && clients.length > 0) {
      setInvoiceClientId(clients[0].id);
    }
  }, [clients, invoiceClientId]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectRates(selectedProject);
    }
  }, [selectedProject]);

  const clearError = () => setTimeout(() => setError(null), 5000);

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data);
      const nextProfileEdits: Record<number, EmployeeProfileEdit> = {};
      data.forEach((employee: Employee) => {
        nextProfileEdits[employee.id] = buildEmployeeProfileEdit(employee);
      });
      setEmployeeProfileEdits(nextProfileEdits);
    } catch (err: any) {
      setError('Failed to load employees');
      clearError();
    }
  };

  const loadEmployeeStatus = async (employeeId: number) => {
    try {
      const status = await employeeApi.getEmployeeStatus(employeeId);
      setEmployeeStatus(status);
    } catch (err: any) {
      setError('Failed to load employee status');
      clearError();
    }
  };

  const loadClients = async () => {
    try {
      const data = await clientApi.getClients();
      setClients(data);
    } catch (err: any) {
      setError('Failed to load clients');
      clearError();
    }
  };

  const loadClientProjects = async (clientId: number) => {
    try {
      const data = await projectApi.getClientProjects(clientId);
      setProjects(data);
      setSelectedProject(null);
      setProjectRates([]);
    } catch (err: any) {
      setError('Failed to load projects');
      clearError();
    }
  };

  const loadProjectRates = async (projectId: number) => {
    try {
      const project = await projectApi.getProject(projectId);
      setProjectRates(project.rates);
    } catch (err: any) {
      setError('Failed to load project rates');
      clearError();
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await employeeApi.createEmployee(employeeForm.name, employeeForm.email, employeeForm.password);
      setEmployeeForm({ name: '', email: '', password: '' });
      setShowAddEmployeeForm(false);
      await loadEmployees();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  const toNullableNumber = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? parseFloat(trimmed) : null;
  };

  const toNullableText = (value: string) => {
    const trimmed = value.trim();
    return trimmed || null;
  };

  const handleOnboardEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await employeeApi.createEmployee(
        onboardingForm.name.trim(),
        onboardingForm.email.trim(),
        onboardingForm.password,
        {
          designation: toNullableText(onboardingForm.designation),
          start_date: toNullableText(onboardingForm.start_date),
          current_hourly_rate: toNullableNumber(onboardingForm.current_hourly_rate),
          promotion_1_date: toNullableText(onboardingForm.promotion_1_date),
          promotion_1_rate: toNullableNumber(onboardingForm.promotion_1_rate),
          promotion_1_designation: toNullableText(onboardingForm.promotion_1_designation),
          promotion_2_date: toNullableText(onboardingForm.promotion_2_date),
          promotion_2_rate: toNullableNumber(onboardingForm.promotion_2_rate),
          promotion_2_designation: toNullableText(onboardingForm.promotion_2_designation),
          promotion_3_date: toNullableText(onboardingForm.promotion_3_date),
          promotion_3_rate: toNullableNumber(onboardingForm.promotion_3_rate),
          promotion_3_designation: toNullableText(onboardingForm.promotion_3_designation),
          promotion_4_date: toNullableText(onboardingForm.promotion_4_date),
          promotion_4_rate: toNullableNumber(onboardingForm.promotion_4_rate),
          promotion_4_designation: toNullableText(onboardingForm.promotion_4_designation),
          promotion_5_date: toNullableText(onboardingForm.promotion_5_date),
          promotion_5_rate: toNullableNumber(onboardingForm.promotion_5_rate),
          promotion_5_designation: toNullableText(onboardingForm.promotion_5_designation),
        }
      );

      setOnboardingForm(emptyOnboardingForm);
      setShowOnboardingForm(false);
      await loadEmployees();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to onboard employee');
      clearError();
    } finally {
      setLoading(false);
    }
  };

  const toggleCardFlip = (employeeId: number) => {
    setFlippedCards((prev) => ({ ...prev, [employeeId]: !prev[employeeId] }));
  };

  const handleEmployeeProfileEditChange = (
    employeeId: number,
    field: keyof EmployeeProfileEdit,
    value: string
  ) => {
    setEmployeeProfileEdits((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {
          designation: '',
          start_date: '',
          current_hourly_rate: '',
          promotion_1_date: '',
          promotion_1_rate: '',
          promotion_1_designation: '',
          promotion_2_date: '',
          promotion_2_rate: '',
          promotion_2_designation: '',
          promotion_3_date: '',
          promotion_3_rate: '',
          promotion_3_designation: '',
          promotion_4_date: '',
          promotion_4_rate: '',
          promotion_4_designation: '',
          promotion_5_date: '',
          promotion_5_rate: '',
          promotion_5_designation: '',
        }),
        [field]: value,
      },
    }));
  };

  const saveEmployeeProfile = async (employeeId: number) => {
    const edit = employeeProfileEdits[employeeId];
    if (!edit) return;

    setSavingEmployeeProfileId(employeeId);
    setError(null);

    try {
      await employeeApi.updateEmployeeProfile(employeeId, {
        designation: toNullableText(edit.designation),
        start_date: toNullableText(edit.start_date),
        current_hourly_rate: toNullableNumber(edit.current_hourly_rate),
        promotion_1_date: toNullableText(edit.promotion_1_date),
        promotion_1_rate: toNullableNumber(edit.promotion_1_rate),
        promotion_1_designation: toNullableText(edit.promotion_1_designation),
        promotion_2_date: toNullableText(edit.promotion_2_date),
        promotion_2_rate: toNullableNumber(edit.promotion_2_rate),
        promotion_2_designation: toNullableText(edit.promotion_2_designation),
        promotion_3_date: toNullableText(edit.promotion_3_date),
        promotion_3_rate: toNullableNumber(edit.promotion_3_rate),
        promotion_3_designation: toNullableText(edit.promotion_3_designation),
        promotion_4_date: toNullableText(edit.promotion_4_date),
        promotion_4_rate: toNullableNumber(edit.promotion_4_rate),
        promotion_4_designation: toNullableText(edit.promotion_4_designation),
        promotion_5_date: toNullableText(edit.promotion_5_date),
        promotion_5_rate: toNullableNumber(edit.promotion_5_rate),
        promotion_5_designation: toNullableText(edit.promotion_5_designation),
      });
      await loadEmployees();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update employee profile');
      clearError();
    } finally {
      setSavingEmployeeProfileId(null);
    }
  };

  const openDeleteEmployeeModal = (employeeId: number, employeeName: string) => {
    setDeleteEmployeeModal({
      open: true,
      employeeId,
      employeeName,
    });
    setDeleteConfirmationText('');
  };

  const closeDeleteEmployeeModal = () => {
    setDeleteEmployeeModal({
      open: false,
      employeeId: null,
      employeeName: '',
    });
    setDeleteConfirmationText('');
  };

  const handleDeleteEmployee = async () => {
    if (!deleteEmployeeModal.employeeId) return;

    if (deleteConfirmationText !== 'DELETE') {
      setError('Please type DELETE exactly to confirm.');
      clearError();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await employeeApi.deleteEmployee(deleteEmployeeModal.employeeId);
      await loadEmployees();

      if (selectedEmployee === deleteEmployeeModal.employeeId) {
        setSelectedEmployee(null);
        setEmployeeStatus(null);
      }
      closeDeleteEmployeeModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete employee');
      clearError();
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await clientApi.createClient(clientForm.name, clientForm.code);
      setClientForm({ name: '', code: '' });
      setShowAddClientForm(false);
      await loadClients();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      setError('Please select a client first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await projectApi.createProject(selectedClient, projectForm.name, projectForm.code);
      setProjectForm({ name: '', code: '' });
      setShowAddProjectForm(false);
      await loadClientProjects(selectedClient);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      setError('Please select a project first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await projectApi.createProjectRate(
        selectedProject,
        rateForm.designation,
        parseFloat(rateForm.grossRate),
        parseFloat(rateForm.discount)
      );
      setRateForm({ designation: DESIGNATIONS[0], grossRate: '', discount: '0' });
      setShowAddRateForm(false);
      await loadProjectRates(selectedProject);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create rate');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: number) => {
    if (!confirm('Delete this client and all its projects?')) return;

    setLoading(true);
    setError(null);

    try {
      await clientApi.deleteClient(clientId);
      await loadClients();
      setSelectedClient(null);
      setProjects([]);
      setSelectedProject(null);
      setProjectRates([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete client');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm('Delete this project and all its rates?')) return;

    setLoading(true);
    setError(null);

    try {
      await projectApi.deleteProject(projectId);
      if (selectedClient) {
        await loadClientProjects(selectedClient);
      }
      setSelectedProject(null);
      setProjectRates([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRate = async (rateId: number) => {
    if (!confirm('Delete this rate?')) return;

    setLoading(true);
    setError(null);

    try {
      await projectApi.deleteProjectRate(rateId);
      if (selectedProject) {
        await loadProjectRates(selectedProject);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete rate');
    } finally {
      setLoading(false);
    }
  };

  const runInvoiceReport = async () => {
    if (!invoiceClientId) {
      setError('Please select a client for invoicing');
      clearError();
      return;
    }

    setInvoiceLoading(true);
    setError(null);
    try {
      const data = await employeeApi.getClientInvoiceReport(invoiceClientId, invoiceStartDate, invoiceEndDate);
      setInvoiceReport(data);
      const nextEdits: Record<number, { gross_rate: string; discount: string; hours: string }> = {};
      data.rows.forEach((row) => {
        nextEdits[row.work_id] = {
          gross_rate: row.gross_rate.toString(),
          discount: row.discount.toString(),
          hours: row.hours.toString(),
        };
      });
      setInvoiceEdits(nextEdits);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load invoice report');
      clearError();
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleInvoiceEditChange = (
    workId: number,
    field: 'gross_rate' | 'discount' | 'hours',
    value: string
  ) => {
    setInvoiceEdits((prev) => ({
      ...prev,
      [workId]: {
        ...(prev[workId] || { gross_rate: '', discount: '', hours: '' }),
        [field]: value,
      },
    }));
  };

  const saveInvoiceRow = async (workId: number) => {
    const edit = invoiceEdits[workId];
    if (!edit) return;

    setSavingInvoiceRowId(workId);
    setError(null);
    try {
      await employeeApi.updateWorkInvoiceValues(workId, {
        gross_rate: edit.gross_rate === '' ? null : parseFloat(edit.gross_rate),
        discount: edit.discount === '' ? null : parseFloat(edit.discount),
        hours: edit.hours === '' ? null : parseFloat(edit.hours),
      });
      await runInvoiceReport();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save invoice values');
      clearError();
    } finally {
      setSavingInvoiceRowId(null);
    }
  };

  const runPayablesReport = async () => {
    setPayablesLoading(true);
    setError(null);
    try {
      const data = await employeeApi.getEmployeePayablesReport(
        payableStartDate,
        payableEndDate,
        payableEmployeeId || undefined
      );
      setPayablesReport(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load payables report');
      clearError();
    } finally {
      setPayablesLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-8">
          <p className="text-slate-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Message */}
        <div className="glass-panel rounded-3xl p-6 mb-6">
          <h2 className="text-3xl font-black text-slate-900">Admin Dashboard</h2>
          <p className="text-slate-600 mt-1">Welcome, {user.name}</p>
          <p className="text-slate-500 text-sm mt-2">Current Time: {currentTime.toLocaleString()}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-panel bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-4">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="glass-panel rounded-2xl mb-6 border-b border-white/50">
          <div className="flex">
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${
                activeTab === 'employees'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                  : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
              }`}
            >
              Employee Management
            </button>
            <button
              onClick={() => setActiveTab('onboarding')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${
                activeTab === 'onboarding'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                  : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
              }`}
            >
              Employee Onboarding
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${
                activeTab === 'clients'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                  : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
              }`}
            >
              Clients & Projects
            </button>
            <button
              onClick={() => setActiveTab('invoicing')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${
                activeTab === 'invoicing'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                  : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
              }`}
            >
              Invoicing
            </button>
            <button
              onClick={() => setActiveTab('payables')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${
                activeTab === 'payables'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                  : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
              }`}
            >
              Payables
            </button>
          </div>
        </div>

        {/* EMPLOYEE MANAGEMENT TAB */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            {/* Add Employee Section */}
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-800">Employee Management</h2>
                <button
                  onClick={() => setShowAddEmployeeForm(!showAddEmployeeForm)}
                  className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl transition"
                >
                  {showAddEmployeeForm ? 'Cancel' : '+ Add New Employee'}
                </button>
              </div>

              {showAddEmployeeForm && (
                <form onSubmit={handleAddEmployee} className="mb-6 p-4 glass-subtle rounded-2xl border border-white/60">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={employeeForm.name}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                      required
                      className="border border-slate-300 rounded-xl px-4 py-2 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={employeeForm.email}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                      required
                      className="border border-slate-300 rounded-xl px-4 py-2 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={employeeForm.password}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                      required
                      minLength={6}
                      className="border border-slate-300 rounded-xl px-4 py-2 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="glass-primary-btn hover:brightness-95 text-white px-6 py-2 rounded-xl transition disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Employee'}
                  </button>
                </form>
              )}

              {/* Employee List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee.id)}
                    className={`text-left p-4 rounded-lg border-2 transition cursor-pointer ${
                      selectedEmployee === employee.id
                        ? 'border-blue-500 bg-blue-50/70'
                        : 'border-white/60 bg-white/45 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-800">{employee.name}</p>
                        <p className="text-sm text-gray-600">{employee.email}</p>
                        {employee.is_admin && (
                          <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            Admin
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteEmployeeModal(employee.id, employee.name);
                        }}
                        disabled={loading}
                        className="px-3 py-1 text-xs font-semibold glass-danger-btn rounded-lg hover:brightness-95 transition disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {employees.length === 0 && !showAddEmployeeForm && (
                <p className="text-slate-500 text-center py-4">No employees found.</p>
              )}
            </div>

            {/* Employee Status */}
            {employeeStatus && (
              <div className="glass-panel rounded-3xl p-6">
                <h2 className="text-xl font-semibold text-slate-800 mb-4">
                  {employeeStatus.employee.name}'s Status
                </h2>
                <div className="mb-4">
                  <div className={`inline-flex items-center px-4 py-2 rounded-full ${
                    employeeStatus.today_hours > 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      employeeStatus.today_hours > 0 ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    Today's Hours: {employeeStatus.today_hours.toFixed(2)}h
                  </div>
                </div>
                {employeeStatus.today_entries.length > 0 && (
                  <div className="glass-subtle p-4 rounded-xl">
                    <p className="text-slate-700 font-semibold mb-2">Today's Entries:</p>
                    <ul className="space-y-2">
                      {employeeStatus.today_entries.map((entry: any) => (
                        <li key={entry.id} className="text-sm text-slate-600">
                          <span className="font-medium">{entry.project_name}</span> - {entry.hours_worked}h
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'onboarding' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Employee Onboarding</h2>
                  <p className="text-sm text-slate-600 mt-1">Create employee + compensation/promotion profile in one step.</p>
                </div>
                <button
                  onClick={() => setShowOnboardingForm(!showOnboardingForm)}
                  className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl transition"
                >
                  {showOnboardingForm ? 'Cancel' : '+ Add Employee Profile'}
                </button>
              </div>

              {showOnboardingForm && (
                <form onSubmit={handleOnboardEmployee} className="glass-subtle rounded-2xl border border-white/60 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Employee Name *"
                      value={onboardingForm.name}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, name: e.target.value })}
                      className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email *"
                      value={onboardingForm.email}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, email: e.target.value })}
                      className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password *"
                      value={onboardingForm.password}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, password: e.target.value })}
                      className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                      minLength={6}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Designation"
                      value={onboardingForm.designation}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, designation: e.target.value })}
                      className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                    />
                    <input
                      type="date"
                      value={onboardingForm.start_date}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, start_date: e.target.value })}
                      className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Current Hourly Rate"
                      value={onboardingForm.current_hourly_rate}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, current_hourly_rate: e.target.value })}
                      className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div key={idx} className="rounded-xl border border-white/70 bg-white/60 p-3 space-y-2">
                        <p className="text-xs font-bold text-slate-600 uppercase">Promotion {idx}</p>
                        <input
                          type="date"
                          value={onboardingForm[`promotion_${idx}_date` as keyof typeof onboardingForm] as string}
                          onChange={(e) => setOnboardingForm({
                            ...onboardingForm,
                            [`promotion_${idx}_date`]: e.target.value,
                          })}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/85"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Hourly rate"
                          value={onboardingForm[`promotion_${idx}_rate` as keyof typeof onboardingForm] as string}
                          onChange={(e) => setOnboardingForm({
                            ...onboardingForm,
                            [`promotion_${idx}_rate`]: e.target.value,
                          })}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/85"
                        />
                        <input
                          type="text"
                          placeholder="New designation (optional)"
                          value={onboardingForm[`promotion_${idx}_designation` as keyof typeof onboardingForm] as string}
                          onChange={(e) => setOnboardingForm({
                            ...onboardingForm,
                            [`promotion_${idx}_designation`]: e.target.value,
                          })}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/85 col-span-2"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="glass-primary-btn hover:brightness-95 text-white px-6 py-2 rounded-xl transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Create Employee Profile'}
                  </button>
                </form>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {employees.map((employee: Employee) => (
                <div
                  key={employee.id}
                  style={{ perspective: '1000px' }}
                  className="transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01]"
                >
                  <div
                    className="relative h-80 w-full transition-transform duration-700"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: flippedCards[employee.id] ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCardFlip(employee.id)}
                      className="absolute inset-0 w-full text-left rounded-2xl p-5 shadow-xl hover:shadow-2xl overflow-hidden border border-white/60 bg-gradient-to-br from-cyan-100/70 via-white/70 to-indigo-100/70 backdrop-blur-xl"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="absolute -top-14 -right-10 w-36 h-36 bg-cyan-300/30 rounded-full blur-2xl" />
                      <div className="absolute -bottom-14 -left-10 w-36 h-36 bg-indigo-300/30 rounded-full blur-2xl" />
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-700 font-bold">Employee Card</p>
                      <h3 className="text-xl font-black text-slate-900 mt-2">{employee.name}</h3>
                      <p className="text-slate-600 text-sm mt-1">{employee.email}</p>
                      <div className="mt-6 rounded-xl bg-white/70 border border-white/70 p-3 space-y-2">
                        <p className="text-xs text-slate-500">ID: <span className="font-semibold text-slate-900">{employee.employee_code || 'Not set'}</span></p>
                        <p className="text-xs text-slate-500">Designation: <span className="font-semibold text-slate-900">{employee.designation || 'Not set'}</span></p>
                        <p className="text-xs text-slate-500">Hourly Rate: <span className="font-semibold text-slate-900">{employee.current_hourly_rate ?? '-'}</span></p>
                      </div>
                      <p className="text-xs text-slate-500 mt-5">Click to flip for details</p>
                    </button>

                    <div
                      className="absolute inset-0 w-full text-left rounded-2xl p-5 shadow-xl overflow-hidden border border-white/60 bg-gradient-to-br from-indigo-100/75 via-white/70 to-blue-100/70 backdrop-blur-xl"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <div className="absolute -top-14 -left-10 w-36 h-36 bg-indigo-300/30 rounded-full blur-2xl" />
                      <div className="absolute -bottom-14 -right-10 w-36 h-36 bg-blue-300/30 rounded-full blur-2xl" />
                      <p className="text-xs uppercase tracking-[0.2em] text-indigo-700 font-bold">Employee Details</p>
                      <div className="mt-3 space-y-1 text-sm text-slate-700">
                        <p><span className="font-semibold">Start Date:</span> {employee.start_date || '-'}</p>
                        <p><span className="font-semibold">Current Rate:</span> {employee.current_hourly_rate ?? '-'}</p>
                        {[1, 2, 3, 4, 5].map((idx) => (
                          <p key={`${employee.id}-view-promo-${idx}`}>
                            <span className="font-semibold">Promotion {idx}:</span>{' '}
                            {employee[`promotion_${idx}_date` as keyof Employee] as string || '-'} /{' '}
                            {employee[`promotion_${idx}_rate` as keyof Employee] as number ?? '-'} /{' '}
                            {employee[`promotion_${idx}_designation` as keyof Employee] as string || '-'}
                          </p>
                        ))}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEmployeeId(employee.id)}
                          className="glass-primary-btn hover:brightness-95 text-white px-3 py-2 rounded-lg text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCardFlip(employee.id)}
                          className="px-3 py-2 rounded-lg bg-white/70 border border-white/70 text-slate-700 text-sm"
                        >
                          Flip Back
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLIENTS & PROJECTS TAB */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Clients */}
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-800">Clients</h2>
                <button
                  onClick={() => setShowAddClientForm(!showAddClientForm)}
                  className="glass-primary-btn hover:brightness-95 text-white px-3 py-1 rounded text-sm transition"
                >
                  {showAddClientForm ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {showAddClientForm && (
                <form onSubmit={handleAddClient} className="mb-4 p-3 glass-subtle rounded-xl border border-white/60">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-yellow-700 mb-1">CLIENT NAME</label>
                      <input
                        type="text"
                        placeholder="e.g., Lekadir"
                        value={clientForm.name}
                        onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-yellow-700 mb-1">CLIENT CODE</label>
                      <input
                        type="text"
                        placeholder="e.g., LD"
                        value={clientForm.code}
                        onChange={(e) => setClientForm({ ...clientForm, code: e.target.value.toUpperCase() })}
                        required
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-3 w-full glass-primary-btn hover:brightness-95 text-white px-3 py-2 rounded-xl text-sm transition disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Client'}
                  </button>
                </form>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(client.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      selectedClient === client.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-white/60 hover:border-blue-300 bg-white/45'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{client.name}</p>
                        <p className="text-sm font-mono text-gray-600">{client.code}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClient(client.id);
                        }}
                        disabled={loading}
                        className="ml-2 px-2 py-1 text-xs glass-danger-btn rounded hover:brightness-95 transition disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {clients.length === 0 && !showAddClientForm && (
                <p className="text-slate-500 text-center py-4">No clients found.</p>
              )}
            </div>

            {/* RIGHT: Projects & Rates */}
            <div className="space-y-6">
              {/* Projects Section */}
              {selectedClient && (
                <div className="glass-panel rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">New Project Details</h3>
                    <button
                      onClick={() => setShowAddProjectForm(!showAddProjectForm)}
                      className="glass-primary-btn hover:brightness-95 text-white px-3 py-1 rounded text-sm transition"
                    >
                      {showAddProjectForm ? 'Cancel' : '+ Add'}
                    </button>
                  </div>

                  {showAddProjectForm && (
                    <form onSubmit={handleAddProject} className="mb-4 p-3 glass-subtle rounded-xl border border-white/60">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-blue-700 mb-1">PROJECT NAME</label>
                          <input
                            type="text"
                            placeholder="e.g., Project Bedrock"
                            value={projectForm.name}
                            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                            required
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-700 mb-1">NEW PROJECT CODE</label>
                          <input
                            type="text"
                            placeholder="e.g., BD001"
                            value={projectForm.code}
                            onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value.toUpperCase() })}
                            required
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-3 w-full glass-primary-btn hover:brightness-95 text-white px-3 py-2 rounded-xl text-sm transition disabled:opacity-50"
                      >
                        {loading ? 'Adding...' : 'Add Project'}
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProject(project.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                          selectedProject === project.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-white/60 hover:border-blue-300 bg-white/45'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-bold text-gray-800">{project.name}</p>
                            <p className="text-sm text-red-600 font-semibold">{clients.find(c => c.id === selectedClient)?.code}-{project.code}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                            disabled={loading}
                            className="ml-2 px-2 py-1 text-xs glass-danger-btn rounded hover:brightness-95 transition disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {projects.length === 0 && !showAddProjectForm && (
                    <p className="text-slate-500 text-center py-4">No projects found.</p>
                  )}
                </div>
              )}

              {/* Project Rates Section */}
              {selectedProject && (
                <div className="glass-panel rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-yellow-800 glass-subtle px-3 py-2 rounded-lg flex-1">
                      GROSS RATES (Standard per hour)
                    </h3>
                    <button
                      onClick={() => setShowAddRateForm(!showAddRateForm)}
                      className="ml-2 glass-primary-btn hover:brightness-95 text-white px-3 py-1 rounded text-sm transition"
                    >
                      {showAddRateForm ? 'Cancel' : '+ Add'}
                    </button>
                  </div>

                  {showAddRateForm && (
                    <form onSubmit={handleAddRate} className="mb-4 p-3 glass-subtle rounded-xl border border-white/60">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-purple-700 mb-1">DESIGNATION</label>
                          <select
                            value={rateForm.designation}
                            onChange={(e) => setRateForm({ ...rateForm, designation: e.target.value })}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            {DESIGNATIONS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold text-purple-700 mb-1">GROSS RATE</label>
                            <input
                              type="number"
                              placeholder="300"
                              value={rateForm.grossRate}
                              onChange={(e) => setRateForm({ ...rateForm, grossRate: e.target.value })}
                              required
                              step="0.01"
                              min="0"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-purple-700 mb-1">DISCOUNT %</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={rateForm.discount}
                              onChange={(e) => setRateForm({ ...rateForm, discount: e.target.value })}
                              step="0.1"
                              min="0"
                              max="100"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-3 w-full glass-primary-btn hover:brightness-95 text-white px-3 py-2 rounded-xl text-sm transition disabled:opacity-50"
                      >
                        {loading ? 'Adding...' : 'Add Rate'}
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {projectRates.length > 0 ? (
                      projectRates.map((rate) => (
                        <div key={rate.id} className="p-3 border border-white/60 rounded-xl bg-white/55 hover:bg-white/75 transition">
                          <div className="grid grid-cols-4 gap-2 items-center text-sm">
                            <div>
                              <p className="font-bold text-gray-700">{rate.designation}</p>
                              <p className="text-xs text-gray-500">Designation</p>
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-gray-700">${rate.gross_rate}</p>
                              <p className="text-xs text-gray-500">Gross</p>
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-red-600">{rate.discount}%</p>
                              <p className="text-xs text-gray-500">Discount</p>
                            </div>
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-bold text-green-600">${rate.net_rate}</p>
                                <p className="text-xs text-gray-500">Net</p>
                              </div>
                              <button
                                onClick={() => handleDeleteRate(rate.id)}
                                disabled={loading}
                                className="px-2 py-1 text-xs glass-danger-btn rounded hover:brightness-95 transition disabled:opacity-50"
                              >
                                Del
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-4">No rates found.</p>
                    )}
                  </div>
                </div>
              )}

              {!selectedClient && (
                <div className="min-h-64 glass-panel rounded-3xl p-6 flex items-center justify-center">
                  <p className="text-slate-500">Select a client to view/manage projects</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invoicing' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-2xl font-black text-slate-900 mb-4">Reports - Client Invoicing</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={invoiceClientId ?? ''}
                  onChange={(e) => setInvoiceClientId(Number(e.target.value))}
                  className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                >
                  <option value="">Select Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={invoiceStartDate}
                  onChange={(e) => setInvoiceStartDate(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                />
                <input
                  type="date"
                  value={invoiceEndDate}
                  onChange={(e) => setInvoiceEndDate(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                />
                <button
                  onClick={runInvoiceReport}
                  disabled={invoiceLoading}
                  className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl transition disabled:opacity-50"
                >
                  {invoiceLoading ? 'Running...' : 'Run Report'}
                </button>
              </div>
            </div>

            {invoiceReport && (
              <div className="glass-panel rounded-3xl p-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                  <div>
                    <p className="text-sm text-slate-600">
                      Client: <span className="font-semibold text-slate-900">{invoiceReport.client.name}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      Period: {invoiceReport.start_date} to {invoiceReport.end_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Currency: <span className="font-semibold">CAD$</span></p>
                    <p className="text-xl font-black text-slate-900">
                      Total Billable: {invoiceReport.total_net_billable.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/65">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/90">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Project Code</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Employee</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Level</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Project Name</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Date</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Gross Rate</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Discount</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Net Rate</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Hours</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Net Billable</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Task Performed</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceReport.rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={12}>
                            No invoice entries found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        invoiceReport.rows.map((row) => (
                          <tr key={row.work_id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-slate-800 font-semibold">{row.project_code}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_designation}</td>
                            <td className="px-4 py-3 text-slate-700">{row.project_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.work_date}</td>
                            <td className="px-4 py-3 text-slate-700">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={invoiceEdits[row.work_id]?.gross_rate ?? ''}
                                onChange={(e) => handleInvoiceEditChange(row.work_id, 'gross_rate', e.target.value)}
                                className="w-24 border border-slate-300 rounded-lg px-2 py-1 bg-white/85"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={invoiceEdits[row.work_id]?.discount ?? ''}
                                onChange={(e) => handleInvoiceEditChange(row.work_id, 'discount', e.target.value)}
                                className="w-20 border border-slate-300 rounded-lg px-2 py-1 bg-white/85"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-700">{row.net_rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={invoiceEdits[row.work_id]?.hours ?? ''}
                                onChange={(e) => handleInvoiceEditChange(row.work_id, 'hours', e.target.value)}
                                className="w-20 border border-slate-300 rounded-lg px-2 py-1 bg-white/85"
                              />
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">{row.net_billable.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {row.task_performed || '-'}
                              {row.is_invoice_override && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800">
                                  Admin Override
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => saveInvoiceRow(row.work_id)}
                                disabled={savingInvoiceRowId === row.work_id}
                                className="glass-primary-btn hover:brightness-95 text-white px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
                              >
                                {savingInvoiceRowId === row.work_id ? 'Saving...' : 'Save'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {invoiceReport.project_totals.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {invoiceReport.project_totals.map((summary) => (
                      <div key={summary.project_id} className="glass-subtle rounded-xl border border-white/70 p-3">
                        <p className="font-semibold text-slate-900">{summary.project_code} - {summary.project_name}</p>
                        <p className="text-sm text-slate-600">Hours: {summary.total_hours.toFixed(2)}</p>
                        <p className="text-sm font-semibold text-slate-800">Billable (CAD$): {summary.total_net_billable.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'payables' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-2xl font-black text-slate-900 mb-4">Reports - Employee Payables</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={payableEmployeeId ?? ''}
                  onChange={(e) => setPayableEmployeeId(e.target.value ? Number(e.target.value) : null)}
                  className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                >
                  <option value="">All Employees</option>
                  {employees
                    .filter((emp) => !emp.is_admin)
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                </select>
                <input
                  type="date"
                  value={payableStartDate}
                  onChange={(e) => setPayableStartDate(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                />
                <input
                  type="date"
                  value={payableEndDate}
                  onChange={(e) => setPayableEndDate(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                />
                <button
                  onClick={runPayablesReport}
                  disabled={payablesLoading}
                  className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl transition disabled:opacity-50"
                >
                  {payablesLoading ? 'Running...' : 'Run Report'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Auto-populated from employee onboarding rates/promotions and attendance logs.
              </p>
            </div>

            {payablesReport && (
              <div className="glass-panel rounded-3xl p-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                  <div>
                    <p className="text-sm text-slate-600">
                      Period: {payablesReport.start_date} to {payablesReport.end_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Currency: <span className="font-semibold">INR</span></p>
                    <p className="text-xl font-black text-slate-900">
                      Total Payable: {payablesReport.total_net_payable.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/65">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/90">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Project Code</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Name</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Level</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Project Name</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Date</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Rate</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Hours</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Net Payable</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Task Performed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payablesReport.rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                            No payable entries found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        payablesReport.rows.map((row) => (
                          <tr key={row.work_id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-slate-800 font-semibold">{row.project_code || '-'}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_designation}</td>
                            <td className="px-4 py-3 text-slate-700">{row.project_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.work_date}</td>
                            <td className="px-4 py-3 text-slate-700">{row.rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">{row.hours.toFixed(2)}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{row.net_payable.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">{row.task_performed || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {payablesReport.employee_totals.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {payablesReport.employee_totals.map((summary) => (
                      <div key={summary.employee_id} className="glass-subtle rounded-xl border border-white/70 p-3">
                        <p className="font-semibold text-slate-900">
                          {summary.employee_name} {summary.employee_code ? `(${summary.employee_code})` : ''}
                        </p>
                        <p className="text-sm text-slate-600">Hours: {summary.total_hours.toFixed(2)}</p>
                        <p className="text-sm font-semibold text-slate-800">Net Payable (INR): {summary.total_net_payable.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {editingEmployeeId !== null && employeeProfileEdits[editingEmployeeId] && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center px-4">
          <div className="w-full max-w-4xl glass-panel rounded-3xl p-6 shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black text-slate-900">Edit Employee Details</h3>
              <button
                onClick={() => setEditingEmployeeId(null)}
                className="px-3 py-1 rounded-lg bg-white/70 border border-white/70 text-slate-700 text-sm"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="border border-slate-300 rounded-xl px-3 py-2 bg-white/85 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Employee ID</span>
                <p className="font-semibold text-slate-900">
                  {employees.find((emp) => emp.id === editingEmployeeId)?.employee_code || 'Auto-generated'}
                </p>
              </div>
              <input
                type="text"
                placeholder="Designation"
                value={employeeProfileEdits[editingEmployeeId].designation}
                onChange={(e) => handleEmployeeProfileEditChange(editingEmployeeId, 'designation', e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white/85"
              />
              <input
                type="date"
                value={employeeProfileEdits[editingEmployeeId].start_date}
                onChange={(e) => handleEmployeeProfileEditChange(editingEmployeeId, 'start_date', e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white/85"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Current Hourly Rate"
                value={employeeProfileEdits[editingEmployeeId].current_hourly_rate}
                onChange={(e) => handleEmployeeProfileEditChange(editingEmployeeId, 'current_hourly_rate', e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white/85"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={`modal-promo-${idx}`} className="rounded-xl border border-white/70 bg-white/60 p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase">Promotion {idx}</p>
                  <input
                    type="date"
                    value={employeeProfileEdits[editingEmployeeId][`promotion_${idx}_date` as keyof EmployeeProfileEdit] as string}
                    onChange={(e) => handleEmployeeProfileEditChange(editingEmployeeId, `promotion_${idx}_date` as keyof EmployeeProfileEdit, e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/90"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Rate"
                    value={employeeProfileEdits[editingEmployeeId][`promotion_${idx}_rate` as keyof EmployeeProfileEdit] as string}
                    onChange={(e) => handleEmployeeProfileEditChange(editingEmployeeId, `promotion_${idx}_rate` as keyof EmployeeProfileEdit, e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/90"
                  />
                  <input
                    type="text"
                    placeholder="Designation"
                    value={employeeProfileEdits[editingEmployeeId][`promotion_${idx}_designation` as keyof EmployeeProfileEdit] as string}
                    onChange={(e) => handleEmployeeProfileEditChange(editingEmployeeId, `promotion_${idx}_designation` as keyof EmployeeProfileEdit, e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/90"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={async () => {
                  await saveEmployeeProfile(editingEmployeeId);
                  setEditingEmployeeId(null);
                }}
                disabled={savingEmployeeProfileId === editingEmployeeId}
                className="glass-primary-btn hover:brightness-95 text-white px-5 py-2.5 rounded-xl disabled:opacity-50"
              >
                {savingEmployeeProfileId === editingEmployeeId ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteEmployeeModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-md flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl glass-panel p-6">
            <h3 className="text-xl font-bold text-slate-900">Confirm Employee Deletion</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete{' '}
              <span className="font-semibold text-slate-900">{deleteEmployeeModal.employeeName}</span> and all linked work entries.
            </p>
            <p className="mt-4 text-sm font-semibold text-red-600">
              Type <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">DELETE</span> to continue.
            </p>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="Type DELETE"
              className="mt-3 w-full border border-slate-300 bg-white/80 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
            />
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={closeDeleteEmployeeModal}
                disabled={loading}
                className="px-4 py-2 rounded-xl glass-subtle border border-white/60 text-slate-700 hover:bg-white/70 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                disabled={loading || deleteConfirmationText !== 'DELETE'}
                className="px-4 py-2 rounded-xl glass-danger-btn hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

