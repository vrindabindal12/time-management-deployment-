'use client';

import { useState, useEffect } from 'react';
import { employeeApi, clientApi, projectApi, getCurrentUser, isAuthenticated, isAdmin } from '@/lib/api';
import type { Client, Project, ProjectRate } from '@/lib/api';
import { useRouter } from 'next/navigation';

const DESIGNATIONS = ['Managing Director', 'Associate Director', 'Senior Consultant'];

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

  // Client & Project states
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', code: '' });

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
    if (selectedProject) {
      loadProjectRates(selectedProject);
    }
  }, [selectedProject]);

  const clearError = () => setTimeout(() => setError(null), 5000);

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data);
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Message */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
          <p className="text-gray-600 mt-1">Welcome, {user.name}</p>
          <p className="text-gray-500 text-sm mt-2">Current Time: {currentTime.toLocaleString()}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-lg mb-6 border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${
                activeTab === 'employees'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 border-b-2 border-transparent'
              }`}
            >
              Employee Management
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex-1 px-6 py-4 font-semibold transition text-center ${
                activeTab === 'clients'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 border-b-2 border-transparent'
              }`}
            >
              Clients & Projects
            </button>
          </div>
        </div>

        {/* EMPLOYEE MANAGEMENT TAB */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            {/* Add Employee Section */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Employee Management</h2>
                <button
                  onClick={() => setShowAddEmployeeForm(!showAddEmployeeForm)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
                >
                  {showAddEmployeeForm ? 'Cancel' : '+ Add New Employee'}
                </button>
              </div>

              {showAddEmployeeForm && (
                <form onSubmit={handleAddEmployee} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={employeeForm.name}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                      required
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={employeeForm.email}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                      required
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={employeeForm.password}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                      required
                      minLength={6}
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {loading ? 'Adding...' : 'Add Employee'}
                  </button>
                </form>
              )}

              {/* Employee List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {employees.map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee.id)}
                    className={`text-left p-4 rounded-lg border-2 transition ${
                      selectedEmployee === employee.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <p className="font-semibold text-gray-800">{employee.name}</p>
                    <p className="text-sm text-gray-600">{employee.email}</p>
                    {employee.is_admin && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {employees.length === 0 && !showAddEmployeeForm && (
                <p className="text-gray-500 text-center py-4">No employees found.</p>
              )}
            </div>

            {/* Employee Status */}
            {employeeStatus && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
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
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-700 font-semibold mb-2">Today's Entries:</p>
                    <ul className="space-y-2">
                      {employeeStatus.today_entries.map((entry: any) => (
                        <li key={entry.id} className="text-sm text-gray-600">
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

        {/* CLIENTS & PROJECTS TAB */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Clients */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Clients</h2>
                <button
                  onClick={() => setShowAddClientForm(!showAddClientForm)}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition"
                >
                  {showAddClientForm ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {showAddClientForm && (
                <form onSubmit={handleAddClient} className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-yellow-700 mb-1">CLIENT NAME</label>
                      <input
                        type="text"
                        placeholder="e.g., Lekadir"
                        value={clientForm.name}
                        onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                        required
                        className="w-full border border-yellow-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
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
                        className="w-full border border-yellow-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition disabled:bg-gray-400"
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
                        : 'border-gray-200 hover:border-blue-300 bg-gray-50'
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
                        className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition disabled:opacity-50"
                      >
                        × Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {clients.length === 0 && !showAddClientForm && (
                <p className="text-gray-500 text-center py-4">No clients found.</p>
              )}
            </div>

            {/* RIGHT: Projects & Rates */}
            <div className="space-y-6">
              {/* Projects Section */}
              {selectedClient && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">New Project Details</h3>
                    <button
                      onClick={() => setShowAddProjectForm(!showAddProjectForm)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition"
                    >
                      {showAddProjectForm ? 'Cancel' : '+ Add'}
                    </button>
                  </div>

                  {showAddProjectForm && (
                    <form onSubmit={handleAddProject} className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-blue-700 mb-1">PROJECT NAME</label>
                          <input
                            type="text"
                            placeholder="e.g., Project Bedrock"
                            value={projectForm.name}
                            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                            required
                            className="w-full border border-blue-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                            className="w-full border border-blue-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm transition disabled:bg-gray-400"
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
                            : 'border-gray-200 hover:border-blue-300 bg-gray-50'
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
                            className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {projects.length === 0 && !showAddProjectForm && (
                    <p className="text-gray-500 text-center py-4">No projects found.</p>
                  )}
                </div>
              )}

              {/* Project Rates Section */}
              {selectedProject && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-yellow-700 bg-yellow-100 px-3 py-2 rounded flex-1">
                      GROSS RATES (Standard per hour)
                    </h3>
                    <button
                      onClick={() => setShowAddRateForm(!showAddRateForm)}
                      className="ml-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm transition"
                    >
                      {showAddRateForm ? 'Cancel' : '+ Add'}
                    </button>
                  </div>

                  {showAddRateForm && (
                    <form onSubmit={handleAddRate} className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-purple-700 mb-1">DESIGNATION</label>
                          <select
                            value={rateForm.designation}
                            onChange={(e) => setRateForm({ ...rateForm, designation: e.target.value })}
                            className="w-full border border-purple-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                              className="w-full border border-purple-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                              className="w-full border border-purple-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-3 w-full bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-sm transition disabled:bg-gray-400"
                      >
                        {loading ? 'Adding...' : 'Add Rate'}
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {projectRates.length > 0 ? (
                      projectRates.map((rate) => (
                        <div key={rate.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
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
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition disabled:opacity-50"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No rates found.</p>
                    )}
                  </div>
                </div>
              )}

              {!selectedClient && (
                <div className="min-h-64 bg-white rounded-lg shadow-lg p-6 flex items-center justify-center">
                  <p className="text-gray-500">Select a client to view/manage projects</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
