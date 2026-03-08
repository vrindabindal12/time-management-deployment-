'use client';

import { useState, useEffect, useRef } from 'react';
import { employeeApi, clientApi, projectApi, getCurrentUser, isAuthenticated, isAdmin } from '@/lib/api';
import type { Client, ClientInvoiceReport, Employee, EmployeePayablesReport, Project, ProjectRate } from '@/lib/api';
import { useRouter } from 'next/navigation';

const DESIGNATIONS = ['Managing Director', 'Associate Director', 'Senior Consultant'];

const emptyOnboardingForm = {
  name: '',
  email: '',
  password: '',
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0);
  const router = useRouter();

  // Employee states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<any>(null);
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', password: '', reporting_manager: '' });
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState(emptyOnboardingForm);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [employeeProfileEdits, setEmployeeProfileEdits] = useState<Record<number, EmployeeProfileEdit>>({});
  const [savingEmployeeProfileId, setSavingEmployeeProfileId] = useState<number | null>(null);
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
  const [payablesStatusFilter, setPayablesStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [selectedPaidIds, setSelectedPaidIds] = useState<number[]>([]);
  const [savingPayables, setSavingPayables] = useState(false);

  // Project states
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', code: '' });
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectEditForm, setProjectEditForm] = useState({ name: '', code: '' });

  // Project Rate states
  const [projectRates, setProjectRates] = useState<ProjectRate[]>([]);
  const [showAddRateForm, setShowAddRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '', discount: '0' });
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [rateEditForm, setRateEditForm] = useState({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '', discount: '0' });
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
    setEditingClientId(null);
    setClientEditForm({ name: '', code: '' });
    setEditingProjectId(null);
    setProjectEditForm({ name: '', code: '' });
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

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data);
      const nonAdminIds = data.filter((employee: Employee) => !employee.is_admin).map((employee: Employee) => employee.id);
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

    try {
      await employeeApi.createEmployee(
        onboardingForm.name.trim(),
        onboardingForm.email.trim(),
        onboardingForm.password,
        {
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
        rateForm.employeeName,
        rateForm.designation,
        parseFloat(rateForm.grossRate),
        parseFloat(rateForm.discount)
      );
      setRateForm({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '', discount: '0' });
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
    setProjectEditForm({ name: project.name, code: project.code });
    setShowAddProjectForm(false);
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setProjectEditForm({ name: '', code: '' });
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId) return;

    setLoading(true);
    setError(null);

    try {
      await projectApi.updateProject(editingProjectId, {
        name: projectEditForm.name,
        code: projectEditForm.code,
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
      discount: String(rate.discount ?? 0),
    });
    setShowAddRateForm(false);
  };

  const cancelEditRate = () => {
    setEditingRateId(null);
    setRateEditForm({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '', discount: '0' });
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
        gross_rate: parseFloat(rateEditForm.grossRate),
        discount: parseFloat(rateEditForm.discount),
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
      setSelectedPaidIds(data.rows.filter(r => r.is_paid).map(r => r.work_id));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load payables report');
      clearError();
    } finally {
      setPayablesLoading(false);
    }
  };

  const savePayablesStatus = async () => {
    if (!payablesReport) return;
    setSavingPayables(true);
    setError(null);
    try {
      const allIds = payablesReport.rows.map(r => r.work_id);
      const pendingIds = allIds.filter(id => !selectedPaidIds.includes(id));

      if (selectedPaidIds.length > 0) {
        await employeeApi.markPayablesPaid(selectedPaidIds, true);
      }
      if (pendingIds.length > 0) {
        await employeeApi.markPayablesPaid(pendingIds, false);
      }

      const data = await employeeApi.getEmployeePayablesReport(
        payableStartDate,
        payableEndDate,
        payableEmployeeId || undefined
      );
      setPayablesReport(data);
      setSelectedPaidIds(data.rows.filter(r => r.is_paid).map(r => r.work_id));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save payment status');
      clearError();
    } finally {
      setSavingPayables(false);
    }
  };

  const moveEmployeeCard = (draggedEmployeeId: number, targetEmployeeId: number) => {
    if (draggedEmployeeId === targetEmployeeId) return;
    setEmployeeCardOrder((prev) => {
      const current = prev.length ? [...prev] : employees.filter((employee) => !employee.is_admin).map((employee) => employee.id);
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

  const nonAdminEmployees = employees.filter((employee) => !employee.is_admin);
  const orderedEmployeeCards = [
    ...employeeCardOrder
      .map((employeeId) => nonAdminEmployees.find((employee) => employee.id === employeeId))
      .filter((employee): employee is Employee => Boolean(employee)),
    ...nonAdminEmployees.filter((employee) => !employeeCardOrder.includes(employee.id)),
  ];
  const selectedClientData = clients.find((client) => client.id === selectedClient) || null;
  const invoiceProjectOptions = invoiceReport
    ? Array.from(new Set(invoiceReport.rows.map((row) => row.project_code))).sort()
    : [];

  // Pagination state for invoicing
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceRowsPerPage, setInvoiceRowsPerPage] = useState(20);

  // Reset invoice pagination when filters or report change
  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceReport, invoiceProjectFilter, invoiceRowsPerPage]);
  const filteredInvoiceRows = invoiceReport
    ? invoiceReport.rows.filter((row) => invoiceProjectFilter === 'ALL' || row.project_code === invoiceProjectFilter)
    : [];
  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoiceRows.length / invoiceRowsPerPage));
  const paginatedInvoiceRows = filteredInvoiceRows.slice((invoicePage - 1) * invoiceRowsPerPage, invoicePage * invoiceRowsPerPage);

  // Pagination state for payables
  const [payablesPage, setPayablesPage] = useState(1);
  const [payablesRowsPerPage, setPayablesRowsPerPage] = useState(20);

  // Reset payables pagination when filters or report change
  useEffect(() => {
    setPayablesPage(1);
  }, [payablesReport, payablesProjectFilter, payablesStatusFilter, payablesRowsPerPage]);
  const payablesProjectOptions = payablesReport
    ? Array.from(new Set(payablesReport.rows.map((row) => row.project_code || '-'))).sort()
    : [];
  const filteredPayablesRows = payablesReport
    ? payablesReport.rows.filter((row) => {
      const matchesProject = payablesProjectFilter === 'ALL' || (row.project_code || '-') === payablesProjectFilter;
      const isPaid = selectedPaidIds.includes(row.work_id);
      const matchesStatus = payablesStatusFilter === 'ALL' ||
        (payablesStatusFilter === 'PAID' && isPaid) ||
        (payablesStatusFilter === 'PENDING' && !isPaid);
      return matchesProject && matchesStatus;
    })
    : [];
  const payablesTotalPages = Math.max(1, Math.ceil(filteredPayablesRows.length / payablesRowsPerPage));
  const paginatedPayablesRows = filteredPayablesRows.slice((payablesPage - 1) * payablesRowsPerPage, payablesPage * payablesRowsPerPage);

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
      'Discount',
      'Net Rate',
      'Hours',
      'Net Billable',
      'Task Performed',
    ]];

    filteredInvoiceRows.forEach((row) => {
      rows.push([
        row.project_code,
        row.employee_name,
        row.employee_designation,
        row.project_name,
        row.work_date,
        row.gross_rate.toFixed(2),
        row.discount.toFixed(2),
        row.net_rate.toFixed(2),
        row.hours.toFixed(2),
        row.net_billable.toFixed(2),
        row.task_performed || '',
      ]);
    });

    rows.push([]);
    rows.push(['Total Hours', invoiceReport.total_hours.toFixed(2)]);
    rows.push(['Total Billable', invoiceReport.total_net_billable.toFixed(2)]);

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

    const activeRows = filteredPayablesRows.filter(row => !selectedPaidIds.includes(row.work_id));

    activeRows.forEach((row) => {
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

    const activeTotalHours = activeRows.reduce((sum, row) => sum + row.hours, 0);
    const activeTotalPayable = activeRows.reduce((sum, row) => sum + row.net_payable, 0);

    rows.push([]);
    rows.push(['Total Hours', activeTotalHours.toFixed(2)]);
    rows.push(['Total Payable', activeTotalPayable.toFixed(2)]);

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
            <p className="text-slate-500 text-sm">{currentTime.toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-cyan-100/80 via-white/80 to-blue-100/70 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-700 font-bold">Total Employees</p>
              <p className="text-4xl font-black text-slate-900 mt-3">{employees.filter((emp) => !emp.is_admin).length}</p>
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
                      minLength={6}
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
                {employees.filter((employee: Employee) => !employee.is_admin).map((employee) => (
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

              {employees.filter((employee: Employee) => !employee.is_admin).length === 0 && !showAddEmployeeForm && (
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
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Employee Management</h2>
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
                      type="text"
                      placeholder="Reporting Manager *"
                      value={onboardingForm.reporting_manager}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, reporting_manager: e.target.value })}
                      className="border border-slate-300 rounded-xl px-3 py-2 bg-white/80"
                      required
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
              {orderedEmployeeCards.map((employee: Employee) => (
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
                    className="relative h-[29rem] w-full transition-transform duration-700"
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
                      <div className="mt-5 rounded-2xl bg-white/72 border border-white/70 p-4">
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
                      className="absolute inset-0 w-full text-left rounded-2xl p-5 shadow-xl overflow-hidden border border-white/60 bg-gradient-to-br from-indigo-100/80 via-white/75 to-blue-100/75 backdrop-blur-xl"
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
                      <h4 className="text-xl font-black text-slate-900 mt-2">Core Information</h4>
                      <div className="mt-4 grid grid-cols-1 gap-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-slate-700"><span className="font-semibold">Emp ID:</span> {employee.employee_code || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-slate-700"><span className="font-semibold">Designation:</span> {employee.designation || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-slate-700"><span className="font-semibold">Start Date:</span> {employee.start_date || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-slate-700"><span className="font-semibold">Reporting Manager:</span> {employee.reporting_manager || '-'}</p>
                        <p className="rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-slate-700"><span className="font-semibold">Current Rate:</span> {employee.current_hourly_rate ?? '-'}</p>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
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
          </div>
        )}

        {/* CLIENTS & PROJECTS TAB */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Clients */}
            <div className="glass-panel rounded-3xl p-6 border border-white/70 bg-gradient-to-br from-cyan-50/70 via-white/75 to-blue-100/60">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Clients</h2>
                  <p className="text-sm text-slate-600">Choose a client to open project workspace</p>
                </div>
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

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(client.id)}
                    className={`relative overflow-hidden p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:-translate-y-0.5 ${selectedClient === client.id
                      ? 'border-cyan-300 bg-gradient-to-br from-cyan-100/85 via-white/75 to-blue-100/80 shadow-lg'
                      : 'border-white/60 hover:border-cyan-200 bg-gradient-to-br from-white/80 via-white/70 to-cyan-50/70 shadow-md'
                      }`}
                  >
                    <div className="absolute -top-10 -right-8 w-28 h-28 rounded-full bg-cyan-300/20 blur-2xl" />
                    <div className="absolute -bottom-10 -left-8 w-28 h-28 rounded-full bg-blue-300/20 blur-2xl" />
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-cyan-700">Client</p>
                        <p className="font-black text-slate-900 text-lg mt-1">{client.name}</p>
                        <p className="text-sm font-mono text-slate-600 mt-1">{client.code}</p>
                      </div>
                      <div className="ml-2 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditClient(client);
                          }}
                          disabled={loading}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-100 text-cyan-800 border border-cyan-200 hover:bg-cyan-200 transition disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteEntityModal('client', client.id, client.name);
                          }}
                          disabled={loading}
                          className="px-3 py-1.5 text-xs font-semibold glass-danger-btn rounded-lg hover:brightness-95 transition disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
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
              {selectedClient && selectedClientData && (
                <div className="glass-panel rounded-3xl p-6 border border-white/70 bg-gradient-to-br from-cyan-50/75 via-white/75 to-blue-100/65 transition-all duration-500">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] font-bold text-cyan-700">Project Workspace</p>
                      <h3 className="text-2xl font-black text-slate-900 mt-1">{selectedClientData.name}</h3>
                      <p className="text-sm text-slate-600">Client code: <span className="font-mono font-semibold">{selectedClientData.code}</span></p>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddProjectForm(!showAddProjectForm);
                        setEditingProjectId(null);
                      }}
                      className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm transition"
                    >
                      {showAddProjectForm ? 'Hide Create Form' : '+ Create Project'}
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

                  <div className="space-y-3">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProject(project.id)}
                        className={`relative overflow-hidden p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:-translate-y-0.5 ${selectedProject === project.id
                          ? 'border-cyan-300 bg-gradient-to-br from-cyan-100/85 via-white/75 to-blue-100/75 shadow-lg'
                          : 'border-white/60 hover:border-cyan-200 bg-gradient-to-br from-white/80 via-white/70 to-cyan-50/70 shadow-md'
                          }`}
                      >
                        <div className="absolute -top-10 -right-8 w-28 h-28 rounded-full bg-cyan-300/20 blur-2xl" />
                        <div className="absolute -bottom-10 -left-8 w-28 h-28 rounded-full bg-blue-300/20 blur-2xl" />
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-cyan-700">Project</p>
                            <p className="font-black text-slate-900 text-lg mt-1">{project.name}</p>
                            <p className="text-sm text-cyan-700 font-semibold mt-1">{selectedClientData.code}-{project.code}</p>
                          </div>
                          <div className="ml-2 flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditProject(project);
                              }}
                              disabled={loading}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-100 text-cyan-800 border border-cyan-200 hover:bg-cyan-200 transition disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteEntityModal('project', project.id, project.name);
                              }}
                              disabled={loading}
                              className="px-3 py-1.5 text-xs font-semibold glass-danger-btn rounded-lg hover:brightness-95 transition disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
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
                    <h3 className="text-sm font-bold text-cyan-800 glass-subtle px-3 py-2 rounded-lg flex-1">
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
                          <label className="block text-xs font-bold text-cyan-700 mb-1">EMPLOYEE NAME</label>
                          <input
                            type="text"
                            placeholder="e.g., Shashank Jain"
                            value={rateForm.employeeName}
                            onChange={(e) => setRateForm({ ...rateForm, employeeName: e.target.value })}
                            required
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-cyan-700 mb-1">DESIGNATION</label>
                          <select
                            value={rateForm.designation}
                            onChange={(e) => setRateForm({ ...rateForm, designation: e.target.value })}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            {DESIGNATIONS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold text-cyan-700 mb-1">GROSS RATE</label>
                            <input
                              type="number"
                              placeholder="300"
                              value={rateForm.grossRate}
                              onChange={(e) => setRateForm({ ...rateForm, grossRate: e.target.value })}
                              required
                              step="0.01"
                              min="0"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-cyan-700 mb-1">DISCOUNT %</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={rateForm.discount}
                              onChange={(e) => setRateForm({ ...rateForm, discount: e.target.value })}
                              step="0.1"
                              min="0"
                              max="100"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
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

                  {editingRateId !== null && (
                    <form onSubmit={handleUpdateRate} className="mb-4 p-3 rounded-2xl border border-cyan-200/70 bg-cyan-50/70">
                      <p className="text-xs uppercase tracking-[0.18em] font-bold text-cyan-700 mb-3">Edit Gross Rate</p>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={rateEditForm.employeeName}
                          onChange={(e) => setRateEditForm({ ...rateEditForm, employeeName: e.target.value })}
                          required
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <select
                          value={rateEditForm.designation}
                          onChange={(e) => setRateEditForm({ ...rateEditForm, designation: e.target.value })}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          {DESIGNATIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={rateEditForm.grossRate}
                            onChange={(e) => setRateEditForm({ ...rateEditForm, grossRate: e.target.value })}
                            required
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={rateEditForm.discount}
                            onChange={(e) => setRateEditForm({ ...rateEditForm, discount: e.target.value })}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white/85 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm transition disabled:opacity-50"
                        >
                          {loading ? 'Saving...' : 'Save Rate'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditRate}
                          className="px-4 py-2 rounded-xl text-sm border border-slate-300 bg-white/70 text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2">
                    {projectRates.length > 0 ? (
                      projectRates.map((rate) => (
                        <div key={rate.id} className="p-4 border border-white/60 rounded-2xl bg-white/60 hover:bg-white/78 transition">
                          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.1fr_.7fr_.7fr_.7fr_auto] gap-4 items-center text-sm">
                            <div>
                              <p className="font-bold text-gray-700">{rate.employee_name || '-'}</p>
                              <p className="text-xs text-gray-500">Employee</p>
                            </div>
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
                            <div className="text-center">
                              <div>
                                <p className="font-bold text-green-600">${rate.net_rate}</p>
                                <p className="text-xs text-gray-500">Net</p>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEditRate(rate)}
                                disabled={loading}
                                className="min-w-[74px] px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-100 text-cyan-800 border border-cyan-200 hover:bg-cyan-200 transition disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => openDeleteEntityModal('rate', rate.id, `${rate.employee_name || 'Rate'} (${rate.designation})`)}
                                disabled={loading}
                                className="min-w-[74px] px-4 py-2 text-xs font-semibold glass-danger-btn rounded-xl hover:brightness-95 transition disabled:opacity-50"
                              >
                                Delete
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
                <div className="min-h-64 glass-panel rounded-3xl p-6 flex items-center justify-center border border-white/70 bg-gradient-to-br from-cyan-50/70 via-white/70 to-blue-100/65">
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-cyan-700">Project Workspace</p>
                    <p className="text-slate-700 font-semibold mt-2">Select a client to open create/edit project section</p>
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
                      <p className="text-lg font-black text-slate-900">CAD$</p>
                    </div>
                    <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-indigo-700 font-bold">Total Billable</p>
                      <p className="text-2xl font-black text-slate-900">{invoiceReport.total_net_billable.toFixed(2)}</p>
                    </div>
                  </div>
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
                  <div className="mt-3 max-w-xs">
                    <label className="block text-xs uppercase tracking-[0.16em] font-bold text-slate-600 mb-1">Project Filter</label>
                    <select
                      value={invoiceProjectFilter}
                      onChange={(e) => setInvoiceProjectFilter(e.target.value)}
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
                      {paginatedInvoiceRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={11}>
                            No invoice entries found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        paginatedInvoiceRows.map((row) => (
                          <tr key={row.work_id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-slate-800 font-semibold">{row.project_code}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.employee_designation}</td>
                            <td className="px-4 py-3 text-slate-700">{row.project_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.work_date}</td>
                            <td className="px-4 py-3 text-slate-700">{row.gross_rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">{row.discount.toFixed(2)}%</td>
                            <td className="px-4 py-3 text-slate-700">{row.net_rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">{row.hours.toFixed(2)}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{row.net_billable.toFixed(2)}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {row.task_performed || '-'}
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
                {/* Pagination Controls for Invoicing */}
                {invoiceTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <span className="text-xs text-slate-600">
                        Page {invoicePage} of {invoiceTotalPages}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded border bg-white/80 text-slate-700 disabled:opacity-50"
                        onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                        disabled={invoicePage === 1}
                      >
                        Previous
                      </button>
                      {Array.from({ length: invoiceTotalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          className={`px-3 py-1 rounded border ${invoicePage === pageNum ? 'bg-blue-100 border-blue-400 font-bold' : 'bg-white/80 text-slate-700'}`}
                          onClick={() => setInvoicePage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      ))}
                      <button
                        className="px-3 py-1 rounded border bg-white/80 text-slate-700 disabled:opacity-50"
                        onClick={() => setInvoicePage((p) => Math.min(invoiceTotalPages, p + 1))}
                        disabled={invoicePage === invoiceTotalPages}
                      >
                        Next
                      </button>
                    </div>
                    <div>
                      <select
                        className="border rounded px-2 py-1 text-xs bg-white/80"
                        value={invoiceRowsPerPage}
                        onChange={(e) => {
                          setInvoiceRowsPerPage(Number(e.target.value));
                          setInvoicePage(1);
                        }}
                      >
                        {[10, 20, 50, 100].map((n) => (
                          <option key={n} value={n}>{n} / page</option>
                        ))}
                      </select>
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
            </div>

            {payablesReport && (
              <div className="glass-panel rounded-3xl p-6">
                <div className="mb-4 rounded-2xl border border-white/70 bg-white/60 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] items-center gap-3">
                    <div>
                      <p className="text-sm text-slate-600">
                        Period: {payablesReport.start_date} to {payablesReport.end_date}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-700 font-bold">Currency</p>
                      <p className="text-lg font-black text-slate-900">INR</p>
                    </div>
                    <div className="rounded-xl border border-green-200/80 bg-gradient-to-br from-green-50/80 to-emerald-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-green-700 font-bold">Total Paid</p>
                      <p className="text-2xl font-black text-slate-900">
                        {payablesReport.rows
                          .filter(row => selectedPaidIds.includes(row.work_id))
                          .reduce((sum, row) => sum + row.net_payable, 0)
                          .toFixed(0)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-lime-50/80 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-700 font-bold">Total Pending</p>
                      <p className="text-2xl font-black text-slate-900">
                        {payablesReport.rows
                          .filter(row => !selectedPaidIds.includes(row.work_id))
                          .reduce((sum, row) => sum + row.net_payable, 0)
                          .toFixed(0)}
                      </p>
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
                  <div className="mt-3 flex flex-wrap gap-3 max-w-2xl items-end">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs uppercase tracking-[0.16em] font-bold text-slate-600 mb-1">Project Filter</label>
                      <select
                        value={payablesProjectFilter}
                        onChange={(e) => setPayablesProjectFilter(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/90 text-sm"
                      >
                        <option value="ALL">All Projects</option>
                        {payablesProjectOptions.map((projectCode) => (
                          <option key={projectCode} value={projectCode}>
                            {projectCode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs uppercase tracking-[0.16em] font-bold text-slate-600 mb-1">Status Filter</label>
                      <select
                        value={payablesStatusFilter}
                        onChange={(e) => setPayablesStatusFilter(e.target.value as 'ALL' | 'PAID' | 'PENDING')}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/90 text-sm"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending Only</option>
                        <option value="PAID">Paid Only</option>
                      </select>
                    </div>
                    <div>
                      <button
                        onClick={savePayablesStatus}
                        disabled={savingPayables}
                        className="glass-primary-btn hover:brightness-95 text-white px-5 py-2 rounded-xl transition disabled:opacity-50 h-[38px] flex items-center shadow-md font-semibold"
                      >
                        {savingPayables ? 'Saving...' : 'Save Paid Status'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/65">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/90">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-[0.12em] w-12"></th>
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
                      {paginatedPayablesRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={10}>
                            No payable entries found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        paginatedPayablesRows.map((row) => (
                          <tr key={row.work_id} className={`hover:bg-slate-50/70 transition-colors ${selectedPaidIds.includes(row.work_id) ? 'opacity-50 bg-emerald-50/40' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedPaidIds.includes(row.work_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPaidIds(prev => [...prev, row.work_id]);
                                  } else {
                                    setSelectedPaidIds(prev => prev.filter(id => id !== row.work_id));
                                  }
                                }}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300"
                                title={selectedPaidIds.includes(row.work_id) ? "Mark as Pending" : "Mark as Paid"}
                              />
                            </td>
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
                {/* Pagination Controls for Payables */}
                {payablesTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <span className="text-xs text-slate-600">
                        Page {payablesPage} of {payablesTotalPages}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded border bg-white/80 text-slate-700 disabled:opacity-50"
                        onClick={() => setPayablesPage((p) => Math.max(1, p - 1))}
                        disabled={payablesPage === 1}
                      >
                        Previous
                      </button>
                      {Array.from({ length: payablesTotalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          className={`px-3 py-1 rounded border ${payablesPage === pageNum ? 'bg-emerald-100 border-emerald-400 font-bold' : 'bg-white/80 text-slate-700'}`}
                          onClick={() => setPayablesPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      ))}
                      <button
                        className="px-3 py-1 rounded border bg-white/80 text-slate-700 disabled:opacity-50"
                        onClick={() => setPayablesPage((p) => Math.min(payablesTotalPages, p + 1))}
                        disabled={payablesPage === payablesTotalPages}
                      >
                        Next
                      </button>
                    </div>
                    <div>
                      <select
                        className="border rounded px-2 py-1 text-xs bg-white/80"
                        value={payablesRowsPerPage}
                        onChange={(e) => {
                          setPayablesRowsPerPage(Number(e.target.value));
                          setPayablesPage(1);
                        }}
                      >
                        {[10, 20, 50, 100].map((n) => (
                          <option key={n} value={n}>{n} / page</option>
                        ))}
                      </select>
                    </div>
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

