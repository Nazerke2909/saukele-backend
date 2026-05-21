/**
 * Saukele API Client
 * Handles all communication with the backend REST API
 */
class SaukeleAPI {
  constructor() {
    // Try multiple possible ports where the backend might be running
    const port = window.location.port;
    const devPorts = ['3000', '4000'];
    
    if (port === '5500' || port === '5173' || port === '3000' || port === '') {
      // We're in dev mode — try port 3000 (from .env) or 4000
      this.baseURL = 'http://localhost:3000';
    } else {
      this.baseURL = window.location.origin;  // Production (served from backend)
    }
    
    this.accessToken = localStorage.getItem('accessToken') || null;
    this.refreshToken = localStorage.getItem('refreshToken') || null;
  }

  // ===== Auth Headers =====
  getHeaders(includeAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (includeAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  // ===== HTTP Helpers =====
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(options.auth),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(data?.error || data?.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        
        // If 401 and we have a refresh token, try refreshing
        if (response.status === 401 && this.refreshToken && options.auth) {
          const refreshed = await this.refreshTokens();
          if (refreshed) {
            // Retry original request with new token
            config.headers['Authorization'] = `Bearer ${this.accessToken}`;
            const retryResponse = await fetch(url, config);
            const retryData = await retryResponse.json().catch(() => null);
            if (retryResponse.ok) return retryData;
            throw new Error(retryData?.error || `HTTP ${retryResponse.status}`);
          }
        }
        
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      throw new Error('Network error. Is the server running?');
    }
  }

  // ===== Token Management =====
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  clearCurrentUser() {
    localStorage.removeItem('currentUser');
  }

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  async register(email, password, role = 'GUEST', fullName = '') {
    const data = await this.request('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, role, fullName }),
    });
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async refreshTokens() {
    try {
      const data = await this.request('/auth/refresh', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      this.clearTokens();
      this.clearCurrentUser();
      return false;
    }
  }

  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
    } catch { /* ignore */ }
    this.clearTokens();
    this.clearCurrentUser();
  }

  async getMe() {
    const data = await this.request('/auth/me', { auth: true });
    this.setCurrentUser(data);
    return data;
  }

  async updateProfile(data) {
    return await this.request('/auth/profile', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async verifyEmail(email, code) {
    return await this.request('/auth/verify-email', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, code }),
    });
  }

  async resendVerification(email) {
    return await this.request('/auth/resend-verification', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email) {
    return await this.request('/auth/forgot-password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email, token, newPassword) {
    return await this.request('/auth/reset-password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, token, newPassword }),
    });
  }

  // ============================================
  // WEDDING ENDPOINTS
  // ============================================

  async listWeddings(cursor = null, limit = 10) {
    let query = `?limit=${limit}`;
    if (cursor) query += `&cursor=${cursor}`;
    return await this.request(`/weddings${query}`, { auth: true });
  }

  async getWedding(id) {
    return await this.request(`/weddings/${id}`, { auth: true });
  }

  async createWedding(data) {
    return await this.request('/weddings', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async updateWedding(id, data) {
    return await this.request(`/weddings/${id}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async deleteWedding(id) {
    return await this.request(`/weddings/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  // ============================================
  // POOL ENDPOINTS
  // ============================================

  async listPools(weddingId = null, cursor = null, limit = 10) {
    let query = `?limit=${limit}`;
    if (weddingId) query += `&weddingId=${weddingId}`;
    if (cursor) query += `&cursor=${cursor}`;
    return await this.request(`/pools${query}`, { auth: true });
  }

  async getPool(id) {
    return await this.request(`/pools/${id}`, { auth: true });
  }

  async createPool(data) {
    return await this.request('/pools', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async updatePool(id, data) {
    return await this.request(`/pools/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async deletePool(id) {
    return await this.request(`/pools/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async purchasePool(id) {
    return await this.request(`/pools/${id}/purchase`, {
      method: 'PATCH',
      auth: true,
    });
  }

  async deliverPool(id) {
    return await this.request(`/pools/${id}/deliver`, {
      method: 'PATCH',
      auth: true,
    });
  }

  async updatePoolStatus(id, status) {
    return await this.request(`/pools/${id}/status`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ status }),
    });
  }

  // ============================================
  // CONTRIBUTION ENDPOINTS
  // ============================================

  async createContribution(data) {
    return await this.request('/contributions', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async getMyContributions(cursor = null, limit = 10) {
    let query = `?limit=${limit}`;
    if (cursor) query += `&cursor=${cursor}`;
    return await this.request(`/contributions/my${query}`, { auth: true });
  }

  async getPoolContributions(poolId, cursor = null, limit = 10) {
    let query = `?limit=${limit}`;
    if (cursor) query += `&cursor=${cursor}`;
    return await this.request(`/contributions/pool/${poolId}${query}`, { auth: true });
  }

  async deleteContribution(id) {
    return await this.request(`/contributions/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  // ============================================
  // FAMILY TREE ENDPOINTS
  // ============================================

  async getFamilyTree(weddingId) {
    return await this.request(`/family/${weddingId}/tree`, { auth: true });
  }

  async getFamilyTreeRecursive(weddingId, memberId = null, includeCouple = false) {
    let query = '?';
    if (memberId) query += `&memberId=${memberId}`;
    if (includeCouple) query += `&includeCouple=true`;
    return await this.request(`/family/${weddingId}/tree/recursive${query}`, { auth: true });
  }

  async addFamilyMember(weddingId, data) {
    return await this.request(`/family/${weddingId}/member`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async getGiftObligations(weddingId) {
    return await this.request(`/family/${weddingId}/obligations`, { auth: true });
  }

  async getMyFamilyWedding() {
    return await this.request('/family/my-wedding', { auth: true });
  }

  async getMyRank() {
    return await this.request('/family/my-rank', { auth: true });
  }

  async removeFamilyMember(weddingId, memberId) {
    return await this.request(`/family/${weddingId}/member/${memberId}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async sendObligationReminders(weddingId) {
    return await this.request(`/family/${weddingId}/remind`, {
      method: 'POST',
      auth: true,
    });
  }

  // ============================================
  // LOGISTICS ENDPOINTS
  // ============================================

  async createLogistics(poolId) {
    return await this.request(`/pools/${poolId}/logistics`, {
      method: 'POST',
      auth: true,
    });
  }

  async assignCarrier(poolId, data) {
    return await this.request(`/pools/${poolId}/logistics/carrier`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async updateDeliveryStatus(poolId, deliveryStatus, carrierNotes = '') {
    return await this.request(`/pools/${poolId}/logistics/status`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ deliveryStatus, carrierNotes }),
    });
  }

  async getLogistics(poolId) {
    return await this.request(`/pools/${poolId}/logistics`, { auth: true });
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  async adminListUsers(cursor = null, limit = 20, filters = {}) {
    let query = `?limit=${limit}`;
    if (cursor) query += `&cursor=${cursor}`;
    if (filters.role) query += `&role=${filters.role}`;
    if (filters.isBlocked) query += `&isBlocked=${filters.isBlocked}`;
    return await this.request(`/admin/users${query}`, { auth: true });
  }

  async adminDeleteUser(id) {
    return await this.request(`/admin/users/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async adminUpdateExchangeRate(data) {
    return await this.request('/admin/exchange-rates', {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(data),
    });
  }

  async adminGetAuditLog(cursor = null, limit = 50, filters = {}) {
    let query = `?limit=${limit}`;
    if (cursor) query += `&cursor=${cursor}`;
    if (filters.action) query += `&action=${filters.action}`;
    if (filters.entityType) query += `&entityType=${filters.entityType}`;
    if (filters.userId) query += `&userId=${filters.userId}`;
    return await this.request(`/admin/audit-log${query}`, { auth: true });
  }

  async adminPromoteModerator(userId) {
    return await this.request(`/admin/moderators/${userId}/promote`, {
      method: 'PATCH',
      auth: true,
    });
  }

  async adminGetQueueStats() {
    return await this.request('/admin/queue-stats', { auth: true });
  }

  async adminGetQueueDetail(queueName) {
    return await this.request(`/admin/queue-stats/${queueName}`, { auth: true });
  }

  async adminGetJobDetail(queueName, jobId) {
    return await this.request(`/admin/queue-stats/${queueName}/jobs/${jobId}`, { auth: true });
  }

  async adminRetryJob(queueName, jobId) {
    return await this.request(`/admin/queue-stats/${queueName}/jobs/${jobId}/retry`, {
      method: 'POST',
      auth: true,
    });
  }

  async adminRemoveJob(queueName, jobId) {
    return await this.request(`/admin/queue-stats/${queueName}/jobs/${jobId}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async adminGetCronTasks() {
    return await this.request('/admin/queue-stats/cron/tasks', { auth: true });
  }

  async adminTriggerCronTask(type) {
    return await this.request(`/admin/queue-stats/cron/trigger/${type}`, {
      method: 'POST',
      auth: true,
    });
  }

  // ============================================
  // MODERATOR ENDPOINTS
  // ============================================

  async moderatorGetFlaggedContributions(cursor = null, limit = 20) {
    let query = `?limit=${limit}`;
    if (cursor) query += `&cursor=${cursor}`;
    return await this.request(`/moderator/contributions/flagged${query}`, { auth: true });
  }

  async moderatorBlockUser(id) {
    return await this.request(`/moderator/users/${id}/block`, {
      method: 'PATCH',
      auth: true,
    });
  }

  async moderatorGetOwnAuditLog(cursor = null, limit = 50) {
    let query = `?limit=${limit}`;
    if (cursor) query += `&cursor=${cursor}`;
    return await this.request(`/moderator/audit-log${query}`, { auth: true });
  }

  async searchUserByEmail(email) {
  return await this.request(`/auth/search-user?email=${encodeURIComponent(email)}`, { auth: true });
  }
}

// Global instance
const api = new SaukeleAPI();
