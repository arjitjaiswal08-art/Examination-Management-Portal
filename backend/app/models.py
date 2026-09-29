from datetime import datetime, date, time
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Association table for Admin assigning Examiners to Examinations
exam_examiners = db.Table(
    'exam_examiners',
    db.Column('examination_id', db.Integer, db.ForeignKey('examinations.id', ondelete='CASCADE'), primary_key=True),
    db.Column('examiner_id', db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
)

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, index=True)  # 'admin', 'examiner', 'student'
    name = db.Column(db.String(120), nullable=False)
    contact = db.Column(db.String(30), nullable=True)
    department = db.Column(db.String(100), nullable=True)
    roll_number = db.Column(db.String(50), nullable=True)  # For students
    status = db.Column(db.String(20), default='active')  # 'active', 'inactive'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    slots = db.relationship('ExaminationSlot', back_populates='examiner', cascade='all, delete-orphan')
    bookings = db.relationship('Booking', back_populates='student', cascade='all, delete-orphan')
    assigned_examinations = db.relationship('Examination', secondary=exam_examiners, back_populates='assigned_examiners')
    notifications = db.relationship('Notification', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'name': self.name,
            'contact': self.contact,
            'department': self.department,
            'roll_number': self.roll_number,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Course(db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    course_code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    course_name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    department = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), default='active')  # 'active', 'inactive'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    examinations = db.relationship('Examination', back_populates='course', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'course_code': self.course_code,
            'course_name': self.course_name,
            'description': self.description,
            'department': self.department,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'exams_count': len(self.examinations)
        }


class Examination(db.Model):
    __tablename__ = 'examinations'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False)
    examination_name = db.Column(db.String(150), nullable=False)
    examination_type = db.Column(db.String(50), nullable=False)  # Viva, Practical, Project Demo, Assessment
    duration = db.Column(db.Integer, nullable=False, default=30)  # in minutes
    maximum_marks = db.Column(db.Float, nullable=False, default=100.0)
    slot_creation_start_date = db.Column(db.Date, nullable=False)
    slot_creation_end_date = db.Column(db.Date, nullable=False)
    slot_booking_start_date = db.Column(db.Date, nullable=False)
    slot_booking_end_date = db.Column(db.Date, nullable=False)
    examination_status = db.Column(db.String(30), default='Draft')  # Draft, Slot Creation, Booking Open, Closed, Completed
    is_results_published = db.Column(db.Boolean, default=False)
    instructions = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    course = db.relationship('Course', back_populates='examinations')
    rubrics = db.relationship('ExaminationRubric', back_populates='examination', cascade='all, delete-orphan')
    slots = db.relationship('ExaminationSlot', back_populates='examination', cascade='all, delete-orphan')
    assigned_examiners = db.relationship('User', secondary=exam_examiners, back_populates='assigned_examinations')

    def is_slot_creation_open(self):
        today = date.today()
        if self.examination_status == 'Slot Creation':
            return True
        if self.slot_creation_start_date and self.slot_creation_end_date:
            return self.slot_creation_start_date <= today <= self.slot_creation_end_date
        return False

    def is_slot_booking_open(self):
        today = date.today()
        if self.examination_status == 'Booking Open':
            return True
        if self.slot_booking_start_date and self.slot_booking_end_date:
            return self.slot_booking_start_date <= today <= self.slot_booking_end_date
        return False

    def to_dict(self, include_rubrics=False, include_slots=False):
        data = {
            'id': self.id,
            'course_id': self.course_id,
            'course_code': self.course.course_code if self.course else None,
            'course_name': self.course.course_name if self.course else None,
            'examination_name': self.examination_name,
            'examination_type': self.examination_type,
            'duration': self.duration,
            'maximum_marks': self.maximum_marks,
            'slot_creation_start_date': self.slot_creation_start_date.isoformat() if self.slot_creation_start_date else None,
            'slot_creation_end_date': self.slot_creation_end_date.isoformat() if self.slot_creation_end_date else None,
            'slot_booking_start_date': self.slot_booking_start_date.isoformat() if self.slot_booking_start_date else None,
            'slot_booking_end_date': self.slot_booking_end_date.isoformat() if self.slot_booking_end_date else None,
            'examination_status': self.examination_status,
            'is_results_published': self.is_results_published,
            'instructions': self.instructions,
            'is_slot_creation_open': self.is_slot_creation_open(),
            'is_slot_booking_open': self.is_slot_booking_open(),
            'assigned_examiner_ids': [e.id for e in self.assigned_examiners],
            'assigned_examiners': [{'id': e.id, 'name': e.name, 'email': e.email} for e in self.assigned_examiners],
            'slots_count': len(self.slots),
            'rubrics_count': len(self.rubrics),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_rubrics:
            data['rubrics'] = [r.to_dict() for r in self.rubrics]
        if include_slots:
            data['slots'] = [s.to_dict() for s in self.slots]
        return data


class ExaminationRubric(db.Model):
    __tablename__ = 'examination_rubrics'

    id = db.Column(db.Integer, primary_key=True)
    examination_id = db.Column(db.Integer, db.ForeignKey('examinations.id', ondelete='CASCADE'), nullable=False)
    criterion_name = db.Column(db.String(150), nullable=False)
    maximum_marks = db.Column(db.Float, nullable=False)
    weightage = db.Column(db.Float, nullable=False, default=100.0)  # percentage weight or equal weight
    description = db.Column(db.Text, nullable=True)

    examination = db.relationship('Examination', back_populates='rubrics')
    scores = db.relationship('EvaluationScore', back_populates='rubric', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'examination_id': self.examination_id,
            'criterion_name': self.criterion_name,
            'maximum_marks': self.maximum_marks,
            'weightage': self.weightage,
            'description': self.description
        }


class ExaminationSlot(db.Model):
    __tablename__ = 'examination_slots'

    id = db.Column(db.Integer, primary_key=True)
    examination_id = db.Column(db.Integer, db.ForeignKey('examinations.id', ondelete='CASCADE'), nullable=False)
    examiner_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(10), nullable=False)  # HH:MM
    end_time = db.Column(db.String(10), nullable=False)    # HH:MM
    max_student_capacity = db.Column(db.Integer, nullable=False, default=1)
    available_seats = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(20), default='Available')  # Available, Full, Cancelled, Completed
    meeting_link = db.Column(db.String(255), nullable=True)
    venue = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    examination = db.relationship('Examination', back_populates='slots')
    examiner = db.relationship('User', back_populates='slots')
    bookings = db.relationship('Booking', back_populates='slot', cascade='all, delete-orphan')

    def update_seat_status(self):
        active_bookings = sum(1 for b in self.bookings if b.status in ['Booked', 'Completed'])
        self.available_seats = max(0, self.max_student_capacity - active_bookings)
        if self.status != 'Cancelled' and self.status != 'Completed':
            if self.available_seats == 0:
                self.status = 'Full'
            else:
                self.status = 'Available'

    def to_dict(self, include_bookings=False):
        data = {
            'id': self.id,
            'examination_id': self.examination_id,
            'examination_name': self.examination.examination_name if self.examination else None,
            'course_code': self.examination.course.course_code if self.examination and self.examination.course else None,
            'course_name': self.examination.course.course_name if self.examination and self.examination.course else None,
            'examiner_id': self.examiner_id,
            'examiner_name': self.examiner.name if self.examiner else None,
            'examiner_email': self.examiner.email if self.examiner else None,
            'date': self.date.isoformat() if self.date else None,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'max_student_capacity': self.max_student_capacity,
            'available_seats': self.available_seats,
            'status': self.status,
            'meeting_link': self.meeting_link,
            'venue': self.venue,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'booked_count': len([b for b in self.bookings if b.status != 'Cancelled'])
        }
        if include_bookings:
            data['bookings'] = [b.to_dict() for b in self.bookings]
        return data


class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey('examination_slots.id', ondelete='CASCADE'), nullable=False)
    booking_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='Booked')  # Booked, Cancelled, Completed, Rescheduled
    rescheduled_reason = db.Column(db.String(255), nullable=True)

    student = db.relationship('User', back_populates='bookings')
    slot = db.relationship('ExaminationSlot', back_populates='bookings')
    evaluation = db.relationship('Evaluation', back_populates='booking', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        exam = self.slot.examination if self.slot else None
        course = exam.course if exam else None
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'student_email': self.student.email if self.student else None,
            'student_roll': self.student.roll_number if self.student else None,
            'slot_id': self.slot_id,
            'examination_id': exam.id if exam else None,
            'examination_name': exam.examination_name if exam else None,
            'examination_type': exam.examination_type if exam else None,
            'course_code': course.course_code if course else None,
            'course_name': course.course_name if course else None,
            'examiner_id': self.slot.examiner_id if self.slot else None,
            'examiner_name': self.slot.examiner.name if self.slot and self.slot.examiner else None,
            'slot_date': self.slot.date.isoformat() if self.slot and self.slot.date else None,
            'slot_time': f"{self.slot.start_time} - {self.slot.end_time}" if self.slot else None,
            'meeting_link': self.slot.meeting_link if self.slot else None,
            'booking_date': self.booking_date.isoformat() if self.booking_date else None,
            'status': self.status,
            'rescheduled_reason': self.rescheduled_reason,
            'has_evaluation': self.evaluation is not None,
            'is_results_published': exam.is_results_published if exam else False
        }


class Evaluation(db.Model):
    __tablename__ = 'evaluations'

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id', ondelete='CASCADE'), unique=True, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    examiner_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    total_marks = db.Column(db.Float, nullable=False, default=0.0)
    remarks = db.Column(db.Text, nullable=True)
    evaluation_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='Submitted')  # Draft, Submitted

    booking = db.relationship('Booking', back_populates='evaluation')
    student = db.relationship('User', foreign_keys=[student_id])
    examiner = db.relationship('User', foreign_keys=[examiner_id])
    scores = db.relationship('EvaluationScore', back_populates='evaluation', cascade='all, delete-orphan')

    def to_dict(self, include_scores=True):
        exam = self.booking.slot.examination if self.booking and self.booking.slot else None
        data = {
            'id': self.id,
            'booking_id': self.booking_id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'student_roll': self.student.roll_number if self.student else None,
            'examiner_id': self.examiner_id,
            'examiner_name': self.examiner.name if self.examiner else None,
            'examination_id': exam.id if exam else None,
            'examination_name': exam.examination_name if exam else None,
            'maximum_marks': exam.maximum_marks if exam else 100.0,
            'total_marks': self.total_marks,
            'remarks': self.remarks,
            'evaluation_date': self.evaluation_date.isoformat() if self.evaluation_date else None,
            'status': self.status,
            'is_results_published': exam.is_results_published if exam else False
        }
        if include_scores:
            data['scores'] = [s.to_dict() for s in self.scores]
        return data


class EvaluationScore(db.Model):
    __tablename__ = 'evaluation_scores'

    id = db.Column(db.Integer, primary_key=True)
    evaluation_id = db.Column(db.Integer, db.ForeignKey('evaluations.id', ondelete='CASCADE'), nullable=False)
    rubric_id = db.Column(db.Integer, db.ForeignKey('examination_rubrics.id', ondelete='CASCADE'), nullable=False)
    marks_obtained = db.Column(db.Float, nullable=False, default=0.0)
    feedback = db.Column(db.String(255), nullable=True)

    evaluation = db.relationship('Evaluation', back_populates='scores')
    rubric = db.relationship('ExaminationRubric', back_populates='scores')

    def to_dict(self):
        return {
            'id': self.id,
            'evaluation_id': self.evaluation_id,
            'rubric_id': self.rubric_id,
            'criterion_name': self.rubric.criterion_name if self.rubric else None,
            'maximum_marks': self.rubric.maximum_marks if self.rubric else None,
            'weightage': self.rubric.weightage if self.rubric else None,
            'marks_obtained': self.marks_obtained,
            'feedback': self.feedback
        }


class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(30), default='info')  # info, success, warning, reminder
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='notifications')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ExportJob(db.Model):
    __tablename__ = 'export_jobs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    job_type = db.Column(db.String(50), nullable=False)  # csv_export, monthly_report
    task_id = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(30), default='PENDING')  # PENDING, PROCESSING, SUCCESS, FAILURE
    filename = db.Column(db.String(255), nullable=True)
    file_path = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'job_type': self.job_type,
            'task_id': self.task_id,
            'status': self.status,
            'filename': self.filename,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
