/**
 * 个人中心页 —— 所有登录用户可见。
 *
 * 功能：
 *   - 展示当前用户基本信息（姓名/部门/组/岗位/角色/考核类型）
 *   - 查看本期考核成绩概览（若已计算）
 *   - 查看积分汇总（本人）
 *   - 快捷入口：修改密码
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Row,
  Col,
  Statistic,
  Empty,
  Spin,
  Button,
  App as AntdApp,
} from 'antd';
import {
  UserOutlined,
  TrophyOutlined,
  BarChartOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { resultApi } from '@/services/api/result';
import { scoreApi } from '@/services/api/score';
import { evaluationApi } from '@/services/api/evaluation';
import type { FinalResult, ScoreSummary } from '@/types';
import { useUserStore } from '@/stores/userStore';
import { useCycleStore } from '@/stores/cycleStore';
import { formatNumber } from '@/utils/format';

export default function ProfilePage() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const activeCycle = useCycleStore((s) => s.activeCycle);

  // 本人最终成绩
  const [result, setResult] = useState<FinalResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  // 本人积分汇总
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  // 工作目标评语（多位领导合并：XXX：评语\nXXX：评语），仅在成绩已计算后拉取
  const [workGoalComments, setWorkGoalComments] = useState<string>('');

  const loadMyResult = useCallback(async () => {
    if (!user) return;
    setResultLoading(true);
    try {
      const list = await resultApi.list({ employee_name: user.name });
      const mine = list.find((r) => r.employee_id === user.user_id) || null;
      setResult(mine);
    } catch {
      // 可能尚未计算，静默
    } finally {
      setResultLoading(false);
    }
  }, [user]);

  const loadMyScore = useCallback(async () => {
    if (!user) return;
    setScoreLoading(true);
    try {
      const list = await scoreApi.listSummary({ employee_name: user.name });
      const mine = list.find((s) => s.employee_id === user.user_id) || null;
      setScoreSummary(mine);
    } catch {
      // 静默
    } finally {
      setScoreLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadMyResult();
    loadMyScore();
  }, [loadMyResult, loadMyScore]);

  // 成绩已计算（result 非空）时，再拉工作目标评语
  useEffect(() => {
    if (!result) {
      setWorkGoalComments('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await evaluationApi.listWorkGoals();
        const merged = list
          .filter((s) => s.comment && s.comment.trim().length > 0)
          .map((s) => `${s.leader_name || '未知领导'}：${s.comment}`)
          .join('\n');
        if (!cancelled) setWorkGoalComments(merged);
      } catch {
        if (!cancelled) setWorkGoalComments('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (!user) return null;

  return (
    <div style={{ padding: 24 }}>
      {/* 基本信息 */}
      <Card
        title={
          <span>
            <UserOutlined style={{ marginRight: 8 }} />
            个人信息
          </span>
        }
        style={{
          marginBottom: 16,
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Button icon={<LockOutlined />} onClick={() => navigate('/profile/change-password')}>
            修改密码
          </Button>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
          <Descriptions.Item label="部门">{user.department}</Descriptions.Item>
          <Descriptions.Item label="角色">
            <Tag color="blue">{user.role}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="考核类型">
            <Tag color="purple">{user.assess_type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前周期">
            {activeCycle ? activeCycle.name : <Tag color="default">无活跃周期</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16}>
        {/* 积分汇总 */}
        <Col xs={24} md={12}>
          <Card
            title={
              <span>
                <BarChartOutlined style={{ marginRight: 8 }} />
                本期积分
              </span>
            }
            style={{
              marginBottom: 16,
              borderRadius: 'var(--neu-radius-md)',
              boxShadow: 'var(--neu-shadow-out-1)',
              border: 'none',
            }}
          >
            <Spin spinning={scoreLoading}>
              {scoreSummary ? (
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="项目积分" value={formatNumber(Number(scoreSummary.project_score_total))} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="公共积分" value={formatNumber(Number(scoreSummary.public_score_total))} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="转型积分" value={formatNumber(Number(scoreSummary.transform_score_total))} />
                  </Col>
                  <Col span={8} style={{ marginTop: 16 }}>
                    <Statistic title="总积分" value={formatNumber(Number(scoreSummary.total_score))} valueStyle={{ fontWeight: 700 }} />
                  </Col>
                  <Col span={8} style={{ marginTop: 16 }}>
                    <Statistic title="归一化得分" value={formatNumber(Number(scoreSummary.normalized_score))} valueStyle={{ color: '#1890ff' }} />
                  </Col>
                </Row>
              ) : (
                <Empty description="暂无积分数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Spin>
          </Card>
        </Col>

        {/* 最终成绩 */}
        <Col xs={24} md={12}>
          <Card
            title={
              <span>
                <TrophyOutlined style={{ marginRight: 8 }} />
                本期考核成绩
              </span>
            }
            style={{
              marginBottom: 16,
              borderRadius: 'var(--neu-radius-md)',
              boxShadow: 'var(--neu-shadow-out-1)',
              border: 'none',
            }}
          >
            <Spin spinning={resultLoading}>
              {result ? (
                <>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="总分"
                        value={formatNumber(Number(result.total_score))}
                        valueStyle={{ fontWeight: 700, fontSize: 24 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic title="排名" value={result.ranking > 0 ? result.ranking : '-'} />
                    </Col>
                    <Col span={8}>
                      <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>评定等级</div>
                      {result.rating ? (
                        <Tag color={result.rating === '优秀' ? 'gold' : result.rating === '不合格' ? 'red' : 'blue'} style={{ fontSize: 14 }}>
                          {result.rating}
                        </Tag>
                      ) : (
                        <span style={{ color: '#999' }}>待评定</span>
                      )}
                    </Col>
                  </Row>
                  <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
                    <Descriptions.Item label="工作积分">
                      {formatNumber(Number(result.work_score))}/{Number(result.work_score_max)}
                    </Descriptions.Item>
                    <Descriptions.Item label="经济指标">
                      {formatNumber(Number(result.economic_score))}/{Number(result.economic_score_max)}
                    </Descriptions.Item>
                    <Descriptions.Item label="综合评价">
                      {formatNumber(Number(result.eval_score))}/30
                    </Descriptions.Item>
                    <Descriptions.Item label="加减分">
                      {Number(result.bonus_score) !== 0
                        ? (Number(result.bonus_score) > 0 ? '+' : '') + formatNumber(Number(result.bonus_score))
                        : '-'}
                    </Descriptions.Item>
                    {Number(result.key_task_score) > 0 && (
                      <Descriptions.Item label="重点任务">
                        {formatNumber(Number(result.key_task_score))}/10
                      </Descriptions.Item>
                    )}
                    {Number(result.work_goal_score) > 0 && (
                      <Descriptions.Item label="工作目标">
                        {formatNumber(Number(result.work_goal_score))}/70
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                  {result.leader_comment && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--neu-bg, #f5f5f5)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>领导评语</div>
                      <div>{result.leader_comment}</div>
                    </div>
                  )}
                  {workGoalComments && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--neu-bg, #f5f5f5)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>评语</div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {workGoalComments}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Empty description="暂无考核成绩" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
