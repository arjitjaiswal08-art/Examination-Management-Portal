from datetime import datetime, date
from flask import Blueprint, request, jsonify
from app.models import (
    db, User, Course, Examination, ExaminationRubric,
    ExaminationSlot, Booking, Evaluation, Notification, ExportJob
)
from app.auth_helper import roles_required
from app.redis_client import (
    get_cache, set_cache, invalidate_exam_cache,
    invalidate_rubric_cache, invalidate_schedule_cache
)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# ----------------- DASHBOARD & ANALYTICS ----------------- #

@admin_bp.route('/stats', methods=['GET'])
@roles_required('admin')
def get_admin_stats():
    cache_key = "admin:stats"
    cached = get_cache(cache_key)
    if cached:
        return jsonify(cached), 200

    total_courses = Course.query.count()
    total_examinations = Examination.query.count()
    total_students = User.query.filter_by(role='student').count()
    total_examiners = User.query.filter_by(role='examiner').count()
    total_slots = ExaminationSlot.query.count()
    total_bookings = Booking.query.count()

    # Chart 1: Popular examinations by bookings
    exams = Examination.query.all()
    popular_exams = []
    for exam in exams:
        b_count = (
            Booking.query.join(ExaminationSlot)
            .filter(ExaminationSlot.examination_id == exam.id)
            .count()
        )
        popular_exams.append({
            'exam_id': exam.id,
            'name': exam.examination_name,
            'course_code': exam.course.course_code if exam.course else '',
            'bookings_count': b_count
        })
    popular_exams.sort(key=lambda x: x['bookings_count'], reverse=True)

    # Chart 2: Examiner workload (slots created and evaluations submitted)
    examiners = User.query.filter_by(role='examiner').all()
    examiner_workload = []
    for ex in examiners:
        slots_count = ExaminationSlot.query.filter_by(examiner_id=ex.id).count()
        evals_count = Evaluation.query.filter_by(examiner_id=ex.id).count()
        examiner_workload.append({
            'id': ex.id,
            'name': ex.name,
            'slots_count': slots_count,
            'evaluations_count': evals_count
        })

    # Chart 3: Booking status distribution
    status_counts = {
        'Booked': Booking.query.filter_by(status='Booked').count(),
        'Completed': Booking.query.filter_by(status='Completed').count(),
        'Cancelled': Booking.query.filter_by(status='Cancelled').count(),
        'Rescheduled': Booking.query.filter_by(status='Rescheduled').count()
    }

    result = {
        'metrics': {
            'total_courses': total_courses,
            'total_examinations': total_examinations,
            'total_students': total_students,
            'total_examiners': total_examiners,
            'total_slots': total_slots,
            'total_bookings': total_bookings
        },
        'popular_exams': popular_exams[:6],
        'examiner_workload': examiner_workload,
        'booking_status_counts': status_counts
    }
    set_cache(cache_key, result, expiry=180)  # 3 minute cache
    return jsonify(result), 200


# ----------------- COURSES CRUD ----------------- #

@admin_bp.route('/courses', methods=['GET'])
@roles_required('admin')
def get_courses():
    courses = Course.query.order_by(Course.created_at.desc()).all()
    return jsonify({'courses': [c.to_dict() for c in courses]}), 200

@admin_bp.route('/courses', methods=['POST'])
@roles_required('admin')
def create_course():
    data = request.get_json() or {}
    code = data.get('course_code', '').strip().upper()
    name = data.get('course_name', '').strip()

    if not code or not name:
        return jsonify({'error': 'Course Code and Course Name are required'}), 400

    if Course.query.filter_by(course_code=code).first():
        return jsonify({'error': f"Course with code '{code}' already exists"}), 400

    course = Course(
        course_code=code,
        course_name=name,
        description=data.get('description', '').strip(),
        department=data.get('department', '').strip(),
        status=data.get('status', 'active')
    )
    db.session.add(course)
    db.session.commit()
    invalidate_exam_cache()

    return jsonify({'message': 'Course created successfully', 'course': course.to_dict()}), 201

@admin_bp.route('/courses/<int:course_id>', methods=['PUT'])
@roles_required('admin')
def update_course(course_id):
    course = Course.query.get_or_404(course_id)
    data = request.get_json() or {}

    if 'course_name' in data and data['course_name'].strip():
        course.course_name = data['course_name'].strip()
    if 'description' in data:
        course.description = data['description'].strip()
    if 'department' in data:
        course.department = data['department'].strip()
    if 'status' in data:
        course.status = data['status']

    db.session.commit()
    invalidate_exam_cache()
    return jsonify({'message': 'Course updated successfully', 'course': course.to_dict()}), 200

@admin_bp.route('/courses/<int:course_id>', methods=['DELETE'])
@roles_required('admin')
def delete_course(course_id):
    course = Course.query.get_or_404(course_id)
    db.session.delete(course)
    db.session.commit()
    invalidate_exam_cache()
    return jsonify({'message': 'Course removed successfully'}), 200


# ----------------- EXAMINATIONS CRUD & TIMELINES ----------------- #

@admin_bp.route('/examinations', methods=['GET'])
@roles_required('admin')
def get_examinations():
    cache_key = "exams:all"
    cached = get_cache(cache_key)
    if cached:
        return jsonify({'examinations': cached}), 200

    exams = Examination.query.order_by(Examination.created_at.desc()).all()
    data = [e.to_dict(include_rubrics=True) for e in exams]
    set_cache(cache_key, data, expiry=300)
    return jsonify({'examinations': data}), 200

@admin_bp.route('/examinations', methods=['POST'])
@roles_required('admin')
def create_examination():
    data = request.get_json() or {}
    course_id = data.get('course_id')
    name = data.get('examination_name', '').strip()
    exam_type = data.get('examination_type', 'Viva')
    duration = int(data.get('duration', 30))
    max_marks = float(data.get('maximum_marks', 100.0))

    try:
        sc_start = datetime.strptime(data['slot_creation_start_date'], '%Y-%m-%d').date()
        sc_end = datetime.strptime(data['slot_creation_end_date'], '%Y-%m-%d').date()
        sb_start = datetime.strptime(data['slot_booking_start_date'], '%Y-%m-%d').date()
        sb_end = datetime.strptime(data['slot_booking_end_date'], '%Y-%m-%d').date()
    except (KeyError, ValueError):
        return jsonify({'error': 'Invalid or missing dates. Format: YYYY-MM-DD'}), 400

    if not course_id or not name:
        return jsonify({'error': 'Course ID and Examination Name are required'}), 400

    exam = Examination(
        course_id=course_id,
        examination_name=name,
        examination_type=exam_type,
        duration=duration,
        maximum_marks=max_marks,
        slot_creation_start_date=sc_start,
        slot_creation_end_date=sc_end,
        slot_booking_start_date=sb_start,
        slot_booking_end_date=sb_end,
        examination_status=data.get('examination_status', 'Draft'),
        instructions=data.get('instructions', '')
    )

    # Assign examiners if provided
    examiner_ids = data.get('examiner_ids', [])
    if examiner_ids:
        examiners = User.query.filter(User.id.in_(examiner_ids), User.role == 'examiner').all()
        exam.assigned_examiners.extend(examiners)

    db.session.add(exam)
    db.session.commit()
    invalidate_exam_cache()

    return jsonify({'message': 'Examination created successfully', 'examination': exam.to_dict()}), 201

@admin_bp.route('/examinations/<int:exam_id>', methods=['PUT'])
@roles_required('admin')
def update_examination(exam_id):
    exam = Examination.query.get_or_404(exam_id)
    data = request.get_json() or {}

    if 'examination_name' in data and data['examination_name'].strip():
        exam.examination_name = data['examination_name'].strip()
    if 'examination_type' in data:
        exam.examination_type = data['examination_type']
    if 'duration' in data:
        exam.duration = int(data['duration'])
    if 'maximum_marks' in data:
        exam.maximum_marks = float(data['maximum_marks'])
    if 'instructions' in data:
        exam.instructions = data['instructions']
    if 'examination_status' in data:
        exam.examination_status = data['examination_status']

    # Update timeline dates
    for field in ['slot_creation_start_date', 'slot_creation_end_date', 'slot_booking_start_date', 'slot_booking_end_date']:
        if field in data and data[field]:
            try:
                setattr(exam, field, datetime.strptime(data[field], '%Y-%m-%d').date())
            except ValueError:
                pass

    if 'examiner_ids' in data:
        examiners = User.query.filter(User.id.in_(data['examiner_ids']), User.role == 'examiner').all()
        exam.assigned_examiners = examiners

    db.session.commit()
    invalidate_exam_cache(exam_id)
    return jsonify({'message': 'Examination updated successfully', 'examination': exam.to_dict()}), 200

@admin_bp.route('/examinations/<int:exam_id>', methods=['DELETE'])
@roles_required('admin')
def delete_examination(exam_id):
    exam = Examination.query.get_or_404(exam_id)
    db.session.delete(exam)
    db.session.commit()
    invalidate_exam_cache(exam_id)
    return jsonify({'message': 'Examination removed successfully'}), 200

@admin_bp.route('/examinations/<int:exam_id>/status', methods=['POST'])
@roles_required('admin')
def update_exam_status(exam_id):
    """Admin manually opens/closes slot creation or slot booking or sets status."""
    exam = Examination.query.get_or_404(exam_id)
    data = request.get_json() or {}
    new_status = data.get('status')

    valid_statuses = ['Draft', 'Slot Creation', 'Booking Open', 'Closed', 'Completed']
    if new_status not in valid_statuses:
        return jsonify({'error': f"Invalid status. Must be one of {valid_statuses}"}), 400

    exam.examination_status = new_status
    db.session.commit()
    invalidate_exam_cache(exam_id)
    return jsonify({'message': f"Status updated to '{new_status}'", 'examination': exam.to_dict()}), 200

@admin_bp.route('/examinations/<int:exam_id>/publish-results', methods=['POST'])
@roles_required('admin')
def publish_exam_results(exam_id):
    """Admin publishes examination results to students."""
    exam = Examination.query.get_or_404(exam_id)
    exam.is_results_published = True
    exam.examination_status = 'Completed'

    # Notify all students with bookings for this exam
    bookings = Booking.query.join(ExaminationSlot).filter(ExaminationSlot.examination_id == exam.id).all()
    student_ids = {b.student_id for b in bookings}

    for sid in student_ids:
        notif = Notification(
            user_id=sid,
            title=f"Results Published: {exam.examination_name}",
            message=f"Results for '{exam.examination_name}' have been officially published. You can now view marks and download your scorecard.",
            type='success'
        )
        db.session.add(notif)

    db.session.commit()
    invalidate_exam_cache(exam_id)
    return jsonify({'message': f"Results for '{exam.examination_name}' published successfully"}), 200


# ----------------- RUBRICS MANAGEMENT ----------------- #

@admin_bp.route('/examinations/<int:exam_id>/rubrics', methods=['GET'])
@roles_required('admin', 'examiner')
def get_rubrics(exam_id):
    cache_key = f"rubrics:{exam_id}"
    cached = get_cache(cache_key)
    if cached:
        return jsonify({'rubrics': cached}), 200

    rubrics = ExaminationRubric.query.filter_by(examination_id=exam_id).all()
    data = [r.to_dict() for r in rubrics]
    set_cache(cache_key, data, expiry=300)
    return jsonify({'rubrics': data}), 200

@admin_bp.route('/examinations/<int:exam_id>/rubrics', methods=['POST'])
@roles_required('admin')
def create_rubric(exam_id):
    Examination.query.get_or_404(exam_id)
    data = request.get_json() or {}
    name = data.get('criterion_name', '').strip()
    max_marks = float(data.get('maximum_marks', 10.0))
    weightage = float(data.get('weightage', 10.0))
    desc = data.get('description', '').strip()

    if not name or max_marks <= 0:
        return jsonify({'error': 'Criterion name and positive maximum marks are required'}), 400

    rubric = ExaminationRubric(
        examination_id=exam_id,
        criterion_name=name,
        maximum_marks=max_marks,
        weightage=weightage,
        description=desc
    )
    db.session.add(rubric)
    db.session.commit()
    invalidate_rubric_cache(exam_id)

    return jsonify({'message': 'Rubric criterion added', 'rubric': rubric.to_dict()}), 201

@admin_bp.route('/rubrics/<int:rubric_id>', methods=['PUT', 'DELETE'])
@roles_required('admin')
def manage_rubric(rubric_id):
    rubric = ExaminationRubric.query.get_or_404(rubric_id)
    exam_id = rubric.examination_id

    if request.method == 'DELETE':
        db.session.delete(rubric)
        db.session.commit()
        invalidate_rubric_cache(exam_id)
        return jsonify({'message': 'Rubric criterion removed'}), 200

    data = request.get_json() or {}
    if 'criterion_name' in data and data['criterion_name'].strip():
        rubric.criterion_name = data['criterion_name'].strip()
    if 'maximum_marks' in data:
        rubric.maximum_marks = float(data['maximum_marks'])
    if 'weightage' in data:
        rubric.weightage = float(data['weightage'])
    if 'description' in data:
        rubric.description = data['description'].strip()

    db.session.commit()
    invalidate_rubric_cache(exam_id)
    return jsonify({'message': 'Rubric criterion updated', 'rubric': rubric.to_dict()}), 200


# ----------------- EXAMINERS MANAGEMENT ----------------- #

@admin_bp.route('/examiners', methods=['GET'])
@roles_required('admin')
def get_examiners():
    examiners = User.query.filter_by(role='examiner').all()
    return jsonify({'examiners': [e.to_dict() for e in examiners]}), 200

@admin_bp.route('/examiners', methods=['POST'])
@roles_required('admin')
def add_examiner():
    """Admin adds a new examiner account."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    name = data.get('name', '').strip()

    if not username or not email or not password or not name:
        return jsonify({'error': 'Username, email, password, and name are required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username is already taken'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email is already registered'}), 400

    examiner = User(
        username=username,
        email=email,
        role='examiner',
        name=name,
        department=data.get('department', '').strip(),
        contact=data.get('contact', '').strip(),
        status='active'
    )
    examiner.set_password(password)
    db.session.add(examiner)
    db.session.commit()

    return jsonify({'message': 'Examiner added successfully', 'examiner': examiner.to_dict()}), 201

@admin_bp.route('/examiners/<int:examiner_id>', methods=['PUT'])
@roles_required('admin')
def update_examiner(examiner_id):
    examiner = User.query.filter_by(id=examiner_id, role='examiner').first_or_404()
    data = request.get_json() or {}

    if 'name' in data and data['name'].strip():
        examiner.name = data['name'].strip()
    if 'department' in data:
        examiner.department = data['department'].strip()
    if 'contact' in data:
        examiner.contact = data['contact'].strip()
    if 'status' in data:
        examiner.status = data['status']
    if 'password' in data and data['password']:
        examiner.set_password(data['password'])

    db.session.commit()
    return jsonify({'message': 'Examiner updated successfully', 'examiner': examiner.to_dict()}), 200


# ----------------- STUDENTS MANAGEMENT ----------------- #

@admin_bp.route('/students', methods=['GET'])
@roles_required('admin')
def get_students():
    students = User.query.filter_by(role='student').order_by(User.created_at.desc()).all()
    return jsonify({'students': [s.to_dict() for s in students]}), 200

@admin_bp.route('/students/<int:student_id>/status', methods=['PUT'])
@roles_required('admin')
def update_student_status(student_id):
    student = User.query.filter_by(id=student_id, role='student').first_or_404()
    data = request.get_json() or {}
    if 'status' in data and data['status'] in ['active', 'inactive']:
        student.status = data['status']
        db.session.commit()
    return jsonify({'message': 'Student status updated', 'student': student.to_dict()}), 200


# ----------------- SLOTS & BOOKINGS OVERVIEW & OVERRIDES ----------------- #

@admin_bp.route('/slots', methods=['GET'])
@roles_required('admin')
def get_all_slots():
    exam_id = request.args.get('examination_id', type=int)
    query = ExaminationSlot.query
    if exam_id:
        query = query.filter_by(examination_id=exam_id)
    slots = query.order_by(ExaminationSlot.date.desc()).all()
    return jsonify({'slots': [s.to_dict(include_bookings=True) for s in slots]}), 200

@admin_bp.route('/bookings', methods=['GET'])
@roles_required('admin')
def get_all_bookings():
    bookings = Booking.query.order_by(Booking.booking_date.desc()).all()
    return jsonify({'bookings': [b.to_dict() for b in bookings]}), 200

@admin_bp.route('/bookings/<int:booking_id>/reschedule', methods=['POST'])
@roles_required('admin')
def reschedule_booking(booking_id):
    """Admin reschedules student booking to a different slot in exceptional situations."""
    booking = Booking.query.get_or_404(booking_id)
    data = request.get_json() or {}
    new_slot_id = data.get('new_slot_id')
    reason = data.get('reason', 'Administrative rescheduling')

    new_slot = ExaminationSlot.query.get_or_404(new_slot_id)
    if new_slot.available_seats <= 0:
        return jsonify({'error': 'Target slot has no available seats'}), 400

    old_slot = booking.slot
    booking.slot_id = new_slot.id
    booking.status = 'Rescheduled'
    booking.rescheduled_reason = reason

    old_slot.update_seat_status()
    new_slot.update_seat_status()

    # Notify student
    notif = Notification(
        user_id=booking.student_id,
        title="Examination Slot Rescheduled",
        message=f"Your booking for {new_slot.examination.examination_name} was rescheduled to {new_slot.date} ({new_slot.start_time} - {new_slot.end_time}). Reason: {reason}",
        type='warning'
    )
    db.session.add(notif)
    db.session.commit()
    invalidate_schedule_cache()

    return jsonify({'message': 'Booking rescheduled successfully', 'booking': booking.to_dict()}), 200

@admin_bp.route('/slots/<int:slot_id>/reassign-examiner', methods=['POST'])
@roles_required('admin')
def reassign_examiner(slot_id):
    """Admin changes the assigned examiner for a slot."""
    slot = ExaminationSlot.query.get_or_404(slot_id)
    data = request.get_json() or {}
    new_examiner_id = data.get('new_examiner_id')

    new_examiner = User.query.filter_by(id=new_examiner_id, role='examiner').first_or_404()
    slot.examiner_id = new_examiner.id
    db.session.commit()
    invalidate_schedule_cache()

    return jsonify({'message': f"Assigned examiner updated to {new_examiner.name}", 'slot': slot.to_dict()}), 200

@admin_bp.route('/reports/monthly-trigger', methods=['POST'])
@roles_required('admin')
def trigger_monthly_report():
    """Trigger the Celery monthly report generation task and return comprehensive results."""
    from app.tasks import generate_monthly_report
    result = None
    try:
        # Dispatch to Celery worker and wait up to 5s for task completion
        task = generate_monthly_report.delay()
        result = task.get(timeout=5)
    except Exception as e:
        # Fallback inline generation if Celery worker is offline or delayed
        result = generate_monthly_report()

    if result:
        set_cache("admin:monthly_report:latest", result, expiry=86400)

    return jsonify({
        'message': 'Monthly examination report generated successfully',
        'result': result
    }), 200

@admin_bp.route('/reports/monthly/latest', methods=['GET'])
@roles_required('admin')
def get_latest_monthly_report():
    """Fetch the latest generated monthly examination report."""
    cached = get_cache("admin:monthly_report:latest")
    if cached:
        return jsonify({'report': cached}), 200

    from app.tasks import generate_monthly_report
    res = generate_monthly_report()
    set_cache("admin:monthly_report:latest", res, expiry=86400)
    return jsonify({'report': res}), 200

