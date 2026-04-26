"""remove mixed role fields

Revision ID: c8b2f4d91a07
Revises: fadc6745b411
Create Date: 2026-04-18 00:00:00.000000

移除「混合角色」概念：
- employees.assess_type_secondary
- final_results.is_mixed_role
- final_results.secondary_assess_type
- final_results.secondary_work_score / secondary_economic_score / secondary_key_task_score
  / secondary_eval_score / secondary_bonus_score / secondary_total_score
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8b2f4d91a07'
down_revision: Union[str, Sequence[str], None] = 'fadc6745b411'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('employees') as batch_op:
        batch_op.drop_column('assess_type_secondary')

    with op.batch_alter_table('final_results') as batch_op:
        batch_op.drop_column('is_mixed_role')
        batch_op.drop_column('secondary_assess_type')
        batch_op.drop_column('secondary_work_score')
        batch_op.drop_column('secondary_economic_score')
        batch_op.drop_column('secondary_key_task_score')
        batch_op.drop_column('secondary_eval_score')
        batch_op.drop_column('secondary_bonus_score')
        batch_op.drop_column('secondary_total_score')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('employees') as batch_op:
        batch_op.add_column(sa.Column(
            'assess_type_secondary', sa.String(length=20),
            nullable=True, comment='第二考核类型（混合角色）',
        ))

    with op.batch_alter_table('final_results') as batch_op:
        batch_op.add_column(sa.Column(
            'is_mixed_role', sa.Boolean(),
            nullable=True, comment='是否混合角色',
        ))
        batch_op.add_column(sa.Column(
            'secondary_assess_type', sa.String(length=20),
            nullable=True, comment='第二考核类型',
        ))
        batch_op.add_column(sa.Column(
            'secondary_work_score', sa.Numeric(precision=8, scale=2),
            nullable=True, comment='第二身份工作积分得分',
        ))
        batch_op.add_column(sa.Column(
            'secondary_economic_score', sa.Numeric(precision=8, scale=2),
            nullable=True, comment='第二身份经济指标得分',
        ))
        batch_op.add_column(sa.Column(
            'secondary_key_task_score', sa.Numeric(precision=5, scale=2),
            nullable=True, comment='第二身份重点任务得分',
        ))
        batch_op.add_column(sa.Column(
            'secondary_eval_score', sa.Numeric(precision=8, scale=2),
            nullable=True, comment='第二身份综合评价得分',
        ))
        batch_op.add_column(sa.Column(
            'secondary_bonus_score', sa.Numeric(precision=5, scale=2),
            nullable=True, comment='第二身份加减分',
        ))
        batch_op.add_column(sa.Column(
            'secondary_total_score', sa.Numeric(precision=8, scale=2),
            nullable=True, comment='第二身份总分',
        ))
