from flask import Blueprint, request, jsonify, g
from app.models import db, User
from app.auth_helper import generate_token, jwt_required

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username_or_email = data.get('username', '').strip()
    password = data.get('password', '')

    if not username_or_email or not password:
        return jsonify({'error': 'Username/email and password are required'}), 400

    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    if user.status != 'active':
        return jsonify({'error': 'Account is deactivated. Contact Admin.'}), 403

    token = generate_token(user)
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    }), 200

@auth_bp.route('/register', methods=['POST'])
def register():
    """Self-registration strictly for Students only. Admin and Examiners cannot self-register."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    roll_number = data.get('roll_number', '').strip()
    department = data.get('department', '').strip()
    contact = data.get('contact', '').strip()

    if not username or not email or not password or not name:
        return jsonify({'error': 'Username, email, password and name are required'}), 400

    # Ensure no admin or examiner role registration is possible
    if User.query.filter_by(username=username).first():
        return jsonify({'error': f"Username '{username}' is already taken"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': f"Email '{email}' is already registered"}), 400

    student = User(
        username=username,
        email=email,
        role='student',  # Enforced to student
        name=name,
        roll_number=roll_number,
        department=department,
        contact=contact,
        status='active'
    )
    student.set_password(password)
    db.session.add(student)
    db.session.commit()

    token = generate_token(student)
    return jsonify({
        'message': 'Student registered successfully',
        'token': token,
        'user': student.to_dict()
    }), 201

@auth_bp.route('/me', methods=['GET'])
@jwt_required
def get_current_user():
    return jsonify({'user': g.current_user.to_dict()}), 200

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required
def update_profile():
    data = request.get_json() or {}
    user = g.current_user

    if 'name' in data and data['name'].strip():
        user.name = data['name'].strip()
    if 'contact' in data:
        user.contact = data['contact'].strip()
    if 'department' in data:
        user.department = data['department'].strip()
    if 'roll_number' in data and user.role == 'student':
        user.roll_number = data['roll_number'].strip()
    if 'password' in data and data['password']:
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        user.set_password(data['password'])

    db.session.commit()
    return jsonify({'message': 'Profile updated successfully', 'user': user.to_dict()}), 200
