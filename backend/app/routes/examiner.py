from datetime import datetime, date
from flask import Blueprint, request, jsonify, g
from app.models import (
    db, User, Examination, ExaminationRubric, ExaminationSlot,
    Booking, Evaluation, EvaluationScore, Notification
)
from app.auth_helper import roles_required
from app.redis_client import invalidate_schedule_cache, invalidate_exam_cache

examiner_bp = Blueprint('examiner', __name__, url_prefix='/api/examiner')

# ----------------- EXAMINER DASHBOARD STATS ----------------- #

@examiner_bp.route('/dashboard', methods=['GET'])
@roles_required('examiner')
def get_examiner_dashboard():
    examiner_id = g.current_user.id

    # 1. Assigned examinations
    assigned_exams = g.current_user.assigned_examinations
    # 2. Created examination slots
    slots = ExaminationSlot.query.filter_by(examiner_id=examiner_id).order_by(ExaminationSlot.date.desc()).all()
    # 3. Booked students across examiner slots
    slot_ids = [s.id for s in slots]
    booked_count = Booking.query.filter(Booking.slot_id.in_(slot_ids), Booking.status.in_(['Booked', 'Completed'])).count() if slot_ids else 0
    # 4. Pending evaluations: Booked students that do not yet have an evaluation
    pending_evaluations = 0
    if slot_ids:
        bookings = Booking.query.filter(Booking.slot_id.in_(slot_ids), Booking.status.in_(['Booked', 'Completed'])).all()
        pending_evaluations = sum(1 for b in bookings if not b.evaluation)

    return jsonify({
        'metrics': {
            'assigned_exams_count': len(assigned_exams),
            'slots_created_count': len(slots),
            'booked_students_count': booked_count,
            'pending_evaluations_count': pending_evaluations
        },
        'assigned_examinations': [e.to_dict(include_rubrics=True) for e in assigned_exams],
        'recent_slots': [s.to_dict(include_bookings=True) for s in slots[:10]]
    }), 200


# ----------------- SLOTS MANAGEMENT ----------------- #

@examiner_bp.route('/slots', methods=['GET'])
@roles_required('examiner')
def get_my_slots():
    exam_id = request.args.get('examination_id', type=int)
    query = ExaminationSlot.query.filter_by(examiner_id=g.current_user.id)
    if exam_id:
        query = query.filter_by(examination_id=exam_id)
    slots = query.order_by(ExaminationSlot.date.desc(), ExaminationSlot.start_time.asc()).all()
    return jsonify({'slots': [s.to_dict(include_bookings=True) for s in slots]}), 200

@examiner_bp.route('/slots', methods=['POST'])
@roles_required('examiner')
def create_slot():
    """Create slot during slot creation period."""
    data = request.get_json() or {}
    exam_id = data.get('examination_id')
    slot_date_str = data.get('date')
    start_time = data.get('start_time', '').strip()
    end_time = data.get('end_time', '').strip()
    capacity = int(data.get('max_student_capacity', 1))
    meeting_link = data.get('meeting_link', '').strip()
    venue = data.get('venue', 'Online').strip()

    if not exam_id or not slot_date_str or not start_time or not end_time:
        return jsonify({'error': 'Examination ID, Date, Start Time, and End Time are required'}), 400

    exam = Examination.query.get_or_404(exam_id)

    # Validate slot creation period
    today = date.today()
    if not exam.is_slot_creation_open():
        return jsonify({
            'error': (
                f"Slot creation is currently closed for '{exam.examination_name}'. "
                f"Allowed window: {exam.slot_creation_start_date} to {exam.slot_creation_end_date}."
            )
        }), 400

    try:
        slot_date = datetime.strptime(slot_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Expected YYYY-MM-DD'}), 400

    slot = ExaminationSlot(
        examination_id=exam_id,
        examiner_id=g.current_user.id,
        date=slot_date,
        start_time=start_time,
        end_time=end_time,
        max_student_capacity=capacity,
        available_seats=capacity,
        status='Available',
        meeting_link=meeting_link,
        venue=venue
    )
    db.session.add(slot)
    db.session.commit()
    invalidate_schedule_cache(exam_id)

    return jsonify({'message': 'Slot created successfully', 'slot': slot.to_dict()}), 201

@examiner_bp.route('/slots/<int:slot_id>', methods=['PUT', 'DELETE'])
@roles_required('examiner')
def manage_slot(slot_id):
    """Examiners can update or remove slots before student booking begins / before any student has booked."""
    slot = ExaminationSlot.query.filter_by(id=slot_id, examiner_id=g.current_user.id).first_or_404()
    exam = slot.examination

    # Check if student booking has already started or students are booked
    active_bookings = [b for b in slot.bookings if b.status in ['Booked', 'Completed']]
    if active_bookings:
        return jsonify({'error': 'Cannot modify or delete slot because students have already booked it'}), 400

    today = date.today()
    if exam.slot_booking_start_date and today >= exam.slot_booking_start_date:
        return jsonify({'error': 'Cannot modify or delete slot after student booking period has started'}), 400

    if request.method == 'DELETE':
        db.session.delete(slot)
        db.session.commit()
        invalidate_schedule_cache(exam.id)
        return jsonify({'message': 'Slot deleted successfully'}), 200

    data = request.get_json() or {}
    if 'date' in data:
        try:
            slot.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            pass
    if 'start_time' in data and data['start_time'].strip():
        slot.start_time = data['start_time'].strip()
    if 'end_time' in data and data['end_time'].strip():
        slot.end_time = data['end_time'].strip()
    if 'max_student_capacity' in data:
        slot.max_student_capacity = int(data['max_student_capacity'])
        slot.available_seats = slot.max_student_capacity
    if 'meeting_link' in data:
        slot.meeting_link = data['meeting_link'].strip()
    if 'venue' in data:
        slot.venue = data['venue'].strip()

    db.session.commit()
    invalidate_schedule_cache(exam.id)
    return jsonify({'message': 'Slot updated successfully', 'slot': slot.to_dict()}), 200


# ----------------- BOOKED STUDENTS & EVALUATION ----------------- #

@examiner_bp.route('/slots/<int:slot_id>/students', methods=['GET'])
@roles_required('examiner')
def get_slot_students(slot_id):
    """View students booked for a specific slot."""
    slot = ExaminationSlot.query.filter_by(id=slot_id, examiner_id=g.current_user.id).first_or_404()
    bookings = Booking.query.filter_by(slot_id=slot.id).all()
    
    results = []
    for b in bookings:
        b_dict = b.to_dict()
        b_dict['evaluation'] = b.evaluation.to_dict() if b.evaluation else None
        results.append(b_dict)

    return jsonify({'slot': slot.to_dict(), 'bookings': results}), 200

@examiner_bp.route('/bookings/<int:booking_id>/evaluate', methods=['POST'])
@roles_required('examiner')
def evaluate_student(booking_id):
    """Examiner evaluates student using rubric criteria, marks, and remarks."""
    booking = Booking.query.get_or_404(booking_id)

    # Security check: Examiners can evaluate only students booked into their slots
    if booking.slot.examiner_id != g.current_user.id:
        return jsonify({'error': 'You can evaluate only students booked in your own slots'}), 403

    data = request.get_json() or {}
    rubric_scores = data.get('scores', [])  # list of {rubric_id: X, marks_obtained: Y, feedback: Z}
    remarks = data.get('remarks', '').strip()

    exam = booking.slot.examination
    rubrics = {r.id: r for r in exam.rubrics}

    total_marks = 0.0
    scores_to_save = []

    for item in rubric_scores:
        r_id = item.get('rubric_id')
        marks = float(item.get('marks_obtained', 0.0))
        feedback = item.get('feedback', '')

        if r_id in rubrics:
            max_m = rubrics[r_id].maximum_marks
            if marks < 0 or marks > max_m:
                return jsonify({'error': f"Marks for '{rubrics[r_id].criterion_name}' must be between 0 and {max_m}"}), 400
            total_marks += marks
            scores_to_save.append({
                'rubric_id': r_id,
                'marks_obtained': marks,
                'feedback': feedback
            })

    # Create or update evaluation
    evaluation = booking.evaluation
    if not evaluation:
        evaluation = Evaluation(
            booking_id=booking.id,
            student_id=booking.student_id,
            examiner_id=g.current_user.id,
            total_marks=total_marks,
            remarks=remarks,
            status='Submitted'
        )
        db.session.add(evaluation)
        db.session.flush()
    else:
        evaluation.total_marks = total_marks
        evaluation.remarks = remarks
        evaluation.evaluation_date = datetime.utcnow()
        evaluation.status = 'Submitted'
        # Clear old scores
        EvaluationScore.query.filter_by(evaluation_id=evaluation.id).delete()

    for item in scores_to_save:
        score = EvaluationScore(
            evaluation_id=evaluation.id,
            rubric_id=item['rubric_id'],
            marks_obtained=item['marks_obtained'],
            feedback=item['feedback']
        )
        db.session.add(score)

    booking.status = 'Completed'
    booking.slot.update_seat_status()

    # Notify student
    notif = Notification(
        user_id=booking.student_id,
        title=f"Evaluation Submitted: {exam.examination_name}",
        message=f"Examiner {g.current_user.name} has submitted your evaluation for {exam.examination_name}. Official results will be visible upon publication by Admin.",
        type='info'
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify({
        'message': 'Evaluation submitted successfully',
        'evaluation': evaluation.to_dict()
    }), 200

@examiner_bp.route('/slots/<int:slot_id>/complete', methods=['POST'])
@roles_required('examiner')
def mark_slot_completed(slot_id):
    """Examiner marks examination slot as completed."""
    slot = ExaminationSlot.query.filter_by(id=slot_id, examiner_id=g.current_user.id).first_or_404()
    slot.status = 'Completed'
    db.session.commit()
    return jsonify({'message': 'Slot marked as Completed', 'slot': slot.to_dict()}), 200
