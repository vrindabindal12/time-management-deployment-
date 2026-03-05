'use client';

import { useState, useEffect } from 'react';
import { employeeApi, getCurrentUser, logout, isAuthenticated } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Form fields
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursWorked, setHoursWorked] = useState('');
  const [description, setDescription] = useState('');
  
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
    loadStatus();
    loadProjects();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router]);

  const loadStatus = async () => {
    try {
      const data = await employeeApi.getMyStatus();
      setStatus(data);
    } catch (err: any) {
      setError('Failed to load status');
    }
  };

  const loadProjects = async () => {
    try {
      const data = await employeeApi.getAllProjects();
      setProjects(data);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    }
  };

  const handleProjectCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setProjectCode(code);
    
    if (!code.trim()) {
      setProjectName('');
      setFilteredProjects([]);
      setShowProjectDropdown(false);
      return;
    }
    
    const filtered = projects.filter(p => 
      p.code.toUpperCase().includes(code.toUpperCase())
    );
    setFilteredProjects(filtered);
    setShowProjectDropdown(filtered.length > 0);
  };

  const selectProject = (project: any) => {
    setProjectCode(project.code);
    setProjectName(project.name);
    setFilteredProjects([]);
    setShowProjectDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!projectCode.trim()) {
        setError('Project code is required');
        setLoading(false);
        return;
      }

      if (!projectName.trim()) {
        setError('Please select a valid project');
        setLoading(false);
        return;
      }

      if (!description.trim()) {
        setError('Description is required');
        setLoading(false);
        return;
      }

      const hours = parseFloat(hoursWorked);
      if (isNaN(hours) || hours <= 0 || hours > 24) {
        setError('Hours must be between 0 and 24');
        setLoading(false);
        return;
      }

      await employeeApi.addWork({
        project_code: projectCode.trim(),
        work_date: workDate,
        hours_worked: hours,
        description: description.trim()
      });
      
      // Reset form
      setProjectCode('');
      setProjectName('');
      setWorkDate(new Date().toISOString().split('T')[0]);
      setHoursWorked('');
      setDescription('');
      
      setSuccess('Work entry added successfully!');
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add work entry');
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
      <div className="max-w-4xl mx-auto">
        {/* Welcome Message */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Welcome, {user.name}!</h2>
          <p className="text-gray-600 mt-1">{user.email}</p>
          <p className="text-gray-500 text-sm mt-2">Current Time: {currentTime.toLocaleString()}</p>
        </div>

        {/* Today's Summary */}
        {status && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Today's Work</h2>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                Total Hours Today: {status.today_hours.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {status.today_entries.length} {status.today_entries.length === 1 ? 'entry' : 'entries'} logged
              </p>
            </div>
          </div>
        )}

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

        {/* Add Work Entry Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Add Work Entry</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label htmlFor="projectCode" className="block text-sm font-medium text-gray-700 mb-1">
                Project Code *
              </label>
              <input
                id="projectCode"
                type="text"
                required
                value={projectCode}
                onChange={handleProjectCodeChange}
                onFocus={() => projectCode && setShowProjectDropdown(true)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter or select project code (e.g., LD-001-BD001)"
                autoComplete="off"
              />
              
              {/* Project Selection Dropdown */}
              {showProjectDropdown && filteredProjects.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg mt-1 z-10">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => selectProject(project)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                    >
                      <div className="font-semibold text-gray-800">{project.code}</div>
                      <div className="text-sm text-gray-600">{project.name}</div>
                      {project.client_name && (
                        <div className="text-xs text-gray-500">{project.client_name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-populated Project Name */}
            {projectName && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600">Selected Project:</p>
                <p className="font-semibold text-blue-900">{projectName}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="workDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Work Date *
                </label>
                <input
                  id="workDate"
                  type="date"
                  required
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="hoursWorked" className="block text-sm font-medium text-gray-700 mb-1">
                  Hours Worked *
                </label>
                <input
                  id="hoursWorked"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  required
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 8"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What did you work on?"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Work Entry'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Once submitted, you cannot edit your entries. Only admins can make changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
