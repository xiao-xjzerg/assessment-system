"""add position to final_results

Revision ID: d1f3a07b9c11
Revises: c8b2f4d91a07
Create Date: 2026-04-20 00:00:00.000000

为 final_results 增加 position（岗位）字段，用于成绩页岗位筛选与展示。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1f3a07b9c11'
down_revision: Union[str, Sequence[str], None] = 'c8b2f4d91a07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('final_results') as batch_op:
        batch_op.add_column(sa.Column(
            'position', sa.String(length=50),
            nullable=True, comment='岗位',
        ))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('final_results') as batch_op:
        batch_op.drop_column('position')
