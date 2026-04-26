"""leader optional assess_type

Revision ID: e5a92c1f83b4
Revises: d1f3a07b9c11
Create Date: 2026-04-20 10:00:00.000000

允许 employees.assess_type 为空：领导不参与考核，该字段无需填写。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5a92c1f83b4'
down_revision: Union[str, Sequence[str], None] = 'd1f3a07b9c11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('employees') as batch_op:
        batch_op.alter_column(
            'assess_type',
            existing_type=sa.String(length=20),
            nullable=True,
            existing_comment='考核类型：基层管理人员/公共人员/业务人员/产品研发人员',
            comment='考核类型：基层管理人员/公共人员/业务人员/产品研发人员（领导可为空）',
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('employees') as batch_op:
        batch_op.alter_column(
            'assess_type',
            existing_type=sa.String(length=20),
            nullable=False,
            existing_comment='考核类型：基层管理人员/公共人员/业务人员/产品研发人员（领导可为空）',
            comment='考核类型：基层管理人员/公共人员/业务人员/产品研发人员',
        )
