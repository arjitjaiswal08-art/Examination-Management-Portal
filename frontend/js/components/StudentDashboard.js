// Student Dashboard Component
const StudentDashboard = {
  props: ['currentUser'],
  data() {
    return {
      activeTab: 'overview', // 'overview', 'exams', 'bookings', 'results'
      dashboardData: null,
      examinationsList: [],
      searchQuery: '',
      filterType: '',
      filterStatus: '',
      loading: false,
      toastMessage: '',
      toastType: 'success',

      // Slot Booking Modal
      showSlotsModal: false,
      targetExam: null,
      availableSlots: [],
      bookingSlotLoading: false,

      // Async CSV Export Job State
      exportingCsv: false,
      exportJobId: null,
      csvDownloadUrl: null,

      // Scorecard Modal
      showScorecardModal: false,
      activeResultForScorecard: null
    };
  },
  mounted() {
    this.loadStudentData();
  },
  template: `
    <div class="student-dashboard">
      <!-- Toast Alert -->
      <div v-if="toastMessage" class="alert alert-dismissible fade show mb-3" :class="'alert-' + toastType" role="alert">
        <i class="bi bi-info-circle-fill me-2"></i>
        <span>{{ toastMessage }}</span>
        <button type="button" class="btn-close" @click="toastMessage = ''"></button>
      </div>

      <!-- Dashboard Overview Metrics Cards -->
      <div v-if="dashboardData && dashboardData.metrics" class="row g-3 mb-4">
        <div class="col-md-3">
          <div class="card stat-card shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Available Examinations</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-primary">{{ dashboardData.metrics.available_exams_count }}</h3>
              <i class="bi bi-journal-plus fs-3 text-primary opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card stat-card border-warning shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Upcoming Exams</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-warning">{{ dashboardData.metrics.upcoming_exams_count }}</h3>
              <i class="bi bi-clock-history fs-3 text-warning opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card stat-card border-info shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Total Bookings</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-info">{{ dashboardData.metrics.total_bookings_count }}</h3>
              <i class="bi bi-bookmark-check fs-3 text-info opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card stat-card border-success shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Published Results</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-success">{{ dashboardData.metrics.published_results_count }}</h3>
              <i class="bi bi-award-fill fs-3 text-success opacity-75"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="card shadow-sm mb-4">
        <div class="card-header bg-white border-bottom">
          <ul class="nav nav-tabs card-header-tabs">
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'overview' ? 'active fw-bold text-primary' : 'text-secondary'" @click="activeTab = 'overview'">
                <i class="bi bi-house-door me-1"></i> Dashboard Overview
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'exams' ? 'active fw-bold text-primary' : 'text-secondary'" @click="activeTab = 'exams'; loadExaminationsList()">
                <i class="bi bi-search me-1"></i> Available Examinations & Slots
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'bookings' ? 'active fw-bold text-primary' : 'text-secondary'" @click="activeTab = 'bookings'">
                <i class="bi bi-calendar-check me-1"></i> My Examination Bookings
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'results' ? 'active fw-bold text-primary' : 'text-secondary'" @click="activeTab = 'results'">
                <i class="bi bi-award me-1"></i> Results & Scorecards
              </button>
            </li>
          </ul>
        </div>

        <div class="card-body p-4">
          <!-- 1. DASHBOARD OVERVIEW TAB -->
          <div v-if="activeTab === 'overview'">
            <!-- Upcoming Examinations Alert Banner -->
            <div v-if="dashboardData && dashboardData.upcoming_bookings.length > 0" class="mb-4">
              <h6 class="fw-bold text-dark mb-3"><i class="bi bi-bell-fill text-warning me-2"></i>Upcoming Scheduled Examinations</h6>
              <div class="row g-3">
                <div v-for="b in dashboardData.upcoming_bookings" :key="b.id" class="col-md-6">
                  <div class="card p-3 border-start border-4 border-warning shadow-sm bg-light">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <strong class="text-primary">{{ b.course_code }}</strong>
                      <span class="badge bg-warning text-dark">{{ b.status }}</span>
                    </div>
                    <h6 class="fw-bold mb-1">{{ b.examination_name }}</h6>
                    <div class="small text-muted mb-2">
                      <div><i class="bi bi-calendar-event me-1"></i> {{ b.slot_date }} &bull; {{ b.slot_time }}</div>
                      <div><i class="bi bi-person me-1"></i> Examiner: {{ b.examiner_name }}</div>
                    </div>
                    <div v-if="b.meeting_link" class="mt-2">
                      <a :href="b.meeting_link" target="_blank" class="btn btn-sm btn-primary">
                        <i class="bi bi-camera-video-fill me-1"></i> Join Examination Meeting
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Action: Export History As CSV (Celery Batch Job) -->
            <div class="card p-3 border bg-light shadow-sm mb-4">
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <h6 class="fw-bold mb-1 text-dark">
                    <i class="bi bi-filetype-csv text-success me-2"></i> Export Complete Examination History (CSV)
                  </h6>
                  <small class="text-muted">
                    Triggers a Celery asynchronous background batch job to aggregate and generate your official history CSV file.
                  </small>
                </div>
                <div>
                  <button class="btn btn-success btn-sm fw-semibold" :disabled="exportingCsv" @click="triggerCsvExport">
                    <span v-if="exportingCsv" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-download me-1"></i>
                    Export CSV Batch Job
                  </button>
                  <a v-if="csvDownloadUrl" :href="csvDownloadUrl" class="btn btn-outline-success btn-sm ms-2" target="_blank">
                    <i class="bi bi-cloud-arrow-down me-1"></i> Download Ready CSV
                  </a>
                </div>
              </div>
            </div>

            <!-- Published Results Snapshot -->
            <h6 class="fw-bold text-dark mb-3"><i class="bi bi-award-fill text-success me-2"></i>Recent Published Results</h6>
            <div v-if="!dashboardData || dashboardData.published_results.length === 0" class="text-center py-4 text-muted bg-light rounded-3">
              <i class="bi bi-journal-x fs-2 d-block mb-1"></i>
              No published examination results yet.
            </div>
            <div v-else class="row g-3">
              <div v-for="res in dashboardData.published_results" :key="res.id" class="col-md-6">
                <div class="card p-3 shadow-sm border-start border-4 border-success">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <strong class="text-primary">{{ res.course_code }}</strong>
                    <span class="badge bg-success">Published</span>
                  </div>
                  <h6 class="fw-bold mb-1">{{ res.examination_name }}</h6>
                  <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                    <div>
                      <span class="small text-muted">Marks: </span>
                      <strong class="text-success fs-5">{{ res.total_marks }} / {{ res.maximum_marks }}</strong>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" @click="viewScorecard(res)">
                      <i class="bi bi-eye me-1"></i> View Scorecard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. EXAMINATIONS & SLOT BOOKING TAB -->
          <div v-if="activeTab === 'exams'">
            <!-- Search & Filters -->
            <div class="row g-2 mb-4">
              <div class="col-md-6">
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input 
                    type="text" 
                    v-model="searchQuery" 
                    class="form-control" 
                    placeholder="Search by examination or course name/code..." 
                    @input="loadExaminationsList">
                </div>
              </div>
              <div class="col-md-3">
                <select v-model="filterType" class="form-select" @change="loadExaminationsList">
                  <option value="">All Types</option>
                  <option value="Viva">Viva</option>
                  <option value="Practical">Practical</option>
                  <option value="Project Demo">Project Demo</option>
                  <option value="Assessment">Assessment</option>
                </select>
              </div>
              <div class="col-md-3">
                <select v-model="filterStatus" class="form-select" @change="loadExaminationsList">
                  <option value="">All Statuses</option>
                  <option value="Booking Open">Booking Open</option>
                  <option value="Slot Creation">Slot Creation</option>
                  <option value="Closed">Closed</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <!-- Examinations Cards -->
            <div v-if="examinationsList.length === 0" class="text-center py-5 text-muted">
              <i class="bi bi-search fs-1 d-block mb-2"></i>
              <h6>No examinations found matching your criteria</h6>
            </div>

            <div v-else class="row g-3">
              <div v-for="exam in examinationsList" :key="exam.id" class="col-lg-6">
                <div class="card p-3 shadow-sm h-100 border">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span class="badge bg-light text-primary border me-1">{{ exam.course_code }}</span>
                      <span class="badge bg-light text-dark border">{{ exam.examination_type }}</span>
                    </div>
                    <span class="badge" :class="getStatusBadgeClass(exam.examination_status)">{{ exam.examination_status }}</span>
                  </div>

                  <h5 class="fw-bold mb-1">{{ exam.examination_name }}</h5>
                  <p class="small text-muted mb-2">{{ exam.course_name }}</p>

                  <div class="small bg-light p-2 rounded mb-3">
                    <div><strong>Duration:</strong> {{ exam.duration }} minutes &bull; <strong>Max Marks:</strong> {{ exam.maximum_marks }}</div>
                    <div><strong>Booking Window:</strong> {{ exam.slot_booking_start_date }} to {{ exam.slot_booking_end_date }}</div>
                    <div v-if="exam.instructions" class="text-secondary mt-1">
                      <i class="bi bi-info-circle me-1"></i> {{ exam.instructions }}
                    </div>
                  </div>

                  <div class="mt-auto d-flex justify-content-between align-items-center">
                    <div>
                      <span v-if="exam.is_already_booked" class="badge bg-success-subtle text-success border border-success">
                        <i class="bi bi-check-circle me-1"></i> You Have Booked This
                      </span>
                      <span v-else-if="!exam.is_slot_booking_open" class="badge bg-secondary">
                        Booking Closed
                      </span>
                    </div>

                    <button 
                      class="btn btn-sm" 
                      :class="exam.is_slot_booking_open && !exam.is_already_booked ? 'btn-primary' : 'btn-outline-secondary'"
                      :disabled="!exam.is_slot_booking_open || exam.is_already_booked"
                      @click="openSlotBookingModal(exam)">
                      <i class="bi bi-calendar-plus me-1"></i>
                      {{ exam.is_already_booked ? 'Slot Booked' : 'View Available Slots' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. MY BOOKINGS TAB -->
          <div v-if="activeTab === 'bookings'">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-bold mb-0">My Examination Bookings & History</h5>
              <button class="btn btn-outline-secondary btn-sm" @click="loadStudentData">
                <i class="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>

            <div v-if="!dashboardData || dashboardData.all_bookings.length === 0" class="text-center py-5 text-muted">
              <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
              <h6>No examination bookings recorded yet</h6>
              <p class="small">Browse the Available Examinations tab to book your examination slots.</p>
            </div>

            <div v-else class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Booking ID</th>
                    <th>Examination</th>
                    <th>Slot Date & Time</th>
                    <th>Examiner</th>
                    <th>Status</th>
                    <th>Meeting Link</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in dashboardData.all_bookings" :key="b.id">
                    <td>#{{ b.id }}</td>
                    <td>
                      <strong>{{ b.examination_name }}</strong>
                      <div class="small text-muted">{{ b.course_code }}</div>
                    </td>
                    <td>
                      <div>{{ b.slot_date }}</div>
                      <small class="text-muted">{{ b.slot_time }}</small>
                    </td>
                    <td>{{ b.examiner_name }}</td>
                    <td>
                      <span class="badge" :class="getBookingBadge(b.status)">{{ b.status }}</span>
                      <small v-if="b.rescheduled_reason" class="d-block text-muted" style="font-size: 0.72rem;">
                        Rescheduled: {{ b.rescheduled_reason }}
                      </small>
                    </td>
                    <td>
                      <a v-if="b.meeting_link" :href="b.meeting_link" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-camera-video me-1"></i> Join Meeting
                      </a>
                      <span v-else class="text-muted small">N/A</span>
                    </td>
                    <td class="text-end">
                      <button 
                        v-if="b.status === 'Booked'" 
                        class="btn btn-sm btn-outline-danger" 
                        @click="cancelBooking(b.id)"
                        title="Cancel booking before deadline">
                        <i class="bi bi-x-circle me-1"></i> Cancel
                      </button>
                      <span v-else class="text-muted small">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. RESULTS & SCORECARDS TAB -->
          <div v-if="activeTab === 'results'">
            <h5 class="fw-bold mb-3">Published Examination Results</h5>

            <div v-if="!dashboardData || dashboardData.published_results.length === 0" class="text-center py-5 text-muted">
              <i class="bi bi-award fs-1 d-block mb-2"></i>
              <h6>No results published yet</h6>
              <p class="small">Once your examinations are evaluated and published by Admin, your detailed scores will appear here.</p>
            </div>

            <div v-else class="row g-4">
              <div v-for="res in dashboardData.published_results" :key="res.id" class="col-md-6">
                <div class="card shadow-sm p-4 h-100 border">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <strong class="text-primary">{{ res.course_code }}</strong>
                    <span class="badge bg-success">Results Published</span>
                  </div>
                  <h5 class="fw-bold mb-1">{{ res.examination_name }}</h5>
                  <div class="small text-muted mb-3">Examiner: {{ res.examiner_name }}</div>

                  <!-- Marks Callout -->
                  <div class="p-3 bg-light rounded-3 mb-3 d-flex justify-content-between align-items-center">
                    <div>
                      <span class="small text-muted d-block">Total Marks Awarded:</span>
                      <h3 class="fw-bold mb-0 text-success">{{ res.total_marks }} / {{ res.maximum_marks }}</h3>
                    </div>
                    <span class="badge fs-6" :class="res.total_marks >= (0.4 * res.maximum_marks) ? 'bg-success' : 'bg-danger'">
                      {{ res.total_marks >= (0.4 * res.maximum_marks) ? 'PASS' : 'FAIL' }}
                    </span>
                  </div>

                  <!-- Rubric breakdown preview -->
                  <div class="mb-3">
                    <div class="fw-semibold small text-secondary mb-1">Rubric Criteria Breakdown:</div>
                    <ul class="list-group list-group-flush small">
                      <li v-for="score in res.scores" :key="score.id" class="list-group-item px-0 py-1 d-flex justify-content-between">
                        <span>{{ score.criterion_name }}</span>
                        <strong>{{ score.marks_obtained }} / {{ score.maximum_marks }}</strong>
                      </li>
                    </ul>
                  </div>

                  <p v-if="res.remarks" class="small text-muted bg-white p-2 border rounded">
                    <strong>Examiner Remarks:</strong> {{ res.remarks }}
                  </p>

                  <div class="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
                    <button class="btn btn-outline-primary btn-sm" @click="viewScorecard(res)">
                      <i class="bi bi-eye me-1"></i> View Breakdown
                    </button>
                    <a :href="'/api/common/scorecard/' + res.id + '/pdf'" target="_blank" class="btn btn-primary btn-sm">
                      <i class="bi bi-file-earmark-pdf-fill me-1"></i> Download Scorecard PDF
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL 1: Available Slots for Booking -->
      <div v-if="showSlotsModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header bg-light">
              <div>
                <h5 class="modal-title fw-bold mb-0">Select Examination Slot: {{ targetExam.examination_name }}</h5>
                <small class="text-muted">{{ targetExam.course_code }} &bull; Duration: {{ targetExam.duration }} mins</small>
              </div>
              <button type="button" class="btn-close" @click="showSlotsModal = false"></button>
            </div>
            <div class="modal-body p-4">
              <div v-if="availableSlots.length === 0" class="text-center py-4 text-muted">
                <i class="bi bi-calendar-x fs-2 d-block mb-1"></i>
                No slots currently available for this examination. Examiners may still be creating slots.
              </div>

              <div v-else class="row g-3">
                <div v-for="slot in availableSlots" :key="slot.id" class="col-md-6">
                  <div class="card p-3 border shadow-sm h-100" :class="slot.available_seats === 0 ? 'bg-light opacity-75' : ''">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <span class="badge bg-primary">{{ slot.date }}</span>
                      <span class="badge" :class="slot.available_seats > 0 ? 'bg-success' : 'bg-danger'">
                        {{ slot.available_seats > 0 ? slot.available_seats + ' seats left' : 'Full' }}
                      </span>
                    </div>

                    <h6 class="fw-bold mb-1"><i class="bi bi-clock me-1"></i> {{ slot.start_time }} - {{ slot.end_time }}</h6>
                    <div class="small text-muted mb-2">
                      <div>Examiner: <strong>{{ slot.examiner_name }}</strong></div>
                      <div>Venue: {{ slot.venue || 'Online' }}</div>
                    </div>

                    <div class="mt-auto">
                      <button 
                        class="btn btn-sm w-100" 
                        :class="slot.available_seats > 0 ? 'btn-success' : 'btn-secondary'"
                        :disabled="slot.available_seats === 0 || bookingSlotLoading"
                        @click="confirmBookSlot(slot.id)">
                        <span v-if="bookingSlotLoading" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="bi bi-check-circle me-1"></i>
                        {{ slot.available_seats > 0 ? 'Book This Slot' : 'Slot Full' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showSlotsModal = false">Close</button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL 2: Scorecard Details Modal -->
      <div v-if="showScorecardModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header bg-light">
              <h5 class="modal-title fw-bold">Official Examination Scorecard</h5>
              <button type="button" class="btn-close" @click="showScorecardModal = false"></button>
            </div>
            <div class="modal-body p-4" v-if="activeResultForScorecard">
              <div class="text-center pb-3 border-bottom mb-3">
                <h4 class="fw-bold text-primary mb-1">{{ activeResultForScorecard.examination_name }}</h4>
                <p class="text-muted small mb-0">{{ activeResultForScorecard.course_name }} ({{ activeResultForScorecard.course_code }})</p>
              </div>

              <div class="row g-3 mb-4">
                <div class="col-6 col-md-3">
                  <small class="text-muted d-block">Student</small>
                  <strong>{{ activeResultForScorecard.student_name }}</strong>
                </div>
                <div class="col-6 col-md-3">
                  <small class="text-muted d-block">Roll Number</small>
                  <strong>{{ activeResultForScorecard.student_roll || 'N/A' }}</strong>
                </div>
                <div class="col-6 col-md-3">
                  <small class="text-muted d-block">Examiner</small>
                  <strong>{{ activeResultForScorecard.examiner_name }}</strong>
                </div>
                <div class="col-6 col-md-3">
                  <small class="text-muted d-block">Total Score</small>
                  <strong class="text-success fs-5">{{ activeResultForScorecard.total_marks }} / {{ activeResultForScorecard.maximum_marks }}</strong>
                </div>
              </div>

              <h6 class="fw-bold mb-2">Rubric Evaluation Breakdown:</h6>
              <div class="table-responsive mb-3">
                <table class="table table-bordered align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Criterion</th>
                      <th>Max Marks</th>
                      <th>Marks Awarded</th>
                      <th>Examiner Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in activeResultForScorecard.scores" :key="s.id">
                      <td><strong>{{ s.criterion_name }}</strong></td>
                      <td>{{ s.maximum_marks }}</td>
                      <td class="text-success fw-bold">{{ s.marks_obtained }}</td>
                      <td class="text-muted small">{{ s.feedback || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="p-3 bg-light rounded-3">
                <strong>Overall Remarks:</strong>
                <p class="mb-0 text-secondary mt-1">{{ activeResultForScorecard.remarks || 'No remarks provided.' }}</p>
              </div>
            </div>
            <div class="modal-footer">
              <a 
                v-if="activeResultForScorecard" 
                :href="'/api/common/scorecard/' + activeResultForScorecard.id + '/pdf'" 
                target="_blank" 
                class="btn btn-primary">
                <i class="bi bi-file-earmark-pdf-fill me-1"></i> Download PDF
              </a>
              <button type="button" class="btn btn-secondary" @click="showScorecardModal = false">Close</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  methods: {
    showToast(msg, type = 'success') {
      this.toastMessage = msg;
      this.toastType = type;
      setTimeout(() => {
        if (this.toastMessage === msg) this.toastMessage = '';
      }, 5000);
    },
    getStatusBadgeClass(status) {
      if (status === 'Draft') return 'badge-status-draft';
      if (status === 'Slot Creation') return 'badge-status-slotcreation';
      if (status === 'Booking Open') return 'badge-status-bookingopen';
      if (status === 'Closed') return 'badge-status-closed';
      if (status === 'Completed') return 'badge-status-completed';
      return 'bg-secondary';
    },
    getBookingBadge(status) {
      if (status === 'Booked') return 'bg-primary';
      if (status === 'Completed') return 'bg-success';
      if (status === 'Cancelled') return 'bg-secondary';
      if (status === 'Rescheduled') return 'bg-warning text-dark';
      return 'bg-light text-dark';
    },
    async loadStudentData() {
      this.loading = true;
      try {
        const data = await api.getStudentDashboard();
        this.dashboardData = data;
      } catch (err) {
        this.showToast(err.message, 'danger');
      } finally {
        this.loading = false;
      }
    },
    async loadExaminationsList() {
      try {
        const res = await api.searchExaminations(this.searchQuery, this.filterType, this.filterStatus);
        this.examinationsList = res.examinations;
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async openSlotBookingModal(exam) {
      this.targetExam = exam;
      try {
        const res = await api.getAvailableSlots(exam.id);
        this.availableSlots = res.slots;
        this.showSlotsModal = true;
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async confirmBookSlot(slotId) {
      this.bookingSlotLoading = true;
      try {
        await api.bookSlot(slotId);
        this.showToast('Slot booked successfully!');
        this.showSlotsModal = false;
        this.loadStudentData();
        this.loadExaminationsList();
      } catch (err) {
        this.showToast(err.message, 'danger');
      } finally {
        this.bookingSlotLoading = false;
      }
    },
    async cancelBooking(bookingId) {
      if (!confirm('Are you sure you want to cancel this booking?')) return;
      try {
        await api.cancelBooking(bookingId);
        this.showToast('Booking cancelled successfully');
        this.loadStudentData();
        this.loadExaminationsList();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async triggerCsvExport() {
      this.exportingCsv = true;
      try {
        const res = await api.exportStudentHistoryCsv();
        this.showToast('CSV export batch job triggered in background');
        if (res.download_url) {
          this.csvDownloadUrl = res.download_url;
        } else if (res.job_id) {
          // Poll for completion
          const poll = setInterval(async () => {
            const statusRes = await api.getExportJobStatus(res.job_id);
            if (statusRes.job && statusRes.job.status === 'SUCCESS') {
              clearInterval(poll);
              this.csvDownloadUrl = `/api/common/download/${statusRes.job.filename}`;
              this.showToast('Your examination history CSV is ready to download!');
              this.exportingCsv = false;
            }
          }, 1500);
        }
      } catch (err) {
        this.showToast(err.message, 'danger');
        this.exportingCsv = false;
      }
    },
    viewScorecard(res) {
      this.activeResultForScorecard = res;
      this.showScorecardModal = true;
    }
  }
};

window.StudentDashboard = StudentDashboard;
