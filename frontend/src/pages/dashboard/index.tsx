/**
 * 工作台 —— Neumorphism 软萌风格。
 *
 * 按角色展示不同卡片：
 *   - 管理员：统计概览 + 管理入口
 *   - 项目经理：参与度 / 公共积分 / 评价
 *   - 普通员工：公共积分 / 评价 / 个人中心
 *   - 领导：评价 / 工作目标 / 成绩
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Col,
  Row,
  Statistic,
  Space,
  Tag,
  Typography,
  Button,
  Spin,
  Alert,
} from 'antd';
import {
  TeamOutlined,
  ProjectOutlined,
  CalendarOutlined,
  FormOutlined,
  SolutionOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { NeuCard } from '@/components/neu';
import { useUserStore } from '@/stores/userStore';
import { useCycleStore } from '@/stores/cycleStore';
import { employeeApi } from '@/services/api/employee';
import { projectApi } from '@/services/api/project';
import { evaluationApi } from '@/services/api/evaluation';
import { ROLE } from '@/utils/constants';

const { Title, Text, Paragraph } = Typography;

interface QuickLink {
  key: string;
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  color: string;
}

export default function DashboardPage() {
  const user = useUserStore((s) => s.user);
  const activeCycle = useCycleStore((s) => s.activeCycle);
  const phaseName = useCycleStore((s) => s.phaseName);
  const fetchActive = useCycleStore((s) => s.fetchActive);

  const [loading, setLoading] = useState(false);
  const [employeeTotal, setEmployeeTotal] = useState<number | null>(null);
  const [projectTotal, setProjectTotal] = useState<number | null>(null);
  const [evalProgress, setEvalProgress] = useState<{
    total: number;
    completed: number;
    pending: number;
    progress: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!activeCycle) {
      fetchActive().catch(() => undefined);
    }

    const tasks: Promise<unknown>[] = [];
    setLoading(true);

    if (user.role === ROLE.ADMIN) {
      tasks.push(
        employeeApi
          .list({ page: 1, page_size: 1 })
          .then((d) => setEmployeeTotal(d.total))
          .catch(() => setEmployeeTotal(null)),
      );
      tasks.push(
        projectApi
          .list({ page: 1, page_size: 1 })
          .then((d) => setProjectTotal(d.total))
          .catch(() => setProjectTotal(null)),
      );
      tasks.push(
        evaluationApi
          .progress()
          .then((p) => setEvalProgress(p))
          .catch(() => setEvalProgress(null)),
      );
    }

    Promise.allSettled(tasks).finally(() => setLoading(false));
  }, [user, activeCycle, fetchActive]);

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Spin />
      </div>
    );
  }

  // ---- 按角色生成快捷入口（项目经理由 is_pm 派生，可与员工/领导角色叠加） ----
  const quickLinks: QuickLink[] = [];
  if (user.role === ROLE.ADMIN) {
    quickLinks.push(
      { key: 'emp', title: '员工管理', description: '维护员工信息、批量导入', to: '/data/employees', icon: <TeamOutlined />, color: '#5b8def' },
      { key: 'proj', title: '项目管理', description: '维护项目一览表、签约概率', to: '/data/projects', icon: <ProjectOutlined />, color: '#13c2c2' },
      { key: 'cycle', title: '考核周期', description: '创建/激活周期、切换阶段', to: '/settings/cycles', icon: <CalendarOutlined />, color: '#722ed1' },
      { key: 'param', title: '考核参数', description: '人均目标 / 系数表 / 签约概率', to: '/settings/parameters', icon: <SettingOutlined />, color: '#fa8c16' },
      { key: 'score', title: '积分统计', description: '触发计算、明细与汇总', to: '/stats/score', icon: <FormOutlined />, color: '#52c41a' },
      { key: 'result', title: '最终成绩', description: '查看排名、设定评级', to: '/result/final', icon: <TrophyOutlined />, color: '#eb2f96' },
    );
  } else {
    if (user.is_pm) {
      quickLinks.push({
        key: 'part',
        title: '项目参与度',
        description: '为我负责的项目填报参与度',
        to: '/declare/participation',
        icon: <FormOutlined />,
        color: '#5b8def',
      });
    }
    if (user.role === ROLE.LEADER) {
      quickLinks.push(
        { key: 'eval', title: '我的评价', description: '完成 360 互评任务', to: '/evaluation/my-tasks', icon: <SolutionOutlined />, color: '#5b8def' },
        { key: 'wg', title: '工作目标完成度', description: '为公共人员打分', to: '/evaluation/work-goal', icon: <FormOutlined />, color: '#13c2c2' },
        { key: 'final', title: '最终成绩', description: '查看部门成绩与评语', to: '/result/final', icon: <TrophyOutlined />, color: '#eb2f96' },
      );
    } else {
      quickLinks.push(
        { key: 'public', title: '公共积分申报', description: '提交公共/转型活动申报', to: '/declare/public-score', icon: <FormOutlined />, color: '#13c2c2' },
        { key: 'eval', title: '我的评价', description: '完成 360 互评任务', to: '/evaluation/my-tasks', icon: <SolutionOutlined />, color: '#722ed1' },
        { key: 'me', title: '个人中心', description: '查看本期个人成绩详情', to: '/profile/me', icon: <TrophyOutlined />, color: '#eb2f96' },
      );
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 欢迎区 */}
      <NeuCard level={2} style={{ marginBottom: 20 }}>
        <Row gutter={24} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4}>
              <Title level={4} style={{ marginBottom: 0, color: 'var(--neu-text-primary)' }}>
                {greet()}，{user.name}
              </Title>
              <Space size={8} wrap>
                <Tag color="blue" style={{ borderRadius: 8 }}>{user.role}</Tag>
                {user.department && <Tag style={{ borderRadius: 8 }}>{user.department}</Tag>}
                {user.assess_type && <Tag color="purple" style={{ borderRadius: 8 }}>{user.assess_type}</Tag>}
              </Space>
              <Text style={{ color: 'var(--neu-text-secondary)' }}>
                欢迎回到员工季度考核管理系统。请通过左侧菜单或下方快捷入口开始工作。
              </Text>
            </Space>
          </Col>
          <Col>
            <Space direction="vertical" align="end" size={4}>
              <Text style={{ color: 'var(--neu-text-secondary)', fontSize: 13 }}>当前考核周期</Text>
              {activeCycle ? (
                <Space>
                  <Text strong style={{ fontSize: 16, color: 'var(--neu-text-primary)' }}>
                    {activeCycle.name}
                  </Text>
                  <Tag color="blue" style={{ borderRadius: 8 }}>{phaseName()}</Tag>
                </Space>
              ) : (
                <Tag style={{ borderRadius: 8 }}>暂无活跃周期</Tag>
              )}
            </Space>
          </Col>
        </Row>
      </NeuCard>

      {/* 无活跃周期提示 */}
      {!activeCycle && user.role === ROLE.ADMIN && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 20, borderRadius: 'var(--neu-radius-sm)' }}
          message="当前无活跃考核周期"
          description={'请前往"考核设置 → 考核周期"创建并激活一个新的考核周期。'}
          action={
            <Link to="/settings/cycles">
              <Button size="small" type="primary">立即创建</Button>
            </Link>
          }
        />
      )}

      {/* 管理员统计区 */}
      {user.role === ROLE.ADMIN && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {[
            {
              title: '员工总数',
              value: employeeTotal ?? 0,
              icon: <TeamOutlined />,
              color: '#5b8def',
              suffix: '人',
              loading: loading && employeeTotal === null,
            },
            {
              title: '项目总数',
              value: projectTotal ?? 0,
              icon: <ProjectOutlined />,
              color: '#13c2c2',
              suffix: '个',
              loading: loading && projectTotal === null,
            },
            {
              title: '评价完成率',
              value: evalProgress ? evalProgress.progress : 0,
              icon: <SolutionOutlined />,
              color: '#722ed1',
              suffix: '%',
              loading: loading && evalProgress === null,
              extra: evalProgress ? `已完成 ${evalProgress.completed} / ${evalProgress.total}` : undefined,
            },
            {
              title: '当前阶段',
              value: activeCycle ? phaseName() : '-',
              icon: <CalendarOutlined />,
              color: '#fa8c16',
              suffix: '',
              loading: false,
              extra: activeCycle ? `阶段 ${activeCycle.phase} / 5` : undefined,
            },
          ].map((item) => (
            <Col xs={24} sm={12} md={6} key={item.title}>
              <NeuCard level={2}>
                <Spin spinning={!!item.loading}>
                  <Statistic
                    title={<span style={{ color: 'var(--neu-text-secondary)' }}>{item.title}</span>}
                    value={item.value}
                    precision={item.title === '评价完成率' ? 1 : undefined}
                    prefix={<span style={{ color: item.color }}>{item.icon}</span>}
                    suffix={item.suffix}
                  />
                  {item.extra && (
                    <Text style={{ fontSize: 12, color: 'var(--neu-text-tertiary)' }}>
                      {item.extra}
                    </Text>
                  )}
                </Spin>
              </NeuCard>
            </Col>
          ))}
        </Row>
      )}

      {/* 快捷入口 */}
      <NeuCard level={2} style={{ padding: 0 }}>
        <div style={{ padding: '16px 24px 8px', borderBottom: '1px solid var(--neu-border)' }}>
          <Text strong style={{ fontSize: 15, color: 'var(--neu-text-primary)' }}>快捷入口</Text>
        </div>
        <div style={{ padding: 20 }}>
          <Row gutter={[16, 16]}>
            {quickLinks.map((link) => (
              <Col key={link.key} xs={24} sm={12} md={8} lg={6}>
                <Link to={link.to}>
                  <NeuCard level={1} hoverable style={{ padding: 18 }}>
                    <Space align="start">
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 'var(--neu-radius-sm)',
                          background: `${link.color}18`,
                          boxShadow: 'var(--neu-shadow-in-1)',
                          color: link.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                        }}
                      >
                        {link.icon}
                      </div>
                      <div>
                        <Text strong style={{ color: 'var(--neu-text-primary)' }}>
                          {link.title}
                        </Text>
                        <Paragraph
                          style={{ marginBottom: 0, fontSize: 12, color: 'var(--neu-text-tertiary)' }}
                        >
                          {link.description}
                        </Paragraph>
                      </div>
                    </Space>
                    <div style={{ textAlign: 'right', marginTop: 8 }}>
                      <Text style={{ fontSize: 12, color: 'var(--neu-accent)' }}>
                        进入 <ArrowRightOutlined />
                      </Text>
                    </div>
                  </NeuCard>
                </Link>
              </Col>
            ))}
          </Row>
        </div>
      </NeuCard>
    </div>
  );
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 6) return '凌晨好';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
