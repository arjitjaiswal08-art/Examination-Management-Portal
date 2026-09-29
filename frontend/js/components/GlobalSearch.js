// Global Search Modal Component (Admin search across students, examiners, exams, bookings)
const GlobalSearch = {
  props: ['show'],
  emits: ['close'],
  data() {
    return {
      searchQuery: '',
      results: null,
      loading: false
    };
  },
  watch: {
    show(val) {
      if (val) {
        this.searchQuery = '';
        this.results = null;
      }
    }
  },
  template: `
    <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);" @click.self="$emit('close')">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content shadow-lg">
          <div class="modal-header bg-light">
            <h5 class="modal-title fw-bold">
              <i class="bi bi-search text-primary me-2"></i> Global Portal Search
            </h5>
            <button type="button" class="btn-close" @click="$emit('close')"></button>
          </div>
          <div class="modal-body p-4">
            <div class="input-group input-group-lg mb-4">
              <span class="input-group-text bg-white"><i class="bi bi-search text-primary"></i></span>
              <input 
                type="text" 
                v-model="searchQuery" 
                class="form-control" 
                placeholder="Search students, examiners, examinations, or bookings..." 
                @input="performSearch"
                autofocus>
            </div>

            <div v-if="loading" class="text-center py-4">
              <span class="spinner-border text-primary"></span>
            </div>

            <div v-else-if="results">
              <!-- Users / Students / Examiners -->
              <div v-if="results.users.length > 0" class="mb-4">
                <h6 class="fw-bold text-secondary text-uppercase small">Users & Students ({{ results.users.length }})</h6>
                <div class="list-group">
                  <div v-for="u in results.users" :key="u.id" class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{{ u.name }}</strong>
                      <span class="text-muted small ms-2">({{ u.email }})</span>
                      <small v-if="u.roll_number" class="badge bg-light text-dark ms-1">Roll: {{ u.roll_number }}</small>
                    </div>
                    <span class="badge" :class="u.role === 'examiner' ? 'bg-success' : (u.role === 'admin' ? 'bg-danger' : 'bg-primary')">
                      {{ u.role.toUpperCase() }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Examinations -->
              <div v-if="results.examinations.length > 0" class="mb-4">
                <h6 class="fw-bold text-secondary text-uppercase small">Examinations ({{ results.examinations.length }})</h6>
                <div class="list-group">
                  <div v-for="e in results.examinations" :key="e.id" class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{{ e.examination_name }}</strong>
                      <div class="small text-muted">{{ e.course_code }} - {{ e.course_name }}</div>
                    </div>
                    <span class="badge bg-secondary">{{ e.examination_status }}</span>
                  </div>
                </div>
              </div>

              <!-- Bookings -->
              <div v-if="results.bookings.length > 0" class="mb-3">
                <h6 class="fw-bold text-secondary text-uppercase small">Bookings ({{ results.bookings.length }})</h6>
                <div class="list-group">
                  <div v-for="b in results.bookings" :key="b.id" class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>Student: {{ b.student_name }}</strong>
                      <div class="small text-muted">{{ b.examination_name }} &bull; {{ b.slot_date }}</div>
                    </div>
                    <span class="badge bg-info text-dark">{{ b.status }}</span>
                  </div>
                </div>
              </div>

              <div v-if="results.users.length === 0 && results.examinations.length === 0 && results.bookings.length === 0" class="text-center py-4 text-muted">
                <i class="bi bi-emoji-neutral fs-2 d-block mb-1"></i>
                No matching results found for "{{ searchQuery }}".
              </div>
            </div>

            <div v-else class="text-center py-4 text-muted">
              <i class="bi bi-keyboard fs-3 d-block mb-1"></i>
              Type at least 2 characters to search across the examination portal.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="$emit('close')">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
  methods: {
    async performSearch() {
      const q = this.searchQuery.trim();
      if (q.length < 2) {
        this.results = null;
        return;
      }
      this.loading = true;
      try {
        const res = await api.globalSearch(q);
        this.results = res.results;
      } catch (err) {
        console.error(err);
      } finally {
        this.loading = false;
      }
    }
  }
};

window.GlobalSearch = GlobalSearch;
