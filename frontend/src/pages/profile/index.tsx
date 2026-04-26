/**
 * 个人中心页 —— 所有登录用户可见。
 *
 * 功能：
 *   - 展示当前用户基本信息（姓名/部门/组/岗位/角色/考核类型）
 *   - 查看本期考核成绩概览（若已计算）
 *   - 查看积分汇总（本人）
 *   - 快捷入口：修改密码
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Tabs,
  Table,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  TrophyOutlined,
  BarChartOutlined,
  LockOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { resultApi } from '@/services/api/result';
import { scoreApi } from '@/services/api/score';
import { economicApi } from '@/services/api/economic';
import { publicScoreApi } from '@/services/api/publicScore';
import { evaluationApi } from '@/services/api/evaluation';
import type {
  FinalResult,
  ScoreSummary,
  ScoreDetail,
  EconomicDetail,
  PublicScore,
} from '@/types';
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

  // 本人项目/经济/公共积分明细（详情卡片用）
  const [scoreDetails, setScoreDetails] = useState<ScoreDetail[]>([]);
  const [economicDetails, setEconomicDetails] = useState<EconomicDetail[]>([]);
  const [publicScores, setPublicScores] = useState<PublicScore[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

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

  // 明细：项目积分 / 经济指标 / 公共积分（后端对非管理员已自动过滤为本人）
  const loadMyDetails = useCallback(async () => {
    if (!user) return;
    setDetailLoading(true);
    try {
      const [sd, ed, ps] = await Promise.allSettled([
        scoreApi.listDetails(),
        economicApi.listDetails(),
        publicScoreApi.list(),
      ]);
      setScoreDetails(sd.status === 'fulfilled' ? sd.value : []);
      setEconomicDetails(ed.status === 'fulfilled' ? ed.value : []);
      setPublicScores(ps.status === 'fulfilled' ? ps.value : []);
    } finally {
      setDetailLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadMyResult();
    loadMyScore();
    loadMyDetails();
  }, [loadMyResult, loadMyScore, loadMyDetails]);

  // 项目积分按项目聚合（一个项目可能同时有售前+交付两条）
  const projectScoreRows = useMemo(() => {
    const projectDetails = scoreDetails.filter(
      (d) => d.phase === '售前' || d.phase === '交付',
    );
    const grouped = new Map<
      string,
      { project_name: string; presale: number; delivery: number; total: number }
    >();
    for (const d of projectDetails) {
      const key = d.project_name || '-';
      const row = grouped.get(key) || {
        project_name: key,
        presale: 0,
        delivery: 0,
        total: 0,
      };
      const s = Number(d.score) || 0;
      if (d.phase === '售前') row.presale += s;
      else row.delivery += s;
      row.total += s;
      grouped.set(key, row);
    }
    return Array.from(grouped.values());
  }, [scoreDetails]);

  const participatedProjectCount = projectScoreRows.length;

  // 每个项目的经济指标（按项目聚合显示多条指标）
  const economicByProject = useMemo(() => {
    const grouped = new Map<string, EconomicDetail[]>();
    for (const d of economicDetails) {
      const key = d.project_name || '-';
      const arr = grouped.get(key) || [];
      arr.push(d);
      grouped.set(key, arr);
    }
    return Array.from(grouped.entries()).map(([project_name, items]) => ({
      project_name,
      items,
      total: items
        .filter((i) => i.indicator_type !== '产品合同')
        .reduce((s, i) => s + (Number(i.score) || 0), 0),
    }));
  }, [economicDetails]);

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
                    <Statistic title="参与项目数" value={participatedProjectCount} suffix="个" />
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

      {/* 项目与申报明细（一张卡片内用 Tab 切换） */}
      <Card
        title={
          <span>
            <ProjectOutlined style={{ marginRight: 8 }} />
            项目与申报明细
          </span>
        }
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-1)',
          border: 'none',
        }}
      >
        <Spin spinning={detailLoading}>
          <Tabs
            items={[
              {
                key: 'project',
                label: `项目积分（${participatedProjectCount}）`,
                children: projectScoreRows.length > 0 ? (
                  <Table
                    rowKey="project_name"
                    size="small"
                    pagination={false}
                    dataSource={projectScoreRows}
                    columns={
                      [
                        { title: '项目名称', dataIndex: 'project_name', ellipsis: true },
                        {
                          title: '售前积分',
                          dataIndex: 'presale',
                          width: 110,
                          align: 'right',
                          render: (v: number) => (v > 0 ? formatNumber(v) : '-'),
                        },
                        {
                          title: '交付积分',
                          dataIndex: 'delivery',
                          width: 110,
                          align: 'right',
                          render: (v: number) => (v > 0 ? formatNumber(v) : '-'),
                        },
                        {
                          title: '合计',
                          dataIndex: 'total',
                          width: 110,
                          align: 'right',
                          render: (v: number) => (
                            <strong>{formatNumber(v)}</strong>
                          ),
                        },
                      ] as ColumnsType<(typeof projectScoreRows)[number]>
                    }
                    summary={(data) => {
                      const presale = data.reduce((s, r) => s + r.presale, 0);
                      const delivery = data.reduce((s, r) => s + r.delivery, 0);
                      const total = data.reduce((s, r) => s + r.total, 0);
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}>总计</Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="right">
                            {formatNumber(presale)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">
                            {formatNumber(delivery)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">
                            <strong>{formatNumber(total)}</strong>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      );
                    }}
                  />
                ) : (
                  <Empty description="暂无项目积分" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ),
              },
              {
                key: 'economic',
                label: `经济指标（${economicByProject.length}）`,
                children: economicDetails.length > 0 ? (
                  <Table<EconomicDetail>
                    rowKey={(r) => `${r.project_name}-${r.indicator_type}`}
                    size="small"
                    pagination={false}
                    dataSource={economicDetails}
                    columns={
                      [
                        { title: '项目名称', dataIndex: 'project_name', ellipsis: true },
                        { title: '指标类型', dataIndex: 'indicator_type', width: 110 },
                        {
                          title: '完成值(万元)',
                          dataIndex: 'completed_value',
                          width: 120,
                          align: 'right',
                          render: (v: number) => formatNumber(Number(v)),
                        },
                        {
                          title: '目标值(万元)',
                          dataIndex: 'target_value',
                          width: 120,
                          align: 'right',
                          render: (v: number) => formatNumber(Number(v)),
                        },
                        {
                          title: '参与系数',
                          dataIndex: 'participation_coeff',
                          width: 100,
                          align: 'right',
                          render: (v: number) => formatNumber(Number(v)),
                        },
                        {
                          title: '得分',
                          dataIndex: 'score',
                          width: 90,
                          align: 'right',
                          render: (v: number) => <strong>{formatNumber(Number(v))}</strong>,
                        },
                      ] as ColumnsType<EconomicDetail>
                    }
                  />
                ) : (
                  <Empty description="暂无经济指标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ),
              },
              {
                key: 'public',
                label: `公共积分申报（${publicScores.length}）`,
                children: publicScores.length > 0 ? (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={publicScores}
                    columns={
                      [
                        { title: '活动名称', dataIndex: 'activity_name', ellipsis: true },
                        { title: '活动类型', dataIndex: 'activity_type', width: 120 },
                        {
                          title: '人月',
                          dataIndex: 'man_months',
                          width: 80,
                          align: 'right',
                          render: (v: number | string) => formatNumber(Number(v)),
                        },
                        { title: '复杂性', dataIndex: 'complexity', width: 100 },
                        {
                          title: '积分',
                          dataIndex: 'score',
                          width: 90,
                          align: 'right',
                          render: (v: number | string) => (
                            <strong>{formatNumber(Number(v))}</strong>
                          ),
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 100,
                          render: (s: string | null) =>
                            s ? <Tag color="blue">{s}</Tag> : '-',
                        },
                      ] as ColumnsType<PublicScore>
                    }
                  />
                ) : (
                  <Empty description="暂无公共积分申报" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ),
              },
            ]}
          />
        </Spin>
      </Card>
    </div>
  );
}
