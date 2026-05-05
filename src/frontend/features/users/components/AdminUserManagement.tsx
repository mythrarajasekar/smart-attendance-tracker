import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchUsers, deactivateUser, setFilters, resetFilters } from '../store/userSlice';
import UserTable from './UserTable';
import SearchFilters from './SearchFilters';

const AdminUserManagement: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { list, pagination, filters, isLoading, error } = useSelector((s: RootState) => s.users);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchUsers(filters));
  }, [dispatch, filters]);

  const handleFilterChange = (newFilters: Parameters<typeof setFilters>[0]['payload']) => {
    dispatch(setFilters(newFilters));
  };

  const handleReset = () => dispatch(resetFilters());

  const handlePageChange = (page: number) => dispatch(setFilters({ page }));

  const handleDeactivate = async (userId: string) => {
    setConfirmDeactivate(null);
    await dispatch(deactivateUser(userId));
    dispatch(fetchUsers(filters));
  };

  return (
    <div data-testid="admin-user-management" aria-label="User management">
      <h2>User Management</h2>

      <button
        data-testid="admin-create-user-button"
        type="button"
        aria-label="Create new user"
        onClick={() => {/* open create modal */}}
      >
        Create User
      </button>

      <SearchFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {error && <div role="alert" aria-live="assertive">{error}</div>}

      <UserTable
        users={list}
        total={pagination.total}
        page={pagination.page}
        limit={pagination.limit}
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onSort={(field, order) => dispatch(setFilters({ sortBy: field, sortOrder: order }))}
        onEdit={(id) => {/* open edit modal */void id;}}
        onDeactivate={(id) => setConfirmDeactivate(id)}
      />

      {confirmDeactivate && (
        <div role="dialog" aria-modal="true" aria-label="Confirm deactivation">
          <p>Are you sure you want to deactivate this user?</p>
          <button onClick={() => handleDeactivate(confirmDeactivate)}>Confirm</button>
          <button onClick={() => setConfirmDeactivate(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
