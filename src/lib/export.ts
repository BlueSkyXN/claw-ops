// CSV 数据导出工具

export function exportToCSV(filename: string, headers: string[], rows: string[][]): void {
  // Add BOM for Chinese character support in Excel
  const BOM = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Export specific data types
export function exportTasks(tasks: Array<{id: string, title: string, state: string, priority: string, assigneeName: string, tokensUsed: number, elapsedMinutes: number, createdAt: string, updatedAt: string}>) {
  exportToCSV('tasks-export.csv',
    ['任务ID', '标题', '状态', '优先级', '负责人', 'Token消耗', '耗时(分钟)', '创建时间', '更新时间'],
    tasks.map(t => [t.id, t.title, t.state, t.priority, t.assigneeName, String(t.tokensUsed), String(t.elapsedMinutes), t.createdAt, t.updatedAt])
  )
}

export function exportLogs(logs: Array<{id: string, timestamp: string, level: string, source: string, message: string, taskId?: string}>) {
  exportToCSV('logs-export.csv',
    ['日志ID', '时间', '级别', '来源', '关联任务', '内容'],
    logs.map(l => [l.id, l.timestamp, l.level, l.source, l.taskId || '', l.message])
  )
}

export function exportAgentMetrics(agents: Array<{id: string, name: string, status: string, metrics: {tokensConsumed: number, tasksCompleted: number, avgResponseTime: number, successRate: number}}>) {
  exportToCSV('agents-export.csv',
    ['智能体ID', '名称', '状态', 'Token消耗', '完成任务数', '平均响应(秒)', '成功率'],
    agents.map(a => [a.id, a.name, a.status, String(a.metrics.tokensConsumed), String(a.metrics.tasksCompleted), String(a.metrics.avgResponseTime), String(a.metrics.successRate)])
  )
}
