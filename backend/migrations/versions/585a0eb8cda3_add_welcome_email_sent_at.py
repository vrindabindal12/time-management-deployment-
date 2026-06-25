"""Add welcome email sent at

Revision ID: 585a0eb8cda3
Revises: b263fc4f42d5
Create Date: 2026-06-25 16:08:45.511849

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import reflection

# revision identifiers, used by Alembic.
revision = '585a0eb8cda3'
down_revision = 'b263fc4f42d5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = reflection.Inspector.from_engine(bind)
    columns = [c['name'] for c in insp.get_columns('employee')]
    
    with op.batch_alter_table('employee', schema=None) as batch_op:
        if 'welcome_email_sent_at' not in columns:
            batch_op.add_column(sa.Column('welcome_email_sent_at', sa.DateTime(), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = reflection.Inspector.from_engine(bind)
    columns = [c['name'] for c in insp.get_columns('employee')]
    
    with op.batch_alter_table('employee', schema=None) as batch_op:
        if 'welcome_email_sent_at' in columns:
            batch_op.drop_column('welcome_email_sent_at')

