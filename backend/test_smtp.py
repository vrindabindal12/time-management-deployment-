import sys
import os
from flask_mail import Message

# Add backend to python path if run from root
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import app, mail

def test_smtp_connection(recipient):
    print("--- Flask-Mail SMTP Diagnostics ---")
    print(f"MAIL_SERVER: {app.config.get('MAIL_SERVER')}")
    print(f"MAIL_PORT: {app.config.get('MAIL_PORT')}")
    print(f"MAIL_USE_TLS: {app.config.get('MAIL_USE_TLS')}")
    print(f"MAIL_USE_SSL: {app.config.get('MAIL_USE_SSL')}")
    print(f"MAIL_USERNAME: {app.config.get('MAIL_USERNAME')}")
    print(f"MAIL_DEFAULT_SENDER: {app.config.get('MAIL_DEFAULT_SENDER')}")
    print("-" * 35)

    if not app.config.get('MAIL_USERNAME') or app.config.get('MAIL_USERNAME') == 'placeholder@example.com':
        print("[WARNING] MAIL_USERNAME is not set or is set to placeholder value.")

    with app.app_context():
        msg = Message(
            subject="Atlas SMTP Diagnostic Test Email",
            recipients=[recipient],
            body=f"This is a diagnostic test email from the Atlas Time Tracking system to verify SMTP configuration.\n\nConfigured Server: {app.config.get('MAIL_SERVER')}:{app.config.get('MAIL_PORT')}"
        )
        try:
            print(f"Attempting to send email to {recipient} synchronously...")
            mail.send(msg)
            print("SUCCESS! Test email sent successfully.")
            return True
        except Exception as e:
            import traceback
            print("\nERROR! Failed to send email:")
            traceback.print_exc()
            return False

if __name__ == '__main__':
    recipient = "vrindabindal12@gmail.com"  # default test recipient
    if len(sys.argv) > 1:
        recipient = sys.argv[1]
    test_smtp_connection(recipient)
