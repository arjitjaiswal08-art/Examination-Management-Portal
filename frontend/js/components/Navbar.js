// Navigation Bar Component
const Navbar = {
  props: ['currentUser', 'notifications', 'unreadCount', 'canInstall'],
  emits: ['logout', 'open-profile', 'open-login', 'open-register', 'open-search', 'refresh-notifications', 'install-app'],
  template: `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm sticky-top">
      <div class="container-fluid px-3 px-lg-4">
        <a class="navbar-brand d-flex align-items-center" href="#" @click.prevent>
          <i class="bi bi-mortarboard-fill me-2 fs-4"></i>
          <span>EMP Portal</span>
          <span class="badge bg-light text-primary ms-2 fs-7 rounded-pill">v2.0</span>
        </a>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#empNavbar">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="empNavbar">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <span class="nav-link active">
                <i class="bi bi-shield-check me-1"></i> Examination Management Portal
              </span>
            </li>
          </ul>

          <div class="d-flex align-items-center gap-2">
            <!-- Admin Global Search -->
            <button 
              v-if="currentUser && currentUser.role === 'admin'"
              class="btn btn-outline-light btn-sm d-flex align-items-center"
              @click="$emit('open-search')"
              title="Global Search">
              <i class="bi bi-search me-1"></i> Search
            </button>

            <!-- Notifications Dropdown (when logged in) -->
            <div v-if="currentUser" class="dropdown">
              <button 
                class="btn btn-primary position-relative text-white border-0" 
                type="button" 
                id="notificationsDropdown" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
                @click="$emit('refresh-notifications')">
                <i class="bi bi-bell-fill fs-5"></i>
                <span 
                  v-if="unreadCount > 0" 
                  class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {{ unreadCount }}
                </span>
              </button>

              <div class="dropdown-menu dropdown-menu-end shadow p-2" style="width: 330px; max-height: 420px; overflow-y: auto;" aria-labelledby="notificationsDropdown">
                <div class="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom">
                  <h6 class="mb-0 fw-bold">Notifications</h6>
                  <button class="btn btn-sm btn-link text-decoration-none p-0" @click.stop="markAllRead">Mark all read</button>
                </div>

                <div v-if="notifications.length === 0" class="text-center text-muted py-3">
                  <i class="bi bi-bell-slash fs-4 d-block mb-1"></i>
                  <small>No notifications yet</small>
                </div>

                <div v-for="notif in notifications" :key="notif.id" class="p-2 mb-1 rounded" :class="notif.is_read ? 'bg-white' : 'bg-light border-start border-3 border-primary'">
                  <div class="d-flex justify-content-between">
                    <strong class="small text-truncate" style="max-width: 200px;">{{ notif.title }}</strong>
                    <span class="badge" :class="getBadgeClass(notif.type)">{{ notif.type }}</span>
                  </div>
                  <p class="small text-muted mb-1 mt-1">{{ notif.message }}</p>
                  <small class="text-secondary" style="font-size: 0.72rem;">{{ formatDate(notif.created_at) }}</small>
                </div>
              </div>
            </div>

            <!-- User Menu or Login Buttons -->
            <template v-if="currentUser">
              <div class="dropdown">
                <button class="btn btn-light dropdown-toggle btn-sm d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
                  <i class="bi bi-person-circle fs-6"></i>
                  <span class="fw-semibold">{{ currentUser.name }}</span>
                  <span class="badge rounded-pill" :class="getRoleBadge(currentUser.role)">{{ currentUser.role.toUpperCase() }}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                  <li>
                    <h6 class="dropdown-header">
                      Signed in as <strong>{{ currentUser.username }}</strong>
                    </h6>
                  </li>
                  <li><hr class="dropdown-divider"></li>
                  <li>
                    <a class="dropdown-item" href="#" @click.prevent="$emit('open-profile')">
                      <i class="bi bi-person-gear me-2"></i> Profile & Password
                    </a>
                  </li>
                  <li><hr class="dropdown-divider"></li>
                  <li>
                    <a class="dropdown-item text-danger" href="#" @click.prevent="$emit('logout')">
                      <i class="bi bi-box-arrow-right me-2"></i> Logout
                    </a>
                  </li>
                </ul>
              </div>
            </template>
            <template v-else>
              <button class="btn btn-outline-light btn-sm" @click="$emit('open-login')">
                <i class="bi bi-box-arrow-in-right me-1"></i> Login
              </button>
              <button class="btn btn-light btn-sm fw-semibold text-primary" @click="$emit('open-register')">
                <i class="bi bi-person-plus me-1"></i> Student Register
              </button>
            </template>
          </div>
        </div>
      </div>
    </nav>
  `,
  methods: {
    getRoleBadge(role) {
      if (role === 'admin') return 'bg-danger text-white';
      if (role === 'examiner') return 'bg-success text-white';
      return 'bg-primary text-white';
    },
    getBadgeClass(type) {
      if (type === 'success') return 'bg-success';
      if (type === 'warning') return 'bg-warning text-dark';
      if (type === 'reminder') return 'bg-info text-dark';
      return 'bg-secondary';
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    async markAllRead() {
      try {
        await api.markNotificationsRead();
        this.$emit('refresh-notifications');
      } catch (e) {
        console.error(e);
      }
    }
  }
};

window.Navbar = Navbar;
