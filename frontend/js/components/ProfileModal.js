// User Profile & Password Update Modal Component
const ProfileModal = {
  props: ['show', 'currentUser'],
  emits: ['close', 'profile-updated'],
  data() {
    return {
      profileForm: {
        name: '',
        contact: '',
        department: '',
        roll_number: '',
        password: '',
        confirmPassword: ''
      },
      loading: false,
      errorMessage: '',
      successMessage: ''
    };
  },
  watch: {
    show(val) {
      if (val && this.currentUser) {
        this.profileForm.name = this.currentUser.name || '';
        this.profileForm.contact = this.currentUser.contact || '';
        this.profileForm.department = this.currentUser.department || '';
        this.profileForm.roll_number = this.currentUser.roll_number || '';
        this.profileForm.password = '';
        this.profileForm.confirmPassword = '';
        this.errorMessage = '';
        this.successMessage = '';
      }
    }
  },
  template: `
    <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow">
          <div class="modal-header">
            <h5 class="modal-title fw-bold">User Profile & Account</h5>
            <button type="button" class="btn-close" @click="$emit('close')"></button>
          </div>
          <form @submit.prevent="saveProfile">
            <div class="modal-body p-4">
              <div v-if="errorMessage" class="alert alert-danger py-2 small">{{ errorMessage }}</div>
              <div v-if="successMessage" class="alert alert-success py-2 small">{{ successMessage }}</div>

              <div class="mb-3">
                <label class="form-label text-muted small mb-0">Role & Username</label>
                <div class="d-flex align-items-center gap-2 mt-1">
                  <span class="badge bg-primary text-uppercase">{{ currentUser.role }}</span>
                  <span class="fw-bold">@{{ currentUser.username }}</span>
                  <span class="text-muted">({{ currentUser.email }})</span>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label fw-semibold">Full Name *</label>
                <input type="text" v-model="profileForm.name" class="form-control" required>
              </div>

              <div v-if="currentUser.role === 'student'" class="mb-3">
                <label class="form-label fw-semibold">Roll Number</label>
                <input type="text" v-model="profileForm.roll_number" class="form-control">
              </div>

              <div class="mb-3">
                <label class="form-label fw-semibold">Department</label>
                <input type="text" v-model="profileForm.department" class="form-control">
              </div>

              <div class="mb-3">
                <label class="form-label fw-semibold">Contact Number</label>
                <input type="tel" v-model="profileForm.contact" class="form-control">
              </div>

              <hr class="my-3">

              <h6 class="fw-bold text-secondary mb-2">Change Password (Optional)</h6>
              <div class="row g-2">
                <div class="col-6">
                  <input type="password" v-model="profileForm.password" class="form-control" placeholder="New Password">
                </div>
                <div class="col-6">
                  <input type="password" v-model="profileForm.confirmPassword" class="form-control" placeholder="Confirm Password">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="$emit('close')">Close</button>
              <button type="submit" class="btn btn-primary" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  methods: {
    async saveProfile() {
      if (this.profileForm.password) {
        if (this.profileForm.password !== this.profileForm.confirmPassword) {
          this.errorMessage = 'Passwords do not match';
          return;
        }
        if (this.profileForm.password.length < 6) {
          this.errorMessage = 'Password must be at least 6 characters long';
          return;
        }
      }

      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';

      try {
        const payload = {
          name: this.profileForm.name,
          contact: this.profileForm.contact,
          department: this.profileForm.department,
          roll_number: this.profileForm.roll_number
        };
        if (this.profileForm.password) {
          payload.password = this.profileForm.password;
        }

        const res = await api.updateProfile(payload);
        this.successMessage = 'Profile updated successfully!';
        this.$emit('profile-updated', res.user);
        setTimeout(() => {
          this.$emit('close');
        }, 1200);
      } catch (err) {
        this.errorMessage = err.message;
      } finally {
        this.loading = false;
      }
    }
  }
};

window.ProfileModal = ProfileModal;
