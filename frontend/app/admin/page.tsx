'use client';

import { useState, useEffect, useRef } from 'react';
import { employeeApi, clientApi, projectApi, getCurrentUser, isAuthenticated, isAdmin } from '@/lib/api';
import type { Client, ClientInvoiceReport, ClientInvoiceExpense, Employee, EmployeePayablesReport, Project, ProjectRate } from '@/lib/api';
import { useRouter } from 'next/navigation';
import LiveClock from '@/components/LiveClock';

const DESIGNATIONS = ['Managing Director', 'Associate Director', 'Senior Consultant'];

type ProjectContractType = 'fixed_fee' | 'time_materials' | 'retainer' | 'admin' | 'documentation';

const emptyProjectForm = {
  name: '',
  code: '',
  contract_type: 'time_materials' as ProjectContractType,
  fixed_fee_amount: '',
  expected_hours: '',
  discount: '',
  project_discount: '0',
  standard_rate: '',
  is_billable: true,
};

const emptyOnboardingForm = {
  name: '',
  email: '',
  password: '',
  role: 'employee',
  designation: '',
  reporting_manager: '',
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
  reporting_manager: string;
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
  reporting_manager: employee.reporting_manager || '',
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

const AVATAR_GRADIENTS = [
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-fuchsia-500 to-pink-600',
  'from-orange-500 to-rose-600',
  'from-sky-500 to-indigo-600',
];

const getEmployeeInitials = (name: string) => {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'NA';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
};

const getEmployeeAvatarGradient = (employee: Employee) => {
  const seed = `${employee.id}-${employee.name}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('onboarding');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0);
  const router = useRouter();

  // Employee states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<any>(null);
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', password: '', reporting_manager: '' });
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [showOnboardingPassword, setShowOnboardingPassword] = useState(false);
  const [onboardingEmailError, setOnboardingEmailError] = useState<string | null>(null);
  const [onboardingPasswordError, setOnboardingPasswordError] = useState<string | null>(null);
  const [onboardingForm, setOnboardingForm] = useState(emptyOnboardingForm);
  const [employeeRoleEdit, setEmployeeRoleEdit] = useState<Record<number, string>>({});
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [employeeProfileEdits, setEmployeeProfileEdits] = useState<Record<number, EmployeeProfileEdit>>({});
  const [savingEmployeeProfileId, setSavingEmployeeProfileId] = useState<number | null>(null);
  const [resendingWelcomeId, setResendingWelcomeId] = useState<number | null>(null);
  const [resendWelcomeSuccessId, setResendWelcomeSuccessId] = useState<number | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeCardOrder, setEmployeeCardOrder] = useState<number[]>([]);
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<number | null>(null);
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState<number | null>(null);
  const isCardDraggingRef = useRef(false);
  const suppressFlipUntilRef = useRef(0);
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
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [clientEditForm, setClientEditForm] = useState({ name: '', code: '' });
  const [invoiceClientId, setInvoiceClientId] = useState<number | null>(null);
  const [invoiceStartDate, setInvoiceStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [invoiceEndDate, setInvoiceEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceReport, setInvoiceReport] = useState<ClientInvoiceReport | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceProjectFilter, setInvoiceProjectFilter] = useState('ALL');
  const [payableEmployeeId, setPayableEmployeeId] = useState<number | null>(null);
  const [payableStartDate, setPayableStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [payableEndDate, setPayableEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payablesReport, setPayablesReport] = useState<EmployeePayablesReport | null>(null);
  const [payablesLoading, setPayablesLoading] = useState(false);
  const [payablesProjectFilter, setPayablesProjectFilter] = useState('ALL');
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(10);
  const [payablesPage, setPayablesPage] = useState(1);
  const [payablesPageSize, setPayablesPageSize] = useState(10);
  const [selectedPayableIds, setSelectedPayableIds] = useState<Set<number>>(new Set());
  const [payableMarkPaidModal, setPayableMarkPaidModal] = useState<{ open: boolean; isPaid: boolean } | null>(null);
  const [nonBillableRateInput, setNonBillableRateInput] = useState('');
  const [nonBillableRateApplying, setNonBillableRateApplying] = useState(false);
  const [payablesStatusFilter, setPayablesStatusFilter] = useState<'ALL' | 'paid' | 'unpaid'>('ALL');
  const [payablesTypeFilter, setPayablesTypeFilter] = useState<'ALL' | 'non-billable' | 'billable'>('ALL');
  const [inlineRateEdits, setInlineRateEdits] = useState<Record<number, string>>({});
  const [savingRateId, setSavingRateId] = useState<number | null>(null);
  const [employeeCardsPage, setEmployeeCardsPage] = useState(1);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const EMPLOYEE_CARDS_PAGE_SIZE = 9;

  // Project states
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectEditForm, setProjectEditForm] = useState(emptyProjectForm);

  // Project Rate states
  const [projectRates, setProjectRates] = useState<ProjectRate[]>([]);
  const [showAddRateForm, setShowAddRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '' });
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [rateEditForm, setRateEditForm] = useState({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '' });



  const [deleteEntityModal, setDeleteEntityModal] = useState<{
    open: boolean;
    entityType: 'client' | 'project' | 'rate' | null;
    entityId: number | null;
    entityName: string;
  }>({
    open: false,
    entityType: null,
    entityId: null,
    entityName: '',
  });
  const [deleteEntityConfirmationText, setDeleteEntityConfirmationText] = useState('');

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

    return () => { };
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
    setEditingClientId(null);
    setClientEditForm({ name: '', code: '' });
    setEditingProjectId(null);
    setProjectEditForm(emptyProjectForm);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedOrder = localStorage.getItem('admin_employee_card_order');
    if (!savedOrder) return;
    try {
      const parsed = JSON.parse(savedOrder);
      if (Array.isArray(parsed)) {
        setEmployeeCardOrder(parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v)));
      }
    } catch {
      // Ignore invalid persisted order.
    }
  }, []);

  useEffect(() => {
    const loadDashboardCounts = async () => {
      try {
        const allProjects = await employeeApi.getAllProjects();
        setTotalProjectsCount(allProjects.length);
      } catch {
        setTotalProjectsCount(0);
      }
    };
    loadDashboardCounts();
  }, []);

  const clearError = () => setTimeout(() => setError(null), 5000);
  const clearSuccess = () => setTimeout(() => setSuccessMsg(null), 4000);
  const setSuccess = (msg: string) => { setSuccessMsg(msg); clearSuccess(); };

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data);
      const nonAdminIds = data.filter((employee: Employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').map((employee: Employee) => employee.id);
      setEmployeeCardOrder((prev) => {
        const kept = prev.filter((id) => nonAdminIds.includes(id));
        const appended = nonAdminIds.filter((id) => !kept.includes(id));
        const next = [...kept, ...appended];
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_employee_card_order', JSON.stringify(next));
        }
        return next;
      });
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
      await employeeApi.createEmployee(employeeForm.name, employeeForm.email, employeeForm.password, {
        reporting_manager: toNullableText(employeeForm.reporting_manager),
      });
      setEmployeeForm({ name: '', email: '', password: '', reporting_manager: '' });
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
    setOnboardingEmailError(null);
    setOnboardingPasswordError(null);

    const pwd = onboardingForm.password;
    let pwdMsg: string | null = null;
    if (pwd.length < 8) pwdMsg = 'Password must be at least 8 characters.';
    else if (!/[a-z]/.test(pwd)) pwdMsg = 'Password must contain at least one lowercase letter.';
    else if (!/[A-Z]/.test(pwd)) pwdMsg = 'Password must contain at least one uppercase letter.';
    else if (!/[!@#$%^&*()\-_=+[\]{}|;:'",./<>?`~\\]/.test(pwd)) pwdMsg = 'Password must contain at least one special character.';
    if (pwdMsg) {
      setOnboardingPasswordError(pwdMsg);
      setLoading(false);
      return;
    }

    const emailExists = employees.some(
      (emp) => emp.email.toLowerCase() === onboardingForm.email.trim().toLowerCase()
    );
    if (emailExists) {
      setOnboardingEmailError('This email is already registered to an existing account.');
      setLoading(false);
      return;
    }

    try {
      await employeeApi.createEmployee(
        onboardingForm.name.trim(),
        onboardingForm.email.trim(),
        onboardingForm.password,
        {
          role: onboardingForm.role as 'admin' | 'employee' | 'both',
          designation: toNullableText(onboardingForm.designation),
          reporting_manager: toNullableText(onboardingForm.reporting_manager),
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
      setOnboardingEmailError(null);
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
          reporting_manager: '',
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

  const handleUpdateRole = async (employeeId: number) => {
    const newRole = employeeRoleEdit[employeeId];
    if (!newRole) return;
    setSavingRoleId(employeeId);
    setError(null);
    try {
      const updated = await employeeApi.updateEmployeeRole(employeeId, newRole as 'admin' | 'employee' | 'both');
      setEmployees((prev) => prev.map((e) => (e.id === employeeId ? updated : e)));
      setEmployeeRoleEdit((prev) => { const next = { ...prev }; delete next[employeeId]; return next; });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update role');
      clearError();
    } finally {
      setSavingRoleId(null);
    }
  };

  const saveEmployeeProfile = async (employeeId: number) => {
    const edit = employeeProfileEdits[employeeId];
    if (!edit) return;

    setSavingEmployeeProfileId(employeeId);
    setError(null);

    try {
      await employeeApi.updateEmployeeProfile(employeeId, {
        designation: toNullableText(edit.designation),
        reporting_manager: toNullableText(edit.reporting_manager),
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

  const handleResendWelcome = async (employeeId: number) => {
    setResendingWelcomeId(employeeId);
    setError(null);
    try {
      await employeeApi.resendWelcomeEmail(employeeId);
      setResendWelcomeSuccessId(employeeId);
      setTimeout(() => setResendWelcomeSuccessId(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend welcome email');
      clearError();
    } finally {
      setResendingWelcomeId(null);
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
      setSelectedClient(null);
      setSelectedProject(null);
      setProjects([]);
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
    if (['fixed_fee', 'retainer'].includes(projectForm.contract_type) && !projectForm.fixed_fee_amount.trim()) {
      setError('Fixed fee amount is required for fixed fee and retainer projects');
      return;
    }
    if (projectForm.contract_type === 'admin' && !projectForm.standard_rate.trim()) {
      setError('Standard Rate per Hour is required for admin projects');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await projectApi.createProject(
        selectedClient,
        projectForm.name,
        projectForm.code,
        projectForm.contract_type,
        ['fixed_fee', 'retainer'].includes(projectForm.contract_type) ? Number(projectForm.fixed_fee_amount) : undefined,
        ['fixed_fee', 'retainer'].includes(projectForm.contract_type) && projectForm.expected_hours ? Number(projectForm.expected_hours) : undefined,
        ['fixed_fee', 'retainer'].includes(projectForm.contract_type) && projectForm.discount ? Number(projectForm.discount) : undefined,
        projectForm.contract_type === 'admin' && projectForm.standard_rate ? Number(projectForm.standard_rate) : undefined,
        Number(projectForm.project_discount || 0),
        projectForm.is_billable
      );
      setProjectForm(emptyProjectForm);
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
        rateForm.employeeName,
        rateForm.designation,
        parseFloat(rateForm.grossRate)
      );
      setRateForm({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '' });
      setShowAddRateForm(false);
      await loadProjectRates(selectedProject);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create rate');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteEntityModal = (
    entityType: 'client' | 'project' | 'rate',
    entityId: number,
    entityName: string
  ) => {
    setDeleteEntityModal({
      open: true,
      entityType,
      entityId,
      entityName,
    });
    setDeleteEntityConfirmationText('');
  };

  const closeDeleteEntityModal = () => {
    setDeleteEntityModal({
      open: false,
      entityType: null,
      entityId: null,
      entityName: '',
    });
    setDeleteEntityConfirmationText('');
  };

  const handleConfirmDeleteEntity = async () => {
    if (!deleteEntityModal.entityId || !deleteEntityModal.entityType) return;

    if (deleteEntityConfirmationText !== 'DELETE') {
      setError('Please type DELETE exactly to confirm.');
      clearError();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (deleteEntityModal.entityType === 'client') {
        await clientApi.deleteClient(deleteEntityModal.entityId);
        await loadClients();
        if (selectedClient === deleteEntityModal.entityId) {
          setSelectedClient(null);
          setProjects([]);
          setSelectedProject(null);
          setProjectRates([]);
        }
      } else if (deleteEntityModal.entityType === 'project') {
        await projectApi.deleteProject(deleteEntityModal.entityId);
        if (selectedClient) {
          await loadClientProjects(selectedClient);
        }
        if (selectedProject === deleteEntityModal.entityId) {
          setSelectedProject(null);
          setProjectRates([]);
        }
      } else if (deleteEntityModal.entityType === 'rate') {
        await projectApi.deleteProjectRate(deleteEntityModal.entityId);
        if (selectedProject) {
          await loadProjectRates(selectedProject);
        }
      }

      closeDeleteEntityModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete item');
      clearError();
    } finally {
      setLoading(false);
    }
  };


  const startEditClient = (client: Client) => {
    setEditingClientId(client.id);
    setClientEditForm({ name: client.name, code: client.code });
    setShowAddClientForm(false);
  };

  const cancelEditClient = () => {
    setEditingClientId(null);
    setClientEditForm({ name: '', code: '' });
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClientId) return;

    setLoading(true);
    setError(null);

    try {
      await clientApi.updateClient(editingClientId, {
        name: clientEditForm.name,
        code: clientEditForm.code,
      });
      await loadClients();
      cancelEditClient();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update client');
      clearError();
    } finally {
      setLoading(false);
    }
  };

  const startEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setProjectEditForm({
      name: project.name,
      code: project.code,
      contract_type: project.contract_type,
      fixed_fee_amount: project.fixed_fee_amount != null ? String(project.fixed_fee_amount) : '',
      expected_hours: project.expected_hours != null ? String(project.expected_hours) : '',
      discount: project.discount != null ? String(project.discount) : '',
      project_discount: project.project_discount != null ? String(project.project_discount) : '0',
      standard_rate: project.standard_rate != null ? String(project.standard_rate) : '',
      is_billable: !!project.is_billable,
    });
    setShowAddProjectForm(false);
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setProjectEditForm(emptyProjectForm);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId) return;
    if (['fixed_fee', 'retainer'].includes(projectEditForm.contract_type) && !projectEditForm.fixed_fee_amount.trim()) {
      setError('Fixed fee amount is required for fixed fee and retainer projects');
      return;
    }
    if (projectEditForm.contract_type === 'admin' && !projectEditForm.standard_rate.trim()) {
      setError('Standard Rate per Hour is required for admin projects');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await projectApi.updateProject(editingProjectId, {
        name: projectEditForm.name,
        code: projectEditForm.code,
        contract_type: projectEditForm.contract_type,
        fixed_fee_amount: ['fixed_fee', 'retainer'].includes(projectEditForm.contract_type) && projectEditForm.fixed_fee_amount
          ? Number(projectEditForm.fixed_fee_amount)
          : null,
        expected_hours: ['fixed_fee', 'retainer'].includes(projectEditForm.contract_type) && projectEditForm.expected_hours
          ? Number(projectEditForm.expected_hours)
          : null,
        discount: ['fixed_fee', 'retainer'].includes(projectEditForm.contract_type) && projectEditForm.discount
          ? Number(projectEditForm.discount)
          : null,
        standard_rate: projectEditForm.contract_type === 'admin' && projectEditForm.standard_rate
          ? Number(projectEditForm.standard_rate)
          : null,
        project_discount: Number(projectEditForm.project_discount || 0),
        is_billable: projectEditForm.is_billable,
      });
      cancelEditProject();
      if (selectedClient) {
        await loadClientProjects(selectedClient);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update project');
      clearError();
    } finally {
      setLoading(false);
    }
  };

  const startEditRate = (rate: ProjectRate) => {
    setEditingRateId(rate.id);
    setRateEditForm({
      employeeName: rate.employee_name || '',
      designation: rate.designation || DESIGNATIONS[0],
      grossRate: String(rate.gross_rate ?? ''),
    });
    setShowAddRateForm(false);
  };

  const cancelEditRate = () => {
    setEditingRateId(null);
    setRateEditForm({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '' });
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRateId) return;

    setLoading(true);
    setError(null);

    try {
      await projectApi.updateProjectRate(editingRateId, {
        employee_name: rateEditForm.employeeName,
        designation: rateEditForm.designation,
        gross_rate: parseFloat(rateEditForm.grossRate)
      });
      cancelEditRate();
      if (selectedProject) {
        await loadProjectRates(selectedProject);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update rate');
      clearError();
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
      setInvoiceProjectFilter('ALL');
      setInvoicePage(1);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load invoice report');
      clearError();
    } finally {
      setInvoiceLoading(false);
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
      setPayablesProjectFilter('ALL');
      setPayablesStatusFilter('ALL');
      setPayablesTypeFilter('ALL');
      setPayablesPage(1);
      setSelectedPayableIds(new Set());
      setInlineRateEdits({});
      setNonBillableRateInput('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load payables report');
      clearError();
    } finally {
      setPayablesLoading(false);
    }
  };

  const handleApplyNonBillableRate = async () => {
    if (!payablesReport || !nonBillableRateInput) return;
    const rateNum = parseFloat(nonBillableRateInput);
    if (isNaN(rateNum) || rateNum < 0) {
      setError('Please enter a valid non-negative rate');
      clearError();
      return;
    }
    setNonBillableRateApplying(true);
    try {
      await employeeApi.setNonBillableRate(payablesReport.start_date, payablesReport.end_date, rateNum);
      // Refresh the report so net_payable values update
      const data = await employeeApi.getEmployeePayablesReport(
        payableStartDate,
        payableEndDate,
        payableEmployeeId || undefined
      );
      setPayablesReport(data);
      setPayablesPage(1);
      setSuccess('Non-billable rate applied successfully');
      clearSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply non-billable rate');
      clearError();
    } finally {
      setNonBillableRateApplying(false);
    }
  };

  const handleSaveInlineRate = async (workId: number) => {
    const rateStr = inlineRateEdits[workId];
    const rate = parseFloat(rateStr);
    if (isNaN(rate) || rate < 0) return;
    setSavingRateId(workId);
    try {
      await employeeApi.updateWorkPayableValues(workId, { payable_rate: rate });
      setPayablesReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((r) =>
            r.work_id === workId
              ? { ...r, rate, net_payable: parseFloat((rate * r.hours).toFixed(2)) }
              : r
          ),
        };
      });
      setInlineRateEdits((prev) => { const n = { ...prev }; delete n[workId]; return n; });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save rate');
      clearError();
    } finally {
      setSavingRateId(null);
    }
  };

  const handleMarkPayablesPaid = async (isPaid: boolean) => {
    const ids = Array.from(selectedPayableIds);
    if (ids.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await employeeApi.markPayablesPaid(ids, isPaid);
      setSelectedPayableIds(new Set());
      setPayableMarkPaidModal(null);
      await runPayablesReport();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update payment status');
      clearError();
    } finally {
      setLoading(false);
    }
  };

  const moveEmployeeCard = (draggedEmployeeId: number, targetEmployeeId: number) => {
    if (draggedEmployeeId === targetEmployeeId) return;
    setEmployeeCardOrder((prev) => {
      const current = prev.length ? [...prev] : employees.filter((employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').map((employee) => employee.id);
      const fromIndex = current.indexOf(draggedEmployeeId);
      const toIndex = current.indexOf(targetEmployeeId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      current.splice(fromIndex, 1);
      current.splice(toIndex, 0, draggedEmployeeId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_employee_card_order', JSON.stringify(current));
      }
      return current;
    });
  };

  const handleEmployeeCardDrop = () => {
    setDragOverEmployeeId(null);
    setDraggingEmployeeId(null);
  };

  const handleEmployeeCardDragStart = (employeeId: number, e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    isCardDraggingRef.current = true;
    suppressFlipUntilRef.current = Date.now() + 80;
    setDraggingEmployeeId(employeeId);
  };

  const handleEmployeeCardDragEnd = () => {
    isCardDraggingRef.current = false;
    suppressFlipUntilRef.current = Date.now() + 180;
    setDraggingEmployeeId(null);
    setDragOverEmployeeId(null);
  };

  const canFlipCard = () => !isCardDraggingRef.current && Date.now() >= suppressFlipUntilRef.current;

  const nonAdminEmployees = employees.filter((employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin');
  const orderedEmployeeCards = [
    ...employeeCardOrder
      .map((employeeId) => nonAdminEmployees.find((employee) => employee.id === employeeId))
      .filter((employee): employee is Employee => Boolean(employee)),
    ...nonAdminEmployees.filter((employee) => !employeeCardOrder.includes(employee.id)),
  ];
  const searchFilteredEmployeeCards = employeeSearchQuery.trim()
    ? orderedEmployeeCards.filter((emp) => {
      const q = employeeSearchQuery.trim().toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        (emp.designation || '').toLowerCase().includes(q) ||
        (emp.employee_code || '').toLowerCase().includes(q)
      );
    })
    : orderedEmployeeCards;
  const empCardsTotalPages = Math.max(1, Math.ceil(searchFilteredEmployeeCards.length / EMPLOYEE_CARDS_PAGE_SIZE));
  const empCardsStartIndex = (employeeCardsPage - 1) * EMPLOYEE_CARDS_PAGE_SIZE;
  const pagedEmployeeCards = searchFilteredEmployeeCards.slice(empCardsStartIndex, empCardsStartIndex + EMPLOYEE_CARDS_PAGE_SIZE);
  const selectedClientData = clients.find((client) => client.id === selectedClient) || null;
  const invoiceProjectOptions = invoiceReport
    ? Array.from(new Set([
        ...invoiceReport.rows.map((row) => row.project_code),
        ...(invoiceReport.expense_rows || []).map((ex: ClientInvoiceExpense) => ex.project_code)
      ])).filter(Boolean).sort()
    : [];

  const invoiceWorkRows = invoiceReport
    ? invoiceReport.rows.filter((row) => invoiceProjectFilter === 'ALL' || row.project_code === invoiceProjectFilter)
    : [];

  const invoiceExpenseRows = invoiceReport
    ? (invoiceReport.expense_rows || [])
        .filter((ex: ClientInvoiceExpense) => invoiceProjectFilter === 'ALL' || ex.project_code === invoiceProjectFilter)
        .map((ex: ClientInvoiceExpense, idx: number) => ({
          ...ex,
          isExpense: true,
          work_id: `expense-${idx}`,
          work_date: ex.date,
          hours: 0,
          net_billable: ex.amount,
          task_performed: ex.expense_type,
          employee_name: ex.employee_name,
          employee_designation: ex.employee_designation,
          gross_rate: 0,
          discount: 0,
          net_rate: 0,
          project_name: ex.project_name,
          project_code: ex.project_code,
          is_invoice_override: false
        }))
    : [];

  const filteredInvoiceRows = [...invoiceWorkRows, ...invoiceExpenseRows];
  const payablesProjectOptions = payablesReport
    ? Array.from(new Set(payablesReport.rows.map((row) => row.project_code || '-'))).sort()
    : [];
  const filteredPayablesRows = payablesReport
    ? payablesReport.rows.filter((row) => {
      if (payablesProjectFilter !== 'ALL' && (row.project_code || '-') !== payablesProjectFilter) return false;
      if (payablesStatusFilter === 'paid' && !row.is_paid) return false;
      if (payablesStatusFilter === 'unpaid' && row.is_paid) return false;
      if (payablesTypeFilter === 'non-billable' && !row.is_non_billable) return false;
      if (payablesTypeFilter === 'billable' && row.is_non_billable) return false;
      return true;
    })
    : [];

  const invoiceTotalRecords = filteredInvoiceRows.length;
  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotalRecords / invoicePageSize));
  const invoiceStartIndex = (invoicePage - 1) * invoicePageSize;
  const pagedInvoiceRows = filteredInvoiceRows.slice(invoiceStartIndex, invoiceStartIndex + invoicePageSize);
  const invoiceEndItem = invoiceTotalRecords === 0 ? 0 : Math.min(invoiceStartIndex + invoicePageSize, invoiceTotalRecords);

  const payablesTotalRecords = filteredPayablesRows.length;
  const payablesTotalPages = Math.max(1, Math.ceil(payablesTotalRecords / payablesPageSize));
  const payablesStartIndex = (payablesPage - 1) * payablesPageSize;
  const pagedPayablesRows = filteredPayablesRows.slice(payablesStartIndex, payablesStartIndex + payablesPageSize);
  const payablesEndItem = payablesTotalRecords === 0 ? 0 : Math.min(payablesStartIndex + payablesPageSize, payablesTotalRecords);
  const filteredTotalPaid = filteredPayablesRows.reduce((sum, r) => sum + (r.is_paid ? r.net_payable : 0), 0);
  const filteredTotalPayable = filteredPayablesRows.reduce((sum, r) => sum + (!r.is_paid ? r.net_payable : 0), 0);

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

  const downloadInvoiceCsv = () => {
    if (!invoiceReport) return;
    const rows: string[][] = [[
      'Project Code',
      'Employee',
      'Level',
      'Project Name',
      'Date',
      'Gross Rate',
      'Project Discount (%)',
      'Final Rate',
      'Hours',
      'Net Billable',
      'Task Performed',
    ]];

    filteredInvoiceRows.forEach((row: any) => {
      rows.push([
        row.project_code + (row.isExpense ? ' (Expense)' : ''),
        row.employee_name,
        row.employee_designation,
        row.project_name,
        row.work_date,
        row.isExpense ? '-' : row.gross_rate.toFixed(2),
        row.isExpense ? '-' : row.discount.toFixed(2),
        row.isExpense ? '-' : row.net_rate.toFixed(2),
        row.isExpense ? '-' : row.hours.toFixed(2),
        row.net_billable.toFixed(2),
        row.task_performed || '',
      ]);
    });

    rows.push([]);
    rows.push(['Total Hours', invoiceReport.total_hours.toFixed(2)]);
    rows.push(['Total Actual Billable', invoiceReport.total_net_billable.toFixed(2)]);
    rows.push(['Total Invoice Amount', invoiceReport.total_invoice_amount.toFixed(2)]);

    downloadCsvFile(
      `client_invoice_${invoiceReport.client.code}_${invoiceReport.start_date}_to_${invoiceReport.end_date}.csv`,
      rows
    );
  };

  const downloadPayablesCsv = () => {
    if (!payablesReport) return;
    const rows: string[][] = [[
      'Project Code',
      'Employee Name',
      'Employee Code',
      'Level',
      'Project Name',
      'Date',
      'Rate',
      'Hours',
      'Net Payable',
      'Task Performed',
    ]];

    filteredPayablesRows.forEach((row) => {
      rows.push([
        row.project_code || '',
        row.employee_name,
        row.employee_code || '',
        row.employee_designation,
        row.project_name,
        row.work_date,
        row.rate.toFixed(2),
        row.hours.toFixed(2),
        row.net_payable.toFixed(2),
        row.task_performed || '',
      ]);
    });

    rows.push([]);
    rows.push(['Total Hours', payablesReport.total_hours.toFixed(2)]);
    rows.push(['Total Payable', payablesReport.total_net_payable.toFixed(2)]);

    downloadCsvFile(
      `employee_payables_${payablesReport.start_date}_to_${payablesReport.end_date}.csv`,
      rows
    );
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
        {/* Dashboard Summary */}
        <div className="glass-panel rounded-3xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-3xl font-black text-slate-900">Admin Dashboard</h2>
              <p className="text-slate-600 mt-1">Organization Overview</p>
            </div>
            <p className="text-slate-500 text-sm"><LiveClock /></p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-cyan-100/80 via-white/80 to-blue-100/70 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-700 font-bold">Total Employees</p>
              <p className="text-4xl font-black text-slate-900 mt-3">{employees.filter((emp) => (emp.role ?? (emp.is_admin ? 'admin' : 'employee')) !== 'admin').length}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-emerald-100/80 via-white/80 to-teal-100/70 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-bold">Total Clients</p>
              <p className="text-4xl font-black text-slate-900 mt-3">{clients.length}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-indigo-100/80 via-white/80 to-violet-100/70 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.18em] text-indigo-700 font-bold">Total Projects</p>
              <p className="text-4xl font-black text-slate-900 mt-3">{totalProjectsCount}</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-panel bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-4">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="glass-panel bg-emerald-50/80 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl mb-4">
            {successMsg}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="glass-panel rounded-2xl mb-6 border-b border-white/50">
          <div className="flex">
            <button
              onClick={() => setActiveTab('onboarding')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${activeTab === 'onboarding'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
                }`}
            >
              Employee Management
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${activeTab === 'clients'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
                }`}
            >
              Clients & Projects
            </button>
            <button
              onClick={() => setActiveTab('invoicing')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${activeTab === 'invoicing'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-white/50'
                : 'text-slate-600 hover:text-slate-800 border-b-2 border-transparent'
                }`}
            >
              Invoicing
            </button>
            <button
              onClick={() => setActiveTab('payables')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${activeTab === 'payables'
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
                      minLength={8}
                      className="border border-slate-300 rounded-xl px-4 py-2 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Reporting Manager"
                      value={employeeForm.reporting_manager}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, reporting_manager: e.target.value })}
                      required
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
                {employees.filter((employee: Employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee.id)}
                    className={`text-left p-4 rounded-lg border-2 transition cursor-pointer ${selectedEmployee === employee.id
                      ? 'border-blue-500 bg-blue-50/70'
                      : 'border-white/60 bg-white/45 hover:border-blue-300'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-800">{employee.name}</p>
                        <p className="text-sm text-gray-600">{employee.email}</p>
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

              {employees.filter((employee: Employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').length === 0 && !showAddEmployeeForm && (
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
                  <div className={`inline-flex items-center px-4 py-2 rounded-full ${employeeStatus.today_hours > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                    }`}>
                    <div className={`w-3 h-3 rounded-full mr-2 ${employeeStatus.today_hours > 0 ? 'bg-green-500' : 'bg-gray-400'
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
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Employee Management</h2>
                  <p className="text-sm text-slate-600 mt-1">Create employee + compensation/promotion profile in one step.</p>
                </div>
                <button
                  onClick={() => { setShowOnboardingForm(true); setShowOnboardingPassword(false); setOnboardingEmailError(null); setOnboardingPasswordError(null); }}
                  className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl transition"
                >
                  + Add Employee Profile
                </button>
              </div>
            </div>

            {/* Employee Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search employees by name, email, designation, or employee code..."
                value={employeeSearchQuery}
                onChange={(e) => { setEmployeeSearchQuery(e.target.value); setEmployeeCardsPage(1); }}
                className="w-full pl-12 pr-10 py-3 rounded-2xl border border-white/70 bg-white/60 backdrop-blur-sm text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-300 shadow-sm transition"
              />
              {employeeSearchQuery && (
                <button
                  type="button"
                  onClick={() => { setEmployeeSearchQuery(''); setEmployeeCardsPage(1); }}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {pagedEmployeeCards.map((employee: Employee) => (
                <div
                  key={employee.id}
                  style={{ perspective: '1000px' }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverEmployeeId !== employee.id) {
                      setDragOverEmployeeId(employee.id);
                    }
                  }}
                  onDragEnter={() => {
                    if (draggingEmployeeId !== null && draggingEmployeeId !== employee.id) {
                      moveEmployeeCard(draggingEmployeeId, employee.id);
                    }
                  }}
                  onDrop={handleEmployeeCardDrop}
                  className={`transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01] ${draggingEmployeeId === employee.id ? 'opacity-60 scale-[0.98]' : ''
                    } ${dragOverEmployeeId === employee.id ? 'ring-2 ring-cyan-400/70 rounded-2xl ring-offset-2 ring-offset-transparent' : ''
                    }`}
                >
                  <div
                    draggable
                    onDragStart={(e) => handleEmployeeCardDragStart(employee.id, e)}
                    onDragEnd={handleEmployeeCardDragEnd}
                    className="relative h-[28rem] w-full transition-transform duration-700"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: flippedCards[employee.id] ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!canFlipCard()) return;
                        toggleCardFlip(employee.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!canFlipCard()) return;
                          toggleCardFlip(employee.id);
                        }
                      }}
                      className="absolute inset-0 w-full text-left rounded-2xl p-5 shadow-xl hover:shadow-2xl overflow-hidden border border-white/60 bg-gradient-to-br from-cyan-100/75 via-white/70 to-indigo-100/75 backdrop-blur-xl"
                      style={{
                        backfaceVisibility: 'hidden',
                        pointerEvents: flippedCards[employee.id] ? 'none' : 'auto',
                      }}
                    >
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full border border-white/80 bg-white/75 text-slate-600 font-semibold cursor-grab"
                        title="Drag from anywhere on card to reorder"
                      >
                        Drag
                      </div>
                      <div className="absolute -top-14 -right-10 w-36 h-36 bg-cyan-300/30 rounded-full blur-2xl" />
                      <div className="absolute -bottom-14 -left-10 w-36 h-36 bg-indigo-300/30 rounded-full blur-2xl" />
                      <div className="mt-2 mb-5 flex items-center gap-4">
                        <div className="relative w-20 h-20 rounded-3xl overflow-hidden border border-white/85 shadow-xl bg-white/70 shrink-0">
                          {employee.profile_photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={employee.profile_photo} alt={`${employee.name} profile`} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${getEmployeeAvatarGradient(employee)} flex items-center justify-center text-white font-black text-lg`}>
                              {getEmployeeInitials(employee.name)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col justify-center">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-700 font-bold">Employee Profile</p>
                          <p className="text-xs text-slate-500 mt-1">Tap card to flip details</p>
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mt-2 leading-tight">{employee.name}</h3>
                      <p className="text-slate-600 text-sm mt-1">{employee.email}</p>
                      <div className="mt-3">
                        {(() => {
                          const r = employee.role || 'employee';
                          const cfg = r === 'both'
                            ? { label: '⚡ Both', cls: 'bg-amber-100 text-amber-800 border-amber-200' }
                            : r === 'admin'
                              ? { label: '🛡️ Admin', cls: 'bg-violet-100 text-violet-800 border-violet-200' }
                              : { label: '👤 Employee', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="mt-4 rounded-2xl bg-white/72 border border-white/70 p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Emp ID</p>
                        <p className="text-lg font-black text-slate-900 mt-1">{employee.employee_code || 'Not set'}</p>
                        <p className="text-xs text-slate-500 mt-2">Designation</p>
                        <p className="text-sm font-semibold text-slate-800">{employee.designation || 'Not set'}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-4">Click to flip for key details</p>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!canFlipCard()) return;
                        setFlippedCards((prev) => ({ ...prev, [employee.id]: false }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!canFlipCard()) return;
                          setFlippedCards((prev) => ({ ...prev, [employee.id]: false }));
                        }
                      }}
                      className="absolute inset-0 w-full text-left rounded-2xl p-5 shadow-xl overflow-hidden border border-white/60 bg-gradient-to-br from-indigo-100/80 via-white/75 to-blue-100/75 backdrop-blur-xl flex flex-col"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        pointerEvents: flippedCards[employee.id] ? 'auto' : 'none',
                      }}
                    >
                      <div
                        className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full border border-white/80 bg-white/75 text-slate-600 font-semibold cursor-grab"
                        title="Drag from anywhere on card to reorder"
                      >
                        Drag
                      </div>
                      <div className="absolute -top-14 -left-10 w-36 h-36 bg-indigo-300/30 rounded-full blur-2xl" />
                      <div className="absolute -bottom-14 -right-10 w-36 h-36 bg-blue-300/30 rounded-full blur-2xl" />
                      <p className="text-[10px] uppercase tracking-[0.28em] text-indigo-700 font-bold">Employee Details</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">Core Information</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-slate-700"><span className="font-semibold">Emp ID:</span> {employee.employee_code || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-slate-700"><span className="font-semibold">Designation:</span> {employee.designation || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-slate-700"><span className="font-semibold">Start Date:</span> {employee.start_date || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-slate-700"><span className="font-semibold"> Reporting Manager:</span> {employee.reporting_manager || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-slate-700 col-span-2"><span className="font-semibold">Current Rate:</span> {employee.current_hourly_rate ?? '-'}</p>
                      </div>

                      {/* Role management */}
                      <div className="mt-2 rounded-xl border border-indigo-200/70 bg-indigo-50/60 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-indigo-700 mb-2">Access Role</p>
                        <div className="flex items-center gap-2">
                          <select
                            value={employeeRoleEdit[employee.id] ?? (employee.role || 'employee')}
                            onChange={(e) => setEmployeeRoleEdit((prev) => ({ ...prev, [employee.id]: e.target.value }))}
                            className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="employee">👤 Employee</option>
                            <option value="admin">🛡️ Admin</option>
                            <option value="both">⚡ Both</option>
                          </select>
                          <button
                            type="button"
                            disabled={
                              savingRoleId === employee.id ||
                              !employeeRoleEdit[employee.id] ||
                              employeeRoleEdit[employee.id] === (employee.role || 'employee')
                            }
                            onClick={(e) => { e.stopPropagation(); handleUpdateRole(employee.id); }}
                            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                          >
                            {savingRoleId === employee.id ? '...' : 'Save'}
                          </button>
                        </div>
                        <p className="mt-1.5 text-[10px] text-slate-500">
                          Current: <span className={`font-semibold ${(employee.role || 'employee') === 'both' ? 'text-amber-600' :
                            (employee.role || 'employee') === 'admin' ? 'text-violet-600' : 'text-emerald-600'
                            }`}>{(employee.role || 'employee').charAt(0).toUpperCase() + (employee.role || 'employee').slice(1)}</span>
                        </p>
                      </div>

                      <div className="mt-auto pt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEmployeeId(employee.id);
                          }}
                          className="glass-primary-btn hover:brightness-95 text-white px-3 py-2 rounded-lg text-sm"
                        >
                          Edit Full Details
                        </button>
                        {!employee.has_set_password && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleResendWelcome(employee.id); }}
                            disabled={resendingWelcomeId === employee.id}
                            className={`px-3 py-2 text-sm font-semibold rounded-lg transition disabled:opacity-40 ${resendWelcomeSuccessId === employee.id
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                              }`}
                          >
                            {resendingWelcomeId === employee.id ? 'Sending...' : resendWelcomeSuccessId === employee.id ? '\u2713 Sent!' : 'Resend Welcome'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteEmployeeModal(employee.id, employee.name);
                          }}
                          className="px-3 py-2 text-sm font-semibold glass-danger-btn rounded-lg hover:brightness-95 transition"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlippedCards((prev) => ({ ...prev, [employee.id]: false }));
                          }}
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

            {searchFilteredEmployeeCards.length > EMPLOYEE_CARDS_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-4 mt-2 pt-4 border-t border-white/40">
                <span className="text-sm text-slate-600">
                  Showing {empCardsStartIndex + 1}–{Math.min(empCardsStartIndex + EMPLOYEE_CARDS_PAGE_SIZE, searchFilteredEmployeeCards.length)} of {searchFilteredEmployeeCards.length} employees
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmployeeCardsPage((p) => Math.max(1, p - 1))}
                    disabled={employeeCardsPage <= 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white/80 text-slate-700 hover:bg-white/95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {employeeCardsPage} of {empCardsTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setEmployeeCardsPage((p) => Math.min(empCardsTotalPages, p + 1))}
                    disabled={employeeCardsPage >= empCardsTotalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white/80 text-slate-700 hover:bg-white/95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLIENTS & PROJECTS TAB */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Clients + Client Default Rates */}
            <div className="space-y-6">
              <div className="glass-panel rounded-3xl p-6 border border-white/70 bg-gradient-to-br from-cyan-50/70 via-white/75 to-blue-100/60">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-100/80">
                      <svg className="w-4 h-4 text-cyan-600" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 leading-tight">Clients</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddClientForm(!showAddClientForm)}
                    className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                  >
                    {showAddClientForm ? 'Cancel' : '+ Add Client'}
                  </button>
                </div>

                {showAddClientForm && (
                  <form onSubmit={handleAddClient} className="mb-4 p-3 glass-subtle rounded-xl border border-white/60">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-cyan-700 mb-1">CLIENT NAME</label>
                        <input
                          type="text"
                          placeholder="e.g., Lekadir"
                          value={clientForm.name}
                          onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                          required
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-cyan-700 mb-1">CLIENT CODE</label>
                        <input
                          type="text"
                          placeholder="e.g., LD"
                          value={clientForm.code}
                          onChange={(e) => setClientForm({ ...clientForm, code: e.target.value.toUpperCase() })}
                          required
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
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

                {editingClientId !== null && (
                  <form onSubmit={handleUpdateClient} className="mb-4 p-3 rounded-2xl border border-cyan-200/70 bg-cyan-50/70">
                    <p className="text-xs uppercase tracking-[0.18em] font-bold text-cyan-700 mb-3">Edit Client</p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={clientEditForm.name}
                        onChange={(e) => setClientEditForm({ ...clientEditForm, name: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <input
                        type="text"
                        value={clientEditForm.code}
                        onChange={(e) => setClientEditForm({ ...clientEditForm, code: e.target.value.toUpperCase() })}
                        required
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm transition disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : 'Save Client'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditClient}
                        className="px-4 py-2 rounded-xl text-sm border border-slate-300 bg-white/70 text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {clients.map((client) => {
                    const cInitials = client.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                    const cPalette = ['bg-cyan-500', 'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500'];
                    const cBg = cPalette[(client.name.charCodeAt(0) || 0) % cPalette.length];
                    const isSelected = selectedClient === client.id;
                    return (
                      <div
                        key={client.id}
                        onClick={() => setSelectedClient(client.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all duration-200 ${isSelected
                          ? 'border-cyan-300/80 bg-gradient-to-r from-cyan-50 to-blue-50/60 shadow-md ring-1 ring-cyan-200/50'
                          : 'border-slate-100 bg-white/60 hover:border-cyan-200/60 hover:bg-white/90 hover:shadow-sm'
                          }`}
                      >
                        <div className={`w-9 h-9 rounded-xl ${cBg} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                          {cInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate text-sm leading-tight">{client.name}</p>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">{client.code}</p>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full shrink-0">Active</span>
                        )}
                        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => startEditClient(client)}
                            disabled={loading}
                            title="Edit client"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 transition disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                          </button>
                          <button
                            onClick={() => openDeleteEntityModal('client', client.id, client.name)}
                            disabled={loading}
                            title="Delete client"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {clients.length === 0 && !showAddClientForm && (
                  <p className="text-slate-500 text-center py-4">No clients found.</p>
                )}
              </div>
              {/* End clients panel */}


            </div>
            {/* End left column wrapper */}

            {/* RIGHT: Projects & Rates */}
            <div className="space-y-6">
              {/* Projects Section */}
              {selectedClient && selectedClientData && (
                <div className="glass-panel rounded-3xl p-6 border border-white/70 bg-gradient-to-br from-cyan-50/75 via-white/75 to-blue-100/65 transition-all duration-500">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-cyan-100/80">
                        <svg className="w-5 h-5 text-cyan-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" /></svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedClientData.name}</h3>
                          <span className="text-[10px] font-bold font-mono text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-lg border border-cyan-200">{selectedClientData.code}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddProjectForm(!showAddProjectForm);
                        setEditingProjectId(null);
                      }}
                      className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                    >
                      {showAddProjectForm ? 'Hide Form' : '+ New Project'}
                    </button>
                  </div>

                  {showAddProjectForm && (
                    <form onSubmit={handleAddProject} className="mb-4 p-4 glass-subtle rounded-2xl border border-white/60 bg-white/65">
                      <p className="text-xs uppercase tracking-[0.18em] font-bold text-blue-700 mb-3">Create New Project</p>
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
                        <div>
                          <label className="block text-xs font-bold text-blue-700 mb-1">CONTRACT TYPE</label>
                          <select
                            value={projectForm.contract_type}
                            onChange={(e) => {
                              const nextType = e.target.value as ProjectContractType;
                              setProjectForm({
                                ...projectForm,
                                contract_type: nextType,
                                fixed_fee_amount: ['fixed_fee', 'retainer'].includes(nextType) ? projectForm.fixed_fee_amount : '',
                                expected_hours: ['fixed_fee', 'retainer'].includes(nextType) ? projectForm.expected_hours : '',
                                discount: ['fixed_fee', 'retainer'].includes(nextType) ? projectForm.discount : '',
                                standard_rate: nextType === 'admin' ? projectForm.standard_rate : '',
                                is_billable: nextType === 'documentation' ? projectForm.is_billable : true,
                              });
                            }}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          >
                            <option value="time_materials">Time & Materials</option>
                            <option value="fixed_fee">Fixed fee</option>
                            <option value="retainer">Retainers</option>
                            <option value="documentation">Documentation</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        {['fixed_fee', 'retainer'].includes(projectForm.contract_type) && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-blue-700 mb-1">FIXED FEE AMOUNT ($)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="e.g., 25000"
                                value={projectForm.fixed_fee_amount}
                                onChange={(e) => setProjectForm({ ...projectForm, fixed_fee_amount: e.target.value })}
                                required
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-blue-700 mb-1">EXPECTED HOURS</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="e.g., 100"
                                value={projectForm.expected_hours}
                                onChange={(e) => setProjectForm({ ...projectForm, expected_hours: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </>
                        )}
                        {projectForm.contract_type === 'admin' && (
                          <div>
                            <label className="block text-xs font-bold text-blue-700 mb-1">STANDARD RATE PER HOUR ($)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="e.g., 50"
                              value={projectForm.standard_rate}
                              onChange={(e) => setProjectForm({ ...projectForm, standard_rate: e.target.value })}
                              required
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        {projectForm.contract_type === 'documentation' && (
                          <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3">
                            <label className="block text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Billing Logic</label>
                            <div className="flex bg-white/60 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setProjectForm({ ...projectForm, is_billable: true })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${projectForm.is_billable
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-50'
                                  }`}
                              >
                                Billable
                              </button>
                              <button
                                type="button"
                                onClick={() => setProjectForm({ ...projectForm, is_billable: false })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${!projectForm.is_billable
                                  ? 'bg-slate-600 text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-50'
                                  }`}
                              >
                                Non-Billable
                              </button>
                            </div>
                          </div>
                        )}
                        {projectForm.contract_type !== 'documentation' && (
                          <div>
                            <label className="block text-xs font-bold text-blue-700 mb-1 font-inter uppercase tracking-wide">Project Discount (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              placeholder="e.g., 10"
                              value={projectForm.project_discount}
                              onChange={(e) => setProjectForm({ ...projectForm, project_discount: e.target.value })}
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}
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

                  {editingProjectId !== null && (
                    <form onSubmit={handleUpdateProject} className="mb-4 p-4 rounded-2xl border border-cyan-200/70 bg-cyan-50/70 backdrop-blur-sm">
                      <p className="text-xs uppercase tracking-[0.18em] font-bold text-cyan-700 mb-3">Edit Project</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-cyan-700 mb-1">PROJECT NAME</label>
                          <input
                            type="text"
                            value={projectEditForm.name}
                            onChange={(e) => setProjectEditForm({ ...projectEditForm, name: e.target.value })}
                            required
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-cyan-700 mb-1">PROJECT CODE</label>
                          <input
                            type="text"
                            value={projectEditForm.code}
                            onChange={(e) => setProjectEditForm({ ...projectEditForm, code: e.target.value.toUpperCase() })}
                            required
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-cyan-700 mb-1">CONTRACT TYPE</label>
                          <select
                            value={projectEditForm.contract_type}
                            onChange={(e) => {
                              const nextType = e.target.value as ProjectContractType;
                              setProjectEditForm({
                                ...projectEditForm,
                                contract_type: nextType,
                                fixed_fee_amount: ['fixed_fee', 'retainer'].includes(nextType) ? projectEditForm.fixed_fee_amount : '',
                                expected_hours: ['fixed_fee', 'retainer'].includes(nextType) ? projectEditForm.expected_hours : '',
                                discount: ['fixed_fee', 'retainer'].includes(nextType) ? projectEditForm.discount : '',
                                standard_rate: nextType === 'admin' ? projectEditForm.standard_rate : '',
                                is_billable: nextType === 'documentation' ? projectEditForm.is_billable : true,
                              });
                            }}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            required
                          >
                            <option value="time_materials">Time & Materials</option>
                            <option value="fixed_fee">Fixed fee</option>
                            <option value="retainer">Retainers</option>
                            <option value="documentation">Documentation</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        {['fixed_fee', 'retainer'].includes(projectEditForm.contract_type) && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-cyan-700 mb-1">FIXED FEE AMOUNT ($)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={projectEditForm.fixed_fee_amount}
                                onChange={(e) => setProjectEditForm({ ...projectEditForm, fixed_fee_amount: e.target.value })}
                                required
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-cyan-700 mb-1">EXPECTED HOURS</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={projectEditForm.expected_hours}
                                onChange={(e) => setProjectEditForm({ ...projectEditForm, expected_hours: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                          </>
                        )}
                        {projectEditForm.contract_type === 'admin' && (
                          <div>
                            <label className="block text-xs font-bold text-cyan-700 mb-1">STANDARD RATE PER HOUR ($)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={projectEditForm.standard_rate}
                              onChange={(e) => setProjectEditForm({ ...projectEditForm, standard_rate: e.target.value })}
                              required
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                        {projectEditForm.contract_type === 'documentation' && (
                          <div className="rounded-xl border border-cyan-300/60 bg-cyan-100/40 p-3">
                            <label className="block text-xs font-bold text-cyan-700 mb-2 uppercase tracking-wide">Billing Logic</label>
                            <div className="flex bg-white/80 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setProjectEditForm({ ...projectEditForm, is_billable: true })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${projectEditForm.is_billable
                                  ? 'bg-cyan-600 text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-50'
                                  }`}
                              >
                                Billable
                              </button>
                              <button
                                type="button"
                                onClick={() => setProjectEditForm({ ...projectEditForm, is_billable: false })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${!projectEditForm.is_billable
                                  ? 'bg-slate-600 text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-50'
                                  }`}
                              >
                                Non-Billable
                              </button>
                            </div>
                          </div>
                        )}
                        {projectEditForm.contract_type !== 'documentation' && (
                          <div>
                            <label className="block text-xs font-bold text-cyan-700 mb-1 font-inter uppercase tracking-wide">Project Discount (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={projectEditForm.project_discount}
                              onChange={(e) => setProjectEditForm({ ...projectEditForm, project_discount: e.target.value })}
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm transition disabled:opacity-50"
                        >
                          {loading ? 'Saving...' : 'Save Project'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditProject}
                          className="px-4 py-2 rounded-xl text-sm border border-slate-300 bg-white/70 text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2">
                    {projects.map((project) => {
                      const pIsSelected = selectedProject === project.id;
                      return (
                        <div
                          key={project.id}
                          onClick={() => setSelectedProject(project.id)}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${pIsSelected
                            ? 'border-cyan-300/80 bg-gradient-to-r from-cyan-50 to-blue-50/60 shadow-md ring-1 ring-cyan-200/50'
                            : 'border-slate-100 bg-white/60 hover:border-cyan-200/60 hover:bg-white/90 hover:shadow-sm'
                            }`}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${pIsSelected ? 'bg-cyan-500' : 'bg-slate-100'
                            }`}>
                            <svg className={`w-4 h-4 ${pIsSelected ? 'text-white' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate text-sm leading-tight">{project.name}</p>
                            <span className="inline-block mt-0.5 text-[10px] font-bold font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                              {selectedClientData.code}-{project.code}
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${project.contract_type === 'fixed_fee'
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : project.contract_type === 'documentation'
                                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                }`}>
                                {project.contract_type === 'fixed_fee' ? 'Fixed fee' : project.contract_type === 'documentation' ? 'Documentation' : 'Time & Materials'}
                              </span>
                              {project.contract_type === 'documentation' && (
                                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${project.is_billable ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-600 bg-slate-100 border-slate-300'}`}>
                                  {project.is_billable ? 'Billable' : 'Non-Billable'}
                                </span>
                              )}
                              {project.contract_type === 'fixed_fee' && project.fixed_fee_amount != null && (
                                <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md border text-amber-700 bg-amber-50 border-amber-200">
                                  $ {project.fixed_fee_amount.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          {pIsSelected && (
                            <span className="text-[10px] font-bold text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full shrink-0">Active</span>
                          )}
                          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => startEditProject(project)}
                              disabled={loading}
                              title="Edit project"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 transition disabled:opacity-50"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                            </button>
                            <button
                              onClick={() => openDeleteEntityModal('project', project.id, project.name)}
                              disabled={loading}
                              title="Delete project"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {projects.length === 0 && !showAddProjectForm && (
                    <p className="text-slate-500 text-center py-4">No projects found.</p>
                  )}
                </div>
              )}




              {!selectedClient && (
                <div className="min-h-64 glass-panel rounded-3xl p-8 flex items-center justify-center border border-white/70 bg-gradient-to-br from-cyan-50/70 via-white/70 to-blue-100/65">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-100/80 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" /></svg>
                    </div>
                    <p className="text-base font-bold text-slate-700">No client selected</p>
                    <p className="text-sm text-slate-400 mt-1">Pick a client on the left to manage its projects and rates</p>
                  </div>
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
                <div className="mb-4 rounded-2xl border border-white/70 bg-white/60 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] items-center gap-3">
                    <div>
                      <p className="text-sm text-slate-600">
                        Client: <span className="font-semibold text-slate-900">{invoiceReport.client.name}</span>
                      </p>
                      <p className="text-sm text-slate-600">
                        Period: {invoiceReport.start_date} to {invoiceReport.end_date}
                      </p>
                    </div>
                    <div className="rounded-xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/80 to-blue-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-cyan-700 font-bold">Currency</p>
                      <p className="text-lg font-black text-slate-900">$</p>
                    </div>
                    <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-indigo-700 font-bold">Total Invoice Amount</p>
                      <p className="text-2xl font-black text-slate-900">{invoiceReport.total_invoice_amount.toFixed(2)}</p>
                    </div>
                  </div>
                  {invoiceReport.fixed_fee_warnings.length > 0 && (
                    <div className="mt-3 rounded-xl border border-amber-300/80 bg-amber-50/80 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] font-bold text-amber-800 mb-2">Fixed Fee Variance Warnings</p>
                      <div className="space-y-1.5 text-sm text-amber-900">
                        {invoiceReport.fixed_fee_warnings.map((warning) => (
                          <p key={warning.project_id}>
                            <span className="font-semibold">{warning.project_code}</span>
                            {' - '}
                            {warning.status === 'overage' ? 'Overage' : 'Nearing threshold'}
                            {': '}Actual $ {warning.actual_hours_amount.toFixed(2)} vs Fixed $ {warning.fixed_fee_amount.toFixed(2)}
                            {warning.utilization_ratio != null && ` (${(warning.utilization_ratio * 100).toFixed(1)}%)`}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={downloadInvoiceCsv}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:brightness-95 shadow-md transition"
                    title="Download Invoice CSV"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 3v12" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    <span className="text-sm font-semibold">Download CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => employeeApi.downloadClientInvoicePdf(
                      invoiceReport.client.id,
                      invoiceReport.start_date,
                      invoiceReport.end_date,
                      invoiceReport.client.code,
                      invoiceProjectFilter
                    )}
                    className="mt-3 ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200/80 bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:brightness-95 shadow-md transition"
                    title="Download Invoice PDF"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-sm font-semibold">Download PDF</span>
                  </button>
                  <div className="mt-3 max-w-xs">
                    <label className="block text-xs uppercase tracking-[0.16em] font-bold text-slate-600 mb-1">Project Filter</label>
                    <select
                      value={invoiceProjectFilter}
                      onChange={(e) => { setInvoiceProjectFilter(e.target.value); setInvoicePage(1); }}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/90 text-sm"
                    >
                      <option value="ALL">All</option>
                      {invoiceProjectOptions.map((projectCode) => (
                        <option key={projectCode} value={projectCode}>
                          {projectCode}
                        </option>
                      ))}
                    </select>
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoiceRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={11}>
                            No invoice entries found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        pagedInvoiceRows.map((row: any) => (
                          <tr key={row.work_id} className={row.isExpense ? "bg-emerald-50/40 hover:bg-emerald-50/60 transition-colors" : "hover:bg-slate-50/70"}>
                            <td className="px-4 py-3 text-slate-800 font-semibold">
                              {row.project_code}
                              {row.isExpense && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                  Expense
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_designation}</td>
                            <td className="px-4 py-3 text-slate-700">{row.project_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.work_date}</td>
                            <td className="px-4 py-3 text-slate-700">{row.isExpense ? '-' : row.gross_rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">{row.isExpense ? '-' : `${row.discount.toFixed(2)}%`}</td>
                            <td className="px-4 py-3 text-slate-700">{row.isExpense ? '-' : row.net_rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">{row.isExpense ? '-' : row.hours.toFixed(2)}</td>
                            <td className={row.isExpense ? "px-4 py-3 font-bold text-emerald-700" : "px-4 py-3 font-bold text-slate-900"}>
                              {row.net_billable.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-slate-700 align-top">
                              <span className="block whitespace-pre-line break-words max-w-[200px]" title={row.task_performed || '-'}>{row.task_performed || '-'}</span>
                              {row.is_invoice_override && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800">
                                  Admin Override
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {invoiceTotalRecords > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-slate-600">Rows per page</label>
                      <select
                        value={invoicePageSize}
                        onChange={(e) => { setInvoicePageSize(Number(e.target.value)); setInvoicePage(1); }}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white/80"
                      >
                        {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="text-sm text-slate-600">
                        Showing {invoiceTotalRecords === 0 ? 0 : invoiceStartIndex + 1}–{invoiceEndItem} of {invoiceTotalRecords}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                        disabled={invoicePage <= 1}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">Page {invoicePage} of {invoiceTotalPages}</span>
                      <button
                        type="button"
                        onClick={() => setInvoicePage((p) => Math.min(invoiceTotalPages, p + 1))}
                        disabled={invoicePage >= invoiceTotalPages}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
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
                    .filter((emp) => (emp.role ?? (emp.is_admin ? 'admin' : 'employee')) !== 'admin')
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
            </div>

            {payablesReport && (
              <div className="glass-panel rounded-3xl p-6">
                <div className="mb-4 rounded-2xl border border-white/70 bg-white/60 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_auto_auto] items-center gap-3">
                    <div>
                      <p className="text-sm text-slate-600">
                        Period: {payablesReport.start_date} to {payablesReport.end_date}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-700 font-bold">Currency</p>
                      <p className="text-lg font-black text-slate-900">INR</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-lime-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-700 font-bold">Total Payable</p>
                      <p className="text-2xl font-black text-slate-900">{filteredTotalPayable.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Total Paid</p>
                      <p className="text-2xl font-black text-slate-900">{filteredTotalPaid.toFixed(2)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadPayablesCsv}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-95 shadow-md transition"
                    title="Download Payables CSV"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 3v12" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    <span className="text-sm font-semibold">Download CSV</span>
                  </button>

                  {/* Filters row */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-[0.16em] font-bold text-slate-600 mb-1">Project</label>
                      <select
                        value={payablesProjectFilter}
                        onChange={(e) => { setPayablesProjectFilter(e.target.value); setPayablesPage(1); }}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/90 text-sm"
                      >
                        <option value="ALL">All Projects</option>
                        {payablesProjectOptions.map((projectCode) => (
                          <option key={projectCode} value={projectCode}>{projectCode}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-[0.16em] font-bold text-slate-600 mb-1">Status</label>
                      <select
                        value={payablesStatusFilter}
                        onChange={(e) => { setPayablesStatusFilter(e.target.value as 'ALL' | 'paid' | 'unpaid'); setPayablesPage(1); }}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/90 text-sm"
                      >
                        <option value="ALL">All</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-[0.16em] font-bold text-slate-600 mb-1">Type</label>
                      <select
                        value={payablesTypeFilter}
                        onChange={(e) => { setPayablesTypeFilter(e.target.value as 'ALL' | 'non-billable' | 'billable'); setPayablesPage(1); }}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/90 text-sm"
                      >
                        <option value="ALL">All</option>
                        <option value="non-billable">Non-Billable</option>
                        <option value="billable">Billable</option>
                      </select>
                    </div>
                  </div>
                </div>

                {selectedPayableIds.size > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                    <span className="text-sm font-semibold text-emerald-800">
                      {selectedPayableIds.size} {selectedPayableIds.size === 1 ? 'entry' : 'entries'} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setPayableMarkPaidModal({ open: true, isPaid: true })}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      Mark as Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayableMarkPaidModal({ open: true, isPaid: false })}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-500 text-white hover:bg-slate-600 transition"
                    >
                      Mark as Unpaid
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPayableIds(new Set())}
                      className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
                <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/65">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/90">
                      <tr>
                        <th className="px-3 py-3 text-center font-bold text-slate-600 w-10">
                          <input
                            type="checkbox"
                            checked={pagedPayablesRows.length > 0 && pagedPayablesRows.every((r) => selectedPayableIds.has(r.work_id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPayableIds((prev) => {
                                  const next = new Set(prev);
                                  pagedPayablesRows.forEach((r) => next.add(r.work_id));
                                  return next;
                                });
                              } else {
                                setSelectedPayableIds((prev) => {
                                  const next = new Set(prev);
                                  pagedPayablesRows.forEach((r) => next.delete(r.work_id));
                                  return next;
                                });
                              }
                            }}
                            className="rounded border-slate-300"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Project Code</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Name</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Level</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Project Name</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Date</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Rate</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Hours</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Net Payable</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Status</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em]">Task Performed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayablesRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={11}>
                            No payable entries found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        pagedPayablesRows.map((row) => (
                          <tr key={row.work_id} className="hover:bg-slate-50/70">
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedPayableIds.has(row.work_id)}
                                onChange={(e) => {
                                  setSelectedPayableIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(row.work_id);
                                    else next.delete(row.work_id);
                                    return next;
                                  });
                                }}
                                className="rounded border-slate-300"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-800 font-semibold">
                              <div className="flex items-center gap-1.5">
                                {row.project_code || '-'}
                                {row.is_non_billable && (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md whitespace-nowrap">Non-Billable</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_designation}</td>
                            <td className="px-4 py-3 text-slate-700">{row.project_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.work_date}</td>
                            <td className="px-4 py-3">
                              {row.is_non_billable ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={inlineRateEdits[row.work_id] ?? row.rate.toFixed(2)}
                                    onChange={(e) => setInlineRateEdits((prev) => ({ ...prev, [row.work_id]: e.target.value }))}
                                    className="w-20 border border-amber-300 rounded-lg px-2 py-1 text-xs bg-white/90 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                  />
                                  {inlineRateEdits[row.work_id] !== undefined && (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineRate(row.work_id)}
                                      disabled={savingRateId === row.work_id}
                                      className="p-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition"
                                      title="Save rate"
                                    >
                                      {savingRateId === row.work_id ? (
                                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M12 2a10 10 0 0 1 10 10" className="opacity-75" /></svg>
                                      ) : (
                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-700">{row.rate.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{row.hours.toFixed(2)}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {row.is_non_billable && inlineRateEdits[row.work_id] !== undefined
                                ? (parseFloat(inlineRateEdits[row.work_id] || '0') * row.hours).toFixed(2)
                                : row.net_payable.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              {row.is_paid ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Paid</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Unpaid</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700 align-top">
                              <span className="block whitespace-pre-line break-words max-w-[200px]" title={row.task_performed || '-'}>{row.task_performed || '-'}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {payablesTotalRecords > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-slate-600">Rows per page</label>
                      <select
                        value={payablesPageSize}
                        onChange={(e) => { setPayablesPageSize(Number(e.target.value)); setPayablesPage(1); }}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white/80"
                      >
                        {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="text-sm text-slate-600">
                        Showing {payablesTotalRecords === 0 ? 0 : payablesStartIndex + 1}–{payablesEndItem} of {payablesTotalRecords}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPayablesPage((p) => Math.max(1, p - 1))}
                        disabled={payablesPage <= 1}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">Page {payablesPage} of {payablesTotalPages}</span>
                      <button
                        type="button"
                        onClick={() => setPayablesPage((p) => Math.min(payablesTotalPages, p + 1))}
                        disabled={payablesPage >= payablesTotalPages}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </div>




      {payableMarkPaidModal?.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/50">
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {payableMarkPaidModal!.isPaid ? 'Mark as Paid' : 'Mark as Unpaid'}
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              This will mark{' '}
              <span className="font-bold text-slate-900">{selectedPayableIds.size}</span>{' '}
              selected {selectedPayableIds.size === 1 ? 'entry' : 'entries'} as{' '}
              <span className="font-bold">{payableMarkPaidModal!.isPaid ? 'paid' : 'unpaid'}</span>. This action can be reversed.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPayableMarkPaidModal(null)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMarkPayablesPaid(payableMarkPaidModal!.isPaid)}
                disabled={loading}
                className={`flex-1 px-4 py-3 rounded-xl text-white font-bold transition disabled:opacity-50 ${payableMarkPaidModal!.isPaid ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'
                  }`}
              >
                {loading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboardingForm && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center px-4 py-6"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowOnboardingForm(false); setOnboardingForm(emptyOnboardingForm); setOnboardingEmailError(null); setOnboardingPasswordError(null); } }}
        >
          <div className="w-full max-w-4xl glass-panel rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/30 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Add Employee Profile</h3>
                <p className="text-sm text-slate-500 mt-0.5">Create employee + compensation/promotion profile in one step.</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowOnboardingForm(false); setOnboardingForm(emptyOnboardingForm); setOnboardingEmailError(null); setOnboardingPasswordError(null); }}
                className="px-4 py-2 rounded-xl bg-white/70 border border-white/70 text-slate-700 text-sm font-semibold hover:bg-white/90 transition"
              >
                Cancel
              </button>
            </div>

            {/* Scrollable form */}
            <form onSubmit={handleOnboardEmployee} autoComplete="off" className="overflow-y-auto px-6 py-5 space-y-5">
              {/* Role selector */}
              <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] font-bold text-indigo-700 mb-3">Access Role</p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'employee', label: 'Employee', desc: 'Time tracking only', icon: '👤' },
                    { value: 'admin', label: 'Admin', desc: 'Full admin access', icon: '🛡️' },
                    { value: 'both', label: 'Both', desc: 'Admin + Employee', icon: '⚡' },
                  ] as const).map(({ value, label, desc, icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOnboardingForm({ ...onboardingForm, role: value })}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${onboardingForm.role === value
                        ? value === 'employee'
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-800 shadow-md'
                          : value === 'admin'
                            ? 'border-violet-400 bg-violet-50 text-violet-800 shadow-md'
                            : 'border-amber-400 bg-amber-50 text-amber-800 shadow-md'
                        : 'border-white/70 bg-white/60 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      <span className="text-xl">{icon}</span>
                      <span className="font-bold">{label}</span>
                      <span className={`text-[10px] font-normal ${onboardingForm.role === value ? 'opacity-80' : 'text-slate-400'}`}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Employee Name *"
                  value={onboardingForm.name}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, name: e.target.value })}
                  autoComplete="off"
                  className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={onboardingForm.email}
                  onChange={(e) => { setOnboardingForm({ ...onboardingForm, email: e.target.value }); if (onboardingEmailError) setOnboardingEmailError(null); }}
                  autoComplete="off"
                  className={`border rounded-xl px-3 py-2.5 bg-white/85 focus:outline-none focus:ring-2 ${onboardingEmailError ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-400'
                    }`}
                  required
                />
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type={showOnboardingPassword ? 'text' : 'password'}
                      placeholder="Password *"
                      value={onboardingForm.password}
                      onChange={(e) => { setOnboardingForm({ ...onboardingForm, password: e.target.value }); if (onboardingPasswordError) setOnboardingPasswordError(null); }}
                      autoComplete="new-password"
                      className={`w-full border rounded-xl px-3 py-2.5 pr-10 bg-white/85 focus:outline-none focus:ring-2 ${onboardingPasswordError ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-400'}`}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOnboardingPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-700 transition"
                      tabIndex={-1}
                      title={showOnboardingPassword ? 'Hide password' : 'Show password'}
                    >
                      {showOnboardingPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 px-1">Min 8 chars · uppercase · lowercase · special character (e.g. !@#$%)</p>
                  {onboardingPasswordError && (
                    <p className="text-xs text-red-600 font-medium px-1">{onboardingPasswordError}</p>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Designation"
                  value={onboardingForm.designation}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, designation: e.target.value })}
                  autoComplete="off"
                  className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="text"
                  placeholder="Reporting Manager *"
                  value={onboardingForm.reporting_manager}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, reporting_manager: e.target.value })}
                  autoComplete="off"
                  className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="date"
                  value={onboardingForm.start_date}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, start_date: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Current Hourly Rate"
                  value={onboardingForm.current_hourly_rate}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, current_hourly_rate: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Duplicate email error */}
              {onboardingEmailError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {onboardingEmailError}
                </div>
              )}

              {/* Promotions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div key={idx} className="rounded-xl border border-white/70 bg-white/60 p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-600 uppercase">Promotion {idx}</p>
                    <input
                      type="date"
                      value={onboardingForm[`promotion_${idx}_date` as keyof typeof onboardingForm] as string}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, [`promotion_${idx}_date`]: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/85"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Hourly rate"
                      value={onboardingForm[`promotion_${idx}_rate` as keyof typeof onboardingForm] as string}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, [`promotion_${idx}_rate`]: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/85"
                    />
                    <input
                      type="text"
                      placeholder="New designation (optional)"
                      value={onboardingForm[`promotion_${idx}_designation` as keyof typeof onboardingForm] as string}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, [`promotion_${idx}_designation`]: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white/85"
                    />
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-2 pb-1">
                <button
                  type="button"
                  onClick={() => { setShowOnboardingForm(false); setOnboardingForm(emptyOnboardingForm); setOnboardingEmailError(null); setOnboardingPasswordError(null); }}
                  className="px-5 py-2.5 rounded-xl bg-white/70 border border-white/70 text-slate-700 text-sm font-semibold hover:bg-white/90 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="glass-primary-btn hover:brightness-95 text-white px-6 py-2.5 rounded-xl transition disabled:opacity-50 font-semibold"
                >
                  {loading ? 'Saving...' : 'Create Employee Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
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
                type="text"
                placeholder="Reporting Manager"
                value={employeeProfileEdits[editingEmployeeId].reporting_manager}
                onChange={(e) => handleEmployeeProfileEditChange(editingEmployeeId, 'reporting_manager', e.target.value)}
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

      {deleteEntityModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-md flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl glass-panel p-6">
            <h3 className="text-xl font-bold text-slate-900">
              Confirm {deleteEntityModal.entityType === 'client' ? 'Client' : deleteEntityModal.entityType === 'project' ? 'Project' : 'Rate'} Deletion
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete{' '}
              <span className="font-semibold text-slate-900">{deleteEntityModal.entityName}</span>.
            </p>
            <p className="mt-4 text-sm font-semibold text-red-600">
              Type <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">DELETE</span> to continue.
            </p>
            <input
              type="text"
              value={deleteEntityConfirmationText}
              onChange={(e) => setDeleteEntityConfirmationText(e.target.value)}
              placeholder="Type DELETE"
              className="mt-3 w-full border border-slate-300 bg-white/80 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
            />
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={closeDeleteEntityModal}
                disabled={loading}
                className="px-4 py-2 rounded-xl glass-subtle border border-white/60 text-slate-700 hover:bg-white/70 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteEntity}
                disabled={loading || deleteEntityConfirmationText !== 'DELETE'}
                className="px-4 py-2 rounded-xl glass-danger-btn hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
