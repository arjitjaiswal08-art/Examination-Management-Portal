// Centralized API Client with JWT Bearer Token management
const API_BASE = (window.location.port === '5001' || window.location.port === '') ? '/api' : 'http://127.0.0.1:5001/api';

const api = {
  getToken() {
    return localStorage.getItem('emp_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('emp_token', token);
    } else {
      localStorage.removeItem('emp_token');
    }
  },

  getUser() {
    const userStr = localStorage.getItem('emp_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('emp_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('emp_user');
    }
  },

  logout() {
    localStorage.removeItem('emp_token');
    localStorage.removeItem('emp_user');
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Unauthorized or expired token
      this.logout();
      window.dispatchEvent(new CustomEvent('auth-expired'));
      throw new Error('Session expired or unauthorized. Please log in again.');
    }

    const contentType = response.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errMsg = (data && data.error) ? data.error : (data && data.message ? data.message : `Request failed with status ${response.status}`);
      throw new Error(errMsg);
    }

    return data;
  },

  // Auth endpoints
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  async registerStudent(studentData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async updateProfile(profileData) {
    const data = await this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
    this.setUser(data.user);
    return data;
  },

  // Admin endpoints
  async getAdminStats() {
    return this.request('/admin/stats');
  },

  async getCourses() {
    return this.request('/admin/courses');
  },

  async createCourse(courseData) {
    return this.request('/admin/courses', {
      method: 'POST',
      body: JSON.stringify(courseData)
    });
  },

  async updateCourse(id, courseData) {
    return this.request(`/admin/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(courseData)
    });
  },

  async deleteCourse(id) {
    return this.request(`/admin/courses/${id}`, {
      method: 'DELETE'
    });
  },

  async getExaminations() {
    return this.request('/admin/examinations');
  },

  async createExamination(examData) {
    return this.request('/admin/examinations', {
      method: 'POST',
      body: JSON.stringify(examData)
    });
  },

  async updateExamination(id, examData) {
    return this.request(`/admin/examinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(examData)
    });
  },

  async deleteExamination(id) {
    return this.request(`/admin/examinations/${id}`, {
      method: 'DELETE'
    });
  },

  async updateExamStatus(id, status) {
    return this.request(`/admin/examinations/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async publishExamResults(id) {
    return this.request(`/admin/examinations/${id}/publish-results`, {
      method: 'POST'
    });
  },

  async getRubrics(examId) {
    return this.request(`/admin/examinations/${examId}/rubrics`);
  },

  async createRubric(examId, rubricData) {
    return this.request(`/admin/examinations/${examId}/rubrics`, {
      method: 'POST',
      body: JSON.stringify(rubricData)
    });
  },

  async updateRubric(rubricId, rubricData) {
    return this.request(`/admin/rubrics/${rubricId}`, {
      method: 'PUT',
      body: JSON.stringify(rubricData)
    });
  },

  async deleteRubric(rubricId) {
    return this.request(`/admin/rubrics/${rubricId}`, {
      method: 'DELETE'
    });
  },

  async getExaminers() {
    return this.request('/admin/examiners');
  },

  async addExaminer(examinerData) {
    return this.request('/admin/examiners', {
      method: 'POST',
      body: JSON.stringify(examinerData)
    });
  },

  async updateExaminer(id, examinerData) {
    return this.request(`/admin/examiners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(examinerData)
    });
  },

  async getStudents() {
    return this.request('/admin/students');
  },

  async updateStudentStatus(id, status) {
    return this.request(`/admin/students/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async getAllSlots(examId = null) {
    const q = examId ? `?examination_id=${examId}` : '';
    return this.request(`/admin/slots${q}`);
  },

  async getAllBookings() {
    return this.request('/admin/bookings');
  },

  async rescheduleBooking(bookingId, newSlotId, reason) {
    return this.request(`/admin/bookings/${bookingId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ new_slot_id: newSlotId, reason })
    });
  },

  async reassignExaminer(slotId, newExaminerId) {
    return this.request(`/admin/slots/${slotId}/reassign-examiner`, {
      method: 'POST',
      body: JSON.stringify({ new_examiner_id: newExaminerId })
    });
  },

  async triggerMonthlyReport() {
    return this.request('/admin/reports/monthly-trigger', {
      method: 'POST'
    });
  },

  async getLatestMonthlyReport() {
    return this.request('/admin/reports/monthly/latest');
  },

  // Examiner endpoints
  async getExaminerDashboard() {
    return this.request('/examiner/dashboard');
  },

  async getExaminerSlots(examId = null) {
    const q = examId ? `?examination_id=${examId}` : '';
    return this.request(`/examiner/slots${q}`);
  },

  async createSlot(slotData) {
    return this.request('/examiner/slots', {
      method: 'POST',
      body: JSON.stringify(slotData)
    });
  },

  async updateSlot(slotId, slotData) {
    return this.request(`/examiner/slots/${slotId}`, {
      method: 'PUT',
      body: JSON.stringify(slotData)
    });
  },

  async deleteSlot(slotId) {
    return this.request(`/examiner/slots/${slotId}`, {
      method: 'DELETE'
    });
  },

  async getSlotStudents(slotId) {
    return this.request(`/examiner/slots/${slotId}/students`);
  },

  async evaluateStudent(bookingId, scores, remarks) {
    return this.request(`/examiner/bookings/${bookingId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ scores, remarks })
    });
  },

  async markSlotCompleted(slotId) {
    return this.request(`/examiner/slots/${slotId}/complete`, {
      method: 'POST'
    });
  },

  // Student endpoints
  async getStudentDashboard() {
    return this.request('/student/dashboard');
  },

  async searchExaminations(search = '', type = '', status = '') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    return this.request(`/student/examinations?${params.toString()}`);
  },

  async getAvailableSlots(examId) {
    return this.request(`/student/examinations/${examId}/slots`);
  },

  async bookSlot(slotId) {
    return this.request('/student/book-slot', {
      method: 'POST',
      body: JSON.stringify({ slot_id: slotId })
    });
  },

  async cancelBooking(bookingId) {
    return this.request(`/student/bookings/${bookingId}/cancel`, {
      method: 'POST'
    });
  },

  async exportStudentHistoryCsv() {
    return this.request('/student/export-history-csv', {
      method: 'POST'
    });
  },

  async getExportJobStatus(jobId) {
    return this.request(`/student/export-jobs/${jobId}`);
  },

  // Common endpoints
  async getNotifications() {
    return this.request('/common/notifications');
  },

  async markNotificationsRead() {
    return this.request('/common/notifications/mark-read', {
      method: 'POST'
    });
  },

  async globalSearch(query) {
    return this.request(`/common/search?q=${encodeURIComponent(query)}`);
  }
};

window.api = api;
