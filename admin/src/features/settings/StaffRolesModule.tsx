import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Users, Plus, Trash2, Key } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = 'http://localhost:8080';

interface ShopRole {
  id: number;
  name: string;
  display_name: string;
  description: string;
  permissions: string; // JSON string
  is_default: boolean;
}

interface ShopStaff {
  id: number;
  user_id: number;
  role_id: number;
  email?: string;
  created_at: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'read:orders', label: 'View Orders', desc: 'Can view order details and history' },
  { id: 'write:orders', label: 'Manage Orders', desc: 'Can fulfill, cancel, and refund orders' },
  { id: 'read:products', label: 'View Products', desc: 'Can view product catalog' },
  { id: 'write:products', label: 'Manage Products', desc: 'Can add, edit, and delete products' },
  { id: 'manage:theme', label: 'Edit Theme', desc: 'Can modify storefront design and AI themes' },
  { id: 'manage:settings', label: 'Store Settings', desc: 'Can edit tax, shipping, and payment settings' },
];

export default function StaffRolesModule({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');
  
  const [roles, setRoles] = useState<ShopRole[]>([]);
  const [staff, setStaff] = useState<ShopStaff[]>([]);
  
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRole, setNewRole] = useState({ display_name: '', name: '', description: '', permissions: [] as string[] });

  const [isInvitingStaff, setIsInvitingStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRoleId, setNewStaffRoleId] = useState<number>(0);

  const axiosConfig = { withCredentials: true };

  const fetchData = async () => {
    try {
      const [rolesRes, staffRes] = await Promise.all([
        axios.get(`${API_BASE}/api/shops/${id}/roles`, axiosConfig),
        axios.get(`${API_BASE}/api/shops/${id}/staff`, axiosConfig)
      ]);
      setRoles(rolesRes.data.roles || []);
      setStaff(staffRes.data.staff || []);
    } catch (err) {
      toast.error('Failed to load RBAC data');
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCreateRole = async () => {
    if (!newRole.display_name || !newRole.name) return toast.error('Name required');
    try {
      const payload = {
        ...newRole,
        permissions: newRole.permissions
      };
      await axios.post(`${API_BASE}/api/shops/${id}/roles`, payload, axiosConfig);
      toast.success('Role created!');
      setIsCreatingRole(false);
      setNewRole({ display_name: '', name: '', description: '', permissions: [] });
      fetchData();
    } catch (err) {
      toast.error('Failed to create role');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/roles/${roleId}`, axiosConfig);
      toast.success('Role deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete role');
    }
  };

  const handleInviteStaff = async () => {
    if (!newStaffEmail || !newStaffRoleId) return toast.error('Email and Role required');
    try {
      await axios.post(`${API_BASE}/api/shops/${id}/staff`, { email: newStaffEmail, role_id: newStaffRoleId }, axiosConfig);
      toast.success('Staff invited successfully!');
      setIsInvitingStaff(false);
      setNewStaffEmail('');
      setNewStaffRoleId(0);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to invite staff');
    }
  };

  const handleRemoveStaff = async (staffId: number) => {
    if (!window.confirm('Revoke access for this staff member?')) return;
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/staff/${staffId}`, axiosConfig);
      toast.success('Staff access revoked');
      fetchData();
    } catch (err) {
      toast.error('Failed to remove staff');
    }
  };

  const togglePermission = (permId: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Shield className="w-6 h-6 mr-2 text-indigo-600" />
            Staff & Permissions
          </h2>
          <p className="text-slate-500 text-sm mt-1">Manage who has access to your store and what they can do.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-max">
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-all ${
            activeTab === 'staff' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 mr-2" /> Staff Members
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-all ${
            activeTab === 'roles' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Key className="w-4 h-4 mr-2" /> Custom Roles
        </button>
      </div>

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsInvitingStaff(!isInvitingStaff)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center text-sm font-medium"
            >
              <Plus className="w-4 h-4 mr-2" /> Invite Staff
            </button>
          </div>

          {isInvitingStaff && (
            <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-800">Invite New Staff Member</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newStaffEmail}
                    onChange={e => setNewStaffEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign Role</label>
                  <select
                    value={newStaffRoleId}
                    onChange={e => setNewStaffRoleId(parseInt(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value={0}>Select a role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={() => setIsInvitingStaff(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition">Cancel</button>
                <button onClick={handleInviteStaff} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition">Send Invite</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">User Details</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Added</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => {
                  const role = roles.find(r => r.id === s.role_id);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{s.email || `User #${s.user_id}`}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {role?.display_name || 'Unknown Role'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRemoveStaff(s.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Revoke Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ROLES TAB */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsCreatingRole(!isCreatingRole)}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition flex items-center text-sm font-medium"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Custom Role
            </button>
          </div>

          {isCreatingRole && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-semibold text-slate-800">New Custom Role</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={newRole.display_name}
                    onChange={e => setNewRole({ ...newRole, display_name: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="e.g., Inventory Manager"
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Internal Name</label>
                  <input
                    type="text"
                    value={newRole.name}
                    disabled
                    className="w-full border border-slate-100 bg-slate-50 rounded-lg px-4 py-2 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newRole.description}
                  onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                  placeholder="What can users with this role do?"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Assign Permissions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label
                      key={perm.id}
                      className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                        newRole.permissions.includes(perm.id) 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          checked={newRole.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                        />
                      </div>
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-slate-900">{perm.label}</span>
                        <span className="block text-xs text-slate-500">{perm.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setIsCreatingRole(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition">Cancel</button>
                <button onClick={handleCreateRole} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition">Save Role</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(role => {
              let parsedPerms: string[] = [];
              try {
                parsedPerms = JSON.parse(role.permissions);
              } catch (e) {}

              return (
                <div key={role.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative group hover:border-slate-300 transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 flex items-center">
                        {role.display_name}
                      </h3>
                      {role.description && <p className="text-sm text-slate-500 mt-1">{role.description}</p>}
                    </div>
                    <button 
                      onClick={() => handleDeleteRole(role.id)}
                      className="text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Permissions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedPerms.map(p => {
                        const known = AVAILABLE_PERMISSIONS.find(k => k.id === p);
                        return (
                          <span key={p} className="inline-flex items-center px-2 py-1 rounded bg-slate-50 text-slate-600 text-xs border border-slate-100">
                            {known ? known.label : p}
                          </span>
                        );
                      })}
                      {parsedPerms.length === 0 && <span className="text-sm text-slate-400 italic">No permissions</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
