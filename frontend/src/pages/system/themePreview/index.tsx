/**
 * 主题预览页 —— 集中展示 Neumorphism 组件 + AntD 融合效果。
 *
 * 临时路由 /system/theme-preview，供用户确认风格后再全面推进。
 */
import { useState } from 'react';
import {
  Card,
  Table,
  Form,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  Statistic,
  Switch,
  Descriptions,
  Badge,
  Progress,
  InputNumber,
} from 'antd';
import {
  TeamOutlined,
  ProjectOutlined,
  SolutionOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { NeuCard, NeuPanel, NeuButton, NeuSwitch, NeuSlider } from '@/components/neu';
import { useTheme } from '@/theme/useTheme';

const { Title, Text, Paragraph } = Typography;

/** 示例表格数据 */
const tableData = [
  { key: '1', name: '张三', department: '实施交付部', grade: 'T5', role: '项目经理', score: 87.5 },
  { key: '2', name: '李四', department: '产品研发部', grade: 'T3', role: '普通员工', score: 92.1 },
  { key: '3', name: '王五', department: '实施交付部', grade: 'S2', role: '管理员', score: 78.3 },
  { key: '4', name: '赵六', department: '产品研发部', grade: 'P4', role: '普通员工', score: 85.0 },
];

const tableColumns = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '部门', dataIndex: 'department', key: 'department' },
  { title: '岗级', dataIndex: 'grade', key: 'grade', render: (v: string) => <Tag>{v}</Tag> },
  {
    title: '角色',
    dataIndex: 'role',
    key: 'role',
    render: (v: string) => <Tag color="blue">{v}</Tag>,
  },
  {
    title: '得分',
    dataIndex: 'score',
    key: 'score',
    render: (v: number) => <Text strong>{v.toFixed(1)}</Text>,
  },
];

export default function ThemePreviewPage() {
  const { mode, resolvedMode, setMode } = useTheme();
  const [switchVal, setSwitchVal] = useState(true);
  const [sliderVal, setSliderVal] = useState(65);
  const [neuSwitchVal, setNeuSwitchVal] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Neumorphism 主题预览</Title>
      <Paragraph type="secondary">
        以下展示 Neumorphism 软萌风组件与 AntD 原生组件的融合效果。
        请切换深/浅色模式查看两套配色方案。确认风格满意后，再按模块逐步推进。
      </Paragraph>

      {/* ========== 主题切换控制 ========== */}
      <NeuCard style={{ marginBottom: 24 }}>
        <Space size={16} align="center">
          <Text strong>当前模式：</Text>
          <Tag color={resolvedMode === 'dark' ? 'geekblue' : 'gold'}>
            {resolvedMode === 'dark' ? '深色' : '浅色'}
            {mode === 'system' ? '（跟随系统）' : ''}
          </Tag>
          <Button.Group>
            <Button type={mode === 'system' ? 'primary' : 'default'} onClick={() => setMode('system')}>
              跟随系统
            </Button>
            <Button type={mode === 'light' ? 'primary' : 'default'} onClick={() => setMode('light')}>
              浅色
            </Button>
            <Button type={mode === 'dark' ? 'primary' : 'default'} onClick={() => setMode('dark')}>
              深色
            </Button>
          </Button.Group>
        </Space>
      </NeuCard>

      {/* ========== Neu 组件展示 ========== */}
      <Row gutter={[24, 24]}>
        {/* NeuCard 三个强度 */}
        <Col xs={24} lg={12}>
          <Title level={5}>NeuCard（外凸阴影 3 级）</Title>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <NeuCard level={1}>
              <Text>Level 1 —— 小控件级阴影</Text>
            </NeuCard>
            <NeuCard level={2}>
              <Text>Level 2 —— 默认卡片阴影</Text>
            </NeuCard>
            <NeuCard level={3}>
              <Text>Level 3 —— 强调面板阴影</Text>
            </NeuCard>
          </Space>
        </Col>

        {/* NeuCard inset + NeuPanel */}
        <Col xs={24} lg={12}>
          <Title level={5}>NeuCard（内凹）+ NeuPanel</Title>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <NeuCard variant="inset">
              <Text>内凹容器 —— 适合表单区域</Text>
            </NeuCard>
            <NeuPanel title="NeuPanel 带标题">
              <Text>面板内容区域，默认内凹风格。</Text>
            </NeuPanel>
          </Space>
        </Col>

        {/* NeuButton */}
        <Col xs={24} lg={12}>
          <Title level={5}>NeuButton</Title>
          <NeuCard>
            <Space size={16} wrap>
              <NeuButton size="small">小按钮</NeuButton>
              <NeuButton>默认按钮</NeuButton>
              <NeuButton size="large">大按钮</NeuButton>
              <NeuButton variant="primary">主要按钮</NeuButton>
              <NeuButton variant="primary" size="large">
                大号主要
              </NeuButton>
              <NeuButton disabled>禁用态</NeuButton>
            </Space>
          </NeuCard>
        </Col>

        {/* NeuSwitch + NeuSlider */}
        <Col xs={24} lg={12}>
          <Title level={5}>NeuSwitch + NeuSlider</Title>
          <NeuCard>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <Space size={16} align="center">
                <Text>NeuSwitch：</Text>
                <NeuSwitch checked={neuSwitchVal} onChange={setNeuSwitchVal} />
                <Text type="secondary">{neuSwitchVal ? '开启' : '关闭'}</Text>
              </Space>
              <div>
                <Text>NeuSlider（{sliderVal}）：</Text>
                <div style={{ marginTop: 12 }}>
                  <NeuSlider value={sliderVal} onChange={setSliderVal} />
                </div>
              </div>
            </Space>
          </NeuCard>
        </Col>
      </Row>

      <Divider />

      {/* ========== 统计卡片区（模拟 Dashboard） ========== */}
      <Title level={5}>统计卡片（Dashboard 风格）</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: '员工总数', value: 156, icon: <TeamOutlined />, color: '#5b8def', suffix: '人' },
          { title: '项目总数', value: 42, icon: <ProjectOutlined />, color: '#13c2c2', suffix: '个' },
          { title: '评价完成率', value: 73.5, icon: <SolutionOutlined />, color: '#722ed1', suffix: '%' },
          { title: '当前阶段', value: '360 评价', icon: <CalendarOutlined />, color: '#fa8c16', suffix: '' },
        ].map((item) => (
          <Col xs={24} sm={12} md={6} key={item.title}>
            <NeuCard level={2}>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={<span style={{ color: item.color }}>{item.icon}</span>}
                suffix={item.suffix}
              />
            </NeuCard>
          </Col>
        ))}
      </Row>

      <Divider />

      {/* ========== AntD Table（保持清晰） ========== */}
      <Title level={5}>AntD Table（保持清晰可读）</Title>
      <Card style={{ marginBottom: 24 }}>
        <Table dataSource={tableData} columns={tableColumns} pagination={false} size="middle" />
      </Card>

      <Divider />

      {/* ========== AntD Form（保持清晰） ========== */}
      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Title level={5}>AntD Form（保持清晰）</Title>
          <Card>
            <Form layout="vertical" requiredMark={false}>
              <Form.Item label="姓名">
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item label="部门">
                <Select
                  placeholder="请选择部门"
                  options={[
                    { label: '实施交付部', value: '实施交付部' },
                    { label: '产品研发部', value: '产品研发部' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="得分">
                <InputNumber placeholder="0-100" min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="启用">
                <Switch checked={switchVal} onChange={setSwitchVal} />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary">提交</Button>
                  <Button>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Descriptions + 其他元素 */}
        <Col xs={24} lg={12}>
          <Title level={5}>Descriptions + Tag + Progress</Title>
          <Card style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="姓名">张三</Descriptions.Item>
              <Descriptions.Item label="部门">
                <Tag>实施交付部</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="考核类型">
                <Tag color="purple">业务人员</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status="processing" text="考核进行中" />
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">评价进度</Text>
                <Progress percent={73} status="active" />
              </div>
              <div>
                <Text type="secondary">积分完成度</Text>
                <Progress percent={100} />
              </div>
              <Space wrap>
                <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>
                <Tag icon={<SyncOutlined spin />} color="processing">进行中</Tag>
                <Tag color="warning">待审核</Tag>
                <Tag color="error">已驳回</Tag>
                <Tag color="default">未开始</Tag>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* ========== 快捷入口卡片（模拟 Dashboard 入口） ========== */}
      <Title level={5}>快捷入口卡片（Dashboard 风格）</Title>
      <Row gutter={[16, 16]}>
        {[
          { title: '员工管理', desc: '维护员工信息、批量导入', icon: <TeamOutlined />, color: '#5b8def' },
          { title: '项目管理', desc: '维护项目一览表、签约概率', icon: <ProjectOutlined />, color: '#13c2c2' },
          { title: '考核周期', desc: '创建/激活周期、切换阶段', icon: <CalendarOutlined />, color: '#722ed1' },
        ].map((item) => (
          <Col xs={24} sm={12} md={8} key={item.title}>
            <NeuCard hoverable>
              <Space align="start">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--neu-radius-sm)',
                    background: `${item.color}22`,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <Text strong>{item.title}</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                    {item.desc}
                  </Paragraph>
                </div>
              </Space>
            </NeuCard>
          </Col>
        ))}
      </Row>
    </div>
  );
}
