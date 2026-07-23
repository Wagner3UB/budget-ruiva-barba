import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { money, monthLabel, PALETTE, counted, periodKey } from '../lib/helpers'
import KpiSummary from './KpiSummary'

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard(props) {
  const dark = props.theme === 'dark'
  const { categories, expenses, monthExpenses, month, setMonth } = props
  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const total = monthExpenses.filter((e) => counted(e) && !e.piggy_deposit).reduce((s, e) => s + Number(e.amount), 0)
  const idealTotal = categories.reduce((s, c) => s + Number(c.ideal || 0), 0)

  const byCategory = useMemo(() => {
    const m = {}
    for (const e of monthExpenses) {
      if (!counted(e) || e.piggy_deposit) continue
      const c = catById[e.category_id]
      const name = c ? c.name : 'Sem categoria'
      m[name] = m[name] || { name, value: 0, color: c?.color }
      m[name].value += Number(e.amount)
    }
    return Object.values(m).sort((a, b) => b.value - a.value)
  }, [monthExpenses, catById])

  const last6 = useMemo(() => {
    const arr = []
    for (let i = 5; i >= 0; i--) {
      const k = shiftMonth(month, -i)
      const tot = expenses
        .filter((e) => periodKey(e.date) === k && counted(e) && !e.piggy_deposit)
        .reduce((s, e) => s + Number(e.amount), 0)
      arr.push({ mes: monthLabel(k), total: Math.round(tot) })
    }
    return arr
  }, [expenses, month])

  return (
    <>
      <div className="month-nav">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <span className="label">{monthLabel(month)}</span>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>

      <KpiSummary {...props} />

      <div className="summary" style={{ marginBottom: 16 }}>
        <div className="box">
          <div className="label">Gasto no mês</div>
          <div className="value">{money(total)}</div>
        </div>
        <div className="box">
          <div className="label">Orçamento ideal</div>
          <div className="value" style={{ color: total > idealTotal ? 'var(--danger)' : 'var(--green)' }}>
            {money(idealTotal)}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Gastos por categoria</h2>
        {byCategory.length === 0 ? (
          <div className="empty">Sem gastos neste mês ainda.</div>
        ) : (
          <>
            <div className="chart-box">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {byCategory.map((d, i) => { const col = d.color || PALETTE[i % PALETTE.length]; return (
                      <Cell key={i} fill={dark ? 'transparent' : col} stroke={col} strokeWidth={dark ? 2 : 1} />
                    ) })}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 12 }}>
              {byCategory.slice(0, 6).map((d, i) => (
                <div className="item" key={d.name}>
                  <div className="info">
                    <span className="dot" style={{ background: d.color || PALETTE[i % PALETTE.length] }} />
                    <span className="desc">{d.name}</span>
                  </div>
                  <span className="amt">{money(d.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Últimos 6 meses</h2>
        <div className="chart-box">
          <ResponsiveContainer>
            <BarChart data={last6} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis fontSize={11} width={44} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="total" fill={dark ? 'transparent' : '#0f766e'} stroke="#0f766e" strokeWidth={dark ? 2 : 0} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
