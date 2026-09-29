from datetime import datetime, date, timedelta
from app.models import db, User, Course, Examination, ExaminationRubric, ExaminationSlot, Booking, Evaluation, EvaluationScore

def init_db(app):
    """Programmatically initialize the SQLite database tables and seed required data."""
    with app.app_context():
        # Programmatically create all database tables
        db.create_all()

        # 1. Ensure exactly one Super Admin exists
        admin = User.query.filter_by(role='admin').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@emp.edu',
                role='admin',
                name='System Administrator',
                contact='+91 9876543210',
                department='Academic Affairs',
                status='active'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print(">>> Programmatically initialized Super Admin: admin / admin123")

        # 2. Seed initial demo dataset if no courses exist
        if Course.query.count() == 0:
            print(">>> Seeding initial demo data for courses, examiners, exams, and rubrics...")

            # Seed Courses
            c1 = Course(
                course_code='CS101',
                course_name='Data Structures and Algorithms',
                description='Fundamental data structures including lists, trees, graphs, and algorithmic complexity.',
                department='Computer Science'
            )
            c2 = Course(
                course_code='CS202',
                course_name='Modern Application Development - II',
                description='Advanced web architecture with VueJS, Flask, Redis caching, and Celery asynchronous jobs.',
                department='Computer Science'
            )
            c3 = Course(
                course_code='CS303',
                course_name='Database Management Systems',
                description='Relational database design, SQL querying, transaction normalization, and indexing.',
                department='Information Technology'
            )
            db.session.add_all([c1, c2, c3])
            db.session.commit()

            # Seed Examiners
            ex1 = User(
                username='prof_sharma',
                email='sharma@emp.edu',
                role='examiner',
                name='Prof. Ram Sharma',
                contact='+91 9123456780',
                department='Computer Science',
                status='active'
            )
            ex1.set_password('examiner123')

            ex2 = User(
                username='dr_anita',
                email='anita@emp.edu',
                role='examiner',
                name='Dr. Anita Verma',
                contact='+91 9123456781',
                department='Computer Science',
                status='active'
            )
            ex2.set_password('examiner123')

            # Seed Student
            st1 = User(
                username='student1',
                email='student1@student.emp.edu',
                role='student',
                name='Aarav Mehta',
                contact='+91 9988776655',
                roll_number='21BSCS001',
                department='Computer Science',
                status='active'
            )
            st1.set_password('student123')

            st2 = User(
                username='student2',
                email='student2@student.emp.edu',
                role='student',
                name='Priya Patel',
                contact='+91 9988776656',
                roll_number='21BSCS002',
                department='Computer Science',
                status='active'
            )
            st2.set_password('student123')

            db.session.add_all([ex1, ex2, st1, st2])
            db.session.commit()

            # Seed Examinations
            today = date.today()

            # Exam 1: Booking Open (Active for student booking)
            exam1 = Examination(
                course_id=c2.id,
                examination_name='MAD-2 Viva & Project Demo',
                examination_type='Project Demo',
                duration=30,
                maximum_marks=100.0,
                slot_creation_start_date=today - timedelta(days=5),
                slot_creation_end_date=today + timedelta(days=2),
                slot_booking_start_date=today - timedelta(days=1),
                slot_booking_end_date=today + timedelta(days=10),
                examination_status='Booking Open',
                instructions='Please join the meeting link 5 minutes prior to slot start time. Keep code ready to execute.'
            )
            db.session.add(exam1)
            exam1.assigned_examiners.extend([ex1, ex2])

            # Exam 2: Slot Creation (Open for examiners to create slots)
            exam2 = Examination(
                course_id=c1.id,
                examination_name='DSA Practical Lab Assessment',
                examination_type='Practical',
                duration=45,
                maximum_marks=50.0,
                slot_creation_start_date=today - timedelta(days=2),
                slot_creation_end_date=today + timedelta(days=7),
                slot_booking_start_date=today + timedelta(days=8),
                slot_booking_end_date=today + timedelta(days=15),
                examination_status='Slot Creation',
                instructions='Lab assessment covering Binary Search Trees and Graph traversal algorithms.'
            )
            db.session.add(exam2)
            exam2.assigned_examiners.append(ex1)

            # Exam 3: Completed with published results
            exam3 = Examination(
                course_id=c3.id,
                examination_name='DBMS Midterm Viva',
                examination_type='Viva',
                duration=20,
                maximum_marks=50.0,
                slot_creation_start_date=today - timedelta(days=30),
                slot_creation_end_date=today - timedelta(days=20),
                slot_booking_start_date=today - timedelta(days=19),
                slot_booking_end_date=today - timedelta(days=10),
                examination_status='Completed',
                is_results_published=True,
                instructions='Viva on SQL normalization and transaction ACID properties.'
            )
            db.session.add(exam3)
            exam3.assigned_examiners.append(ex2)

            db.session.commit()

            # Seed Rubrics for Exam 1
            r1_1 = ExaminationRubric(
                examination_id=exam1.id,
                criterion_name='Architecture & API Design (Flask & REST)',
                maximum_marks=30.0,
                weightage=30.0,
                description='Clean routing, error handling, ORM usage and RESTful principles.'
            )
            r1_2 = ExaminationRubric(
                examination_id=exam1.id,
                criterion_name='Frontend & UI Responsiveness (VueJS & Bootstrap)',
                maximum_marks=30.0,
                weightage=30.0,
                description='Modular components, reactive state management, clean responsive styling.'
            )
            r1_3 = ExaminationRubric(
                examination_id=exam1.id,
                criterion_name='Caching & Asynchronous Processing (Redis & Celery)',
                maximum_marks=20.0,
                weightage=20.0,
                description='Effective Redis cache utilization and Celery background task execution.'
            )
            r1_4 = ExaminationRubric(
                examination_id=exam1.id,
                criterion_name='Viva Q&A & Code Comprehension',
                maximum_marks=20.0,
                weightage=20.0,
                description='Ability to answer technical questions and explain design decisions.'
            )
            db.session.add_all([r1_1, r1_2, r1_3, r1_4])

            # Seed Rubrics for Exam 3
            r3_1 = ExaminationRubric(
                examination_id=exam3.id,
                criterion_name='SQL Schema Design & Normalization',
                maximum_marks=25.0,
                weightage=50.0,
                description='Knowledge of 1NF, 2NF, 3NF, BCNF.'
            )
            r3_2 = ExaminationRubric(
                examination_id=exam3.id,
                criterion_name='Transactions & ACID properties',
                maximum_marks=25.0,
                weightage=50.0,
                description='Concurrency control and recovery mechanisms.'
            )
            db.session.add_all([r3_1, r3_2])
            db.session.commit()

            # Seed Examination Slots for Exam 1
            slot1 = ExaminationSlot(
                examination_id=exam1.id,
                examiner_id=ex1.id,
                date=today + timedelta(days=2),
                start_time='10:00',
                end_time='10:30',
                max_student_capacity=1,
                available_seats=0,
                status='Full',
                meeting_link='https://meet.google.com/abc-defg-hij',
                venue='Online Google Meet'
            )
            slot2 = ExaminationSlot(
                examination_id=exam1.id,
                examiner_id=ex1.id,
                date=today + timedelta(days=2),
                start_time='10:45',
                end_time='11:15',
                max_student_capacity=1,
                available_seats=1,
                status='Available',
                meeting_link='https://meet.google.com/abc-defg-hij',
                venue='Online Google Meet'
            )
            slot3 = ExaminationSlot(
                examination_id=exam1.id,
                examiner_id=ex2.id,
                date=today + timedelta(days=3),
                start_time='14:00',
                end_time='14:30',
                max_student_capacity=2,
                available_seats=1,
                status='Available',
                meeting_link='https://meet.google.com/xyz-uvwx-rst',
                venue='Online Google Meet'
            )

            # Slot for completed Exam 3
            slot_completed = ExaminationSlot(
                examination_id=exam3.id,
                examiner_id=ex2.id,
                date=today - timedelta(days=12),
                start_time='11:00',
                end_time='11:30',
                max_student_capacity=1,
                available_seats=0,
                status='Completed',
                meeting_link='https://meet.google.com/old-exam-link',
                venue='Online Google Meet'
            )

            db.session.add_all([slot1, slot2, slot3, slot_completed])
            db.session.commit()

            # Seed Bookings
            booking1 = Booking(
                student_id=st1.id,
                slot_id=slot1.id,
                booking_date=datetime.utcnow() - timedelta(days=1),
                status='Booked'
            )
            booking2 = Booking(
                student_id=st2.id,
                slot_id=slot3.id,
                booking_date=datetime.utcnow(),
                status='Booked'
            )
            booking_completed = Booking(
                student_id=st1.id,
                slot_id=slot_completed.id,
                booking_date=datetime.utcnow() - timedelta(days=15),
                status='Completed'
            )
            db.session.add_all([booking1, booking2, booking_completed])
            db.session.commit()

            # Seed Evaluation for the completed booking
            eval1 = Evaluation(
                booking_id=booking_completed.id,
                student_id=st1.id,
                examiner_id=ex2.id,
                total_marks=44.0,
                remarks='Excellent clarity on normalization and indexing. Good explanation of isolation levels.',
                evaluation_date=datetime.utcnow() - timedelta(days=12),
                status='Submitted'
            )
            db.session.add(eval1)
            db.session.commit()

            es1 = EvaluationScore(
                evaluation_id=eval1.id,
                rubric_id=r3_1.id,
                marks_obtained=23.0,
                feedback='Strong grasp of 3NF and Boyce-Codd normal forms.'
            )
            es2 = EvaluationScore(
                evaluation_id=eval1.id,
                rubric_id=r3_2.id,
                marks_obtained=21.0,
                feedback='Minor hesitation regarding serializability schedules.'
            )
            db.session.add_all([es1, es2])
            db.session.commit()

            print(">>> Seeding completed successfully!")
