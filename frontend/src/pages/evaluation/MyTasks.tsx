/**
 * 我的评价任���页 —— 所有登��用户可见。
 *
 * 功能：
 *   - 展示当前用户待完成 & 已完成的评价任务列表
 *   - 点击"评分"打开评分弹窗，按维度打分后提交
 *   - 已完成的可查看评分详情
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  InputNumber,
  Descriptions,
  Space,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FormOutlined, EyeOutlined } from '@ant-design/icons';
import { evaluationApi } from '@/services/api/evaluation';
import type { EvalRelation, EvalDimension, EvalScore } from '@/types';
import { formatNumber } from '@/utils/format';

export default function MyTasksPage() {
  const { message } = AntdApp.useApp();

  const [tasks, setTasks] = useState<EvalRelation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await evaluationApi.myTasks();
      setTasks(res);
    } catch {
      message.error('加载评价任务失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ==================== 评分弹窗 ====================
  const [scoreOpen, setScoreOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<EvalRelation | null>(null);
  const [dimensions, setDimensions] = useState<EvalDimension[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [scoreForm] = Form.useForm();

  const openScoring = async (record: EvalRelation) => {
    setCurrentTask(record);
    setScoreOpen(true);
    try {
      const dims = await evaluationApi.getDimensions(record.evaluatee_assess_type);
      setDimensions(dims);
      // 初始化表单字段
      const initial: Record<string, undefined> = {};
      dims.forEach((d) => {
        initial[d.dimension] = undefined;
      });
      scoreForm.setFieldsValue(initial);
    } catch {
      message.error('加载评分维度失败');
    }
  };

  const handleScoreSubmit = async () => {
    try {
      const values = await scoreForm.validateFields();
      setSubmitting(true);
      const scores = dimensions.map((d) => ({
        dimension: d.dimension,
        max_score: d.max_score,
        score: values[d.dimension],
      }));
      await evaluationApi.submitScores({
        relation_id: currentTask!.id,
        scores,
      });
      message.success('评分提交成功');
      setScoreOpen(false);
      scoreForm.resetFields();
      loadTasks();
    } catch {
      message.error('��分提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== 查看详情弹窗 ====================
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailScores, setDetailScores] = useState<EvalScore[]>([]);
  const [detailTask, setDetailTask] = useState<EvalRelation | null>(null);

  const openDetail = async (record: EvalRelation) => {
    setDetailTask(record);
    try {
      const res = await evaluationApi.getScoresByRelation(record.id);
      setDetailScores(res);
      setDetailOpen(true);
    } catch {
      message.error('加载评分详情失败');
    }
  };

  // 表列
  const columns: ColumnsType<EvalRelation> = [
    { title: '被评人', dataIndex: 'evaluatee_name', width: 100 },
    { title: '被评��考核类型', dataIndex: 'evaluatee_assess_type', width: 130 },
    {
      title: '评价人类型',
      dataIndex: 'evaluator_type',
      width: 120,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          '同事': 'blue',
          '上级领导': 'orange',
          '部门领导': 'red',
          '基层管理互评': 'purple',
          '部门员工': 'green',
        };
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'is_completed',
      width: 80,
      align: 'center',
      render: (v: boolean) =>
        v ? <Tag color="success">已完成</Tag> : <Tag color="processing">待评价</Tag>,
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: EvalRelation) =>
        record.is_completed ? (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            查看
          </Button>
        ) : (
          <Button type="link" size="small" icon={<FormOutlined />} onClick={() => openScoring(record)}>
            评分
          </Button>
        ),
    },
  ];

  const pendingCount = tasks.filter((t) => !t.is_completed).length;
  const completedCount = tasks.filter((t) => t.is_completed).length;

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <span>我的评价任务</span>
            <Tag color="processing">待评 {pendingCount}</Tag>
            <Tag color="success">已完成 {completedCount}</Tag>
          </Space>
        }
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* 评分弹窗 */}
      <Modal
        title={currentTask ? `评价 - ${currentTask.evaluatee_name}` : '评价'}
        open={scoreOpen}
        onCancel={() => {
          setScoreOpen(false);
          scoreForm.resetFields();
        }}
        onOk={handleScoreSubmit}
        confirmLoading={submitting}
        okText="提交评分"
        width={500}
        destroyOnClose
      >
        {currentTask && (
          <div style={{ marginBottom: 16, color: 'var(--neu-text-secondary, #666)' }}>
            被评人：<strong>{currentTask.evaluatee_name}</strong>，
            考核类型：{currentTask.evaluatee_assess_type}，
            您的角色：<Tag>{currentTask.evaluator_type}</Tag>
          </div>
        )}
        <Form form={scoreForm} layout="vertical">
          {dimensions.map((dim) => (
            <Form.Item
              key={dim.dimension}
              label={`${dim.dimension}（满分 ${Number(dim.max_score)} 分）`}
              name={dim.dimension}
              rules={[
                { required: true, message: `请输入${dim.dimension}的评分` },
                {
                  type: 'number',
                  max: Number(dim.max_score),
                  min: 0,
                  message: `评分范围 0 ~ ${Number(dim.max_score)}`,
                },
              ]}
            >
              <InputNumber
                min={0}
                max={Number(dim.max_score)}
                step={1}
                precision={1}
                style={{ width: '100%' }}
                placeholder={`0 ~ ${Number(dim.max_score)}`}
              />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {/* 查看评分详情弹窗 */}
      <Modal
        title={detailTask ? `���分详情 - ${detailTask.evaluatee_name}` : '评分详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={460}
      >
        <Descriptions column={1} bordered size="small">
          {detailScores.map((s) => (
            <Descriptions.Item key={s.dimension} label={`${s.dimension}（/${Number(s.max_score)}）`}>
              <strong>{formatNumber(Number(s.score))}</strong>
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Modal>
    </div>
  );
}
