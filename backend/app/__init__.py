import os
from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from app.config import Config
from app.models import db
from app.database import init_db

def create_app(config_class=Config):
    backend_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    frontend_dir = os.path.abspath(os.path.join(backend_dir, '..', 'frontend'))

    app = Flask(
        __name__,
        template_folder=frontend_dir,
        static_folder=frontend_dir,
        static_url_path=''
    )
    app.config.from_object(config_class)

    # Enable CORS for all API requests
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize SQLAlchemy ORM
    db.init_app(app)

    # Register API Blueprints
    from app.routes.auth import auth_bp
    from app.routes.admin import admin_bp
    from app.routes.examiner import examiner_bp
    from app.routes.student import student_bp
    from app.routes.common import common_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(examiner_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(common_bp)

    # Serve static assets or index.html from frontend folder
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path.startswith('api/'):
            return {'error': 'Not found'}, 404
        
        # Check if requested file exists in frontend directory
        full_path = os.path.join(frontend_dir, path)
        if path and os.path.exists(full_path) and os.path.isfile(full_path):
            return send_from_directory(frontend_dir, path)
        
        # Support /static/<path> requests as well
        if path.startswith('static/'):
            rel_path = path[len('static/'):]
            static_file = os.path.join(frontend_dir, rel_path)
            if os.path.exists(static_file) and os.path.isfile(static_file):
                return send_from_directory(frontend_dir, rel_path)

        return render_template('index.html')

    # Programmatically initialize database tables and seed data
    init_db(app)

    return app
