/**
 * 工作目标完成度评分页 ��— 领导/管理员可见。
 *
 * 功能：
 *   - 展示待评分的公共人员列表
 *   - 领导为公共人员打分（满分70分）+ 文字评语
 *   - 查看已有评分记录
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  Input,
  Tag,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FormOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { evaluationApi } from '@/services/api/evaluation';
import type { PublicEmployeeBrief, WorkGoalScore } from '@/types';
import { formatNumber } from '@/utils/format';

interface EmployeeWithScore extends PublicEmployeeBrief {
  existingScore?: WorkGoalScore;
}

export default function WorkGoalPage() {
  const { message } = AntdApp.useApp();

  const [employees, setEmployees] = useState<EmployeeWithScore[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empList, scores] = await Promise.all([
        evaluationApi.listPublicEmployees(),
        evaluationApi.listWorkGoals(),
      ]);
      // 合并已有评分到员工列表
      const scoreMap = new Map<number, WorkGoalScore>();
      scores.forEach((s) => scoreMap.set(s.employee_id, s));
      const merged: EmployeeWithScore[] = empList.map((e) => ({
        ...e,
        existingScore: scoreMap.get(e.id),
      }));
      setEmployees(merged);
    } catch {
      message.error('加载公共人员数据失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 评分弹窗
  const [scoreOpen, setScoreOpen] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<EmployeeWithScore | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const openScoring = (record: EmployeeWithScore) => {
    setCurrentEmp(record);
    if (record.existingScore) {
      form.setFieldsValue({
        score: Number(record.existingScore.score),
        comment: record.existingScore.comment || '',
      });
    } else {
      form.resetFields();
    }
    setScoreOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await evaluationApi.saveWorkGoal({
        employee_id: currentEmp!.id,
        score: values.score,
        comment: values.comment || null,
      });
      message.success('评分保存成功');
      setScoreOpen(false);
      loadData();
    } catch {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 表列
  const columns: ColumnsType<EmployeeWithScore> = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '部门', dataIndex: 'department', width: 110 },
    { title: '组/中心', dataIndex: 'group_name', width: 110, render: (v: string | null) => v || '-' },
    { title: '岗位', dataIndex: 'position', width: 100, render: (v: string | null) => v || '-' },
    {
      title: '评分状态',
      width: 100,
      align: 'center',
      render: (_: unknown, record: EmployeeWithScore) =>
        record.existingScore ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已评 {formatNumber(Number(record.existingScore.score))}
          </Tag>
        ) : (
          <Tag color="warning">待评分</Tag>
        ),
    },
    {
      title: '评语',
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: EmployeeWithScore) =>
        record.existingScore?.comment || '-',
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: EmployeeWithScore) => (
        <Button
          type="link"
          size="small"
          icon={<FormOutlined />}
          onClick={() => openScoring(record)}
        >
          {record.existingScore ? '修改' : '评分'}
        </Button>
      ),
    },
  ];

  const scoredCount = employees.filter((e) => e.existingScore).length;

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <span>工作目标完成度评分</span>
            <Tag color="success">已评 {scoredCount}/{employees.length}</Tag>
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
          dataSource={employees}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* 评分弹窗 */}
      <Modal
        title={currentEmp ? `工作目标完成度 - ${currentEmp.name}` : '评分'}
        open={scoreOpen}
        onCancel={() => setScoreOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="保存"
        destroyOnClose
      >
        {currentEmp && (
          <div style={{ marginBottom: 16, color: 'var(--neu-text-secondary, #666)' }}>
            {currentEmp.name}（{currentEmp.department}
            {currentEmp.group_name ? ` - ${currentEmp.group_name}` : ''}）
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            label="工作目标完成度得分（满分 70 分）"
            name="score"
            rules={[
              { required: true, message: '请输入评分' },
              { type: 'number', min: 0, max: 70, message: '评分范围 0 ~ 70' },
            ]}
          >
            <InputNumber min={0} max={70} step={1} precision={1} style={{ width: '100%' }} placeholder="0 ~ 70" />
          </Form.Item>
          <Form.Item label="文字评语" name="comment">
            <Input.TextArea rows={4} maxLength={1000} showCount placeholder="可选，输入评语..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
