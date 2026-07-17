export const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export const money = (v) => EUR.format(Number(v) || 0)

export const monthKey = (date) => {
  const d = date ? new Date(date) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const monthLabel = (key) => {
  const [y, m] = key.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

// Paleta usada nos gráficos por categoria
export const PALETTE = [
  '#0f766e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6',
  '#ec4899', '#10b981', '#f97316', '#6366f1', '#14b8a6',
  '#eab308', '#64748b',
]

// Gastos marcados como "Não contabilizado" nao entram nas somas
export const counted = (e) => (e.pay_status ?? 'Não') !== 'Não contabilizado'

// Numero de dias de um mes 'YYYY-MM'
export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// Um modelo fixo esta ativo no mes?
export const fixedActiveIn = (f, month) =>
  f.active && f.start_month <= month && (!f.end_month || month <= f.end_month)
