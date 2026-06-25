import os
import unittest
import secrets
import hashlib
from datetime import datetime, timedelta

# Force test configuration before importing backend app
os.environ['DATABASE_URL'] = 'sqlite:///test_forgot_password.db'
os.environ['ADMIN_EMAIL'] = 'admin@test.local'
os.environ.setdefault('ADMIN_PASSWORD', secrets.token_urlsafe(16))

import app as backend_app
from app import app, db, Employee

class ForgotPasswordTests(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] = False
        
        # Enable limiter in testing but reset it before each test
        backend_app.limiter.enabled = True
        backend_app.limiter.reset()
        
        self.client = self.app.test_client()

        with self.app.app_context():
            db.drop_all()
            db.create_all()

            # Create test user
            self.user = Employee(
                name='Test User',
                email='user@example.com',
                role='employee'
            )
            self.user.set_password('Password123!')
            db.session.add(self.user)
            db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            
        # Clean up database file
        try:
            os.remove('test_forgot_password.db')
        except OSError:
            pass

    def test_forgot_password_success_response_regardless_of_existence(self):
        # 1. Non-existent email
        resp = self.client.post(
            '/api/auth/forgot-password',
            json={'email': 'nonexistent@example.com'}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            resp.get_json()['message'],
            "If an account exists with this email, a password reset link has been sent."
        )

        # 2. Existent email
        from unittest.mock import patch
        with patch('app.send_password_reset_email') as mock_send_email:
            resp = self.client.post(
                '/api/auth/forgot-password',
                json={'email': 'user@example.com'}
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(
                resp.get_json()['message'],
                "If an account exists with this email, a password reset link has been sent."
            )
            self.assertTrue(mock_send_email.called)
            
            # Check token stored in database is hashed
            with self.app.app_context():
                user = Employee.query.filter_by(email='user@example.com').first()
                self.assertIsNotNone(user.reset_password_token_hash)
                self.assertIsNotNone(user.reset_password_expires_at)
                
                # Check that the token passed to email sender hashes to the stored hash
                raw_token = mock_send_email.call_args[0][1]
                expected_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
                self.assertEqual(user.reset_password_token_hash, expected_hash)

    def test_reset_password_flow_success(self):
        from unittest.mock import patch
        with patch('app.send_password_reset_email') as mock_send_email:
            # 1. Trigger forgot password to generate token
            self.client.post(
                '/api/auth/forgot-password',
                json={'email': 'user@example.com'}
            )
            raw_token = mock_send_email.call_args[0][1]

            # 2. Reset password
            resp = self.client.post(
                '/api/auth/reset-password',
                json={'token': raw_token, 'new_password': 'NewPassword123!'}
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.get_json()['message'], 'Password updated successfully. You can now log in.')

            # Verify password updated and fields cleared
            with self.app.app_context():
                user = Employee.query.filter_by(email='user@example.com').first()
                self.assertTrue(user.check_password('NewPassword123!'))
                self.assertIsNone(user.reset_password_token_hash)
                self.assertIsNone(user.reset_password_expires_at)

    def test_reset_password_rejects_expired_token(self):
        from unittest.mock import patch
        with patch('app.send_password_reset_email') as mock_send_email:
            self.client.post(
                '/api/auth/forgot-password',
                json={'email': 'user@example.com'}
            )
            raw_token = mock_send_email.call_args[0][1]

            # Manually expire the token in database
            with self.app.app_context():
                user = Employee.query.filter_by(email='user@example.com').first()
                user.reset_password_expires_at = datetime.utcnow() - timedelta(seconds=1)
                db.session.commit()

            # Attempt reset
            resp = self.client.post(
                '/api/auth/reset-password',
                json={'token': raw_token, 'new_password': 'NewPassword123!'}
            )
            self.assertEqual(resp.status_code, 400)
            self.assertIn('expired', resp.get_json()['error'].lower())

    def test_reset_password_fallback_welcome_flow(self):
        # Simulate welcome email flow which generates plain text password_reset_token
        with self.app.app_context():
            user = Employee.query.filter_by(email='user@example.com').first()
            user.password_reset_token = 'welcome_plain_text_token'
            user.password_reset_expires = datetime.utcnow() + timedelta(hours=24)
            db.session.commit()

        # Reset password via the fallback flow
        resp = self.client.post(
            '/api/auth/reset-password',
            json={'token': 'welcome_plain_text_token', 'new_password': 'WelcomePassword123!'}
        )
        self.assertEqual(resp.status_code, 200)
        
        with self.app.app_context():
            user = Employee.query.filter_by(email='user@example.com').first()
            self.assertTrue(user.check_password('WelcomePassword123!'))
            self.assertIsNone(user.password_reset_token)
            self.assertIsNone(user.password_reset_expires)

    def test_forgot_password_rate_limiting(self):
        # Make 3 successful requests
        for _ in range(3):
            resp = self.client.post(
                '/api/auth/forgot-password',
                json={'email': 'user@example.com'}
            )
            self.assertEqual(resp.status_code, 200)

        # The 4th request should be rate limited
        resp = self.client.post(
            '/api/auth/forgot-password',
            json={'email': 'user@example.com'}
        )
        self.assertEqual(resp.status_code, 429)
        self.assertIn('too many requests', resp.get_json()['error'].lower())

if __name__ == '__main__':
    unittest.main()
