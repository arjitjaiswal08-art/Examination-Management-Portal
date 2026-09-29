import os
import csv
from datetime import datetime, date, timedelta
from app.celery_app import celery
from app.config import Config
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def get_flask_app():
    from app import create_app
    return create_app()

@celery.task(name='app.tasks.send_daily_reminders')
def send_daily_reminders():
    """Daily reminder task for students appearing for examinations in the next 24-48 hours."""
    app = get_flask_app()
    with app.app_context():
        from app.models import db, Booking, ExaminationSlot, Examination, User, Notification

        today = date.today()
        upcoming_window = today + timedelta(days=2)

        # Find active bookings for today and tomorrow
        bookings = (
            Booking.query.join(ExaminationSlot)
            .join(Examination)
            .filter(
                Booking.status == 'Booked',
                ExaminationSlot.date >= today,
                ExaminationSlot.date <= upcoming_window
            )
            .all()
        )

        reminders_sent = 0
        for booking in bookings:
            slot = booking.slot
            exam = slot.examination
            student = booking.student
            examiner = slot.examiner

            reminder_msg = (
                f"Reminder: Upcoming Examination '{exam.examination_name}' is scheduled on "
                f"{slot.date.strftime('%d-%b-%Y')} at {slot.start_time} - {slot.end_time}. "
                f"Assigned Examiner: {examiner.name}. "
                f"Venue/Meeting Link: {slot.meeting_link or slot.venue or 'Online'}. "
                f"Instructions: {exam.instructions or 'Please be present on time with valid ID.'}"
            )

            # Create in-app notification
            notification = Notification(
                user_id=student.id,
                title=f"Exam Reminder: {exam.examination_name}",
                message=reminder_msg,
                type='reminder'
            )
            db.session.add(notification)
            reminders_sent += 1
            print(f"[DAILY REMINDER DISPATCH] -> Student: {student.email} | {reminder_msg}")

        db.session.commit()
        return {'status': 'SUCCESS', 'reminders_sent': reminders_sent, 'date': today.isoformat()}


@celery.task(name='app.tasks.generate_monthly_report')
def generate_monthly_report():
    """Generate monthly comprehensive examination report for Admin (HTML & PDF)."""
    app = get_flask_app()
    with app.app_context():
        from app.models import db, Examination, Booking, Evaluation, User, ExaminationSlot, Notification, ExportJob

        today = date.today()
        # Compute statistics
        total_exams = Examination.query.count()
        conducted_exams = Examination.query.filter(Examination.examination_status.in_(['Booking Open', 'Closed', 'Completed'])).count()
        total_students_evaluated = Evaluation.query.count()
        total_completed_bookings = Booking.query.filter_by(status='Completed').count()
        
        # Pending evaluations: Booked slots where date has arrived but no evaluation yet
        pending_evaluations = (
            Booking.query.join(ExaminationSlot)
            .filter(
                Booking.status == 'Booked',
                ExaminationSlot.date <= today
            )
            .count()
        )

        # Most active examiners
        examiners = User.query.filter_by(role='examiner').all()
        examiner_stats = []
        for ex in examiners:
            eval_count = Evaluation.query.filter_by(examiner_id=ex.id).count()
            slots_count = ExaminationSlot.query.filter_by(examiner_id=ex.id).count()
            examiner_stats.append({
                'name': ex.name,
                'email': ex.email,
                'department': ex.department,
                'evaluations_done': eval_count,
                'slots_created': slots_count
            })
        examiner_stats.sort(key=lambda x: x['evaluations_done'], reverse=True)

        os.makedirs(Config.EXPORTS_DIR, exist_ok=True)
        report_filename = f"monthly_report_{today.strftime('%Y_%m')}.pdf"
        report_filepath = os.path.join(Config.EXPORTS_DIR, report_filename)

        # Generate PDF using ReportLab
        doc = SimpleDocTemplate(report_filepath, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        normal_style = styles['Normal']

        elements = []
        elements.append(Paragraph("<b>Examination Management Portal - Monthly Report</b>", title_style))
        elements.append(Paragraph(f"Generated On: {datetime.utcnow().strftime('%d %B %Y, %H:%M UTC')}", normal_style))
        elements.append(Spacer(1, 15))

        stats_data = [
            ["Metric", "Value"],
            ["Total Examinations In System", str(total_exams)],
            ["Examinations Conducted / In-Progress", str(conducted_exams)],
            ["Total Students Evaluated", str(total_students_evaluated)],
            ["Total Completed Bookings", str(total_completed_bookings)],
            ["Pending Student Evaluations", str(pending_evaluations)]
        ]
        t = Table(stats_data, colWidths=[300, 150])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0d6efd')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8f9fa')),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#dee2e6')),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))

        elements.append(Paragraph("<b>Top Active Examiners</b>", styles['Heading2']))
        elements.append(Spacer(1, 8))

        top_ex_data = [["Examiner Name", "Department", "Slots Created", "Evaluations Completed"]]
        for ex in examiner_stats[:5]:
            top_ex_data.append([ex['name'], ex['department'] or 'N/A', str(ex['slots_created']), str(ex['evaluations_done'])])

        t_ex = Table(top_ex_data, colWidths=[150, 130, 80, 100])
        t_ex.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#198754')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#dee2e6')),
        ]))
        elements.append(t_ex)

        doc.build(elements)

        # Notify Admin
        admin = User.query.filter_by(role='admin').first()
        if admin:
            notif = Notification(
                user_id=admin.id,
                title=f"Monthly Examination Report - {today.strftime('%B %Y')}",
                message=(
                    f"Monthly Report generated: {conducted_exams} exams conducted, "
                    f"{total_students_evaluated} students evaluated, {pending_evaluations} pending evaluations. "
                    f"Report PDF saved: {report_filename}"
                ),
                type='info'
            )
            db.session.add(notif)
            db.session.commit()

        return {
            'status': 'SUCCESS',
            'filename': report_filename,
            'stats': {
                'total_exams': total_exams,
                'conducted_exams': conducted_exams,
                'total_students_evaluated': total_students_evaluated,
                'total_completed_bookings': total_completed_bookings,
                'pending_evaluations': pending_evaluations,
                'examiner_stats': examiner_stats
            }
        }


@celery.task(name='app.tasks.export_student_history_csv')
def export_student_history_csv(student_id, export_job_id=None):
    """User Triggered Async Job: Export Examination History as CSV for Student."""
    app = get_flask_app()
    with app.app_context():
        from app.models import db, Booking, User, ExportJob, Notification

        student = User.query.get(student_id)
        if not student:
            return {'status': 'FAILURE', 'error': 'Student not found'}

        os.makedirs(Config.EXPORTS_DIR, exist_ok=True)
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"exam_history_{student.username}_{timestamp}.csv"
        filepath = os.path.join(Config.EXPORTS_DIR, filename)

        bookings = Booking.query.filter_by(student_id=student_id).all()

        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            # Write Header
            writer.writerow([
                'Student ID',
                'Student Name',
                'Roll Number',
                'Examination Name',
                'Course Code',
                'Course Name',
                'Examination Date',
                'Slot Time',
                'Examiner Name',
                'Marks Obtained',
                'Maximum Marks',
                'Booking Status',
                'Remarks'
            ])

            for b in bookings:
                slot = b.slot
                exam = slot.examination if slot else None
                course = exam.course if exam else None
                eval_record = b.evaluation

                marks_str = str(eval_record.total_marks) if (eval_record and exam and exam.is_results_published) else 'Pending / Unpublished'
                remarks_str = eval_record.remarks if (eval_record and exam and exam.is_results_published) else 'N/A'

                writer.writerow([
                    student.id,
                    student.name,
                    student.roll_number or 'N/A',
                    exam.examination_name if exam else 'N/A',
                    course.course_code if course else 'N/A',
                    course.course_name if course else 'N/A',
                    slot.date.isoformat() if slot and slot.date else 'N/A',
                    f"{slot.start_time} - {slot.end_time}" if slot else 'N/A',
                    slot.examiner.name if slot and slot.examiner else 'N/A',
                    marks_str,
                    exam.maximum_marks if exam else 'N/A',
                    b.status,
                    remarks_str
                ])

        # Update export job if ID provided
        if export_job_id:
            job = ExportJob.query.get(export_job_id)
            if job:
                job.status = 'SUCCESS'
                job.filename = filename
                job.file_path = filepath
                job.completed_at = datetime.utcnow()

        # Add notification for student
        notif = Notification(
            user_id=student.id,
            title="Examination History Export Ready",
            message=f"Your examination history CSV '{filename}' has been generated successfully and is ready to download.",
            type='success'
        )
        db.session.add(notif)
        db.session.commit()

        return {
            'status': 'SUCCESS',
            'filename': filename,
            'download_url': f"/api/common/download/{filename}"
        }
