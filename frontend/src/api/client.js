// En dev, Vite proxifie /api vers http://localhost:4000 (voir vite.config.js).
// En production, définissez VITE_API_URL (ex: https://kajye-api.onrender.com)
// dans les variables d'environnement de votre hébergeur front-end.
export const API_ORIGIN = import.meta.env.VITE_API_URL || '';
const BASE = `${API_ORIGIN}/api`;

async function request(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (formData) {
    payload = body; // FormData sets its own Content-Type boundary
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(data?.error || `Erreur ${res.status}`);
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

  paymentMethods: () => request('/purchases/payment-methods'),
  buy: (body, token) => request('/purchases', { method: 'POST', body, token }),
  confirmPurchase: (id, token) => request(`/purchases/${id}/confirm`, { method: 'POST', token }),
  library: (token) => request('/purchases/library', { token }),
  history: (token) => request('/purchases/history', { token }),
  downloadLink: (bookId, token) => request(`/purchases/${bookId}/download-link`, { token }),

  dashboard: (token) => request('/admin/dashboard', { token }),
  transactions: (params, token) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v)).toString();
    return request(`/admin/transactions${qs ? `?${qs}` : ''}`, { token });
  },
  refund: (id, body, token) => request(`/admin/transactions/${id}/refund`, { method: 'POST', body, token }),
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
