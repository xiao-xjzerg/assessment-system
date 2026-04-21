/**
 * 项目管理页 —— 仅管理员可见。
 *
 * 功能：
 *   - 列表查询（项目名/令号搜索 + 项目类型/部门/状态筛选 + 分页）
 *   - 新增 / 编辑（Modal 表单：基本字段 + 金额 + 进度系数 + 项目经理）
 *   - 删除（Popconfirm）
 *   - Excel 导入（含「全量更新」选项）
 *   - 下载模板
 *   - 签约概率设置（Drawer：列出未签约项目，行内可编辑概率，统一保存触发后端重算经济规模系数）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Form,
  Modal,
  Popconfirm,
  Tag,
  Tooltip,
  InputNumber,
  DatePicker,
  Drawer,
  Upload,
  Switch,
  App as AntdApp,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  PercentageOutlined,
} from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd/es/upload/interface';
import dayjs, { Dayjs } from 'dayjs';
import { projectApi } from '@/services/api/project';
import { parameterApi } from '@/services/api/parameter';
import type {
  Project,
  ProjectCreate,
  ProjectListQuery,
  SigningProbabilityItem,
  ImportResult,
} from '@/types';
import {
  IMPL_METHODS,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '@/utils/constants';
import { downloadBlob, extractFilename, formatCoeff, formatMoney } from '@/utils/format';

interface FormValues {
  project_code: string;
  project_name: string;
  project_type: string;
  impl_method?: string;
  department?: string;
  customer_name?: string;
  date_range?: [Dayjs | null, Dayjs | null];
  contract_amount?: number;
  project_profit?: number;
  self_dev_income?: number;
  product_contract_amount?: number;
  current_period_profit?: number;
  current_period_self_dev_income?: number;
  presale_progress?: number;
  delivery_progress?: number;
  pm_name?: string;
  project_status?: string;
}

const PROJECT_STATUS_OPTIONS = ['进行中', '已签约', '未签约', '已结项', '已暂停'];

export default function ProjectPage() {
  const { message, modal } = AntdApp.useApp();

  const [data, setData] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [filter, setFilter] = useState<{
    search?: string;
    project_type?: string;
    department?: string;
    project_status?: string;
  }>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const [importOpen, setImportOpen] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [importReimport, setImportReimport] = useState(false);
  const [importing, setImporting] = useState(false);

  // 签约概率 Drawer
  const [spOpen, setSpOpen] = useState(false);
  const [spLoading, setSpLoading] = useState(false);
  const [spSaving, setSpSaving] = useState(false);
  const [spList, setSpList] = useState<Project[]>([]);
  const [spProbMap, setSpProbMap] = useState<Record<number, number>>({});

  // 项目类型下拉来源：当前周期的「项目类型系数表」，由管理员在考核参数页维护
  const [projectTypeOptions, setProjectTypeOptions] = useState<string[]>([]);

  useEffect(() => {
    parameterApi
      .listProjectTypeCoeffs()
      .then((list) =>
        setProjectTypeOptions(list.map((c) => c.project_type))
      )
      .catch(() => undefined);
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const query: ProjectListQuery = {
        page,
        page_size: pageSize,
        ...filter,
      };
      const resp = await projectApi.list(query);
      setData(resp.items);
      setTotal(resp.total);
    } catch {
      // 错误已由拦截器处理
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ---- 表单：新增 / 编辑 ----
  // 预填策略：Modal 使用 destroyOnClose，Form 每次打开时重新挂载并读取 initialValues。
  // openCreate/openEdit 只负责切状态，不再手动调 form.setFieldsValue / resetFields。
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: Project) => {
    setEditing(row);
    setFormOpen(true);
  };

  const initialFormValues = useMemo<Partial<FormValues>>(() => {
    if (!editing) {
      return {
        project_status: '进行中',
        contract_amount: 0,
        project_profit: 0,
        self_dev_income: 0,
        product_contract_amount: 0,
        current_period_profit: 0,
        current_period_self_dev_income: 0,
        presale_progress: 0,
        delivery_progress: 0,
      };
    }
    return {
      project_code: editing.project_code,
      project_name: editing.project_name,
      project_type: editing.project_type,
      impl_method: editing.impl_method ?? undefined,
      department: editing.department ?? undefined,
      customer_name: editing.customer_name ?? undefined,
      date_range: [
        editing.start_date ? dayjs(editing.start_date) : null,
        editing.end_date ? dayjs(editing.end_date) : null,
      ],
      contract_amount: Number(editing.contract_amount) || 0,
      project_profit: Number(editing.project_profit) || 0,
      self_dev_income: Number(editing.self_dev_income) || 0,
      product_contract_amount: Number(editing.product_contract_amount) || 0,
      current_period_profit: Number(editing.current_period_profit) || 0,
      current_period_self_dev_income: Number(editing.current_period_self_dev_income) || 0,
      presale_progress: Number(editing.presale_progress) || 0,
      delivery_progress: Number(editing.delivery_progress) || 0,
      pm_name: editing.pm_name ?? undefined,
      project_status: editing.project_status ?? '进行中',
    };
  }, [editing]);

  const onSubmitForm = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const [start, end] = values.date_range || [null, null];
      const payload: ProjectCreate = {
        project_code: values.project_code,
        project_name: values.project_name,
        project_type: values.project_type,
        impl_method: values.impl_method || null,
        department: values.department || null,
        customer_name: values.customer_name || null,
        start_date: start ? start.toISOString() : null,
        end_date: end ? end.toISOString() : null,
        contract_amount: values.contract_amount ?? 0,
        project_profit: values.project_profit ?? 0,
        self_dev_income: values.self_dev_income ?? 0,
        product_contract_amount: values.product_contract_amount ?? 0,
        current_period_profit: values.current_period_profit ?? 0,
        current_period_self_dev_income: values.current_period_self_dev_income ?? 0,
        presale_progress: values.presale_progress ?? 0,
        delivery_progress: values.delivery_progress ?? 0,
        pm_name: values.pm_name || null,
        project_status: values.project_status || '进行中',
      };
      if (editing) {
        // 编辑时不应改 project_code
        const { project_code: _ignored, ...rest } = payload;
        void _ignored;
        await projectApi.update(editing.id, rest);
        message.success('项目已更新');
      } else {
        await projectApi.create(payload);
        message.success('项目已创建');
      }
      setFormOpen(false);
      fetchList();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
    } finally {
      setSubmitting(false);
    }
  };

  // ---- 删除 ----
  const onDelete = async (row: Project) => {
    try {
      await projectApi.remove(row.id);
      message.success('已删除');
      if (data.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchList();
      }
    } catch {
      // 错误已展示
    }
  };

  // ---- 模板下载 ----
  const onDownloadTemplate = async () => {
    try {
      const resp = await projectApi.downloadTemplate();
      const filename = extractFilename(
        resp.headers['content-disposition'] as string | undefined,
        'project_template.xlsx',
      );
      downloadBlob(resp.data, filename);
    } catch {
      message.error('模板下载失败');
    }
  };

  // ---- Excel 导入 ----
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const ok = /\.(xlsx|xls)$/i.test(file.name);
    if (!ok) {
      message.error('请上传 Excel 文件（.xlsx）');
      return Upload.LIST_IGNORE;
    }
    setImportFileList([file as unknown as UploadFile]);
    return false;
  };

  const handleImport = async () => {
    if (importFileList.length === 0) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    const file = importFileList[0] as unknown as File;
    setImporting(true);
    try {
      const result: ImportResult = await projectApi.importExcel(
        file,
        importReimport,
      );
      message.success(`成功导入 ${result.success_count} 条记录`);
      if (result.errors && result.errors.length > 0) {
        modal.warning({
          title: '部分记录导入失败',
          content: (
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12 }}>
                  {e}
                </div>
              ))}
            </div>
          ),
        });
      } else if (result.warnings && result.warnings.length > 0) {
        modal.warning({
          title: '导入成功，存在提示',
          content: (
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {w}
                </div>
              ))}
            </div>
          ),
        });
      }
      setImportOpen(false);
      setImportFileList([]);
      setImportReimport(false);
      fetchList();
    } catch {
      // 错误已展示
    } finally {
      setImporting(false);
    }
  };

  // ---- 签约概率 ----
  const openSigningProb = async () => {
    setSpOpen(true);
    setSpLoading(true);
    try {
      const list = await parameterApi.listSigningProbabilities();
      setSpList(list);
      const map: Record<number, number> = {};
      list.forEach((p) => {
        map[p.id] = Number(p.signing_probability) || 0;
      });
      setSpProbMap(map);
    } catch {
      // 错误已展示
    } finally {
      setSpLoading(false);
    }
  };

  const saveSigningProb = async () => {
    setSpSaving(true);
    try {
      const items: SigningProbabilityItem[] = spList.map((p) => ({
        project_id: p.id,
        signing_probability: spProbMap[p.id] ?? 0,
      }));
      await parameterApi.saveSigningProbabilities(items);
      message.success('签约概率已保存，已重新计算经济规模系数');
      setSpOpen(false);
      fetchList();
    } catch {
      // 错误已展示
    } finally {
      setSpSaving(false);
    }
  };

  // ---- 表格列 ----
  const columns: ColumnsType<Project> = useMemo(
    () => [
      { title: '项目令号', dataIndex: 'project_code', width: 140, fixed: 'left' },
      {
        title: '项目名称',
        dataIndex: 'project_name',
        width: 240,
        ellipsis: true,
      },
      {
        title: '类型',
        dataIndex: 'project_type',
        width: 90,
        render: (v: string) => <Tag color="cyan">{v}</Tag>,
      },
      {
        title: '主承部门',
        dataIndex: 'department',
        width: 120,
        render: (v) => v || '-',
      },
      {
        title: '项目经理',
        dataIndex: 'pm_name',
        width: 140,
        render: (v: string | null, row: Project) => {
          if (!v) return '-';
          if (row.pm_missing) {
            return (
              <Tooltip title="该姓名在员工信息表中不存在或存在同名冲突，无法赋予项目经理权限">
                <Space direction="vertical" size={0}>
                  <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{v}</span>
                  <span style={{ fontSize: 11, color: '#ff4d4f' }}>缺少员工信息</span>
                </Space>
              </Tooltip>
            );
          }
          return v;
        },
      },
      {
        title: '合同金额(万)',
        dataIndex: 'contract_amount',
        width: 120,
        align: 'right',
        render: (v) => formatMoney(v),
      },
      {
        title: '利润(万)',
        dataIndex: 'project_profit',
        width: 110,
        align: 'right',
        render: (v) => formatMoney(v),
      },
      {
        title: '当期确认利润(万)',
        dataIndex: 'current_period_profit',
        width: 140,
        align: 'right',
        render: (v) => formatMoney(v),
      },
      {
        title: '当期确认自研收入(万)',
        dataIndex: 'current_period_self_dev_income',
        width: 160,
        align: 'right',
        render: (v) => formatMoney(v),
      },
      {
        title: '签约概率',
        dataIndex: 'signing_probability',
        width: 100,
        align: 'right',
        render: (v) => `${(Number(v) * 100).toFixed(0)}%`,
      },
      {
        title: '工作量系数',
        dataIndex: 'workload_coeff',
        width: 110,
        align: 'right',
        render: (v) => formatCoeff(v),
      },
      {
        title: '状态',
        dataIndex: 'project_status',
        width: 100,
        render: (v) => <Tag>{v || '-'}</Tag>,
      },
      {
        title: '操作',
        key: 'action',
        width: 160,
        fixed: 'right',
        render: (_v, row) => (
          <Space size={4}>
            <Button
              size="small"
              type="link"
              icon={<EditOutlined />}
              onClick={() => openEdit(row)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除该项目？"
              description="删除后将级联影响参与度与积分明细，请谨慎操作。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(row)}
            >
              <Button
                size="small"
                type="link"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const onTableChange = (p: TablePaginationConfig) => {
    if (p.current && p.current !== page) setPage(p.current);
    if (p.pageSize && p.pageSize !== pageSize) {
      setPageSize(p.pageSize);
      setPage(1);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="项目管理"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Space>
            <Button icon={<PercentageOutlined />} onClick={openSigningProb}>
              签约概率设置
            </Button>
            <Button icon={<DownloadOutlined />} onClick={onDownloadTemplate}>
              下载模板
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              导入 Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增项目
            </Button>
          </Space>
        }
      >
        {/* 筛选区 */}
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="项目名称 / 令号"
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            value={filter.search}
            onChange={(e) =>
              setFilter((f) => ({ ...f, search: e.target.value }))
            }
            onPressEnter={() => {
              setPage(1);
              fetchList();
            }}
          />
          <Select
            placeholder="项目类型"
            allowClear
            style={{ width: 160 }}
            value={filter.project_type}
            options={projectTypeOptions.map((t) => ({ label: t, value: t }))}
            onChange={(v) => {
              setFilter((f) => ({ ...f, project_type: v }));
              setPage(1);
            }}
          />
          <Input
            placeholder="主承部门"
            allowClear
            style={{ width: 160 }}
            value={filter.department}
            onChange={(e) =>
              setFilter((f) => ({ ...f, department: e.target.value }))
            }
            onPressEnter={() => {
              setPage(1);
              fetchList();
            }}
          />
          <Select
            placeholder="项目状态"
            allowClear
            style={{ width: 140 }}
            value={filter.project_status}
            options={PROJECT_STATUS_OPTIONS.map((s) => ({ label: s, value: s }))}
            onChange={(v) => {
              setFilter((f) => ({ ...f, project_status: v }));
              setPage(1);
            }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPage(1);
              fetchList();
            }}
          >
            查询
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setFilter({});
              setPage(1);
            }}
          >
            重置
          </Button>
        </Space>

        <Table<Project>
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          scroll={{ x: 1800 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={onTableChange}
        />
      </Card>

      {/* 新增 / 编辑表单 */}
      <Modal
        title={editing ? '编辑项目' : '新增项目'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={onSubmitForm}
        confirmLoading={submitting}
        destroyOnClose
        width={760}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          autoComplete="off"
          preserve={false}
          initialValues={initialFormValues}
        >
          <Space.Compact block>
            <Form.Item
              label="项目令号"
              name="project_code"
              rules={[{ required: true, message: '请输入项目令号' }]}
              style={{ flex: 1, marginRight: 8 }}
            >
              <Input
                placeholder="项目令号"
                maxLength={50}
                disabled={!!editing}
              />
            </Form.Item>
            <Form.Item
              label="项目状态"
              name="project_status"
              style={{ flex: 1 }}
            >
              <Select
                placeholder="项目状态"
                options={PROJECT_STATUS_OPTIONS.map((s) => ({
                  label: s,
                  value: s,
                }))}
              />
            </Form.Item>
          </Space.Compact>

          <Form.Item
            label="项目名称"
            name="project_name"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="项目名称" maxLength={200} />
          </Form.Item>

          <Space.Compact block>
            <Form.Item
              label="项目类型"
              name="project_type"
              rules={[{ required: true, message: '请选择项目类型' }]}
              style={{ flex: 1, marginRight: 8 }}
            >
              <Select
                placeholder="请在考核参数页维护项目类型系数表"
                options={projectTypeOptions.map((t) => ({ label: t, value: t }))}
                notFoundContent="请先在考核参数页配置项目类型系数"
              />
            </Form.Item>
            <Form.Item label="实施方式" name="impl_method" style={{ flex: 1 }}>
              <Select
                allowClear
                placeholder="实施方式"
                options={IMPL_METHODS.map((m) => ({ label: m, value: m }))}
              />
            </Form.Item>
          </Space.Compact>

          <Space.Compact block>
            <Form.Item
              label="主承部门"
              name="department"
              style={{ flex: 1, marginRight: 8 }}
            >
              <Input placeholder="主承部门" maxLength={50} />
            </Form.Item>
            <Form.Item label="项目经理" name="pm_name" style={{ flex: 1 }}>
              <Input placeholder="项目经理姓名" maxLength={50} />
            </Form.Item>
          </Space.Compact>

          <Form.Item label="客户名称" name="customer_name">
            <Input placeholder="可选" maxLength={200} />
          </Form.Item>

          <Form.Item label="项目周期" name="date_range">
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Space.Compact block>
            <Form.Item
              label="合同金额(万元)"
              name="contract_amount"
              style={{ flex: 1, marginRight: 8 }}
            >
              <InputNumber
                min={0}
                step={1}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
            <Form.Item
              label="项目利润(万元)"
              name="project_profit"
              style={{ flex: 1 }}
            >
              <InputNumber
                step={1}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
          </Space.Compact>

          <Space.Compact block>
            <Form.Item
              label="自研收入(万元)"
              name="self_dev_income"
              style={{ flex: 1, marginRight: 8 }}
            >
              <InputNumber
                min={0}
                step={1}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
            <Form.Item
              label="产品合同金额(万元)"
              name="product_contract_amount"
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                step={1}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
          </Space.Compact>

          <Space.Compact block>
            <Form.Item
              label="当期确认项目利润(万元)"
              name="current_period_profit"
              style={{ flex: 1, marginRight: 8 }}
            >
              <InputNumber
                step={1}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
            <Form.Item
              label="当期确认自研收入(万元)"
              name="current_period_self_dev_income"
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                step={1}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
          </Space.Compact>

          <Space.Compact block>
            <Form.Item
              label="售前活动进度系数"
              name="presale_progress"
              style={{ flex: 1, marginRight: 8 }}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.1}
                precision={4}
                style={{ width: '100%' }}
                placeholder="0 ~ 1"
              />
            </Form.Item>
            <Form.Item
              label="交付活动进度系数"
              name="delivery_progress"
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.1}
                precision={4}
                style={{ width: '100%' }}
                placeholder="0 ~ 1"
              />
            </Form.Item>
          </Space.Compact>
        </Form>
      </Modal>

      {/* 导入 Excel */}
      <Modal
        title="导入项目 Excel"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={handleImport}
        confirmLoading={importing}
        okText="开始导入"
        cancelText="取消"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Upload.Dragger
            beforeUpload={beforeUpload}
            fileList={importFileList}
            onRemove={() => setImportFileList([])}
            maxCount={1}
            accept=".xlsx,.xls"
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 Excel 文件到此处</p>
            <p className="ant-upload-hint">
              仅支持 .xlsx 格式，单次最多 1 个文件
            </p>
          </Upload.Dragger>
          <Space>
            <Switch
              checked={importReimport}
              onChange={setImportReimport}
              checkedChildren="全量更新"
              unCheckedChildren="增量导入"
            />
            <span style={{ fontSize: 12, color: '#999' }}>
              {importReimport
                ? '会清空当前周期已有项目后再导入'
                : '只新增不存在的项目，重复令号会被跳过'}
            </span>
          </Space>
        </Space>
      </Modal>

      {/* 签约概率设置 Drawer */}
      <Drawer
        title="未签约项目签约概率设置"
        width={720}
        open={spOpen}
        onClose={() => setSpOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setSpOpen(false)}>取消</Button>
            <Button type="primary" loading={spSaving} onClick={saveSigningProb}>
              保存
            </Button>
          </Space>
        }
      >
        <p style={{ color: '#999', fontSize: 12 }}>
          仅对状态为「未签约」的项目生效。保存后系统会按概率重算经济规模系数。
        </p>
        <Table<Project>
          rowKey="id"
          loading={spLoading}
          dataSource={spList}
          pagination={false}
          size="small"
          columns={[
            { title: '项目令号', dataIndex: 'project_code', width: 130 },
            {
              title: '项目名称',
              dataIndex: 'project_name',
              ellipsis: true,
            },
            {
              title: '合同金额(万)',
              dataIndex: 'contract_amount',
              width: 110,
              align: 'right',
              render: (v) => formatMoney(v),
            },
            {
              title: '签约概率',
              key: 'prob',
              width: 140,
              render: (_v, row) => (
                <InputNumber
                  min={0}
                  max={1}
                  step={0.1}
                  precision={2}
                  value={spProbMap[row.id] ?? 0}
                  onChange={(v) =>
                    setSpProbMap((m) => ({ ...m, [row.id]: Number(v) || 0 }))
                  }
                  style={{ width: '100%' }}
                />
              ),
            },
          ]}
          locale={{ emptyText: '当前周期暂无未签约项目' }}
        />
      </Drawer>
    </div>
  );
}
