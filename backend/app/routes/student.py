from datetime import datetime, date
from flask import Blueprint, request, jsonify, g
from app.models import (
    db, User, Course, Examination, ExaminationSlot,
    Booking, Evaluation, Notification, ExportJob
)
from app.auth_helper import roles_required
from app.redis_client import get_cache, set_cache, invalidate_schedule_cache

student_bp = Blueprint('student', __name__, url_prefix='/api/student')

# ----------------- STUDENT DASHBOARD & EXAMS ----------------- #

@student_bp.route('/dashboard', methods=['GET'])
@roles_required('student')
def get_student_dashboard():
    student_id = g.current_user.id
    today = date.today()

    # 1. Available Examinations (where booking is open)
    all_exams = Examination.query.all()
    available_exams = [e.to_dict() for e in all_exams if e.is_slot_booking_open()]

    # 2. Student bookings
    bookings = Booking.query.filter_by(student_id=student_id).order_by(Booking.booking_date.desc()).all()
    
    # 3. Upcoming examinations (active bookings for future/today)
    upcoming_bookings = [
        b.to_dict() for b in bookings 
        if b.status in ['Booked', 'Rescheduled'] and b.slot and b.slot.date >= today
    ]

    # 4. Published results
    published_results = []
    for b in bookings:
        if b.evaluation and b.slot and b.slot.examination.is_results_published:
            eval_dict = b.evaluation.to_dict(include_scores=True)
            eval_dict['course_code'] = b.slot.examination.course.course_code
            eval_dict['course_name'] = b.slot.examination.course.course_name
            published_results.append(eval_dict)

    return jsonify({
        'metrics': {
            'available_exams_count': len(available_exams),
            'upcoming_exams_count': len(upcoming_bookings),
            'total_bookings_count': len(bookings),
            'published_results_count': len(published_results)
        },
        'available_exams': available_exams,
        'upcoming_bookings': upcoming_bookings,
        'all_bookings': [b.to_dict() for b in bookings],
        'published_results': published_results
    }), 200


@student_bp.route('/examinations', methods=['GET'])
@roles_required('student')
def search_examinations():
    """Browse, search, and filter available examinations."""
    search = request.args.get('search', '').strip().lower()
    exam_type = request.args.get('type', '').strip()
    status_filter = request.args.get('status', '').strip()

    query = Examination.query.join(Course)

    if search:
        query = query.filter(
            (Examination.examination_name.ilike(f"%{search}%")) |
            (Course.course_name.ilike(f"%{search}%")) |
            (Course.course_code.ilike(f"%{search}%"))
        )
    if exam_type:
        query = query.filter(Examination.examination_type == exam_type)
    if status_filter:
        query = query.filter(Examination.examination_status == status_filter)

    exams = query.order_by(Examination.slot_booking_start_date.asc()).all()
    
    # Check if student already booked each exam
    student_bookings = Booking.query.filter_by(
        student_id=g.current_user.id
    ).filter(Booking.status.in_(['Booked', 'Rescheduled', 'Completed'])).all()
    booked_exam_ids = {b.slot.examination_id for b in student_bookings if b.slot}

    results = []
    for exam in exams:
        item = exam.to_dict(include_rubrics=True)
        item['is_already_booked'] = exam.id in booked_exam_ids
        results.append(item)

    return jsonify({'examinations': results}), 200


@student_bp.route('/examinations/<int:exam_id>/slots', methods=['GET'])
@roles_required('student')
def get_exam_slots(exam_id):
    """View available slots for a specific examination with caching."""
    cache_key = f"schedules:{exam_id}"
    cached = get_cache(cache_key)
    if cached:
        return jsonify({'slots': cached}), 200

    slots = ExaminationSlot.query.filter_by(examination_id=exam_id).order_by(
        ExaminationSlot.date.asc(), ExaminationSlot.start_time.asc()
    ).all()
    data = [s.to_dict() for s in slots]
    set_cache(cache_key, data, expiry=120)  # 2 minute cache
    return jsonify({'slots': data}), 200


# ----------------- BOOKING & CANCELLATION ----------------- #

@student_bp.route('/book-slot', methods=['POST'])
@roles_required('student')
def book_slot():
    """Student books an available examination slot."""
    data = request.get_json() or {}
    slot_id = data.get('slot_id')

    if not slot_id:
        return jsonify({'error': 'Slot ID is required'}), 400

    slot = ExaminationSlot.query.get_or_404(slot_id)
    exam = slot.examination

    # 1. Verify that booking period is open
    today = date.today()
    if not exam.is_slot_booking_open():
        return jsonify({
            'error': (
                f"Booking is closed for '{exam.examination_name}'. "
                f"Booking window: {exam.slot_booking_start_date} to {exam.slot_booking_end_date}."
            )
        }), 400

    # 2. Check if student already has an active booking for this examination
    existing_booking = (
        Booking.query.join(ExaminationSlot)
        .filter(
            Booking.student_id == g.current_user.id,
            ExaminationSlot.examination_id == exam.id,
            Booking.status.in_(['Booked', 'Rescheduled', 'Completed'])
        )
        .first()
    )
    if existing_booking:
        return jsonify({'error': 'You have already booked a slot for this examination'}), 400

    # 3. Check slot seat availability
    slot.update_seat_status()
    if slot.available_seats <= 0 or slot.status in ['Full', 'Cancelled', 'Completed']:
        return jsonify({'error': 'This slot is already full or unavailable'}), 400

    # 4. Create booking
    booking = Booking(
        student_id=g.current_user.id,
        slot_id=slot.id,
        status='Booked'
    )
    db.session.add(booking)
    db.session.flush()

    # 5. Update slot seats & full status
    slot.update_seat_status()

    # 6. Add notification for student
    notif = Notification(
        user_id=g.current_user.id,
        title="Slot Booking Confirmed",
        message=(
            f"You have successfully booked slot for '{exam.examination_name}' on "
            f"{slot.date} ({slot.start_time} - {slot.end_time}) with examiner {slot.examiner.name}."
        ),
        type='success'
    )
    db.session.add(notif)
    db.session.commit()
    invalidate_schedule_cache(exam.id)

    return jsonify({
        'message': 'Slot booked successfully',
        'booking': booking.to_dict()
    }), 201


@student_bp.route('/bookings/<int:booking_id>/cancel', methods=['POST'])
@roles_required('student')
def cancel_booking(booking_id):
    """Student cancels their booking before the booking deadline."""
    booking = Booking.query.filter_by(id=booking_id, student_id=g.current_user.id).first_or_404()
    slot = booking.slot
    exam = slot.examination

    if booking.status != 'Booked':
        return jsonify({'error': f"Cannot cancel booking with status '{booking.status}'"}), 400

    today = date.today()
    if exam.slot_booking_end_date and today > exam.slot_booking_end_date:
        return jsonify({'error': 'Booking cancellation deadline has passed'}), 400

    booking.status = 'Cancelled'
    slot.update_seat_status()

    notif = Notification(
        user_id=g.current_user.id,
        title="Booking Cancelled",
        message=f"Your booking for '{exam.examination_name}' on {slot.date} has been cancelled.",
        type='warning'
    )
    db.session.add(notif)
    db.session.commit()
    invalidate_schedule_cache(exam.id)

    return jsonify({'message': 'Booking cancelled successfully', 'booking': booking.to_dict()}), 200


# ----------------- ASYNC CSV EXPORT JOB ----------------- #

@student_bp.route('/export-history-csv', methods=['POST'])
@roles_required('student')
def export_history_csv():
    """Trigger user-triggered async batch job via Celery to export examination history as CSV."""
    student_id = g.current_user.id

    # Create ExportJob record
    job = ExportJob(
        user_id=student_id,
        job_type='csv_export',
        status='PENDING'
    )
    db.session.add(job)
    db.session.commit()

    try:
        from app.tasks import export_student_history_csv
        task = export_student_history_csv.delay(student_id, job.id)
        job.task_id = task.id
        db.session.commit()
        return jsonify({
            'message': 'Async CSV export job queued in Celery',
            'job_id': job.id,
            'task_id': task.id
        }), 202
    except Exception as e:
        # Fallback inline execution if Celery worker is offline
        from app.tasks import export_student_history_csv
        res = export_student_history_csv(student_id, job.id)
        return jsonify({
            'message': 'CSV export generated successfully',
            'job_id': job.id,
            'result': res
        }), 200

@student_bp.route('/export-jobs/<int:job_id>', methods=['GET'])
@roles_required('student')
def get_export_job_status(job_id):
    job = ExportJob.query.filter_by(id=job_id, user_id=g.current_user.id).first_or_404()
    return jsonify({'job': job.to_dict()}), 200
