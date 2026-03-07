import os
import secrets
import unittest
from datetime import date
import csv
import io
from openpyxl import load_workbook

os.environ['DATABASE_URL'] = 'sqlite:///test_timetracking.db'
os.environ['ADMIN_EMAIL'] = 'admin@test.local'
os.environ.setdefault('ADMIN_PASSWORD', secrets.token_urlsafe(16))

import app as backend_app


class AddWorkValidationTests(unittest.TestCase):
    def setUp(self):
        self.app = backend_app.app
        self.client = self.app.test_client()

        with self.app.app_context():
            backend_app.db.drop_all()
            backend_app.db.create_all()

            admin = backend_app.Employee(
                name='Admin',
                email=backend_app.ADMIN_EMAIL,
                is_admin=True
            )
            admin.set_password(backend_app.ADMIN_PASSWORD)
            backend_app.db.session.add(admin)
            backend_app.db.session.commit()

        self.auth_headers = self._register_and_login()
        self.admin_headers = self._login(backend_app.ADMIN_EMAIL, backend_app.ADMIN_PASSWORD)

    def _login(self, email, password):
        login_response = self.client.post(
            '/api/login',
            json={'email': email, 'password': password}
        )
        token = login_response.get_json()['token']
        return {'Authorization': f'Bearer {token}'}

    def _register_and_login(self):
        email = f"user_{date.today().isoformat()}@test.local"
        register_response = self.client.post(
            '/api/register',
            json={'name': 'User', 'email': email, 'password': 'password123'}
        )
        self.employee_id = register_response.get_json()['employee']['id']

        return self._login(email, 'password123')

    def _add_work_entry(self, project_name='Alpha Project', description='Implemented export feature'):
        response = self.client.post(
            '/api/add-work',
            json={
                'project_name': project_name,
                'work_date': '2026-03-05',
                'hours_worked': 8.5,
                'description': description
            },
            headers=self.auth_headers
        )
        self.assertEqual(response.status_code, 201)

    def test_add_work_requires_description(self):
        response = self.client.post(
            '/api/add-work',
            json={
                'project_name': 'Alpha',
                'work_date': '2026-03-05',
                'hours_worked': 8
            },
            headers=self.auth_headers
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('required', response.get_json()['error'].lower())

    def test_add_work_rejects_blank_description(self):
        response = self.client.post(
            '/api/add-work',
            json={
                'project_name': 'Alpha',
                'work_date': '2026-03-05',
                'hours_worked': 8,
                'description': '   '
            },
            headers=self.auth_headers
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('required', response.get_json()['error'].lower())

    def test_add_work_rejects_blank_project_name(self):
        response = self.client.post(
            '/api/add-work',
            json={
                'project_name': '   ',
                'work_date': '2026-03-05',
                'hours_worked': 8,
                'description': 'Worked on billing module'
            },
            headers=self.auth_headers
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('required', response.get_json()['error'].lower())

    def test_add_work_persists_trimmed_values(self):
        response = self.client.post(
            '/api/add-work',
            json={
                'project_name': '  Alpha Project  ',
                'work_date': '2026-03-05',
                'hours_worked': 8,
                'description': '  Implemented API validation  '
            },
            headers=self.auth_headers
        )

        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertEqual(body['project_name'], 'Alpha Project')
        self.assertEqual(body['description'], 'Implemented API validation')

        work_response = self.client.get('/api/my-work', headers=self.auth_headers)
        self.assertEqual(work_response.status_code, 200)
        entries = work_response.get_json()['work_entries']
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]['project_name'], 'Alpha Project')
        self.assertEqual(entries[0]['description'], 'Implemented API validation')

    def test_add_work_rejects_zero_hours(self):
        response = self.client.post(
            '/api/add-work',
            json={
                'project_name': 'Alpha',
                'work_date': '2026-03-05',
                'hours_worked': 0,
                'description': 'Worked on docs'
            },
            headers=self.auth_headers
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('hours', response.get_json()['error'].lower())

    def test_export_my_work_csv(self):
        self._add_work_entry()
        response = self.client.get('/api/my-work/export?format=csv', headers=self.auth_headers)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'text/csv')
        text = response.data.decode('utf-8')
        rows = list(csv.DictReader(io.StringIO(text)))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['Project Name'], 'Alpha Project')
        self.assertEqual(rows[0]['Description'], 'Implemented export feature')

    def test_export_my_work_excel(self):
        self._add_work_entry()
        response = self.client.get('/api/my-work/export?format=excel', headers=self.auth_headers)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.mimetype,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

        workbook = load_workbook(io.BytesIO(response.data))
        worksheet = workbook.active
        self.assertEqual(worksheet.title, 'Work History')
        self.assertEqual(worksheet['D2'].value, 'Alpha Project')
        self.assertEqual(worksheet['G2'].value, 'Implemented export feature')

    def test_export_employee_work_csv_admin_only(self):
        self._add_work_entry()

        unauthorized = self.client.get(
            f'/api/employee/{self.employee_id}/work/export?format=csv',
            headers=self.auth_headers
        )
        self.assertEqual(unauthorized.status_code, 403)

        authorized = self.client.get(
            f'/api/employee/{self.employee_id}/work/export?format=csv',
            headers=self.admin_headers
        )
        self.assertEqual(authorized.status_code, 200)
        self.assertEqual(authorized.mimetype, 'text/csv')

    def test_export_rejects_invalid_format(self):
        self._add_work_entry()
        response = self.client.get('/api/my-work/export?format=pdf', headers=self.auth_headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn('invalid format', response.get_json()['error'].lower())

    def test_project_filter_applies_to_history_and_export(self):
        self._add_work_entry(project_name='Apollo', description='Apollo work')
        self._add_work_entry(project_name='Beta', description='Beta work')

        history = self.client.get('/api/my-work?project_name=Apollo', headers=self.auth_headers)
        self.assertEqual(history.status_code, 200)
        history_entries = history.get_json()['work_entries']
        self.assertEqual(len(history_entries), 1)
        self.assertEqual(history_entries[0]['project_name'], 'Apollo')

        export_response = self.client.get(
            '/api/my-work/export?format=csv&project_name=Beta',
            headers=self.auth_headers
        )
        self.assertEqual(export_response.status_code, 200)
        rows = list(csv.DictReader(io.StringIO(export_response.data.decode('utf-8'))))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['Project Name'], 'Beta')


if __name__ == '__main__':
    unittest.main()
