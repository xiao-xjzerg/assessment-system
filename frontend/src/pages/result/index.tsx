/**
 * 最终考核成绩页 —— 管理员/领导可见。
 *
 * 功能：
 *   - 触发最终成绩全量计算
 *   - 成绩列表查询（按部门/考核类型/员工筛选）
 *   - 设置评定等级（管理员）
 *   - 编辑领导评语（管理员/领导）
 *   - 导出成绩总表（按类型分Sheet）
 *   - 全量导出（4 Sheet）
 *   - 确认考核完成并归档
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  Dropdown,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  CalculatorOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  EditOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { resultApi } from '@/services/api/result';
import type { FinalResult } from '@/types';
import { ALL_DEPARTMENTS, ALL_ASSESS_TYPES, RATING_LEVELS } from '@/utils/constants';
import { formatNumber, downloadBlob, extractFilename } from '@/utils/format';
import { useUserStore } from '@/stores/userStore';

export default function ResultPage() {
  const { message, modal } = AntdApp.useApp();
  const isAdmin = useUserStore((s) => s.isAdmin());

  const [results, setResults] = useState<FinalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{
    employee_name?: string;
    department?: string;
    assess_type?: string;
  }>({});

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (filter.employee_name) params.employee_name = filter.employee_name;
      if (filter.department) params.department = filter.department;
      if (filter.assess_type) params.assess_type = filter.assess_type;
      const res = await resultApi.list(params);
      setResults(res);
    } catch {
      message.error('加载最终成绩失败');
    } finally {
      setLoading(false);
    }
  }, [message, filter]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // ==================== 触发计算 ====================
  const [calculating, setCalculating] = useState(false);
  const handleCalculate = () => {
    modal.confirm({
      title: '确认触发最终成绩计算',
      content: '将根据积分、经济指标、评价、加减分等数据重新计算所有员工的最终成绩。是否继续？',
      okText: '确认计算',
      onOk: async () => {
        setCalculating(true);
        try {
          await resultApi.calculate();
          message.success('最终成绩计算完成');
          loadResults();
        } catch {
          message.error('计算失败');
        } finally {
          setCalculating(false);
        }
      },
    });
  };

  // ==================== 导出 ====================
  const handleExport = async () => {
    try {
      const res = await resultApi.exportExcel();
      const filename = extractFilename(res.headers?.['content-disposition'], '成绩总表.xlsx');
      downloadBlob(res.data, filename);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleExportAll = async () => {
    try {
      const res = await resultApi.exportAll();
      const filename = extractFilename(res.headers?.['content-disposition'], '全量报表.xlsx');
      downloadBlob(res.data, filename);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // ==================== 确认归档 ====================
  const handleConfirm = () => {
    modal.confirm({
      title: '确认考核完成',
      content: '确认后当前考核周期将归档，数据不可再修改。是否确认？',
      okText: '确认归档',
      okType: 'danger',
      onOk: async () => {
        try {
          await resultApi.confirm();
          message.success('考核已完成并归档');
        } catch {
          message.error('归档失败');
        }
      },
    });
  };

  // ==================== 设置评定等级 ====================
  const handleSetRating = (record: FinalResult, rating: string) => {
    modal.confirm({
      title: '设置评定等级',
      content: `确认将 ${record.employee_name} 的评定等级设为「${rating}」？`,
      onOk: async () => {
        try {
          await resultApi.setRating(record.id, rating);
          message.success('设置成功');
          loadResults();
        } catch {
          message.error('设置失败');
        }
      },
    });
  };

  // ==================== 编辑评语 Modal ====================
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentRecord, setCommentRecord] = useState<FinalResult | null>(null);
  const [commentForm] = Form.useForm();
  const [commentLoading, setCommentLoading] = useState(false);

  const openComment = (record: FinalResult) => {
    setCommentRecord(record);
    commentForm.setFieldsValue({ leader_comment: record.leader_comment || '' });
    setCommentOpen(true);
  };

  const handleCommentSubmit = async () => {
    try {
      const values = await commentForm.validateFields();
      setCommentLoading(true);
      await resultApi.setComment(commentRecord!.id, values.leader_comment);
      message.success('评语保存成功');
      setCommentOpen(false);
      loadResults();
    } catch {
      message.error('保存失败');
    } finally {
      setCommentLoading(false);
    }
  };

  // ==================== 表列 ====================
  const columns: ColumnsType<FinalResult> = [
    { title: '姓名', dataIndex: 'employee_name', width: 90, fixed: 'left' },
    { title: '部门', dataIndex: 'department', width: 100 },
    { title: '组/中心', dataIndex: 'group_name', width: 90, render: (v: string | null) => v || '-' },
    { title: '岗级', dataIndex: 'grade', width: 60, render: (v: string | null) => v || '-' },
    { title: '考核类型', dataIndex: 'assess_type', width: 110 },
    {
      title: '工作积分',
      dataIndex: 'work_score',
      width: 90,
      align: 'right',
      render: (v: number | string, r: FinalResult) =>
        `${formatNumber(Number(v))}/${Number(r.work_score_max)}`,
    },
    {
      title: '经济指标',
      dataIndex: 'economic_score',
      width: 90,
      align: 'right',
      render: (v: number | string, r: FinalResult) =>
        `${formatNumber(Number(v))}/${Number(r.economic_score_max)}`,
    },
    {
      title: '重点任务',
      dataIndex: 'key_task_score',
      width: 85,
      align: 'right',
      render: (v: number | string) => {
        const num = Number(v);
        return num > 0 ? formatNumber(num) + '/10' : '-';
      },
    },
    {
      title: '工作目标',
      dataIndex: 'work_goal_score',
      width: 85,
      align: 'right',
      render: (v: number | string) => {
        const num = Number(v);
        return num > 0 ? formatNumber(num) + '/70' : '-';
      },
    },
    {
      title: '综合评价',
      dataIndex: 'eval_score',
      width: 85,
      align: 'right',
      render: (v: number | string) => formatNumber(Number(v)) + '/30',
    },
    {
      title: '加减分',
      dataIndex: 'bonus_score',
      width: 75,
      align: 'right',
      render: (v: number | string) => {
        const num = Number(v);
        if (num === 0) return '-';
        return <Tag color={num > 0 ? 'success' : 'error'}>{num > 0 ? '+' : ''}{formatNumber(num)}</Tag>;
      },
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      width: 80,
      align: 'right',
      render: (v: number | string) => (
        <span style={{ fontWeight: 700, fontSize: 14 }}>{formatNumber(Number(v))}</span>
      ),
    },
    {
      title: '排名',
      dataIndex: 'ranking',
      width: 60,
      align: 'center',
      render: (v: number) => v > 0 ? v : '-',
    },
    {
      title: '等级',
      dataIndex: 'rating',
      width: 90,
      align: 'center',
      render: (v: string | null, record: FinalResult) => {
        if (!isAdmin) return v ? <Tag>{v}</Tag> : '-';
        const items: MenuProps['items'] = RATING_LEVELS.map((r) => ({
          key: r,
          label: r,
          onClick: () => handleSetRating(record, r),
        }));
        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button type="link" size="small">
              {v ? <Tag color={v === '优秀' ? 'gold' : v === '不合格' ? 'red' : 'blue'}>{v}</Tag> : '设置'}
            </Button>
          </Dropdown>
        );
      },
    },
    {
      title: '操作',
      width: 70,
      fixed: 'right',
      render: (_: unknown, record: FinalResult) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openComment(record)}>
          评语
        </Button>
      ),
    },
  ];

  // 导出下拉菜单
  const exportMenuItems: MenuProps['items'] = [
    { key: 'sheet', label: '成绩总表（按类型分Sheet）', onClick: handleExport },
    { key: 'all', label: '全量导出（4 Sheet）', onClick: handleExportAll },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="最终考核成绩"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Space>
            {isAdmin && (
              <>
                <Button
                  type="primary"
                  icon={<CalculatorOutlined />}
                  loading={calculating}
                  onClick={handleCalculate}
                >
                  触发计算
                </Button>
                <Dropdown menu={{ items: exportMenuItems }}>
                  <Button icon={<DownloadOutlined />}>导出</Button>
                </Dropdown>
                <Button
                  danger
                  icon={<CheckCircleOutlined />}
                  onClick={handleConfirm}
                >
                  确认归档
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="员工姓名"
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 160 }}
            value={filter.employee_name}
            onChange={(e) => setFilter((f) => ({ ...f, employee_name: e.target.value }))}
            onPressEnter={loadResults}
          />
          <Select
            placeholder="部门"
            allowClear
            style={{ width: 140 }}
            value={filter.department}
            onChange={(v) => setFilter((f) => ({ ...f, department: v }))}
            options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
          />
          <Select
            placeholder="考核类型"
            allowClear
            style={{ width: 150 }}
            value={filter.assess_type}
            onChange={(v) => setFilter((f) => ({ ...f, assess_type: v }))}
            options={ALL_ASSESS_TYPES.map((t) => ({ label: t, value: t }))}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={loadResults}>
            查询
          </Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={results}
          loading={loading}
          scroll={{ x: 1500 }}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* 编辑评语 Modal */}
      <Modal
        title={commentRecord ? `领导评语 - ${commentRecord.employee_name}` : '领导评语'}
        open={commentOpen}
        onCancel={() => setCommentOpen(false)}
        onOk={handleCommentSubmit}
        confirmLoading={commentLoading}
        destroyOnClose
      >
        <Form form={commentForm} layout="vertical">
          <Form.Item label="评语" name="leader_comment">
            <Input.TextArea rows={5} maxLength={1000} showCount placeholder="输入领导评语..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
