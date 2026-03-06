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
  const today = new Date();
  const maxWorkDate = today.toISOString().split('T')[0];
  const minDate = new Date(today);
  minDate.setDate(today.getDate() - 7);
  const minWorkDate = minDate.toISOString().split('T')[0];

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

      if (workDate < minWorkDate || workDate > maxWorkDate) {
        setError('You can only log work for today or up to 7 days back');
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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-8">
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Message */}
        <div className="glass-panel rounded-3xl p-6 mb-6">
          <h2 className="text-2xl font-black text-slate-900">Welcome, {user.name}!</h2>
          <p className="text-slate-600 mt-1">{user.email}</p>
          <p className="text-slate-500 text-sm mt-2">Current Time: {currentTime.toLocaleString()}</p>
        </div>

        {/* Today's Summary */}
        {status && (
          <div className="glass-panel rounded-3xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Today's Work</h2>
            <div className="glass-subtle p-4 rounded-xl">
              <p className="text-2xl font-bold text-blue-700">
                Total Hours Today: {status.today_hours.toFixed(2)}
              </p>
              <p className="text-sm text-slate-600 mt-2">
                {status.today_entries.length} {status.today_entries.length === 1 ? 'entry' : 'entries'} logged
              </p>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {error && (
          <div className="glass-panel bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="glass-panel bg-emerald-50/80 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-4">
            {success}
          </div>
        )}

        {/* Add Work Entry Form */}
        <div className="glass-panel rounded-3xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Add Work Entry</h2>
          
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
                className="w-full border border-slate-300 bg-white/80 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter or select project code (e.g., LD-001-BD001)"
                autoComplete="off"
              />
              
              {/* Project Selection Dropdown */}
              {showProjectDropdown && filteredProjects.length > 0 && (
                <div className="absolute top-full left-0 right-0 glass-panel border border-white/70 rounded-xl mt-1 z-10 overflow-hidden">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => selectProject(project)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50/60 border-b border-white/60 last:border-b-0"
                    >
                      <div className="font-semibold text-slate-800">{project.code}</div>
                      <div className="text-sm text-slate-600">{project.name}</div>
                      {project.client_name && (
                        <div className="text-xs text-slate-500">{project.client_name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-populated Project Name */}
            {projectName && (
              <div className="glass-subtle p-3 rounded-xl border border-white/60">
                <p className="text-sm text-slate-600">Selected Project:</p>
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
                  min={minWorkDate}
                  max={maxWorkDate}
                  className="w-full border border-slate-300 bg-white/80 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border border-slate-300 bg-white/80 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full border border-slate-300 bg-white/80 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What did you work on?"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full glass-primary-btn hover:brightness-95 text-white font-semibold py-3 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Work Entry'}
            </button>
          </form>

          <div className="mt-4 p-3 glass-subtle border border-white/60 rounded-xl">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Once submitted, you cannot edit your entries. Only admins can make changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
