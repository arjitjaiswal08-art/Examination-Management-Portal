// Root Vue 3 Application Controller
const { createApp } = Vue;

const app = createApp({
  components: {
    'navbar': Navbar,
    'auth-modal': AuthModal,
    'profile-modal': ProfileModal,
    'global-search': GlobalSearch,
    'admin-dashboard': AdminDashboard,
    'examiner-dashboard': ExaminerDashboard,
    'student-dashboard': StudentDashboard
  },
  data() {
    return {
      currentUser: api.getUser(),
      notifications: [],
      unreadCount: 0,
      pollTimer: null,

      // Modal states
      showAuthModal: false,
      authModalTab: 'login',
      showProfileModal: false,
      showSearchModal: false,

      // PWA / Add to Desktop
      deferredPrompt: null,
      canInstall: false
    };
  },
  mounted() {
    // Listen for session expiry
    window.addEventListener('auth-expired', () => {
      this.currentUser = null;
      this.showAuthModal = true;
      this.authModalTab = 'login';
    });

    // PWA Install prompt listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstall = true;
    });

    if (this.currentUser) {
      this.fetchNotifications();
      this.startNotificationPolling();
    }
  },
  beforeUnmount() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  },
  methods: {
    handleAuthSuccess(user) {
      this.currentUser = user;
      this.showAuthModal = false;
      this.fetchNotifications();
      this.startNotificationPolling();
    },
    handleLogout() {
      api.logout();
      this.currentUser = null;
      this.notifications = [];
      this.unreadCount = 0;
      if (this.pollTimer) clearInterval(this.pollTimer);
    },
    openLogin() {
      this.authModalTab = 'login';
      this.showAuthModal = true;
    },
    openRegister() {
      this.authModalTab = 'register';
      this.showAuthModal = true;
    },
    handleProfileUpdated(updatedUser) {
      this.currentUser = updatedUser;
    },
    async fetchNotifications() {
      if (!this.currentUser) return;
      try {
        const res = await api.getNotifications();
        this.notifications = res.notifications || [];
        this.unreadCount = res.unread_count || 0;
      } catch (err) {
        console.warn('Could not fetch notifications:', err);
      }
    },
    startNotificationPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = setInterval(() => {
        this.fetchNotifications();
      }, 30000); // Poll every 30 seconds
    },
    async installApp() {
      if (!this.deferredPrompt) {
        alert('To add this app to your desktop, use your browser menu -> "Install Examination Management Portal" or "Add to Home Screen".');
        return;
      }
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.canInstall = false;
        this.deferredPrompt = null;
      }
    }
  }
});

app.mount('#app');
