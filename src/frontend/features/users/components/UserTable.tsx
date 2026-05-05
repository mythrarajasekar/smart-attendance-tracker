import React from 'react';
import { UserProfile } from '../store/userSlice';

interface UserTableProps {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSort: (field: string, order: 'asc' | 'desc') => void;
  onEdit: (userId: string) => void;
  onDeactivate: (userId: string) => void;
}

const UserTable: React.FC<UserTableProps> = ({
  users, total, page, limit, isLoading, onPageChange, onEdit, onDeactivate,
}) => {
  const totalPages = Math.ceil(total / limit);

  return (
    <div data-testid="user-table">
      {isLoading && <div aria-live="polite" aria-busy="true">Loading...</div>}
      <table aria-label="Users list">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Department</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id} data-testid={`user-table-row-${user._id}`}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.department || '—'}</td>
              <td>
                <span aria-label={user.isActive ? 'Active' : 'Inactive'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <button
                  data-testid={`user-table-edit-${user._id}`}
                  onClick={() => onEdit(user._id)}
                  aria-label={`Edit ${user.name}`}
                >
                  Edit
                </button>
                {user.isActive && (
                  <button
                    data-testid={`user-table-deactivate-${user._id}`}
                    onClick={() => onDeactivate(user._id)}
                    aria-label={`Deactivate ${user.name}`}
                  >
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <nav aria-label="Pagination">
        <button
          data-testid="user-table-pagination-prev"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          Previous
        </button>
        <span data-testid="user-table-page-info" aria-live="polite">
          Page {page} of {totalPages} ({total} total)
        </span>
        <button
          data-testid="user-table-pagination-next"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
        </button>
      </nav>
    </div>
  );
};

export default UserTable;
