import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/authStore';
import {
  LayoutDashboard,
  Plus,
  FileText,
  Users,
  BarChart3,
} from 'lucide-react';

const navigation = {
  'Incident Creator': [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'New Incident', href: '/incidents/new', icon: Plus },
  ],
  'Issue Responder': [
    { name: 'My Queue', href: '/queue', icon: FileText },
  ],
  'Administrator': [
    { name: 'Dashboard', href: '/admin', icon: BarChart3 },
    { name: 'All Incidents', href: '/admin/incidents', icon: FileText },
    { name: 'Users', href: '/admin/users', icon: Users },
  ],
};

export function Sidebar() {
  const { user } = useAuthStore();

  if (!user) return null;

  const userNav = navigation[user.role];

  return (
    <div className="w-64 bg-white border-r border-surface-border">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">
          Incident Management
        </h1>
      </div>
      <nav className="px-4 space-y-1">
        {userNav.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-500'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}