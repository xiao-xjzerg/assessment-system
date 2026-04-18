/**
 * 经济指标核算页 —— 管理员可见。
 *
 * 功能：
 *   - 触发经济指标全量计算
 *   - 经济指标明细查询（按员工/部门/组筛选）
 *   - 经济指标得分汇总查询（按部门/组筛选）
 *   - Excel 导出
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tabs,
  Tag,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalculatorOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { economicApi } from '@/services/api/economic';
import type { EconomicDetail, EconomicSummary } from '@/types';
import { ALL_DEPARTMENTS } from '@/utils/constants';
import { formatNumber, formatCoeff, downloadBlob, extractFilename } from '@/utils/format';

export default function EconomicPage() {
  const { message, modal } = AntdApp.useApp();

  // ==================== 明细 ====================
  const [details, setDetails] = useState<EconomicDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFilter, setDetailFilter] = useState<{
    employee_name?: string;
    department?: string;
    group_name?: string;
  }>({});

  const loadDetails = useCallback(async () => {
    setDetailLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (detailFilter.employee_name) params.employee_name = detailFilter.employee_name;
      if (detailFilter.department) params.department = detailFilter.department;
      if (detailFilter.group_name) params.group_name = detailFilter.group_name;
      const res = await economicApi.listDetails(params);
      setDetails(res);
    } catch {
      message.error('加载经济指标明细失败');
    } finally {
      setDetailLoading(false);
    }
  }, [message, detailFilter]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // ==================== 汇总 ====================
  const [summaries, setSummaries] = useState<EconomicSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<{
    department?: string;
    group_name?: string;
  }>({});

  const loadSummaries = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (summaryFilter.department) params.department = summaryFilter.department;
      if (summaryFilter.group_name) params.group_name = summaryFilter.group_name;
      const res = await economicApi.listSummary(params);
      setSummaries(res);
    } catch {
      message.error('加载经济指标汇总失败');
    } finally {
      setSummaryLoading(false);
    }
  }, [message, summaryFilter]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // ==================== 触发计算 ====================
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = () => {
    modal.confirm({
      title: '确认触发经济指标计算',
      content: '将重新计算当前周期所有员工的经济指标得分，是否继续？',
      okText: '确认计算',
      onOk: async () => {
        setCalculating(true);
        try {
          await economicApi.calculate();
          message.success('经济指标计算完成');
          loadDetails();
          loadSummaries();
        } catch {
          message.error('经济指标计算失败');
        } finally {
          setCalculating(false);
        }
      },
    });
  };

  // ==================== 导出 Excel ====================
  const handleExport = async () => {
    try {
      const res = await economicApi.exportExcel();
      const filename = extractFilename(
        res.headers?.['content-disposition'],
        '经济指标核算.xlsx',
      );
      downloadBlob(res.data, filename);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // ==================== 明细表列 ====================
  const detailColumns: ColumnsType<EconomicDetail> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100, fixed: 'left' },
    { title: '部门', dataIndex: 'department', width: 110 },
    { title: '组/中心', dataIndex: 'group_name', width: 100, render: (v: string | null) => v || '-' },
    { title: '岗级', dataIndex: 'grade', width: 70, render: (v: string | null) => v || '-' },
    { title: '考核类型', dataIndex: 'assess_type', width: 120 },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '指标类型',
      dataIndex: 'indicator_type',
      width: 110,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          '利润': 'green',
          '自研收入': 'blue',
          '产品合同': 'purple',
          '科技创新': 'orange',
        };
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
      },
    },
    {
      title: '原始值',
      dataIndex: 'raw_value',
      width: 100,
      align: 'right',
      render: (v: number) => formatNumber(v),
    },
    {
      title: '参与系数',
      dataIndex: 'participation_coeff',
      width: 90,
      align: 'right',
      render: (v: number) => formatCoeff(v),
    },
    {
      title: '完成值',
      dataIndex: 'completed_value',
      width: 100,
      align: 'right',
      render: (v: number) => formatNumber(v),
    },
    {
      title: '目标值',
      dataIndex: 'target_value',
      width: 100,
      align: 'right',
      render: (v: number) => formatNumber(v),
    },
    {
      title: '指标系数',
      dataIndex: 'indicator_coeff',
      width: 90,
      align: 'right',
      render: (v: number) => formatCoeff(v),
    },
    {
      title: '满分',
      dataIndex: 'full_mark',
      width: 70,
      align: 'right',
      render: (v: number) => formatNumber(v),
    },
    {
      title: '得分',
      dataIndex: 'score',
      width: 80,
      align: 'right',
      fixed: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 600 }}>{formatNumber(v)}</span>
      ),
    },
  ];

  // ==================== 汇总表列 ====================
  const summaryColumns: ColumnsType<EconomicSummary> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100, fixed: 'left' },
    { title: '部门', dataIndex: 'department', width: 120 },
    { title: '组/中心', dataIndex: 'group_name', width: 110, render: (v: string | null) => v || '-' },
    { title: '岗级', dataIndex: 'grade', width: 70, render: (v: string | null) => v || '-' },
    { title: '考核类型', dataIndex: 'assess_type', width: 120 },
    {
      title: '经济指标总分',
      dataIndex: 'total_score',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <Tag color="geekblue" style={{ fontWeight: 600 }}>{formatNumber(v)}</Tag>
      ),
    },
  ];

  // ==================== 渲染 ====================
  return (
    <div style={{ padding: 24 }}>
      <Card
        title="经济指标核算"
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
              触发计算
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Excel
            </Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="details"
          items={[
            {
              key: 'details',
              label: '核算明细',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Input
                      placeholder="员工姓名"
                      allowClear
                      prefix={<SearchOutlined />}
                      style={{ width: 160 }}
                      value={detailFilter.employee_name}
                      onChange={(e) =>
                        setDetailFilter((f) => ({ ...f, employee_name: e.target.value }))
                      }
                      onPressEnter={loadDetails}
                    />
                    <Select
                      placeholder="部门"
                      allowClear
                      style={{ width: 140 }}
                      value={detailFilter.department}
                      onChange={(v) => setDetailFilter((f) => ({ ...f, department: v }))}
                      options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
                    />
                    <Input
                      placeholder="组/中心"
                      allowClear
                      style={{ width: 140 }}
                      value={detailFilter.group_name}
                      onChange={(e) =>
                        setDetailFilter((f) => ({ ...f, group_name: e.target.value }))
                      }
                      onPressEnter={loadDetails}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadDetails}>
                      查询
                    </Button>
                  </Space>
                  <Table
                    rowKey={(r) => `${r.employee_id}-${r.project_name}-${r.indicator_type}`}
                    columns={detailColumns}
                    dataSource={details}
                    loading={detailLoading}
                    scroll={{ x: 1600 }}
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                  />
                </>
              ),
            },
            {
              key: 'summary',
              label: '得分汇总',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Select
                      placeholder="部门"
                      allowClear
                      style={{ width: 140 }}
                      value={summaryFilter.department}
                      onChange={(v) => setSummaryFilter((f) => ({ ...f, department: v }))}
                      options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
                    />
                    <Input
                      placeholder="组/中心"
                      allowClear
                      style={{ width: 140 }}
                      value={summaryFilter.group_name}
                      onChange={(e) =>
                        setSummaryFilter((f) => ({ ...f, group_name: e.target.value }))
                      }
                      onPressEnter={loadSummaries}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadSummaries}>
                      查询
                    </Button>
                  </Space>
                  <Table
                    rowKey="employee_id"
                    columns={summaryColumns}
                    dataSource={summaries}
                    loading={summaryLoading}
                    scroll={{ x: 700 }}
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
