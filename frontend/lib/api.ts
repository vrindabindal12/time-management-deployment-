import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const triggerFileDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface Employee {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  role: 'admin' | 'employee' | 'both';
  employee_code?: string | null;
  designation?: string | null;
  reporting_manager?: string | null;
  start_date?: string | null;
  current_hourly_rate?: number | null;
  promotion_1_date?: string | null;
  promotion_1_rate?: number | null;
  promotion_1_designation?: string | null;
  promotion_2_date?: string | null;
  promotion_2_rate?: number | null;
  promotion_2_designation?: string | null;
  promotion_3_date?: string | null;
  promotion_3_rate?: number | null;
  promotion_3_designation?: string | null;
  promotion_4_date?: string | null;
  promotion_4_rate?: number | null;
  promotion_4_designation?: string | null;
  promotion_5_date?: string | null;
  promotion_5_rate?: number | null;
  promotion_5_designation?: string | null;
  profile_photo?: string | null;
  has_set_password?: boolean;
}

export interface WorkEntry {
  id: number;
  employee_id: number;
  project_name: string;
  project_code: string | null;
  project_id: number | null;
  client_name: string | null;
  work_date: string;
  hours_worked: number;
  description: string;
  created_at: string;
  updated_at: string;
  updated_by_admin: boolean;
}

export interface EmployeeStatus {
  employee: Employee;
  date?: string;
  today_entries: WorkEntry[];
  today_hours: number;
}

export interface EmployeeWork {
  employee: Employee;
  work_entries: WorkEntry[];
  total_hours: number;
}

// Legacy compatibility type used by older history page.
export interface EmployeePunches {
  employee: Employee;
  punches: any[];
  total_hours: number;
}

export interface ReportData {
  employee: Employee;
  total_hours: number;
  total_days: number;
  total_entries: number;
}

export interface ClientInvoiceRow {
  work_id: number;
  work_date: string;
  project_code: string;
  project_name: string;
  employee_name: string;
  employee_designation: string;
  gross_rate: number;
  discount: number;
  net_rate: number;
  hours: number;
  net_billable: number;
  task_performed: string;
  is_invoice_override: boolean;
}

export interface ClientInvoiceProjectTotal {
  project_id: number;
  project_code: string;
  project_name: string;
  contract_type: 'fixed_fee' | 'time_materials' | 'retainer' | 'admin';
  fixed_fee_amount?: number | null;
  total_hours: number;
  total_net_billable: number;
}

export interface FixedFeeProjectSummary {
  project_id: number;
  project_code: string;
  project_name: string;
  actual_hours_amount: number;
  fixed_fee_amount: number;
  variance_amount: number;
  variance_type: 'none' | 'overage' | 'credit';
  utilization_ratio: number | null;
  status: 'ok' | 'near_limit' | 'overage';
}

export interface ClientInvoiceReport {
  client: Client;
  start_date: string;
  end_date: string;
  rows: ClientInvoiceRow[];
  project_totals: ClientInvoiceProjectTotal[];
  total_hours: number;
  total_net_billable: number;
  total_invoice_amount: number;
  fixed_fee_projects: FixedFeeProjectSummary[];
  tm_projects: Array<{
    project_id: number;
    project_code: string;
    project_name: string;
    total_hours: number;
    total_amount: number;
  }>;
  fixed_fee_warnings: FixedFeeProjectSummary[];
}

export interface EmployeePayableRow {
  work_id: number;
  project_code: string;
  employee_name: string;
  employee_code: string | null;
  employee_designation: string;
  project_name: string;
  work_date: string;
  rate: number;
  hours: number;
  net_payable: number;
  task_performed: string;
  is_paid?: boolean;
  is_non_billable?: boolean;
}

export interface EmployeePayableTotal {
  employee_id: number;
  employee_name: string;
  employee_code: string | null;
  designation: string | null;
  total_hours: number;
  total_net_payable: number;
}

export interface EmployeePayablesReport {
  start_date: string;
  end_date: string;
  rows: EmployeePayableRow[];
  employee_totals: EmployeePayableTotal[];
  total_hours: number;
  total_net_payable: number;
  total_paid: number;
  total_unpaid: number;
}

export interface ProjectRate {
  id: number;
  project_id: number;
  employee_name?: string | null;
  designation: string;
  gross_rate: number;
  created_at: string;
  updated_at: string;
}


export interface Project {
  id: number;
  client_id: number;
  name: string;
  code: string;
  contract_type: 'fixed_fee' | 'time_materials' | 'retainer' | 'admin';
  standard_rate?: number | null;
  fixed_fee_amount?: number | null;
  expected_hours?: number | null;
  discount?: number | null;
  project_discount: number;
  created_at: string;
  updated_at: string;
  rates: ProjectRate[];
}

export interface Client {
  id: number;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;

  projects?: Project[];
}

export interface LoginResponse {
  token: string;
  employee: Employee;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post('/login', { email, password });
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post('/change-password', {
      old_password: oldPassword,
      new_password: newPassword
    });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post('/reset-password', { token, new_password: newPassword });
    return response.data;
  },
};

export const employeeApi = {
  getEmployees: async (): Promise<Employee[]> => {
    const response = await api.get('/employees');
    return response.data;
  },

  createEmployee: async (
    name: string,
    email: string,
    password: string,
    profileData: Partial<Employee> = {}
  ): Promise<Employee> => {
    const response = await api.post('/employees', { name, email, password, ...profileData });
    return response.data;
  },

  updateEmployeeProfile: async (employeeId: number, profileData: Partial<Employee>): Promise<Employee> => {
    const response = await api.put(`/employees/${employeeId}/profile`, profileData);
    return response.data;
  },

  updateEmployeeRole: async (employeeId: number, role: 'admin' | 'employee' | 'both'): Promise<Employee> => {
    const response = await api.put(`/employees/${employeeId}/role`, { role });
    return response.data;
  },

  updateMyProfilePhoto: async (profilePhoto: string | null): Promise<Employee> => {
    const response = await api.put('/me/profile-photo', { profile_photo: profilePhoto });
    return response.data;
  },

  deleteEmployee: async (employeeId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/employees/${employeeId}`);
    return response.data;
  },

  resendWelcomeEmail: async (employeeId: number): Promise<{ message: string }> => {
    const response = await api.post(`/employees/${employeeId}/resend-welcome`);
    return response.data;
  },

  getMyStatus: async (date?: string): Promise<EmployeeStatus> => {
    const params: any = {};
    if (date) params.date = date;
    const response = await api.get('/my-status', { params });
    return response.data;
  },

  getMyWork: async (startDate?: string, endDate?: string, projectName?: string): Promise<EmployeeWork> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (projectName) params.project_name = projectName;
    const response = await api.get('/my-work', { params });
    return response.data;
  },

  addWork: async (workData: {
    project_name?: string;
    project_code?: string;
    work_date: string;
    client_today?: string;
    hours_worked: number;
    description: string;
  }): Promise<WorkEntry> => {
    const response = await api.post('/add-work', workData);
    return response.data;
  },

  exportMyWork: async (
    format: 'csv' | 'excel' = 'csv',
    startDate?: string,
    endDate?: string,
    projectName?: string
  ): Promise<void> => {
    const params: any = { format };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (projectName) params.project_name = projectName;

    const response = await api.get('/my-work/export', {
      params,
      responseType: 'blob',
    });

    const extension = format === 'excel' ? 'xlsx' : 'csv';
    const filename = `my_work_history.${extension}`;
    triggerFileDownload(response.data, filename);
  },

  getEmployeeStatus: async (employeeId: number): Promise<EmployeeStatus> => {
    const response = await api.get(`/employee/${employeeId}/status`);
    return response.data;
  },

  getEmployeeWork: async (
    employeeId: number,
    startDate?: string,
    endDate?: string,
    projectName?: string,
    clientName?: string
  ): Promise<EmployeeWork> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (projectName) params.project_name = projectName;
    if (clientName) params.client_name = clientName;
    const response = await api.get(`/employee/${employeeId}/work`, { params });
    return response.data;
  },

  exportEmployeeWork: async (
    employeeId: number,
    format: 'csv' | 'excel' = 'csv',
    startDate?: string,
    endDate?: string,
    projectName?: string,
    clientName?: string
  ): Promise<void> => {
    const params: any = { format };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (projectName) params.project_name = projectName;
    if (clientName) params.client_name = clientName;

    const response = await api.get(`/employee/${employeeId}/work/export`, {
      params,
      responseType: 'blob',
    });

    const extension = format === 'excel' ? 'xlsx' : 'csv';
    const filename = `employee_${employeeId}_work_history.${extension}`;
    triggerFileDownload(response.data, filename);
  },

  editWork: async (workId: number, data: Partial<WorkEntry>): Promise<WorkEntry> => {
    const response = await api.put(`/work/${workId}`, data);
    return response.data;
  },

  deleteWork: async (workId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/work/${workId}`);
    return response.data;
  },

  updateWorkInvoiceValues: async (
    workId: number,
    data: { gross_rate?: number | null; discount?: number | null; hours?: number | null }
  ): Promise<WorkEntry> => {
    const response = await api.put(`/work/${workId}/invoice-values`, data);
    return response.data;
  },

  getReport: async (): Promise<ReportData[]> => {
    const response = await api.get('/report');
    return response.data;
  },

  getClientInvoiceReport: async (
    clientId: number,
    startDate: string,
    endDate: string
  ): Promise<ClientInvoiceReport> => {
    const response = await api.get('/invoices/client', {
      params: {
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
      },
    });
    return response.data;
  },

  downloadClientInvoicePdf: async (
    clientId: number,
    startDate: string,
    endDate: string,
    clientCode: string,
    projectFilter?: string
  ): Promise<void> => {
    const params: any = {
      client_id: clientId,
      start_date: startDate,
      end_date: endDate,
    };
    if (projectFilter && projectFilter !== 'ALL') params.project_filter = projectFilter;
    const response = await api.get('/invoices/client/pdf', {
      params,
      responseType: 'blob',
    });
    triggerFileDownload(response.data, `invoice_${clientCode}_${startDate}_to_${endDate}.pdf`);
  },

  getEmployeePayablesReport: async (
    startDate: string,
    endDate: string,
    employeeId?: number
  ): Promise<EmployeePayablesReport> => {
    const params: any = {
      start_date: startDate,
      end_date: endDate,
    };
    if (employeeId) params.employee_id = employeeId;

    const response = await api.get('/payables/employees', { params });
    return response.data;
  },

  markPayablesPaid: async (workIds: number[], isPaid: boolean): Promise<any> => {
    const response = await api.put('/payables/mark-paid', {
      work_ids: workIds,
      is_paid: isPaid
    });
    return response.data;
  },

  setNonBillableRate: async (startDate: string, endDate: string, rate: number): Promise<{ count: number; message: string }> => {
    const response = await api.post('/payables/set-nonbillable-rate', {
      start_date: startDate,
      end_date: endDate,
      rate,
    });
    return response.data;
  },

  updateWorkPayableValues: async (workId: number, data: { payable_rate?: number; payable_designation?: string }): Promise<any> => {
    const response = await api.put(`/work/${workId}/payable-values`, data);
    return response.data;
  },

  getProjectByCode: async (code: string): Promise<Project> => {
    const response = await api.get(`/projects/by-code/${code.trim().toUpperCase()}`);
    return response.data;
  },

  getAllProjects: async (): Promise<Project[]> => {
    const response = await api.get('/projects/all');
    return response.data;
  },

  hideProject: async (projectId: number): Promise<{ message: string }> => {
    const response = await api.post('/my-hidden-projects', { project_id: projectId });
    return response.data;
  },

  // Backward compatibility
  getMyPunches: async (): Promise<EmployeePunches> => {
    const data = await employeeApi.getMyWork();
    return {
      employee: data.employee,
      punches: data.work_entries,
      total_hours: data.total_hours,
    };
  },

  getEmployeePunches: async (employeeId: number): Promise<EmployeePunches> => {
    const data = await employeeApi.getEmployeeWork(employeeId);
    return {
      employee: data.employee,
      punches: data.work_entries,
      total_hours: data.total_hours,
    };
  },
};

export const clientApi = {
  getClients: async (): Promise<Client[]> => {
    const response = await api.get('/clients');
    return response.data;
  },

  createClient: async (name: string, code: string): Promise<Client> => {
    const response = await api.post('/clients', { name, code });
    return response.data;
  },

  getClient: async (clientId: number): Promise<Client> => {
    const response = await api.get(`/clients/${clientId}`);
    return response.data;
  },

  updateClient: async (clientId: number, data: Partial<Pick<Client, 'name' | 'code'>>): Promise<Client> => {
    const response = await api.put(`/clients/${clientId}`, data);
    return response.data;
  },

  deleteClient: async (clientId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/clients/${clientId}`);
    return response.data;
  },
};

export const projectApi = {
  getClientProjects: async (clientId: number): Promise<Project[]> => {
    const response = await api.get(`/clients/${clientId}/projects`);
    return response.data;
  },

  createProject: async (
    clientId: number,
    name: string,
    code: string,
    contractType: 'fixed_fee' | 'time_materials' | 'retainer' | 'admin',
    fixedFeeAmount?: number,
    expectedHours?: number,
    discount?: number,
    standardRate?: number,
    projectDiscount: number = 0
  ): Promise<Project> => {
    const payload: any = { name, code, contract_type: contractType, project_discount: projectDiscount };
    if (fixedFeeAmount != null) payload.fixed_fee_amount = fixedFeeAmount;
    if (expectedHours != null) payload.expected_hours = expectedHours;
    if (discount != null) payload.discount = discount;
    if (standardRate != null) payload.standard_rate = standardRate;
    const response = await api.post(`/clients/${clientId}/projects`, payload);
    return response.data;
  },

  getProject: async (projectId: number): Promise<Project> => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },

  updateProject: async (
    projectId: number,
    data: Partial<Pick<Project, 'name' | 'code' | 'contract_type' | 'fixed_fee_amount' | 'expected_hours' | 'discount' | 'standard_rate' | 'project_discount'>>
  ): Promise<Project> => {
    const payload: any = { ...data };
    if ('contract_type' in payload) payload.contract_type = payload.contract_type;
    const response = await api.put(`/projects/${projectId}`, payload);
    return response.data;
  },

  deleteProject: async (projectId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/projects/${projectId}`);
    return response.data;
  },

  getProjectRates: async (projectId: number): Promise<ProjectRate[]> => {
    const response = await api.get(`/projects/${projectId}/rates`);
    return response.data;
  },

  createProjectRate: async (
    projectId: number,
    employeeName: string,
    designation: string,
    grossRate: number
  ): Promise<ProjectRate> => {
    const response = await api.post(`/projects/${projectId}/rates`, {
      employee_name: employeeName,
      designation,
      gross_rate: grossRate
    });
    return response.data;
  },

  updateProjectRate: async (
    rateId: number,
    data: Partial<Pick<ProjectRate, 'employee_name' | 'designation' | 'gross_rate'>>
  ): Promise<ProjectRate> => {
    const response = await api.put(`/rates/${rateId}`, data);
    return response.data;
  },

  deleteProjectRate: async (rateId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/rates/${rateId}`);
    return response.data;
  },

};


export const getCurrentUser = (): Employee | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
};

export const getActiveRole = (): 'admin' | 'employee' => {
  if (typeof window === 'undefined') return 'employee';
  const stored = localStorage.getItem('activeRole');
  if (stored === 'admin' || stored === 'employee') return stored;
  const user = getCurrentUser();
  return user?.role === 'employee' ? 'employee' : 'admin';
};

export const setActiveRole = (role: 'admin' | 'employee'): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('activeRole', role);
  }
};

export const isBothRole = (): boolean => {
  const user = getCurrentUser();
  return (user?.role ?? 'employee') === 'both';
};

export const isAdmin = (): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  const role = user.role ?? (user.is_admin ? 'admin' : 'employee');
  if (role === 'admin') return true;
  if (role === 'both') return getActiveRole() === 'admin';
  return false;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('activeRole');
  window.location.href = '/login';
};

export default api;
