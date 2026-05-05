import React from 'react';
import { UserFilters } from '../store/userSlice';

interface SearchFiltersProps {
  filters: UserFilters;
  onChange: (filters: Partial<UserFilters>) => void;
  onReset: () => void;
}

const ROLES = ['student', 'faculty', 'admin'];
const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Mathematics'];

const SearchFilters: React.FC<SearchFiltersProps> = ({ filters, onChange, onReset }) => (
  <div data-testid="search-filters" role="search" aria-label="User search filters">
    <input
      data-testid="search-filters-text-input"
      type="search"
      placeholder="Search by name, email, roll number..."
      value={filters.search || ''}
      onChange={(e) => onChange({ search: e.target.value || undefined })}
      aria-label="Search users"
    />

    <select
      data-testid="search-filters-role-select"
      value={filters.role || ''}
      onChange={(e) => onChange({ role: e.target.value || undefined })}
      aria-label="Filter by role"
    >
      <option value="">All Roles</option>
      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
    </select>

    <select
      data-testid="search-filters-department-select"
      value={filters.department || ''}
      onChange={(e) => onChange({ department: e.target.value || undefined })}
      aria-label="Filter by department"
    >
      <option value="">All Departments</option>
      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
    </select>

    <select
      data-testid="search-filters-status-select"
      value={filters.isActive === undefined ? '' : String(filters.isActive)}
      onChange={(e) => onChange({ isActive: e.target.value === '' ? undefined : e.target.value === 'true' })}
      aria-label="Filter by status"
    >
      <option value="true">Active</option>
      <option value="false">Inactive</option>
      <option value="">All</option>
    </select>

    <button
      data-testid="search-filters-reset-button"
      onClick={onReset}
      type="button"
      aria-label="Reset filters"
    >
      Reset
    </button>
  </div>
);

export default SearchFilters;
