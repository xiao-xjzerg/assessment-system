"""eval summary new peer columns

Revision ID: a7f2e1b6d0c4
Revises: c3c29dab530c
Create Date: 2026-04-21 12:00:00.000000

互评关系逻辑调整：
- eval_summaries 删掉 colleague1_score ~ colleague4_score（定长4列）
- 新增 colleague_avg_score（同事/部门员工平均分）+ colleague_count（人数）
- 新增 manager_mutual_score（基层管理互评平均分）

原因：新规则下基层管理人员互评"全中心/组员工"、公共人员互评"6人"，
评价人数不再固定，原 colleague1~4 无法承载。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7f2e1b6d0c4'
down_revision: Union[str, Sequence[str], None] = 'c3c29dab530c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('eval_summaries') as batch_op:
        batch_op.drop_column('colleague1_score')
        batch_op.drop_column('colleague2_score')
        batch_op.drop_column('colleague3_score')
        batch_op.drop_column('colleague4_score')
        batch_op.add_column(sa.Column(
            'colleague_avg_score',
            sa.Numeric(precision=6, scale=2),
            nullable=True,
            comment='同事/部门员工评分平均分（业务/产研=同事均值，基层管理/公共=部门员工均值）',
        ))
        batch_op.add_column(sa.Column(
            'colleague_count',
            sa.Integer(),
            nullable=True,
            comment='同事/部门员工评价人数',
        ))
        batch_op.add_column(sa.Column(
            'manager_mutual_score',
            sa.Numeric(precision=6, scale=2),
            nullable=True,
            comment='基层管理互评平均分（仅基层管理人员）',
        ))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('eval_summaries') as batch_op:
        batch_op.drop_column('manager_mutual_score')
        batch_op.drop_column('colleague_count')
        batch_op.drop_column('colleague_avg_score')
        batch_op.add_column(sa.Column(
            'colleague1_score', sa.Numeric(precision=6, scale=2),
            nullable=True, comment='同事1评分',
        ))
        batch_op.add_column(sa.Column(
            'colleague2_score', sa.Numeric(precision=6, scale=2),
            nullable=True, comment='同事2评分',
        ))
        batch_op.add_column(sa.Column(
            'colleague3_score', sa.Numeric(precision=6, scale=2),
            nullable=True, comment='同事3评分',
        ))
        batch_op.add_column(sa.Column(
            'colleague4_score', sa.Numeric(precision=6, scale=2),
            nullable=True, comment='同事4评分',
        ))
