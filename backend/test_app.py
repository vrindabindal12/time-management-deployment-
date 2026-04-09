import os
import secrets
import unittest
from datetime import date, timedelta
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
                'work_date': date.today().isoformat(),
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
                'work_date': date.today().isoformat(),
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
                'work_date': date.today().isoformat(),
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
                'work_date': date.today().isoformat(),
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
                'work_date': date.today().isoformat(),
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
                'work_date': date.today().isoformat(),
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


class PromotionRatePayablesTests(unittest.TestCase):
    def setUp(self):
        self.app = backend_app.app
        self.client = self.app.test_client()

        with self.app.app_context():
            backend_app.db.drop_all()
            backend_app.db.create_all()

            admin = backend_app.Employee(
                name='Admin',
                email=backend_app.ADMIN_EMAIL,
                is_admin=True,
                role='admin'
            )
            admin.set_password(backend_app.ADMIN_PASSWORD)
            backend_app.db.session.add(admin)
            backend_app.db.session.commit()

        self.admin_headers = self._login(backend_app.ADMIN_EMAIL, backend_app.ADMIN_PASSWORD)

    def _login(self, email, password):
        login_response = self.client.post('/api/login', json={'email': email, 'password': password})
        token = login_response.get_json()['token']
        return {'Authorization': f'Bearer {token}'}

    def _create_employee_and_login(self, suffix, profile_data):
        email = f"promo_{suffix}@test.local"
        payload = {
            'name': f'Promo User {suffix}',
            'email': email,
            'password': 'Password123!',
            'reporting_manager': 'Admin',
            **profile_data,
        }
        create_resp = self.client.post('/api/employees', json=payload, headers=self.admin_headers)
        self.assertEqual(create_resp.status_code, 201)
        employee = create_resp.get_json()
        return employee, self._login(email, 'Password123!')

    def _add_work(self, headers, work_date, hours=8.0):
        response = self.client.post(
            '/api/add-work',
            json={
                'project_name': 'Alpha',
                'work_date': work_date.isoformat(),
                'hours_worked': hours,
                'description': 'Promotion regression test'
            },
            headers=headers
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def _get_payables_rows(self):
        start_date = (date.today() - timedelta(days=14)).isoformat()
        end_date = date.today().isoformat()
        response = self.client.get(
            f'/api/payables/employees?start_date={start_date}&end_date={end_date}',
            headers=self.admin_headers
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()['rows']

    def test_payables_use_promotion_rate_on_and_after_promotion_date(self):
        promotion_date = date.today() - timedelta(days=2)
        day_before = promotion_date - timedelta(days=1)

        _, employee_headers = self._create_employee_and_login(
            suffix='dated',
            profile_data={
                'current_hourly_rate': 100,
                'designation': 'Engineer',
                'promotion_1_date': promotion_date.isoformat(),
                'promotion_1_rate': 150,
                'promotion_1_designation': 'Senior Engineer',
            }
        )

        self._add_work(employee_headers, day_before, hours=2)
        self._add_work(employee_headers, promotion_date, hours=2)

        rows = self._get_payables_rows()
        rate_by_date = {row['work_date']: row['rate'] for row in rows}

        self.assertEqual(rate_by_date[day_before.isoformat()], 100.0)
        self.assertEqual(rate_by_date[promotion_date.isoformat()], 150.0)

    def test_profile_promotion_update_reflects_in_regular_payables_rows(self):
        promotion_date = date.today() - timedelta(days=2)

        employee, employee_headers = self._create_employee_and_login(
            suffix='updated',
            profile_data={
                'current_hourly_rate': 100,
                'designation': 'Engineer',
            }
        )

        self._add_work(employee_headers, promotion_date, hours=2)

        rows_before = self._get_payables_rows()
        self.assertEqual(rows_before[0]['rate'], 100.0)

        update_resp = self.client.put(
            f"/api/employees/{employee['id']}/profile",
            json={
                'promotion_1_date': promotion_date.isoformat(),
                'promotion_1_rate': 150,
                'promotion_1_designation': 'Senior Engineer',
            },
            headers=self.admin_headers
        )
        self.assertEqual(update_resp.status_code, 200)

        rows_after = self._get_payables_rows()
        self.assertEqual(rows_after[0]['rate'], 150.0)


if __name__ == '__main__':
    unittest.main()
