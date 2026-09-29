// Admin Dashboard Component
const AdminDashboard = {
  props: ['currentUser'],
  data() {
    return {
      activeTab: 'analytics', // 'analytics', 'courses', 'exams', 'rubrics', 'examiners', 'students', 'slots', 'reports'
      stats: null,
      courses: [],
      examinations: [],
      examiners: [],
      students: [],
      allSlots: [],
      allBookings: [],
      loading: false,
      toastMessage: '',
      toastType: 'success',

      // Modals state
      showCourseModal: false,
      isEditingCourse: false,
      courseForm: { id: null, course_code: '', course_name: '', description: '', department: '', status: 'active' },

      showExamModal: false,
      isEditingExam: false,
      examForm: {
        id: null,
        course_id: '',
        examination_name: '',
        examination_type: 'Viva',
        duration: 30,
        maximum_marks: 100,
        slot_creation_start_date: '',
        slot_creation_end_date: '',
        slot_booking_start_date: '',
        slot_booking_end_date: '',
        examination_status: 'Draft',
        instructions: '',
        examiner_ids: []
      },

      // Rubrics state
      selectedRubricExamId: null,
      examRubrics: [],
      showRubricModal: false,
      isEditingRubric: false,
      rubricForm: { id: null, criterion_name: '', maximum_marks: 25, weightage: 25, description: '' },

      // Examiners state
      showExaminerModal: false,
      isEditingExaminer: false,
      examinerForm: { id: null, username: '', name: '', email: '', department: '', contact: '', password: '', status: 'active' },

      // Reschedule Booking state
      showRescheduleModal: false,
      rescheduleTargetBooking: null,
      rescheduleForm: { new_slot_id: '', reason: '' },

      // Reassign Examiner state
      showReassignModal: false,
      reassignTargetSlot: null,
      reassignForm: { new_examiner_id: '' },

      // Reports & Celery batch state
      reportLoading: false,
      latestReportResult: null,

      // Chart.js instances
      popularChartInstance: null,
      workloadChartInstance: null,
      statusChartInstance: null
    };
  },
  mounted() {
    this.loadAllData();
  },
  template: `
    <div class="admin-dashboard">
      <!-- Toast Alert -->
      <div v-if="toastMessage" class="alert alert-dismissible fade show mb-3" :class="'alert-' + toastType" role="alert">
        <i class="bi bi-info-circle-fill me-2"></i>
        <span>{{ toastMessage }}</span>
        <button type="button" class="btn-close" @click="toastMessage = ''"></button>
      </div>

      <!-- Top Summary Metrics Row -->
      <div v-if="stats && stats.metrics" class="row g-3 mb-4">
        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Courses</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-dark">{{ stats.metrics.total_courses }}</h3>
              <i class="bi bi-book-half fs-3 text-primary opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card border-info shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Examinations</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-dark">{{ stats.metrics.total_examinations }}</h3>
              <i class="bi bi-journal-check fs-3 text-info opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card border-success shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Students</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-dark">{{ stats.metrics.total_students }}</h3>
              <i class="bi bi-people-fill fs-3 text-success opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card border-warning shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Examiners</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-dark">{{ stats.metrics.total_examiners }}</h3>
              <i class="bi bi-person-badge-fill fs-3 text-warning opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Total Slots</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-dark">{{ stats.metrics.total_slots }}</h3>
              <i class="bi bi-calendar3 fs-3 text-primary opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card border-danger shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Bookings</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-dark">{{ stats.metrics.total_bookings }}</h3>
              <i class="bi bi-bookmark-check-fill fs-3 text-danger opacity-75"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="card shadow-sm mb-4">
        <div class="card-header bg-white border-bottom">
          <ul class="nav nav-tabs card-header-tabs">
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'analytics' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('analytics')">
                <i class="bi bi-graph-up me-1"></i> Analytics & Charts
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'courses' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('courses')">
                <i class="bi bi-book me-1"></i> Courses ({{ courses.length }})
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'exams' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('exams')">
                <i class="bi bi-journal-text me-1"></i> Examinations ({{ examinations.length }})
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'rubrics' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('rubrics')">
                <i class="bi bi-card-checklist me-1"></i> Examination Rubrics
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'examiners' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('examiners')">
                <i class="bi bi-person-badge me-1"></i> Examiners ({{ examiners.length }})
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'students' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('students')">
                <i class="bi bi-people me-1"></i> Students ({{ students.length }})
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'slots' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('slots')">
                <i class="bi bi-calendar-event me-1"></i> Slots & Bookings
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="activeTab === 'reports' ? 'active fw-bold text-primary' : 'text-secondary'" @click="switchTab('reports')">
                <i class="bi bi-file-earmark-pdf me-1"></i> Reports & Batch Jobs
              </button>
            </li>
          </ul>
        </div>

        <div class="card-body p-4">
          <!-- 1. ANALYTICS & CHARTS TAB -->
          <div v-show="activeTab === 'analytics'">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-bold mb-0 text-dark">Portal Performance & Booking Analytics</h5>
              <button class="btn btn-outline-secondary btn-sm" @click="loadAllData">
                <i class="bi bi-arrow-clockwise me-1"></i> Refresh Data
              </button>
            </div>

            <div class="row g-4">
              <!-- Popular Exams Chart -->
              <div class="col-lg-6">
                <div class="card p-3 shadow-sm h-100">
                  <h6 class="fw-bold text-secondary mb-3"><i class="bi bi-bar-chart-fill me-2 text-primary"></i>Popular Examinations (Booking Volume)</h6>
                  <div style="position: relative; height: 280px;">
                    <canvas id="popularExamsChart"></canvas>
                  </div>
                </div>
              </div>

              <!-- Examiner Workload Chart -->
              <div class="col-lg-6">
                <div class="card p-3 shadow-sm h-100">
                  <h6 class="fw-bold text-secondary mb-3"><i class="bi bi-people-fill me-2 text-success"></i>Examiner Workload (Slots vs Evaluations)</h6>
                  <div style="position: relative; height: 280px;">
                    <canvas id="examinerWorkloadChart"></canvas>
                  </div>
                </div>
              </div>

              <!-- Booking Status Doughnut Chart -->
              <div class="col-lg-6">
                <div class="card p-3 shadow-sm h-100">
                  <h6 class="fw-bold text-secondary mb-3"><i class="bi bi-pie-chart-fill me-2 text-warning"></i>Booking Status Distribution</h6>
                  <div style="position: relative; height: 260px;">
                    <canvas id="bookingStatusChart"></canvas>
                  </div>
                </div>
              </div>

              <!-- Redis Caching Status Indicator -->
              <div class="col-lg-6">
                <div class="card p-4 shadow-sm h-100 bg-light border-0">
                  <div class="d-flex align-items-center mb-2">
                    <span class="badge bg-success me-2"><i class="bi bi-hdd-network me-1"></i> Active</span>
                    <h6 class="fw-bold mb-0 text-dark">Redis High-Performance Caching</h6>
                  </div>
                  <p class="small text-muted mb-3">
                    Redis caches high-throughput examination schedules, popular listings, and rubrics. Automated cache invalidation triggers whenever examinations, rubrics, or slots change.
                  </p>
                  <ul class="list-group list-group-flush small bg-transparent">
                    <li class="list-group-item bg-transparent px-0 py-1 d-flex justify-content-between">
                      <span><code>admin:stats</code></span>
                      <span class="badge bg-secondary">180s TTL</span>
                    </li>
                    <li class="list-group-item bg-transparent px-0 py-1 d-flex justify-content-between">
                      <span><code>exams:all</code></span>
                      <span class="badge bg-secondary">300s TTL</span>
                    </li>
                    <li class="list-group-item bg-transparent px-0 py-1 d-flex justify-content-between">
                      <span><code>schedules:&lt;exam_id&gt;</code></span>
                      <span class="badge bg-secondary">120s TTL</span>
                    </li>
                    <li class="list-group-item bg-transparent px-0 py-1 d-flex justify-content-between">
                      <span><code>rubrics:&lt;exam_id&gt;</code></span>
                      <span class="badge bg-secondary">300s TTL</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. COURSES TAB -->
          <div v-if="activeTab === 'courses'">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-bold mb-0">Course Curriculum</h5>
              <button class="btn btn-primary btn-sm" @click="openCreateCourse">
                <i class="bi bi-plus-lg me-1"></i> Add Course
              </button>
            </div>

            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Code</th>
                    <th>Course Name</th>
                    <th>Department</th>
                    <th>Exams</th>
                    <th>Status</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in courses" :key="c.id">
                    <td><strong class="text-primary">{{ c.course_code }}</strong></td>
                    <td>{{ c.course_name }}</td>
                    <td>{{ c.department || 'N/A' }}</td>
                    <td><span class="badge bg-info text-dark">{{ c.exams_count }} exams</span></td>
                    <td>
                      <span class="badge" :class="c.status === 'active' ? 'bg-success' : 'bg-secondary'">{{ c.status }}</span>
                    </td>
                    <td class="text-end">
                      <button class="btn btn-outline-secondary btn-sm me-1" @click="openEditCourse(c)">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-outline-danger btn-sm" @click="deleteCourse(c.id)">
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. EXAMINATIONS TAB -->
          <div v-if="activeTab === 'exams'">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-bold mb-0">All Examinations</h5>
              <button class="btn btn-primary btn-sm" @click="openCreateExam">
                <i class="bi bi-plus-lg me-1"></i> Create Examination
              </button>
            </div>

            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Course</th>
                    <th>Examination Name</th>
                    <th>Type</th>
                    <th>Slot Creation Window</th>
                    <th>Booking Window</th>
                    <th>Status</th>
                    <th>Results</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="e in examinations" :key="e.id">
                    <td><strong class="text-dark">{{ e.course_code }}</strong></td>
                    <td>
                      <div class="fw-semibold">{{ e.examination_name }}</div>
                      <small class="text-muted">{{ e.duration }} mins | Max: {{ e.maximum_marks }} pts</small>
                    </td>
                    <td><span class="badge bg-light text-dark border">{{ e.examination_type }}</span></td>
                    <td class="small">
                      <div>{{ e.slot_creation_start_date }} to {{ e.slot_creation_end_date }}</div>
                      <span v-if="e.is_slot_creation_open" class="badge bg-success-subtle text-success">Creation Open</span>
                      <span v-else class="badge bg-secondary-subtle text-muted">Creation Closed</span>
                    </td>
                    <td class="small">
                      <div>{{ e.slot_booking_start_date }} to {{ e.slot_booking_end_date }}</div>
                      <span v-if="e.is_slot_booking_open" class="badge bg-primary-subtle text-primary">Booking Open</span>
                      <span v-else class="badge bg-secondary-subtle text-muted">Booking Closed</span>
                    </td>
                    <td>
                      <span class="badge" :class="getStatusBadgeClass(e.examination_status)">
                        {{ e.examination_status }}
                      </span>
                    </td>
                    <td>
                      <span v-if="e.is_results_published" class="badge bg-success">
                        <i class="bi bi-check-circle me-1"></i> Published
                      </span>
                      <button 
                        v-else 
                        class="btn btn-sm btn-outline-success" 
                        @click="publishResults(e.id)"
                        title="Publish results to students">
                        <i class="bi bi-send-check me-1"></i> Publish
                      </button>
                    </td>
                    <td class="text-end">
                      <div class="dropdown d-inline-block">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                          Status
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow">
                          <li><h6 class="dropdown-header">Change Status</h6></li>
                          <li><a class="dropdown-item" href="#" @click.prevent="setExamStatus(e.id, 'Slot Creation')">Slot Creation</a></li>
                          <li><a class="dropdown-item" href="#" @click.prevent="setExamStatus(e.id, 'Booking Open')">Booking Open</a></li>
                          <li><a class="dropdown-item" href="#" @click.prevent="setExamStatus(e.id, 'Closed')">Closed</a></li>
                          <li><a class="dropdown-item" href="#" @click.prevent="setExamStatus(e.id, 'Completed')">Completed</a></li>
                        </ul>
                      </div>
                      <button class="btn btn-outline-secondary btn-sm ms-1 me-1" @click="openEditExam(e)">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-outline-danger btn-sm" @click="deleteExam(e.id)">
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. RUBRICS TAB -->
          <div v-if="activeTab === 'rubrics'">
            <div class="row mb-3 align-items-center">
              <div class="col-md-6">
                <label class="form-label fw-bold mb-1">Select Examination to Manage Rubrics:</label>
                <select class="form-select" v-model="selectedRubricExamId" @change="loadExamRubrics">
                  <option v-for="e in examinations" :key="e.id" :value="e.id">
                    {{ e.course_code }} - {{ e.examination_name }} ({{ e.examination_type }})
                  </option>
                </select>
              </div>
              <div class="col-md-6 text-md-end mt-3 mt-md-0">
                <button v-if="selectedRubricExamId" class="btn btn-primary btn-sm" @click="openCreateRubric">
                  <i class="bi bi-plus-lg me-1"></i> Add Rubric Criterion
                </button>
              </div>
            </div>

            <div v-if="selectedRubricExamId">
              <div v-if="examRubrics.length === 0" class="text-center py-4 text-muted bg-light rounded-3">
                <i class="bi bi-list-check fs-2 d-block mb-1"></i>
                <p>No rubrics defined for this examination yet. Click "Add Rubric Criterion" to define assessment criteria.</p>
              </div>

              <div v-else class="table-responsive">
                <table class="table table-hover align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Criterion Name</th>
                      <th>Max Marks</th>
                      <th>Weightage</th>
                      <th>Description</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in examRubrics" :key="r.id">
                      <td><strong>{{ r.criterion_name }}</strong></td>
                      <td><span class="badge bg-primary">{{ r.maximum_marks }} pts</span></td>
                      <td>{{ r.weightage }}%</td>
                      <td class="text-muted small">{{ r.description || '-' }}</td>
                      <td class="text-end">
                        <button class="btn btn-outline-secondary btn-sm me-1" @click="openEditRubric(r)">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" @click="deleteRubric(r.id)">
                          <i class="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 5. EXAMINERS TAB -->
          <div v-if="activeTab === 'examiners'">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 class="fw-bold mb-0">Examiners Management</h5>
                <small class="text-muted">Examiners are provisioned strictly by the Admin</small>
              </div>
              <button class="btn btn-primary btn-sm" @click="openCreateExaminer">
                <i class="bi bi-person-plus-fill me-1"></i> Add New Examiner
              </button>
            </div>

            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ex in examiners" :key="ex.id">
                    <td><strong>{{ ex.name }}</strong></td>
                    <td><code>{{ ex.username }}</code></td>
                    <td>{{ ex.email }}</td>
                    <td>{{ ex.department || 'N/A' }}</td>
                    <td>{{ ex.contact || 'N/A' }}</td>
                    <td>
                      <span class="badge" :class="ex.status === 'active' ? 'bg-success' : 'bg-secondary'">{{ ex.status }}</span>
                    </td>
                    <td class="text-end">
                      <button class="btn btn-outline-secondary btn-sm" @click="openEditExaminer(ex)">
                        <i class="bi bi-pencil"></i> Edit
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 6. STUDENTS TAB -->
          <div v-if="activeTab === 'students'">
            <h5 class="fw-bold mb-3">Registered Students</h5>
            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th class="text-end">Toggle Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="st in students" :key="st.id">
                    <td><strong class="text-primary">{{ st.roll_number || 'N/A' }}</strong></td>
                    <td>{{ st.name }}</td>
                    <td><code>{{ st.username }}</code></td>
                    <td>{{ st.email }}</td>
                    <td>{{ st.department || 'N/A' }}</td>
                    <td>
                      <span class="badge" :class="st.status === 'active' ? 'bg-success' : 'bg-secondary'">{{ st.status }}</span>
                    </td>
                    <td class="text-end">
                      <button 
                        class="btn btn-sm" 
                        :class="st.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'"
                        @click="toggleStudentStatus(st)">
                        {{ st.status === 'active' ? 'Deactivate' : 'Activate' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 7. SLOTS & BOOKINGS TAB -->
          <div v-if="activeTab === 'slots'">
            <h5 class="fw-bold mb-3">All Examiner Slots & Student Bookings</h5>

            <!-- Bookings Section -->
            <h6 class="fw-bold text-secondary mb-2"><i class="bi bi-bookmark-check me-2"></i>Recent Bookings</h6>
            <div class="table-responsive mb-4">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Booking ID</th>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Examination</th>
                    <th>Slot Date & Time</th>
                    <th>Assigned Examiner</th>
                    <th>Status</th>
                    <th class="text-end">Administrative Overrides</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in allBookings" :key="b.id">
                    <td>#{{ b.id }}</td>
                    <td><strong>{{ b.student_name }}</strong></td>
                    <td><code>{{ b.student_roll || 'N/A' }}</code></td>
                    <td>{{ b.examination_name }}</td>
                    <td>{{ b.slot_date }} ({{ b.slot_time }})</td>
                    <td>{{ b.examiner_name }}</td>
                    <td>
                      <span class="badge" :class="getBookingBadge(b.status)">{{ b.status }}</span>
                      <small v-if="b.rescheduled_reason" class="d-block text-muted" style="font-size: 0.75rem;">
                        Reason: {{ b.rescheduled_reason }}
                      </small>
                    </td>
                    <td class="text-end">
                      <button 
                        v-if="b.status === 'Booked' || b.status === 'Rescheduled'"
                        class="btn btn-outline-warning btn-sm" 
                        @click="openRescheduleModal(b)">
                        <i class="bi bi-clock-history me-1"></i> Reschedule Slot
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Slots Section -->
            <h6 class="fw-bold text-secondary mb-2 mt-4"><i class="bi bi-calendar3 me-2"></i>Examiner Created Slots</h6>
            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Slot ID</th>
                    <th>Examination</th>
                    <th>Examiner</th>
                    <th>Date & Time</th>
                    <th>Seats (Available / Total)</th>
                    <th>Status</th>
                    <th>Meeting Link</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in allSlots" :key="s.id">
                    <td>#{{ s.id }}</td>
                    <td>{{ s.examination_name }}</td>
                    <td><strong>{{ s.examiner_name }}</strong></td>
                    <td>{{ s.date }} ({{ s.start_time }} - {{ s.end_time }})</td>
                    <td>
                      <span class="badge bg-secondary">{{ s.available_seats }} / {{ s.max_student_capacity }}</span>
                    </td>
                    <td>
                      <span class="badge" :class="s.status === 'Available' ? 'bg-success' : (s.status === 'Full' ? 'bg-danger' : 'bg-secondary')">
                        {{ s.status }}
                      </span>
                    </td>
                    <td>
                      <a v-if="s.meeting_link" :href="s.meeting_link" target="_blank" class="small text-truncate d-inline-block" style="max-width: 150px;">
                        <i class="bi bi-camera-video me-1"></i> Link
                      </a>
                      <span v-else class="text-muted small">None</span>
                    </td>
                    <td class="text-end">
                      <button class="btn btn-outline-info btn-sm" @click="openReassignModal(s)">
                        <i class="bi bi-arrow-repeat me-1"></i> Reassign Examiner
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 8. REPORTS & BATCH JOBS TAB -->
          <div v-if="activeTab === 'reports'">
            <div class="card p-4 border bg-light shadow-sm mb-4">
              <div class="row align-items-center">
                <div class="col-md-8">
                  <h5 class="fw-bold text-dark mb-1">
                    <i class="bi bi-cpu-fill text-primary me-2"></i> Celery Periodic & On-Demand Monthly Report
                  </h5>
                  <p class="text-muted small mb-0">
                    Calculates comprehensive monthly examination metrics (conducted exams, students evaluated, completed bookings, pending evaluations, top examiners). Generates downloadable PDF and HTML records.
                  </p>
                </div>
                <div class="col-md-4 text-md-end mt-3 mt-md-0">
                  <button class="btn btn-success" :disabled="reportLoading" @click="triggerMonthlyBatchReport">
                    <span v-if="reportLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-play-circle-fill me-2"></i>
                    Trigger Monthly Report Now
                  </button>
                </div>
              </div>
            </div>

            <div v-if="latestReportResult" class="card shadow-sm border-success p-4 mb-4">
              <div class="d-flex justify-content-between align-items-center pb-3 border-bottom mb-3">
                <div>
                  <h6 class="fw-bold text-success mb-0">
                    <i class="bi bi-check-circle-fill me-2"></i> Monthly Examination Report Output
                  </h6>
                  <small class="text-muted" v-if="latestReportResult.filename">File: {{ latestReportResult.filename }}</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <a 
                    href="/api/common/reports/monthly/view" 
                    target="_blank" 
                    class="btn btn-outline-success btn-sm fw-semibold">
                    <i class="bi bi-eye-fill me-1"></i> View in Browser
                  </a>
                  <a 
                    href="/api/common/reports/monthly/download" 
                    download="Monthly_Examination_Report.pdf"
                    class="btn btn-success btn-sm fw-semibold shadow-sm">
                    <i class="bi bi-download me-1"></i> Download PDF
                  </a>
                </div>
              </div>

              <div v-if="latestReportResult.stats" class="row g-3 mb-4">
                <div class="col-md-3">
                  <div class="p-3 bg-light rounded text-center border">
                    <span class="text-muted small">Conducted Exams</span>
                    <h4 class="fw-bold mb-0 text-primary">{{ latestReportResult.stats.conducted_exams }}</h4>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="p-3 bg-light rounded text-center border">
                    <span class="text-muted small">Students Evaluated</span>
                    <h4 class="fw-bold mb-0 text-success">{{ latestReportResult.stats.total_students_evaluated }}</h4>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="p-3 bg-light rounded text-center border">
                    <span class="text-muted small">Completed Bookings</span>
                    <h4 class="fw-bold mb-0 text-dark">{{ latestReportResult.stats.total_completed_bookings }}</h4>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="p-3 bg-light rounded text-center border">
                    <span class="text-muted small">Pending Evaluations</span>
                    <h4 class="fw-bold mb-0 text-warning">{{ latestReportResult.stats.pending_evaluations }}</h4>
                  </div>
                </div>
              </div>

              <!-- Top Active Examiners in Report -->
              <div v-if="latestReportResult.stats && latestReportResult.stats.examiner_stats && latestReportResult.stats.examiner_stats.length > 0">
                <h6 class="fw-bold text-secondary mb-2"><i class="bi bi-person-badge me-2"></i>Most Active Examiners (From Report)</h6>
                <div class="table-responsive">
                  <table class="table table-sm table-bordered align-middle mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>Examiner Name</th>
                        <th>Department</th>
                        <th>Slots Created</th>
                        <th>Evaluations Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="ex in latestReportResult.stats.examiner_stats" :key="ex.name">
                        <td><strong>{{ ex.name }}</strong></td>
                        <td>{{ ex.department || 'N/A' }}</td>
                        <td><span class="badge bg-info text-dark">{{ ex.slots_created }} slots</span></td>
                        <td><span class="badge bg-success">{{ ex.evaluations_done }} completed</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-4 text-muted bg-white rounded border">
              <i class="bi bi-file-earmark-bar-graph fs-2 d-block mb-1 text-secondary"></i>
              <p class="mb-0">Click "Trigger Monthly Report Now" above to generate this month's examination report.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- MODALS -->

      <!-- Course Modal -->
      <div v-if="showCourseModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">{{ isEditingCourse ? 'Edit Course' : 'Create New Course' }}</h5>
              <button type="button" class="btn-close" @click="showCourseModal = false"></button>
            </div>
            <form @submit.prevent="saveCourse">
              <div class="modal-body p-4">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Course Code *</label>
                  <input type="text" v-model="courseForm.course_code" class="form-control" placeholder="e.g. CS101" required :disabled="isEditingCourse">
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Course Name *</label>
                  <input type="text" v-model="courseForm.course_name" class="form-control" placeholder="e.g. Data Structures" required>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Department</label>
                  <input type="text" v-model="courseForm.department" class="form-control" placeholder="e.g. Computer Science">
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Description</label>
                  <textarea v-model="courseForm.description" class="form-control" rows="3"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showCourseModal = false">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Course</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Examination Modal -->
      <div v-if="showExamModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">{{ isEditingExam ? 'Edit Examination' : 'Create Examination' }}</h5>
              <button type="button" class="btn-close" @click="showExamModal = false"></button>
            </div>
            <form @submit.prevent="saveExam">
              <div class="modal-body p-4">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Course *</label>
                    <select v-model="examForm.course_id" class="form-select" required>
                      <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.course_code }} - {{ c.course_name }}</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Examination Name *</label>
                    <input type="text" v-model="examForm.examination_name" class="form-control" placeholder="e.g. Final Viva" required>
                  </div>

                  <div class="col-md-4">
                    <label class="form-label fw-semibold">Examination Type *</label>
                    <select v-model="examForm.examination_type" class="form-select" required>
                      <option value="Viva">Viva</option>
                      <option value="Practical">Practical</option>
                      <option value="Project Demo">Project Demo</option>
                      <option value="Assessment">Assessment</option>
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label fw-semibold">Duration (Minutes) *</label>
                    <input type="number" v-model="examForm.duration" class="form-control" min="5" required>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label fw-semibold">Maximum Marks *</label>
                    <input type="number" v-model="examForm.maximum_marks" class="form-control" min="1" required>
                  </div>

                  <!-- Timeline Configuration -->
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Slot Creation Start Date *</label>
                    <input type="date" v-model="examForm.slot_creation_start_date" class="form-control" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Slot Creation End Date *</label>
                    <input type="date" v-model="examForm.slot_creation_end_date" class="form-control" required>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Student Booking Start Date *</label>
                    <input type="date" v-model="examForm.slot_booking_start_date" class="form-control" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Student Booking End Date *</label>
                    <input type="date" v-model="examForm.slot_booking_end_date" class="form-control" required>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Initial Status</label>
                    <select v-model="examForm.examination_status" class="form-select">
                      <option value="Draft">Draft</option>
                      <option value="Slot Creation">Slot Creation</option>
                      <option value="Booking Open">Booking Open</option>
                      <option value="Closed">Closed</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Assign Examiners</label>
                    <select v-model="examForm.examiner_ids" class="form-select" multiple size="3">
                      <option v-for="ex in examiners" :key="ex.id" :value="ex.id">{{ ex.name }} ({{ ex.department || 'N/A' }})</option>
                    </select>
                    <small class="text-muted">Hold Cmd/Ctrl to select multiple</small>
                  </div>

                  <div class="col-12">
                    <label class="form-label fw-semibold">Instructions for Students & Examiners</label>
                    <textarea v-model="examForm.instructions" class="form-control" rows="2" placeholder="e.g. Join meeting 5 mins before slot."></textarea>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showExamModal = false">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Examination</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Rubric Modal -->
      <div v-if="showRubricModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">{{ isEditingRubric ? 'Edit Rubric Criterion' : 'Add Rubric Criterion' }}</h5>
              <button type="button" class="btn-close" @click="showRubricModal = false"></button>
            </div>
            <form @submit.prevent="saveRubric">
              <div class="modal-body p-4">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Criterion Name *</label>
                  <input type="text" v-model="rubricForm.criterion_name" class="form-control" placeholder="e.g. Technical Clarity" required>
                </div>
                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <label class="form-label fw-semibold">Max Marks *</label>
                    <input type="number" v-model="rubricForm.maximum_marks" class="form-control" min="1" step="0.5" required>
                  </div>
                  <div class="col-6">
                    <label class="form-label fw-semibold">Weightage (%)</label>
                    <input type="number" v-model="rubricForm.weightage" class="form-control" min="1" step="1">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Description</label>
                  <textarea v-model="rubricForm.description" class="form-control" rows="3" placeholder="Guidance for examiners during scoring"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showRubricModal = false">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Rubric</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Examiner Modal -->
      <div v-if="showExaminerModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">{{ isEditingExaminer ? 'Edit Examiner' : 'Add New Examiner' }}</h5>
              <button type="button" class="btn-close" @click="showExaminerModal = false"></button>
            </div>
            <form @submit.prevent="saveExaminer">
              <div class="modal-body p-4">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Full Name *</label>
                  <input type="text" v-model="examinerForm.name" class="form-control" required>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Username *</label>
                  <input type="text" v-model="examinerForm.username" class="form-control" required :disabled="isEditingExaminer">
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Email Address *</label>
                  <input type="email" v-model="examinerForm.email" class="form-control" required :disabled="isEditingExaminer">
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Department</label>
                  <input type="text" v-model="examinerForm.department" class="form-control">
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Contact Number</label>
                  <input type="tel" v-model="examinerForm.contact" class="form-control">
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Password {{ isEditingExaminer ? '(Leave blank to keep unchanged)' : '*' }}</label>
                  <input type="password" v-model="examinerForm.password" class="form-control" :required="!isEditingExaminer">
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showExaminerModal = false">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Examiner</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Reschedule Booking Modal -->
      <div v-if="showRescheduleModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">Reschedule Examination Slot</h5>
              <button type="button" class="btn-close" @click="showRescheduleModal = false"></button>
            </div>
            <form @submit.prevent="submitReschedule">
              <div class="modal-body p-4">
                <p class="small text-muted mb-3">
                  Admin override: Reschedule student <strong>{{ rescheduleTargetBooking.student_name }}</strong> for exam <strong>{{ rescheduleTargetBooking.examination_name }}</strong>.
                </p>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Select New Slot *</label>
                  <select v-model="rescheduleForm.new_slot_id" class="form-select" required>
                    <option v-for="s in availableRescheduleSlots" :key="s.id" :value="s.id">
                      {{ s.date }} ({{ s.start_time }} - {{ s.end_time }}) | Examiner: {{ s.examiner_name }} ({{ s.available_seats }} seats left)
                    </option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Reason for Rescheduling *</label>
                  <input type="text" v-model="rescheduleForm.reason" class="form-control" placeholder="e.g. Examiner medical emergency / Student illness" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showRescheduleModal = false">Cancel</button>
                <button type="submit" class="btn btn-warning">Confirm Reschedule</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Reassign Examiner Modal -->
      <div v-if="showReassignModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">Reassign Examiner for Slot #{{ reassignTargetSlot.id }}</h5>
              <button type="button" class="btn-close" @click="showReassignModal = false"></button>
            </div>
            <form @submit.prevent="submitReassign">
              <div class="modal-body p-4">
                <p class="small text-muted mb-3">
                  Change the assigned examiner for slot on {{ reassignTargetSlot.date }} ({{ reassignTargetSlot.start_time }} - {{ reassignTargetSlot.end_time }}).
                </p>
                <div class="mb-3">
                  <label class="form-label fw-semibold">Select New Examiner *</label>
                  <select v-model="reassignForm.new_examiner_id" class="form-select" required>
                    <option v-for="ex in examiners" :key="ex.id" :value="ex.id">{{ ex.name }} ({{ ex.department || 'N/A' }})</option>
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showReassignModal = false">Cancel</button>
                <button type="submit" class="btn btn-info">Reassign Examiner</button>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  `,
  computed: {
    availableRescheduleSlots() {
      if (!this.rescheduleTargetBooking) return [];
      const examId = this.rescheduleTargetBooking.examination_id;
      return this.allSlots.filter(s => s.examination_id === examId && s.id !== this.rescheduleTargetBooking.slot_id && s.available_seats > 0);
    }
  },
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
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'analytics') {
        this.$nextTick(() => {
          this.renderCharts();
        });
      } else if (tab === 'reports') {
        this.loadLatestMonthlyReport();
      }
    },
    async loadAllData() {
      this.loading = true;
      try {
        const [statsData, coursesData, examsData, examinersData, studentsData, slotsData, bookingsData] = await Promise.all([
          api.getAdminStats(),
          api.getCourses(),
          api.getExaminations(),
          api.getExaminers(),
          api.getStudents(),
          api.getAllSlots(),
          api.getAllBookings()
        ]);

        this.stats = statsData;
        this.courses = coursesData.courses;
        this.examinations = examsData.examinations;
        this.examiners = examinersData.examiners;
        this.students = studentsData.students;
        this.allSlots = slotsData.slots;
        this.allBookings = bookingsData.bookings;

        if (this.examinations.length > 0 && !this.selectedRubricExamId) {
          this.selectedRubricExamId = this.examinations[0].id;
          this.loadExamRubrics();
        }

        this.$nextTick(() => {
          if (this.activeTab === 'analytics') {
            this.renderCharts();
          }
        });
      } catch (err) {
        this.showToast(err.message, 'danger');
      } finally {
        this.loading = false;
      }
    },
    renderCharts() {
      if (!this.stats || typeof Chart === 'undefined') return;

      // 1. Popular Exams Chart
      const popCtx = document.getElementById('popularExamsChart');
      if (popCtx) {
        if (this.popularChartInstance) this.popularChartInstance.destroy();
        const labels = this.stats.popular_exams.map(e => e.name);
        const data = this.stats.popular_exams.map(e => e.bookings_count);
        this.popularChartInstance = new Chart(popCtx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Bookings Count',
              data,
              backgroundColor: '#3b82f6',
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } }
            }
          }
        });
      }

      // 2. Examiner Workload Chart
      const workCtx = document.getElementById('examinerWorkloadChart');
      if (workCtx) {
        if (this.workloadChartInstance) this.workloadChartInstance.destroy();
        const labels = this.stats.examiner_workload.map(e => e.name);
        const slotsData = this.stats.examiner_workload.map(e => e.slots_count);
        const evalsData = this.stats.examiner_workload.map(e => e.evaluations_count);
        this.workloadChartInstance = new Chart(workCtx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Slots Created', data: slotsData, backgroundColor: '#10b981', borderRadius: 4 },
              { label: 'Evaluations Completed', data: evalsData, backgroundColor: '#6366f1', borderRadius: 4 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } }
            }
          }
        });
      }

      // 3. Booking Status Chart
      const statusCtx = document.getElementById('bookingStatusChart');
      if (statusCtx) {
        if (this.statusChartInstance) this.statusChartInstance.destroy();
        const counts = this.stats.booking_status_counts || {};
        this.statusChartInstance = new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(counts),
            datasets: [{
              data: Object.values(counts),
              backgroundColor: ['#2563eb', '#10b981', '#94a3b8', '#f59e0b']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }
    },

    // Course handlers
    openCreateCourse() {
      this.isEditingCourse = false;
      this.courseForm = { id: null, course_code: '', course_name: '', description: '', department: '', status: 'active' };
      this.showCourseModal = true;
    },
    openEditCourse(c) {
      this.isEditingCourse = true;
      this.courseForm = { ...c };
      this.showCourseModal = true;
    },
    async saveCourse() {
      try {
        if (this.isEditingCourse) {
          await api.updateCourse(this.courseForm.id, this.courseForm);
          this.showToast('Course updated successfully');
        } else {
          await api.createCourse(this.courseForm);
          this.showToast('Course created successfully');
        }
        this.showCourseModal = false;
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async deleteCourse(id) {
      if (!confirm('Are you sure you want to delete this course? Associated examinations will also be removed.')) return;
      try {
        await api.deleteCourse(id);
        this.showToast('Course deleted');
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },

    // Examination handlers
    openCreateExam() {
      this.isEditingExam = false;
      const today = new Date().toISOString().split('T')[0];
      this.examForm = {
        id: null,
        course_id: this.courses.length > 0 ? this.courses[0].id : '',
        examination_name: '',
        examination_type: 'Viva',
        duration: 30,
        maximum_marks: 100,
        slot_creation_start_date: today,
        slot_creation_end_date: today,
        slot_booking_start_date: today,
        slot_booking_end_date: today,
        examination_status: 'Slot Creation',
        instructions: '',
        examiner_ids: []
      };
      this.showExamModal = true;
    },
    openEditExam(e) {
      this.isEditingExam = true;
      this.examForm = {
        id: e.id,
        course_id: e.course_id,
        examination_name: e.examination_name,
        examination_type: e.examination_type,
        duration: e.duration,
        maximum_marks: e.maximum_marks,
        slot_creation_start_date: e.slot_creation_start_date,
        slot_creation_end_date: e.slot_creation_end_date,
        slot_booking_start_date: e.slot_booking_start_date,
        slot_booking_end_date: e.slot_booking_end_date,
        examination_status: e.examination_status,
        instructions: e.instructions || '',
        examiner_ids: e.assigned_examiner_ids || []
      };
      this.showExamModal = true;
    },
    async saveExam() {
      try {
        if (this.isEditingExam) {
          await api.updateExamination(this.examForm.id, this.examForm);
          this.showToast('Examination updated');
        } else {
          await api.createExamination(this.examForm);
          this.showToast('Examination created');
        }
        this.showExamModal = false;
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async deleteExam(id) {
      if (!confirm('Are you sure you want to delete this examination?')) return;
      try {
        await api.deleteExamination(id);
        this.showToast('Examination removed');
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async setExamStatus(examId, status) {
      try {
        await api.updateExamStatus(examId, status);
        this.showToast(`Examination status changed to ${status}`);
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async publishResults(examId) {
      if (!confirm('Publish results for this examination? All students will receive publication notifications.')) return;
      try {
        await api.publishExamResults(examId);
        this.showToast('Results published successfully');
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },

    // Rubric handlers
    async loadExamRubrics() {
      if (!this.selectedRubricExamId) return;
      try {
        const res = await api.getRubrics(this.selectedRubricExamId);
        this.examRubrics = res.rubrics;
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    openCreateRubric() {
      this.isEditingRubric = false;
      this.rubricForm = { id: null, criterion_name: '', maximum_marks: 25, weightage: 25, description: '' };
      this.showRubricModal = true;
    },
    openEditRubric(r) {
      this.isEditingRubric = true;
      this.rubricForm = { ...r };
      this.showRubricModal = true;
    },
    async saveRubric() {
      try {
        if (this.isEditingRubric) {
          await api.updateRubric(this.rubricForm.id, this.rubricForm);
          this.showToast('Rubric updated');
        } else {
          await api.createRubric(this.selectedRubricExamId, this.rubricForm);
          this.showToast('Rubric criterion added');
        }
        this.showRubricModal = false;
        this.loadExamRubrics();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async deleteRubric(id) {
      if (!confirm('Remove this rubric criterion?')) return;
      try {
        await api.deleteRubric(id);
        this.showToast('Rubric removed');
        this.loadExamRubrics();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },

    // Examiner handlers
    openCreateExaminer() {
      this.isEditingExaminer = false;
      this.examinerForm = { id: null, username: '', name: '', email: '', department: '', contact: '', password: '', status: 'active' };
      this.showExaminerModal = true;
    },
    openEditExaminer(ex) {
      this.isEditingExaminer = true;
      this.examinerForm = { ...ex, password: '' };
      this.showExaminerModal = true;
    },
    async saveExaminer() {
      try {
        if (this.isEditingExaminer) {
          await api.updateExaminer(this.examinerForm.id, this.examinerForm);
          this.showToast('Examiner profile updated');
        } else {
          await api.addExaminer(this.examinerForm);
          this.showToast('Examiner account provisioned successfully');
        }
        this.showExaminerModal = false;
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },

    // Student handlers
    async toggleStudentStatus(st) {
      const newStatus = st.status === 'active' ? 'inactive' : 'active';
      try {
        await api.updateStudentStatus(st.id, newStatus);
        this.showToast(`Student status updated to ${newStatus}`);
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },

    // Reschedule & Reassign
    openRescheduleModal(booking) {
      this.rescheduleTargetBooking = booking;
      this.rescheduleForm = { new_slot_id: '', reason: 'Administrative schedule adjustment' };
      this.showRescheduleModal = true;
    },
    async submitReschedule() {
      try {
        await api.rescheduleBooking(this.rescheduleTargetBooking.id, this.rescheduleForm.new_slot_id, this.rescheduleForm.reason);
        this.showToast('Booking successfully rescheduled');
        this.showRescheduleModal = false;
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    openReassignModal(slot) {
      this.reassignTargetSlot = slot;
      this.reassignForm = { new_examiner_id: slot.examiner_id };
      this.showReassignModal = true;
    },
    async submitReassign() {
      try {
        await api.reassignExaminer(this.reassignTargetSlot.id, this.reassignForm.new_examiner_id);
        this.showToast('Examiner reassigned successfully');
        this.showReassignModal = false;
        this.loadAllData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },

    async loadLatestMonthlyReport() {
      try {
        const res = await api.getLatestMonthlyReport();
        if (res && res.report) {
          this.latestReportResult = res.report;
        }
      } catch (err) {
        console.warn('Could not load latest monthly report:', err);
      }
    },

    // Monthly Report Batch trigger
    async triggerMonthlyBatchReport() {
      this.reportLoading = true;
      try {
        const res = await api.triggerMonthlyReport();
        this.showToast(res.message || 'Monthly report generated successfully!');
        if (res.result) {
          this.latestReportResult = res.result;
        } else {
          await this.loadLatestMonthlyReport();
        }
      } catch (err) {
        this.showToast(err.message, 'danger');
      } finally {
        this.reportLoading = false;
      }
    }
  }
};

window.AdminDashboard = AdminDashboard;
