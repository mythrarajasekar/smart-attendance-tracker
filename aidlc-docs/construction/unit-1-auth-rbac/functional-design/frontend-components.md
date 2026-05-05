# Frontend Components — Unit 1: Authentication & RBAC

## Component Hierarchy

```
App
  └── AuthProvider (Redux store + token refresh setup)
      ├── PublicRoute
      │   └── LoginPage
      │       └── LoginForm
      │           ├── EmailInput
      │           ├── PasswordInput
      │           └── SubmitButton
      └── ProtectedRoute (role-aware guard)
          └── [role-specific dashboard]
```

## Component: LoginPage

**File**: `src/features/auth/pages/LoginPage.tsx`

**Purpose**: Full-page login screen. Renders LoginForm, handles redirect after successful login.

**Props**: none (reads from Redux auth state)

**State**: none (delegates to LoginForm + Redux)

**Behavior**:
- If user is already authenticated (Redux `auth.isAuthenticated === true`), redirect to role-appropriate dashboard
- Renders LoginForm centered on page
- Displays app name/logo

**API Integration**: none directly — delegates to LoginForm

---

## Component: LoginForm

**File**: `src/features/auth/components/LoginForm.tsx`

**Props**:
```typescript
interface LoginFormProps {
  onSuccess?: () => void;
}
```

**Local State**:
```typescript
{
  email: string;
  password: string;
  showPassword: boolean;
  isSubmitting: boolean;
}
```

**Redux Actions dispatched**:
- `authSlice.actions.loginStart()`
- `authSlice.actions.loginSuccess({ accessToken, refreshToken, user })`
- `authSlice.actions.loginFailure(errorMessage)`

**Behavior**:
1. On submit: dispatch `loginThunk({ email, password })`
2. On success: redirect to `/dashboard` (role-based routing handles sub-redirect)
3. On 401: display "Invalid email or password"
4. On 423: display "Account locked. Try again in X minutes."
5. On 429: display "Too many requests. Please wait."
6. Disable submit button while `isSubmitting === true`

**Form Validation** (client-side, pre-submit):
- email: required, valid email format
- password: required, min 1 char (server validates strength on create, not login)

**data-testid attributes**:
```
login-form                  (form element)
login-email-input           (email input)
login-password-input        (password input)
login-password-toggle       (show/hide password button)
login-submit-button         (submit button)
login-error-message         (error display div)
```

---

## Component: ProtectedRoute

**File**: `src/features/auth/components/ProtectedRoute.tsx`

**Props**:
```typescript
interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}
```

**Behavior**:
1. Read `auth.isAuthenticated` and `auth.user.role` from Redux store
2. If not authenticated → redirect to `/login`
3. If authenticated but role not in `allowedRoles` → redirect to `/unauthorized`
4. Otherwise → render children

---

## Redux Auth Slice

**File**: `src/features/auth/store/authSlice.ts`

**State Shape**:
```typescript
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  error: null,
};
```

**Actions**:
```typescript
loginStart()                          // sets isLoading: true, error: null
loginSuccess(payload: LoginPayload)   // sets isAuthenticated, user, tokens
loginFailure(message: string)         // sets error, isLoading: false
logout()                              // resets all state to initial
tokenRefreshed(payload: TokenPayload) // updates accessToken + refreshToken
```

**Async Thunks**:
```typescript
loginThunk({ email, password })
  → POST /api/v1/auth/login
  → on success: dispatch loginSuccess, persist refreshToken to localStorage
  → on failure: dispatch loginFailure with error message

logoutThunk()
  → POST /api/v1/auth/logout (with refreshToken from state)
  → dispatch logout()
  → remove refreshToken from localStorage
  → redirect to /login
```

**Persistence**: `refreshToken` stored in `localStorage` (key: `sat_refresh_token`). `accessToken` kept in Redux memory only (not persisted — re-acquired via refresh on page load).

---

## Axios Token Refresh Interceptor

**File**: `src/shared/api/axiosInstance.ts`

**Purpose**: Transparently refreshes access token when a 401 is received, then retries the original request.

**Logic**:
```typescript
// Request interceptor: attach access token
config.headers.Authorization = `Bearer ${store.getState().auth.accessToken}`;

// Response interceptor: handle 401
if (error.response?.status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  const refreshToken = localStorage.getItem('sat_refresh_token');
  if (!refreshToken) {
    store.dispatch(logout());
    return Promise.reject(error);
  }
  try {
    const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
    store.dispatch(tokenRefreshed({ accessToken: data.accessToken, refreshToken: data.refreshToken }));
    localStorage.setItem('sat_refresh_token', data.refreshToken);
    originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
    return axiosInstance(originalRequest);
  } catch {
    store.dispatch(logout());
    localStorage.removeItem('sat_refresh_token');
    return Promise.reject(error);
  }
}
```

**Concurrent Request Handling**: Uses a `isRefreshing` flag and a `failedQueue` array to queue concurrent 401 requests while a single refresh is in flight, then replay all queued requests with the new token.
