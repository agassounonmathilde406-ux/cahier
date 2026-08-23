export const API_ORIGIN = import.meta.env.VITE_API_URL || '';
const BASE = `${API_ORIGIN}/api`;

async function request(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (formData) {
    payload = body;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Erreur ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  googleLogin: (idToken) => request('/auth/google', { method: 'POST', body: { idToken } }),
  me: (token) => request('/auth/me', { token }),
  updateMe: (body, token) => request('/auth/me', { method: 'PUT', body, token }),

  subjects: () => request('/books/subjects'),
  books: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
    return request(`/books${qs ? `?${qs}` : ''}`);
  },
  book: (id, token) => request(`/books/${id}`, { token }),
  createBook: (formData, token) => request('/books', { method: 'POST', body: formData, formData: true, token }),
  updateBook: (id, formData, token) => request(`/books/${id}`, { method: 'PUT', body: formData, formData: true, token }),
  submitBook: (id, token) => request(`/books/${id}/submit`, { method: 'POST', token }),
  validateBook: (id, decision, token) => request(`/books/${id}/validate`, { method: 'POST', body: { decision }, token }),
  archiveBook: (id, token) => request(`/books/${id}/archive`, { method: 'POST', token }),
  pendingBooks: (token) => request('/books/admin/pending', { token }),
  allBooksAdmin: (token) => request('/books/admin/all', { token }),
  reportBook: (id, reason, token) => request(`/books/${id}/report`, { method: 'POST', body: { reason }, token }),
  reviews: (bookId) => request(`/books/${bookId}/reviews`),
  addReview: (bookId, body, token) => request(`/books/${bookId}/reviews`, { method: 'POST', body, token }),

  buy: (bookId, token) => request('/purchases', { method: 'POST', body: { bookId }, token }),
  library: (token) => request('/purchases/library', { token }),
  history: (token) => request('/purchases/history', { token }),
  downloadLink: (bookId, token) => request(`/purchases/${bookId}/download-link`, { token }),

  balance: (token) => request('/wallet/balance', { token }),
  walletPaymentMethods: () => request('/wallet/payment-methods'),
  recharge: (body, token) => request('/wallet/recharge', { method: 'POST', body, token }),
  confirmRecharge: (id, token) => request(`/wallet/recharge/${id}/confirm`, { method: 'POST', token }),
  walletHistory: (token) => request('/wallet/history', { token }),

  dashboard: (token) => request('/admin/dashboard', { token }),
  settings: (token) => request('/admin/settings', { token }),
  setPaymentMode: (mode, token) => request('/admin/settings/payment-mode', { method: 'POST', body: { mode }, token }),
  walletTransactions: (params, token) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v)).toString();
    return request(`/admin/wallet-transactions${qs ? `?${qs}` : ''}`, { token });
  },
  confirmManualRecharge: (id, token) => request(`/admin/wallet-transactions/${id}/confirm-manual`, { method: 'POST', token }),
  rejectRecharge: (id, token) => request(`/admin/wallet-transactions/${id}/reject`, { method: 'POST', token }),
  transactions: (params, token) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v)).toString();
    return request(`/admin/transactions${qs ? `?${qs}` : ''}`, { token });
  },
  users: (q, token) => request(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token }),
  userDetail: (id, token) => request(`/admin/users/${id}`, { token }),
  suspendUser: (id, token) => request(`/admin/users/${id}/suspend`, { method: 'POST', token }),
  reactivateUser: (id, token) => request(`/admin/users/${id}/reactivate`, { method: 'POST', token }),
  admins: (token) => request('/admin/admins', { token }),
  createAdmin: (body, token) => request('/admin/admins', { method: 'POST', body, token }),
  removeAdmin: (id, token) => request(`/admin/admins/${id}`, { method: 'DELETE', token }),
  activityLog: (token) => request('/admin/activity-log', { token }),
  reports: (token) => request('/admin/reports', { token }),
};
