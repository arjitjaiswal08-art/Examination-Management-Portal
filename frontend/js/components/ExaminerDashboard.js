// Examiner Dashboard Component
const ExaminerDashboard = {
  props: ['currentUser'],
  data() {
    return {
      dashboardData: null,
      mySlots: [],
      selectedExamFilter: '',
      loading: false,
      toastMessage: '',
      toastType: 'success',

      // Create / Edit Slot Modal
      showSlotModal: false,
      isEditingSlot: false,
      slotForm: {
        id: null,
        examination_id: '',
        date: '',
        start_time: '10:00',
        end_time: '10:30',
        max_student_capacity: 1,
        meeting_link: '',
        venue: 'Online Google Meet'
      },

      // View Booked Students & Evaluate Modal
      showStudentsModal: false,
      activeSlot: null,
      slotBookings: [],

      // Rubric Evaluation Modal
      showEvaluateModal: false,
      activeBookingToEvaluate: null,
      evaluationScores: [], // [{rubric_id, criterion_name, maximum_marks, marks_obtained, feedback}]
      evaluationRemarks: '',
      submittingEval: false
    };
  },
  mounted() {
    this.loadExaminerData();
  },
  template: `
    <div class="examiner-dashboard">
      <!-- Toast Alert -->
      <div v-if="toastMessage" class="alert alert-dismissible fade show mb-3" :class="'alert-' + toastType" role="alert">
        <i class="bi bi-info-circle-fill me-2"></i>
        <span>{{ toastMessage }}</span>
        <button type="button" class="btn-close" @click="toastMessage = ''"></button>
      </div>

      <!-- Dashboard Metrics Cards -->
      <div v-if="dashboardData && dashboardData.metrics" class="row g-3 mb-4">
        <div class="col-md-3">
          <div class="card stat-card shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Assigned Examinations</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-primary">{{ dashboardData.metrics.assigned_exams_count }}</h3>
              <i class="bi bi-journal-check fs-3 text-primary opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card stat-card border-info shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Created Slots</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-info">{{ dashboardData.metrics.slots_created_count }}</h3>
              <i class="bi bi-calendar-event fs-3 text-info opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card stat-card border-success shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Booked Students</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-success">{{ dashboardData.metrics.booked_students_count }}</h3>
              <i class="bi bi-people-fill fs-3 text-success opacity-75"></i>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card stat-card border-warning shadow-sm h-100 p-3 bg-white">
            <span class="text-muted small fw-semibold text-uppercase">Pending Evaluations</span>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <h3 class="fw-bold mb-0 text-warning">{{ dashboardData.metrics.pending_evaluations_count }}</h3>
              <i class="bi bi-hourglass-split fs-3 text-warning opacity-75"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Layout: Assigned Exams & Slots -->
      <div class="row g-4">
        <!-- Assigned Examinations List -->
        <div class="col-lg-4">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-white border-bottom py-3">
              <h6 class="fw-bold mb-0 text-dark">
                <i class="bi bi-list-task text-primary me-2"></i> Assigned Examinations
              </h6>
            </div>
            <div class="card-body p-3">
              <div v-if="!dashboardData || dashboardData.assigned_examinations.length === 0" class="text-center py-4 text-muted">
                <i class="bi bi-folder2-open fs-2 d-block mb-1"></i>
                <small>No examinations currently assigned by Admin.</small>
              </div>

              <div v-for="exam in (dashboardData ? dashboardData.assigned_examinations : [])" :key="exam.id" class="p-3 mb-3 border rounded-3 bg-light">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <strong class="text-primary">{{ exam.course_code }}</strong>
                  <span class="badge" :class="getStatusBadgeClass(exam.examination_status)">{{ exam.examination_status }}</span>
                </div>
                <h6 class="fw-bold text-dark mb-1">{{ exam.examination_name }}</h6>
                <div class="small text-muted mb-2">
                  <span>Type: {{ exam.examination_type }}</span> &bull; 
                  <span>Max: {{ exam.maximum_marks }} pts</span> &bull; 
                  <span>{{ exam.duration }} mins</span>
                </div>

                <div class="small bg-white p-2 rounded border mb-2">
                  <div class="fw-semibold text-secondary">Slot Creation Window:</div>
                  <div>{{ exam.slot_creation_start_date }} to {{ exam.slot_creation_end_date }}</div>
                  <div class="mt-1">
                    <span v-if="exam.is_slot_creation_open" class="badge bg-success">Creation Open</span>
                    <span v-else class="badge bg-secondary">Creation Closed</span>
                  </div>
                </div>

                <button 
                  class="btn btn-sm w-100" 
                  :class="exam.is_slot_creation_open ? 'btn-primary' : 'btn-outline-secondary'"
                  :disabled="!exam.is_slot_creation_open"
                  @click="openCreateSlot(exam)">
                  <i class="bi bi-plus-circle me-1"></i> Create Slot for Exam
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Created Examination Slots Table -->
        <div class="col-lg-8">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0 text-dark">
                <i class="bi bi-calendar3 text-success me-2"></i> My Examination Slots
              </h6>
              <button class="btn btn-outline-secondary btn-sm" @click="loadExaminerData">
                <i class="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>

            <div class="card-body p-3">
              <div v-if="mySlots.length === 0" class="text-center py-5 text-muted">
                <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                <h6>No examination slots created yet</h6>
                <p class="small">Select an assigned examination with an open slot creation window to create time slots.</p>
              </div>

              <div v-else class="table-responsive">
                <table class="table table-hover align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Exam</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Bookings</th>
                      <th>Status</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in mySlots" :key="s.id">
                      <td>
                        <strong class="text-dark">{{ s.course_code }}</strong>
                        <div class="small text-muted">{{ s.examination_name }}</div>
                      </td>
                      <td>{{ s.date }}</td>
                      <td><span class="badge bg-light text-dark border">{{ s.start_time }} - {{ s.end_time }}</span></td>
                      <td>
                        <button class="btn btn-sm btn-outline-primary" @click="viewSlotStudents(s)">
                          <i class="bi bi-people me-1"></i>
                          <span>{{ s.booked_count }} / {{ s.max_student_capacity }} Booked</span>
                        </button>
                      </td>
                      <td>
                        <span class="badge" :class="s.status === 'Available' ? 'bg-success' : (s.status === 'Full' ? 'bg-danger' : 'bg-secondary')">
                          {{ s.status }}
                        </span>
                      </td>
                      <td class="text-end">
                        <button 
                          v-if="s.booked_count === 0" 
                          class="btn btn-outline-secondary btn-sm me-1" 
                          @click="openEditSlot(s)"
                          title="Edit slot before bookings start">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button 
                          v-if="s.booked_count === 0" 
                          class="btn btn-outline-danger btn-sm me-1" 
                          @click="deleteSlot(s.id)"
                          title="Delete slot before bookings start">
                          <i class="bi bi-trash"></i>
                        </button>
                        <button 
                          v-if="s.status !== 'Completed'" 
                          class="btn btn-outline-success btn-sm" 
                          @click="markCompleted(s.id)"
                          title="Mark slot as Completed">
                          <i class="bi bi-check-lg"></i> Complete
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL 1: Create / Edit Slot -->
      <div v-if="showSlotModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">{{ isEditingSlot ? 'Edit Slot' : 'Create Examination Slot' }}</h5>
              <button type="button" class="btn-close" @click="showSlotModal = false"></button>
            </div>
            <form @submit.prevent="saveSlot">
              <div class="modal-body p-4">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Examination *</label>
                  <select v-model="slotForm.examination_id" class="form-select" required :disabled="isEditingSlot">
                    <option v-for="e in (dashboardData ? dashboardData.assigned_examinations : [])" :key="e.id" :value="e.id">
                      {{ e.course_code }} - {{ e.examination_name }}
                    </option>
                  </select>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Slot Date *</label>
                  <input type="date" v-model="slotForm.date" class="form-control" required>
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <label class="form-label fw-semibold">Start Time (HH:MM) *</label>
                    <input type="time" v-model="slotForm.start_time" class="form-control" required>
                  </div>
                  <div class="col-6">
                    <label class="form-label fw-semibold">End Time (HH:MM) *</label>
                    <input type="time" v-model="slotForm.end_time" class="form-control" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Maximum Student Capacity *</label>
                  <input type="number" v-model="slotForm.max_student_capacity" class="form-control" min="1" max="50" required>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Meeting Link (e.g. Google Meet / Zoom)</label>
                  <input type="url" v-model="slotForm.meeting_link" class="form-control" placeholder="https://meet.google.com/xyz">
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Venue / Room (Optional)</label>
                  <input type="text" v-model="slotForm.venue" class="form-control" placeholder="Online or Room 302">
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showSlotModal = false">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Slot</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- MODAL 2: View Booked Students for Slot -->
      <div v-if="showStudentsModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">
                Booked Students - Slot #{{ activeSlot.id }} ({{ activeSlot.date }})
              </h5>
              <button type="button" class="btn-close" @click="showStudentsModal = false"></button>
            </div>
            <div class="modal-body p-4">
              <div v-if="slotBookings.length === 0" class="text-center py-4 text-muted">
                <i class="bi bi-person-x fs-2 d-block mb-1"></i>
                No students currently booked in this slot.
              </div>

              <div v-else class="table-responsive">
                <table class="table table-hover align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Evaluation</th>
                      <th class="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="b in slotBookings" :key="b.id">
                      <td><code>{{ b.student_roll || 'N/A' }}</code></td>
                      <td><strong>{{ b.student_name }}</strong></td>
                      <td>{{ b.student_email }}</td>
                      <td>
                        <span class="badge" :class="b.status === 'Completed' ? 'bg-success' : 'bg-primary'">{{ b.status }}</span>
                      </td>
                      <td>
                        <span v-if="b.evaluation" class="badge bg-success">
                          {{ b.evaluation.total_marks }} pts awarded
                        </span>
                        <span v-else class="badge bg-warning text-dark">Pending Evaluation</span>
                      </td>
                      <td class="text-end">
                        <button class="btn btn-primary btn-sm" @click="openEvaluateModal(b)">
                          <i class="bi bi-pencil-square me-1"></i>
                          {{ b.evaluation ? 'Re-Evaluate' : 'Evaluate Student' }}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showStudentsModal = false">Close</button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL 3: Rubric Evaluation Modal -->
      <div v-if="showEvaluateModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content shadow">
            <div class="modal-header bg-light">
              <div>
                <h5 class="modal-title fw-bold">Student Evaluation: {{ activeBookingToEvaluate.student_name }}</h5>
                <small class="text-muted">
                  Roll: {{ activeBookingToEvaluate.student_roll || 'N/A' }} &bull; 
                  Exam: {{ activeBookingToEvaluate.examination_name }}
                </small>
              </div>
              <button type="button" class="btn-close" @click="showEvaluateModal = false"></button>
            </div>

            <form @submit.prevent="submitEvaluation">
              <div class="modal-body p-4">
                <div class="alert alert-info py-2 small mb-3">
                  <i class="bi bi-info-circle me-1"></i> Score each predefined rubric criterion accurately. Total marks will be calculated dynamically.
                </div>

                <!-- Rubric Criteria Scoring Inputs -->
                <div v-for="(item, idx) in evaluationScores" :key="item.rubric_id" class="p-3 mb-3 border rounded-3 bg-light">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <h6 class="fw-bold text-dark mb-0">{{ idx + 1 }}. {{ item.criterion_name }}</h6>
                    <span class="badge bg-primary">Max: {{ item.maximum_marks }} pts</span>
                  </div>
                  <p class="small text-muted mb-2">{{ item.description || 'Evaluate according to rubric criteria.' }}</p>

                  <div class="row g-2 align-items-center">
                    <div class="col-md-4">
                      <div class="input-group">
                        <span class="input-group-text small">Score</span>
                        <input 
                          type="number" 
                          v-model.number="item.marks_obtained" 
                          class="form-control" 
                          :max="item.maximum_marks" 
                          min="0" 
                          step="0.5" 
                          required>
                        <span class="input-group-text small">/ {{ item.maximum_marks }}</span>
                      </div>
                    </div>
                    <div class="col-md-8">
                      <input 
                        type="text" 
                        v-model="item.feedback" 
                        class="form-control" 
                        placeholder="Criterion feedback (optional)">
                    </div>
                  </div>
                </div>

                <!-- Total Auto-Calculated -->
                <div class="d-flex justify-content-between align-items-center p-3 bg-white border rounded-3 mb-3">
                  <span class="fw-bold">Total Marks Obtained:</span>
                  <span class="fs-4 fw-bold text-primary">{{ computedTotalMarks }} pts</span>
                </div>

                <!-- Overall Examiner Remarks -->
                <div class="mb-3">
                  <label class="form-label fw-semibold">Overall Examiner Remarks & Comments *</label>
                  <textarea 
                    v-model="evaluationRemarks" 
                    class="form-control" 
                    rows="3" 
                    placeholder="Provide detailed feedback on student performance, strengths, and areas of improvement." 
                    required></textarea>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showEvaluateModal = false">Cancel</button>
                <button type="submit" class="btn btn-success" :disabled="submittingEval">
                  <span v-if="submittingEval" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-check-circle-fill me-2"></i>
                  Submit Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  `,
  computed: {
    computedTotalMarks() {
      return this.evaluationScores.reduce((acc, curr) => acc + (Number(curr.marks_obtained) || 0), 0);
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
    async loadExaminerData() {
      this.loading = true;
      try {
        const [dash, slotsRes] = await Promise.all([
          api.getExaminerDashboard(),
          api.getExaminerSlots()
        ]);
        this.dashboardData = dash;
        this.mySlots = slotsRes.slots;
      } catch (err) {
        this.showToast(err.message, 'danger');
      } finally {
        this.loading = false;
      }
    },
    openCreateSlot(exam) {
      this.isEditingSlot = false;
      const today = new Date().toISOString().split('T')[0];
      this.slotForm = {
        id: null,
        examination_id: exam.id,
        date: today,
        start_time: '10:00',
        end_time: '10:30',
        max_student_capacity: 1,
        meeting_link: '',
        venue: 'Online Google Meet'
      };
      this.showSlotModal = true;
    },
    openEditSlot(slot) {
      this.isEditingSlot = true;
      this.slotForm = {
        id: slot.id,
        examination_id: slot.examination_id,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        max_student_capacity: slot.max_student_capacity,
        meeting_link: slot.meeting_link || '',
        venue: slot.venue || 'Online'
      };
      this.showSlotModal = true;
    },
    async saveSlot() {
      try {
        if (this.isEditingSlot) {
          await api.updateSlot(this.slotForm.id, this.slotForm);
          this.showToast('Slot updated successfully');
        } else {
          await api.createSlot(this.slotForm);
          this.showToast('Slot created successfully');
        }
        this.showSlotModal = false;
        this.loadExaminerData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async deleteSlot(slotId) {
      if (!confirm('Are you sure you want to delete this slot?')) return;
      try {
        await api.deleteSlot(slotId);
        this.showToast('Slot removed');
        this.loadExaminerData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async markCompleted(slotId) {
      try {
        await api.markSlotCompleted(slotId);
        this.showToast('Slot marked as Completed');
        this.loadExaminerData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async viewSlotStudents(slot) {
      this.activeSlot = slot;
      try {
        const res = await api.getSlotStudents(slot.id);
        this.slotBookings = res.bookings;
        this.showStudentsModal = true;
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async openEvaluateModal(booking) {
      this.activeBookingToEvaluate = booking;
      try {
        // Fetch rubrics for this examination
        const rubricsRes = await api.getRubrics(booking.examination_id);
        const rubrics = rubricsRes.rubrics || [];

        // Prepare scoring array
        this.evaluationScores = rubrics.map(r => ({
          rubric_id: r.id,
          criterion_name: r.criterion_name,
          maximum_marks: r.maximum_marks,
          description: r.description,
          marks_obtained: r.maximum_marks, // default to max
          feedback: ''
        }));

        this.evaluationRemarks = (booking.evaluation && booking.evaluation.remarks) ? booking.evaluation.remarks : '';
        this.showEvaluateModal = true;
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    },
    async submitEvaluation() {
      this.submittingEval = true;
      try {
        const payload = this.evaluationScores.map(item => ({
          rubric_id: item.rubric_id,
          marks_obtained: Number(item.marks_obtained),
          feedback: item.feedback
        }));

        await api.evaluateStudent(this.activeBookingToEvaluate.id, payload, this.evaluationRemarks);
        this.showToast('Evaluation submitted successfully');
        this.showEvaluateModal = false;

        // Refresh slot students modal
        if (this.activeSlot) {
          const res = await api.getSlotStudents(this.activeSlot.id);
          this.slotBookings = res.bookings;
        }
        this.loadExaminerData();
      } catch (err) {
        this.showToast(err.message, 'danger');
      } finally {
        this.submittingEval = false;
      }
    }
  }
};

window.ExaminerDashboard = ExaminerDashboard;
