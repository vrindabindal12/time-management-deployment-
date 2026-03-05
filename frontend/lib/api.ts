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
}

export interface WorkEntry {
  id: number;
  employee_id: number;
  project_name: string;
  work_date: string;
  hours_worked: number;
  description: string;
  created_at: string;
  updated_at: string;
  updated_by_admin: boolean;
}

export interface EmployeeStatus {
  employee: Employee;
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

export interface ProjectRate {
  id: number;
  project_id: number;
  designation: string;
  gross_rate: number;
  discount: number;
  net_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  code: string;
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

  register: async (name: string, email: string, password: string): Promise<{ message: string; employee: Employee }> => {
    const response = await api.post('/register', { name, email, password });
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post('/change-password', { 
      old_password: oldPassword, 
      new_password: newPassword 
    });
    return response.data;
  },
};

export const employeeApi = {
  getEmployees: async (): Promise<Employee[]> => {
    const response = await api.get('/employees');
    return response.data;
  },

  createEmployee: async (name: string, email: string, password: string): Promise<Employee> => {
    const response = await api.post('/employees', { name, email, password });
    return response.data;
  },

  getMyStatus: async (): Promise<EmployeeStatus> => {
    const response = await api.get('/my-status');
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

  addWork: async (projectName: string, workDate: string, hoursWorked: number, description: string): Promise<WorkEntry> => {
    const response = await api.post('/add-work', {
      project_name: projectName.trim(),
      work_date: workDate,
      hours_worked: hoursWorked,
      description: description.trim()
    });
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
    projectName?: string
  ): Promise<EmployeeWork> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (projectName) params.project_name = projectName;
    const response = await api.get(`/employee/${employeeId}/work`, { params });
    return response.data;
  },

  exportEmployeeWork: async (
    employeeId: number,
    format: 'csv' | 'excel' = 'csv',
    startDate?: string,
    endDate?: string,
    projectName?: string
  ): Promise<void> => {
    const params: any = { format };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (projectName) params.project_name = projectName;

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

  getReport: async (): Promise<ReportData[]> => {
    const response = await api.get('/report');
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

  createProject: async (clientId: number, name: string, code: string): Promise<Project> => {
    const response = await api.post(`/clients/${clientId}/projects`, { name, code });
    return response.data;
  },

  getProject: async (projectId: number): Promise<Project> => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },

  updateProject: async (projectId: number, data: Partial<Pick<Project, 'name' | 'code'>>): Promise<Project> => {
    const response = await api.put(`/projects/${projectId}`, data);
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

  createProjectRate: async (projectId: number, designation: string, grossRate: number, discount: number = 0): Promise<ProjectRate> => {
    const response = await api.post(`/projects/${projectId}/rates`, {
      designation,
      gross_rate: grossRate,
      discount
    });
    return response.data;
  },

  updateProjectRate: async (rateId: number, data: Partial<Pick<ProjectRate, 'designation' | 'gross_rate' | 'discount'>>): Promise<ProjectRate> => {
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

export const isAdmin = (): boolean => {
  const user = getCurrentUser();
  return user?.is_admin || false;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export default api;
