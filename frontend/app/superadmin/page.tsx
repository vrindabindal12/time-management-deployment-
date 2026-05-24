'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { superadminApi, SuperAdminOrganization, SuperAdminOrgUsersResponse, isAdmin, getCurrentUser } from '@/lib/api';

export default function SuperAdminDashboard() {
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [filteredOrgs, setFilteredOrgs] = useState<SuperAdminOrganization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [expandedOrg, setExpandedOrg] = useState<number | null>(null);
  const [orgUsers, setOrgUsers] = useState<Record<number, SuperAdminOrgUsersResponse>>({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || (user.role !== 'superadmin' && !(user as any).is_superadmin)) {
      router.push('/dashboard');
      return;
    }

    fetchOrganizations();
  }, [router]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await superadminApi.getOrganizations();
      setOrganizations(data);
      setFilteredOrgs(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      setFilteredOrgs(organizations);
    } else {
      const lower = searchQuery.toLowerCase();
      setFilteredOrgs(organizations.filter(o => 
        o.name.toLowerCase().includes(lower) || 
        o.id.toString().includes(lower)
      ));
    }
  }, [searchQuery, organizations]);

  const toggleOrganization = async (orgId: number) => {
    if (expandedOrg === orgId) {
      setExpandedOrg(null);
      return;
    }
    
    setExpandedOrg(orgId);
    
    if (!orgUsers[orgId]) {
      try {
        const users = await superadminApi.getOrganizationUsers(orgId);
        setOrgUsers(prev => ({ ...prev, [orgId]: users }));
      } catch (err: any) {
        console.error('Failed to load users for org', orgId, err);
      }
    }
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Global Access</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Super Admin Visibility: Monitor all organizations across the platform.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 shadow-sm text-sm font-medium">
          {error}
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/60">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Workspaces</p>
          <p className="text-3xl font-black text-slate-800">{organizations.length}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-white/60">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Users</p>
          <p className="text-3xl font-black text-slate-800">
            {organizations.reduce((sum, org) => sum + org.total_employees, 0)}
          </p>
        </div>
      </div>

      {/* Organizations List */}
      <div className="glass-panel rounded-3xl border border-white/60 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 bg-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800">Platform Organizations</h2>
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="divide-y divide-slate-100">
          {filteredOrgs.map(org => {
            const isExpanded = expandedOrg === org.id;
            const users = orgUsers[org.id];

            return (
              <div key={org.id} className={`transition-colors duration-200 ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-white/40'}`}>
                {/* Organization Header Row */}
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer group"
                  onClick={() => toggleOrganization(org.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-sm">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {org.name}
                        {org.id === 1 && <span className="ml-2 text-[10px] uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Demo</span>}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        ID: {org.id} &bull; Created: {org.created_at ? new Date(org.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-slate-400 font-bold uppercase">Admins</p>
                        <p className="font-bold text-slate-700">{org.total_admins}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400 font-bold uppercase">Employees</p>
                        <p className="font-bold text-slate-700">{org.total_employees}</p>
                      </div>
                    </div>
                    
                    <div className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                      <svg className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Users View */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-indigo-100/50 bg-white/20">
                    {!users ? (
                      <div className="text-sm text-slate-500 text-center py-4 animate-pulse">Loading users...</div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-6 mt-2">
                        {/* Admins List */}
                        <div>
                          <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Organization Admins</h4>
                          <div className="space-y-2">
                            {users.admins.length === 0 ? (
                              <p className="text-sm text-slate-400 italic">No admins found.</p>
                            ) : (
                              users.admins.map(admin => (
                                <div key={admin.id} className="flex items-center justify-between bg-white/60 border border-slate-200 rounded-xl p-3 shadow-sm">
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{admin.name}</p>
                                    <p className="text-xs text-slate-500">{admin.email}</p>
                                  </div>
                                  <span className="text-[10px] uppercase font-bold bg-violet-100 text-violet-700 px-2 py-1 rounded-md">
                                    {admin.role}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Employees List */}
                        <div>
                          <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Standard Employees</h4>
                          <div className="space-y-2">
                            {users.employees.length === 0 ? (
                              <p className="text-sm text-slate-400 italic">No standard employees found.</p>
                            ) : (
                              users.employees.map(emp => (
                                <div key={emp.id} className="flex items-center justify-between bg-white/60 border border-slate-200 rounded-xl p-3 shadow-sm">
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                                    <p className="text-xs text-slate-500">{emp.email}</p>
                                  </div>
                                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {emp.status}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredOrgs.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No organizations found matching your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
