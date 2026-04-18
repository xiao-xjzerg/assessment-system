/**
 * 评分汇总页 —— 管理员可见。
 *
 * 功能：
 *   - 触发评分汇总计算
 *   - 评分汇总列表查询（按员工/部门/考核类型筛选）
 *   - 重置评分（管理员可重置某条关系的评分）
 *   - 导出评分汇总 Excel
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
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalculatorOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { evaluationApi } from '@/services/api/evaluation';
import type { EvalSummary } from '@/types';
import { ALL_DEPARTMENTS, ALL_ASSESS_TYPES } from '@/utils/constants';
import { formatNumber, downloadBlob, extractFilename } from '@/utils/format';

export default function SummaryPage() {
  const { message, modal } = AntdApp.useApp();

  const [summaries, setSummaries] = useState<EvalSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{
    employee_name?: string;
    department?: string;
    assess_type?: string;
  }>({});

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (filter.employee_name) params.employee_name = filter.employee_name;
      if (filter.department) params.department = filter.department;
      if (filter.assess_type) params.assess_type = filter.assess_type;
      const res = await evaluationApi.listSummaries(params);
      setSummaries(res);
    } catch {
      message.error('加载评分汇总失败');
    } finally {
      setLoading(false);
    }
  }, [message, filter]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // 触发计算
  const [calculating, setCalculating] = useState(false);
  const handleCalculate = () => {
    modal.confirm({
      title: '确认触发评分汇总计算',
      content: '将根据已提交的评分记录重新计算加权汇总得分，是否继续？',
      okText: '确认计算',
      onOk: async () => {
        setCalculating(true);
        try {
          await evaluationApi.calculateSummaries();
          message.success('评分汇总计算完成');
          loadSummaries();
        } catch {
          message.error('评分汇总计算失败');
        } finally {
          setCalculating(false);
        }
      },
    });
  };

  // 导出
  const handleExport = async () => {
    try {
      const res = await evaluationApi.exportSummaries();
      const filename = extractFilename(res.headers?.['content-disposition'], '综合评价汇总.xlsx');
      downloadBlob(res.data, filename);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // 表列
  const columns: ColumnsType<EvalSummary> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100, fixed: 'left' },
    { title: '部门', dataIndex: 'department', width: 110 },
    { title: '岗位', dataIndex: 'position', width: 100, render: (v: string | null) => v || '-' },
    { title: '考核类型', dataIndex: 'assess_type', width: 120 },
    {
      title: '同事1',
      dataIndex: 'colleague1_score',
      width: 70,
      align: 'right',
      render: (v: number | string) => v ? formatNumber(Number(v)) : '-',
    },
    {
      title: '同事2',
      dataIndex: 'colleague2_score',
      width: 70,
      align: 'right',
      render: (v: number | string) => v ? formatNumber(Number(v)) : '-',
    },
    {
      title: '同事3',
      dataIndex: 'colleague3_score',
      width: 70,
      align: 'right',
      render: (v: number | string) => v ? formatNumber(Number(v)) : '-',
    },
    {
      title: '同事4',
      dataIndex: 'colleague4_score',
      width: 70,
      align: 'right',
      render: (v: number | string) => v ? formatNumber(Number(v)) : '-',
    },
    {
      title: '上级领导',
      dataIndex: 'superior_score',
      width: 85,
      align: 'right',
      render: (v: number | string) => v ? formatNumber(Number(v)) : '-',
    },
    {
      title: '部门领导',
      dataIndex: 'dept_leader_score',
      width: 85,
      align: 'right',
      render: (v: number | string) => v ? formatNumber(Number(v)) : '-',
    },
    {
      title: '加权总分',
      dataIndex: 'weighted_total',
      width: 90,
      align: 'right',
      render: (v: number | string) => (
        <span style={{ fontWeight: 600 }}>{formatNumber(Number(v))}</span>
      ),
    },
    {
      title: '最终得分(/30)',
      dataIndex: 'final_score',
      width: 110,
      align: 'right',
      fixed: 'right',
      render: (v: number | string) => (
        <Tag color="geekblue" style={{ fontWeight: 600 }}>{formatNumber(Number(v))}</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="综合评价汇总"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              loading={calculating}
              onClick={handleCalculate}
            >
              触发汇总计算
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Excel
            </Button>
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
            onPressEnter={loadSummaries}
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
          <Button type="primary" icon={<SearchOutlined />} onClick={loadSummaries}>
            查询
          </Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={summaries}
          loading={loading}
          scroll={{ x: 1200 }}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>
    </div>
  );
}
