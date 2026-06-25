import os
import unittest
import secrets
import hashlib
import jwt
from datetime import datetime, timedelta
from unittest.mock import patch

# Force test configuration
os.environ['DATABASE_URL'] = 'sqlite:///test_welcome_email.db'
os.environ['ADMIN_EMAIL'] = 'admin@test.local'
os.environ.setdefault('ADMIN_PASSWORD', secrets.token_urlsafe(16))

import app as backend_app
from app import app, db, Employee, Organization

class WelcomeEmailTests(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] = False
        backend_app.limiter.enabled = False  # Disable rate limiting for unit tests

        self.client = self.app.test_client()

        with self.app.app_context():
            db.drop_all()
            db.create_all()

            # Create test Organization
            self.org = Organization(name="Test Org")
            db.session.add(self.org)
            db.session.commit()

            # Create Admin user
            self.admin = Employee(
                name='Admin User',
                email='admin@test.local',
                is_admin=True,
                role='admin',
                organization_id=self.org.id
            )
            self.admin.set_password('AdminPassword123!')
            db.session.add(self.admin)
            db.session.commit()

            # Generate Auth token
            self.token = jwt.encode({
                'employee_id': self.admin.id,
                'email': self.admin.email,
                'is_admin': True,
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, self.app.config['SECRET_KEY'], algorithm='HS256')
            
            self.headers = {
                'Authorization': f'Bearer {self.token}'
            }

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            
        try:
            os.remove('test_welcome_email.db')
        except OSError:
            pass

    @patch('app.mail.send')
    def test_create_new_employee_success(self, mock_mail_send):
        payload = {
            'name': 'New Employee',
            'email': 'new_emp@test.local',
            'password': 'Password123!',
            'reporting_manager': 'Admin User',
            'role': 'employee'
        }
        
        resp = self.client.post(
            '/api/employees',
            json=payload,
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertTrue(data['welcome_email_sent'])
        self.assertEqual(data['employee']['email'], 'new_emp@test.local')
        self.assertIn('welcome email was sent', data['message'])

        # Verify database fields
        with self.app.app_context():
            emp = Employee.query.filter_by(email='new_emp@test.local').first()
            self.assertIsNotNone(emp)
            self.assertIsNotNone(emp.welcome_email_sent_at)
            self.assertIsNotNone(emp.reset_password_token_hash)
            self.assertIsNotNone(emp.reset_password_expires_at)
            
            # Check raw token passed in email matches DB hash
            self.assertTrue(mock_mail_send.called)
            sent_msg = mock_mail_send.call_args[0][0]
            self.assertIn('new_emp@test.local', sent_msg.recipients)
            self.assertIn('Welcome to Atlas', sent_msg.subject)
            
            # Extract token from the email body URL
            import re
            url_match = re.search(r'token=([A-Za-z0-9_\-]+)', sent_msg.body)
            self.assertTrue(url_match)
            raw_token = url_match.group(1)
            
            # Validate that raw token hashes to what's stored
            expected_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
            self.assertEqual(emp.reset_password_token_hash, expected_hash)

    @patch('app.mail.send')
    def test_create_existing_employee_merge_roles(self, mock_mail_send):
        # 1. Create first profile (Employee)
        payload1 = {
            'name': 'Merged User',
            'email': 'merged@test.local',
            'password': 'Password123!',
            'reporting_manager': 'Admin User',
            'role': 'employee'
        }
        resp = self.client.post('/api/employees', json=payload1, headers=self.headers)
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.get_json()['welcome_email_sent'])
        
        mock_mail_send.reset_mock()

        # 2. Add Admin role to same user email
        payload2 = {
            'name': 'Merged User',
            'email': 'merged@test.local',
            'password': 'Password123!',
            'reporting_manager': 'Admin User',
            'role': 'admin'
        }
        resp2 = self.client.post('/api/employees', json=payload2, headers=self.headers)
        self.assertEqual(resp2.status_code, 200)
        
        data2 = resp2.get_json()
        # Since welcome_email_sent_at is already set from payload1, welcome_email_sent should be False
        self.assertFalse(data2['welcome_email_sent'])
        self.assertEqual(data2['employee']['role'], 'both')
        self.assertIn('Existing user updated', data2['message'])
        self.assertIn('No new welcome email was sent', data2['message'])
        self.assertFalse(mock_mail_send.called)

    @patch('app.mail.send')
    def test_resend_welcome_email_success(self, mock_mail_send):
        # Create user
        payload = {
            'name': 'Resend User',
            'email': 'resend@test.local',
            'password': 'Password123!',
            'reporting_manager': 'Admin User',
            'role': 'employee'
        }
        resp = self.client.post('/api/employees', json=payload, headers=self.headers)
        user_id = resp.get_json()['employee']['id']
        
        mock_mail_send.reset_mock()
        
        # Manually clear welcome_email_sent_at to simulate a resend scenario needing update
        with self.app.app_context():
            emp = Employee.query.get(user_id)
            emp.welcome_email_sent_at = None
            db.session.commit()

        # Resend using endpoint 1: /api/employees/<id>/resend-welcome
        resp_resend1 = self.client.post(
            f'/api/employees/{user_id}/resend-welcome',
            headers=self.headers
        )
        self.assertEqual(resp_resend1.status_code, 200)
        self.assertTrue(resp_resend1.get_json()['welcome_email_sent'])
        self.assertTrue(mock_mail_send.called)
        
        with self.app.app_context():
            emp = Employee.query.get(user_id)
            self.assertIsNotNone(emp.welcome_email_sent_at)
            
        mock_mail_send.reset_mock()
        
        # Resend using endpoint 2: /api/users/<id>/resend-welcome-email
        resp_resend2 = self.client.post(
            f'/api/users/{user_id}/resend-welcome-email',
            headers=self.headers
        )
        self.assertEqual(resp_resend2.status_code, 200)
        self.assertTrue(resp_resend2.get_json()['welcome_email_sent'])
        self.assertTrue(mock_mail_send.called)

    @patch('app.mail.send')
    def test_email_sending_failure_does_not_break_creation(self, mock_mail_send):
        # Make mail.send raise an Exception
        mock_mail_send.side_effect = Exception("SMTP server connection timeout")

        payload = {
            'name': 'Fail Mail User',
            'email': 'fail_mail@test.local',
            'password': 'Password123!',
            'reporting_manager': 'Admin User',
            'role': 'employee'
        }
        
        resp = self.client.post(
            '/api/employees',
            json=payload,
            headers=self.headers
        )
        # Should still succeed with 201 Created
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertFalse(data['welcome_email_sent'])
        self.assertIn('welcome email could not be sent', data['message'])

        # Verify user is saved in DB but welcome_email_sent_at is None
        with self.app.app_context():
            emp = Employee.query.filter_by(email='fail_mail@test.local').first()
            self.assertIsNotNone(emp)
            self.assertIsNone(emp.welcome_email_sent_at)

if __name__ == '__main__':
    unittest.main()
