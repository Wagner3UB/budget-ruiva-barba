export const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export const money = (v) => EUR.format(Number(v) || 0)

export const CYCLE_START = 10
export function periodKey(dateISO) {
  if (!dateISO) return ''
  const parts = String(dateISO).slice(0, 10).split('-').map(Number)
  const y = parts[0], m = parts[1], d = parts[2]
  if (!y || !m) return String(dateISO).slice(0, 7)
  if (d >= CYCLE_START) return `${y}-${String(m).padStart(2, '0')}`
  let py = y, pm = m - 1
  if (pm === 0) { pm = 12; py = y - 1 }
  return `${py}-${String(pm).padStart(2, '0')}`
}
export const inPeriod = (dateISO, key) => periodKey(dateISO) === key
export const shiftMonth = (key, delta) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }


export const monthKey = () => periodKey(new Date().toISOString().slice(0, 10))

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

// Disponível de uma pessoa = saldo inicial + entradas − saídas (até o mês, cumulativo)
export function disponivelOf(person, { incomes = [], expenses = [], balances = [] }, month) {
  const opening = Number(balances.find((b) => b.person === person)?.opening || 0)
  const inc = incomes
    .filter((i) => i.person === person && (!month || i.month <= month))
    .reduce((s, i) => s + Number(i.amount), 0)
  const out = expenses
    .filter((e) => e.paid_by === person && counted(e) && (!month || periodKey(e.date) <= month))
    .reduce((s, e) => s + Number(e.amount), 0)
  return opening + inc - out
}

// Saldo de um cofrinho ('casa' | 'nathi') no ano = inicial + depósitos − taxas pagas
export const PIGGY_PERSON = { casa: 'Gui', nathi: 'Nathi' }

export function cofrinhoBalance(piggy, data, year) {
  const { piggyYear = [], houseTaxes = [], taxPayments = [], expenses = [] } = data
  const person = PIGGY_PERSON[piggy] || 'Gui'
  const inYear = (d) => Number((d || '').slice(0, 4)) === year
  const opening = Number(piggyYear.find((y) => y.year === year && (y.piggy || 'casa') === piggy)?.opening || 0)
  // aportes = gastos marcados "à poupança" + depósitos manuais, por pessoa
  const aportes = expenses
    .filter((e) => (e.to_reserve || e.piggy_deposit) && e.paid_by === person && inYear(e.date))
    .reduce((s, e) => s + Number(e.amount), 0)
  const itemIds = new Set(houseTaxes.filter((t) => t.year === year && (t.piggy || 'casa') === piggy).map((t) => t.id))
  const paid = taxPayments
    .filter((p) => itemIds.has(p.tax_id) && p.paid)
    .reduce((s, p) => s + Number(p.amount), 0)
  return opening + aportes - paid
}

// Converte "2.120,36" / "350,03" / "1000.50" em número. Retorna NaN se inválido.
export function parseAmount(v) {
  if (v == null) return 0
  let s = String(v).trim()
  if (!s) return 0
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // milhar (.) fora, vírgula -> ponto
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

// 'YYYY-MM-DD' -> 'DD/MM/AAAA'
export const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
