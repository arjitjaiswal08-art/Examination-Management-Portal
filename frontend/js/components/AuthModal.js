// Authentication Modal Component (Login & Student Registration)
const AuthModal = {
  props: ['show', 'initialTab'],
  emits: ['close', 'auth-success'],
  data() {
    return {
      activeTab: this.initialTab || 'login', // 'login' or 'register'
      loginData: {
        username: '',
        password: ''
      },
      regData: {
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        roll_number: '',
        department: '',
        contact: ''
      },
      loading: false,
      errorMessage: '',
      successMessage: ''
    };
  },
  watch: {
    initialTab(newTab) {
      if (newTab) this.activeTab = newTab;
    },
    show(newVal) {
      if (newVal) {
        this.errorMessage = '';
        this.successMessage = '';
      }
    }
  },
  template: `
    <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);" @click.self="$emit('close')">
      <div class="modal-dialog modal-dialog-centered" :class="activeTab === 'register' ? 'modal-lg' : ''">
        <div class="modal-content shadow-lg border-0">
          <div class="modal-header bg-light border-bottom">
            <h5 class="modal-title fw-bold text-dark d-flex align-items-center">
              <i class="bi bi-shield-lock-fill text-primary me-2"></i>
              {{ activeTab === 'login' ? 'EMP Portal Sign In' : 'New Student Registration' }}
            </h5>
            <button type="button" class="btn-close" @click="$emit('close')"></button>
          </div>

          <div class="modal-body p-4">
            <!-- Tabs -->
            <ul class="nav nav-pills nav-fill mb-4 p-1 bg-light rounded-3">
              <li class="nav-item">
                <button 
                  class="nav-link fw-semibold" 
                  :class="activeTab === 'login' ? 'active shadow-sm' : ''" 
                  @click="activeTab = 'login'; errorMessage = ''">
                  <i class="bi bi-box-arrow-in-right me-1"></i> Sign In
                </button>
              </li>
              <li class="nav-item">
                <button 
                  class="nav-link fw-semibold" 
                  :class="activeTab === 'register' ? 'active shadow-sm' : ''" 
                  @click="activeTab = 'register'; errorMessage = ''">
                  <i class="bi bi-person-plus me-1"></i> Student Registration
                </button>
              </li>
            </ul>

            <!-- Alert messages -->
            <div v-if="errorMessage" class="alert alert-danger py-2 d-flex align-items-center mb-3">
              <i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
              <div>{{ errorMessage }}</div>
            </div>
            <div v-if="successMessage" class="alert alert-success py-2 d-flex align-items-center mb-3">
              <i class="bi bi-check-circle-fill me-2 fs-5"></i>
              <div>{{ successMessage }}</div>
            </div>

            <!-- Login Form -->
            <form v-if="activeTab === 'login'" @submit.prevent="handleLogin">
              <div class="mb-3">
                <label class="form-label fw-semibold">Username or Email</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-person"></i></span>
                  <input 
                    type="text" 
                    v-model="loginData.username" 
                    class="form-control" 
                    placeholder="Enter username or email" 
                    required 
                    autocomplete="username">
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label fw-semibold">Password</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-key"></i></span>
                  <input 
                    type="password" 
                    v-model="loginData.password" 
                    class="form-control" 
                    placeholder="Enter password" 
                    required 
                    autocomplete="current-password">
                </div>
              </div>

              <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-box-arrow-in-right me-2"></i>
                Sign In to Portal
              </button>
            </form>

            <!-- Student Registration Form -->
            <form v-if="activeTab === 'register'" @submit.prevent="handleRegister">
              <div class="alert alert-info py-2 small mb-3">
                <i class="bi bi-info-circle me-1"></i> Examiner accounts are provisioned exclusively by the Administrator. Only Students can register here.
              </div>

              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Full Name *</label>
                  <input type="text" v-model="regData.name" class="form-control" placeholder="e.g. John Doe" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Roll Number / Student ID *</label>
                  <input type="text" v-model="regData.roll_number" class="form-control" placeholder="e.g. 21BSCS105" required>
                </div>

                <div class="col-md-6">
                  <label class="form-label fw-semibold">Username *</label>
                  <input type="text" v-model="regData.username" class="form-control" placeholder="Choose a username" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Email Address *</label>
                  <input type="email" v-model="regData.email" class="form-control" placeholder="student@institute.edu" required>
                </div>

                <div class="col-md-6">
                  <label class="form-label fw-semibold">Department *</label>
                  <input type="text" v-model="regData.department" class="form-control" placeholder="e.g. Computer Science" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Contact Number</label>
                  <input type="tel" v-model="regData.contact" class="form-control" placeholder="+91 9876543210">
                </div>

                <div class="col-md-6">
                  <label class="form-label fw-semibold">Password *</label>
                  <input type="password" v-model="regData.password" class="form-control" placeholder="Min. 6 characters" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Confirm Password *</label>
                  <input type="password" v-model="regData.confirmPassword" class="form-control" placeholder="Re-enter password" required>
                </div>
              </div>

              <div class="mt-4">
                <button type="submit" class="btn btn-success w-100 py-2 fw-semibold" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-person-check me-2"></i>
                  Complete Student Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  methods: {
    async handleLogin() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const res = await api.login(this.loginData.username, this.loginData.password);
        this.$emit('auth-success', res.user);
        this.$emit('close');
      } catch (err) {
        this.errorMessage = err.message;
      } finally {
        this.loading = false;
      }
    },
    async handleRegister() {
      if (this.regData.password !== this.regData.confirmPassword) {
        this.errorMessage = 'Passwords do not match';
        return;
      }
      if (this.regData.password.length < 6) {
        this.errorMessage = 'Password must be at least 6 characters';
        return;
      }

      this.loading = true;
      this.errorMessage = '';
      try {
        const res = await api.registerStudent(this.regData);
        this.$emit('auth-success', res.user);
        this.$emit('close');
      } catch (err) {
        this.errorMessage = err.message;
      } finally {
        this.loading = false;
      }
    }
  }
};

window.AuthModal = AuthModal;
