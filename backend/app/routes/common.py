import os
from datetime import date, datetime
from flask import Blueprint, request, jsonify, g, send_from_directory, abort, make_response
from app.models import db, User, Course, Examination, ExaminationSlot, Booking, Evaluation, Notification
from app.auth_helper import jwt_required, roles_required
from app.config import Config
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

common_bp = Blueprint('common', __name__, url_prefix='/api/common')

@common_bp.route('/notifications', methods=['GET'])
@jwt_required
def get_notifications():
    notifications = Notification.query.filter_by(
        user_id=g.current_user.id
    ).order_by(Notification.created_at.desc()).limit(20).all()

    unread_count = Notification.query.filter_by(
        user_id=g.current_user.id,
        is_read=False
    ).count()

    return jsonify({
        'notifications': [n.to_dict() for n in notifications],
        'unread_count': unread_count
    }), 200

@common_bp.route('/notifications/mark-read', methods=['POST'])
@jwt_required
def mark_notifications_read():
    Notification.query.filter_by(
        user_id=g.current_user.id,
        is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'Notifications marked as read'}), 200

@common_bp.route('/search', methods=['GET'])
@roles_required('admin')
def global_search():
    """Global search across students, examiners, examinations, and bookings."""
    q = request.args.get('q', '').strip().lower()
    if not q:
        return jsonify({'results': {'users': [], 'examinations': [], 'bookings': []}}), 200

    users = User.query.filter(
        (User.name.ilike(f"%{q}%")) |
        (User.username.ilike(f"%{q}%")) |
        (User.email.ilike(f"%{q}%")) |
        (User.roll_number.ilike(f"%{q}%"))
    ).limit(10).all()

    exams = Examination.query.filter(
        Examination.examination_name.ilike(f"%{q}%")
    ).limit(10).all()

    bookings = Booking.query.join(User).filter(
        (User.name.ilike(f"%{q}%")) |
        (User.roll_number.ilike(f"%{q}%"))
    ).limit(10).all()

    return jsonify({
        'results': {
            'users': [u.to_dict() for u in users],
            'examinations': [e.to_dict() for e in exams],
            'bookings': [b.to_dict() for b in bookings]
        }
    }), 200

@common_bp.route('/download/<filename>', methods=['GET'])
def download_export(filename):
    """Download generated CSV or PDF export with guaranteed filename and MIME type."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(Config.EXPORTS_DIR, safe_filename)
    
    # If file doesn't exist as named, check if adding .pdf or .csv works
    if not os.path.exists(file_path):
        if os.path.exists(file_path + '.pdf'):
            safe_filename = safe_filename + '.pdf'
            file_path = file_path + '.pdf'
        elif os.path.exists(file_path + '.csv'):
            safe_filename = safe_filename + '.csv'
            file_path = file_path + '.csv'
        else:
            today = date.today()
            monthly_default = f"monthly_report_{today.strftime('%Y_%m')}.pdf"
            if os.path.exists(os.path.join(Config.EXPORTS_DIR, monthly_default)):
                safe_filename = monthly_default
                file_path = os.path.join(Config.EXPORTS_DIR, safe_filename)
            else:
                abort(404, description="Requested file not found")
    
    mimetype = 'application/pdf' if safe_filename.endswith('.pdf') else ('text/csv' if safe_filename.endswith('.csv') else 'application/octet-stream')
    return send_from_directory(
        Config.EXPORTS_DIR,
        safe_filename,
        as_attachment=True,
        download_name=safe_filename,
        mimetype=mimetype
    )

@common_bp.route('/view/<filename>', methods=['GET'])
def view_export(filename):
    """View generated PDF or CSV directly in browser without forcing download."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(Config.EXPORTS_DIR, safe_filename)
    if not os.path.exists(file_path):
        if os.path.exists(file_path + '.pdf'):
            safe_filename = safe_filename + '.pdf'
            file_path = file_path + '.pdf'
        elif os.path.exists(file_path + '.csv'):
            safe_filename = safe_filename + '.csv'
            file_path = file_path + '.csv'
        else:
            today = date.today()
            monthly_default = f"monthly_report_{today.strftime('%Y_%m')}.pdf"
            if os.path.exists(os.path.join(Config.EXPORTS_DIR, monthly_default)):
                safe_filename = monthly_default
                file_path = os.path.join(Config.EXPORTS_DIR, safe_filename)
            else:
                abort(404, description="Requested file not found")
    
    mimetype = 'application/pdf' if safe_filename.endswith('.pdf') else ('text/csv' if safe_filename.endswith('.csv') else 'text/plain')
    return send_from_directory(
        Config.EXPORTS_DIR,
        safe_filename,
        as_attachment=False,
        mimetype=mimetype
    )

@common_bp.route('/reports/monthly/view', methods=['GET'])
def view_monthly_report():
    """Direct inline view of latest monthly examination report PDF."""
    today = date.today()
    filename = f"monthly_report_{today.strftime('%Y_%m')}.pdf"
    file_path = os.path.join(Config.EXPORTS_DIR, filename)
    if not os.path.exists(file_path):
        from app.tasks import generate_monthly_report
        generate_monthly_report()
    
    return send_from_directory(
        Config.EXPORTS_DIR,
        filename,
        as_attachment=False,
        mimetype='application/pdf'
    )

@common_bp.route('/reports/monthly/download', methods=['GET'])
def download_monthly_report():
    """Direct attachment download of latest monthly examination report PDF with clean filename."""
    today = date.today()
    filename = f"monthly_report_{today.strftime('%Y_%m')}.pdf"
    file_path = os.path.join(Config.EXPORTS_DIR, filename)
    if not os.path.exists(file_path):
        from app.tasks import generate_monthly_report
        generate_monthly_report()
    
    download_name = f"Monthly_Examination_Report_{today.strftime('%B_%Y')}.pdf"
    return send_from_directory(
        Config.EXPORTS_DIR,
        filename,
        as_attachment=True,
        download_name=download_name,
        mimetype='application/pdf'
    )

@common_bp.route('/scorecard/<int:evaluation_id>/pdf', methods=['GET'])
@jwt_required
def download_scorecard_pdf(evaluation_id):
    """Download official examination scorecard as PDF."""
    evaluation = Evaluation.query.get_or_404(evaluation_id)
    # Check permissions: only student who took the exam or admin/examiner can view
    if g.current_user.role == 'student' and evaluation.student_id != g.current_user.id:
        abort(403)

    exam = evaluation.booking.slot.examination
    course = exam.course
    student = evaluation.student
    examiner = evaluation.examiner

    os.makedirs(Config.EXPORTS_DIR, exist_ok=True)
    pdf_filename = f"scorecard_{student.username}_{exam.id}.pdf"
    pdf_filepath = os.path.join(Config.EXPORTS_DIR, pdf_filename)

    doc = SimpleDocTemplate(pdf_filepath, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("<b>EXAMINATION MANAGEMENT PORTAL</b>", styles['Heading1']))
    elements.append(Paragraph("<b>Official Student Examination Scorecard</b>", styles['Heading2']))
    elements.append(Spacer(1, 12))

    meta_table_data = [
        ["Student Name:", student.name, "Roll Number:", student.roll_number or 'N/A'],
        ["Course Code:", course.course_code, "Course Name:", course.course_name],
        ["Examination:", exam.examination_name, "Exam Type:", exam.examination_type],
        ["Assigned Examiner:", examiner.name, "Evaluation Date:", evaluation.evaluation_date.strftime('%d-%b-%Y') if evaluation.evaluation_date else 'N/A'],
        ["Total Marks Obtained:", f"{evaluation.total_marks} / {exam.maximum_marks}", "Result Status:", "PASS" if evaluation.total_marks >= (0.4 * exam.maximum_marks) else "FAIL"]
    ]
    t_meta = Table(meta_table_data, colWidths=[130, 160, 110, 140])
    t_meta.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dee2e6')),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f8f9fa')),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#f8f9fa')),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 16))

    elements.append(Paragraph("<b>Rubric-Based Evaluation Breakdown</b>", styles['Heading3']))
    elements.append(Spacer(1, 8))

    rubric_rows = [["Evaluation Criterion", "Max Marks", "Marks Awarded", "Examiner Feedback"]]
    for s in evaluation.scores:
        crit_name = s.rubric.criterion_name if s.rubric else 'General Assessment'
        max_m = str(s.rubric.maximum_marks) if s.rubric else 'N/A'
        rubric_rows.append([crit_name, max_m, str(s.marks_obtained), s.feedback or '-'])

    t_rubric = Table(rubric_rows, colWidths=[200, 70, 90, 180])
    t_rubric.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0d6efd')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dee2e6')),
    ]))
    elements.append(t_rubric)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph(f"<b>Examiner Remarks:</b> {evaluation.remarks or 'No remarks provided.'}", styles['Normal']))
    doc.build(elements)

    return send_from_directory(
        Config.EXPORTS_DIR,
        pdf_filename,
        as_attachment=True,
        download_name=pdf_filename,
        mimetype='application/pdf'
    )
