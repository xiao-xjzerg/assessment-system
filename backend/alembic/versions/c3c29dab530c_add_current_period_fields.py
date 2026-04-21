"""add_current_period_fields

Revision ID: c3c29dab530c
Revises: e5a92c1f83b4
Create Date: 2026-04-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3c29dab530c'
down_revision: Union[str, Sequence[str], None] = 'e5a92c1f83b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'projects',
        sa.Column('current_period_profit', sa.Numeric(precision=14, scale=2), nullable=True, comment='当期确认项目利润（万元）'),
    )
    op.add_column(
        'projects',
        sa.Column('current_period_self_dev_income', sa.Numeric(precision=14, scale=2), nullable=True, comment='当期确认自研收入（万元）'),
    )


def downgrade() -> None:
    op.drop_column('projects', 'current_period_self_dev_income')
    op.drop_column('projects', 'current_period_profit')
