import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, AreaChart, PieChart,
  Bar, Line, Area, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { money, monthLabel, counted, PALETTE, periodKey } from '../lib/helpers'

const shift = (key, d) => {
  const [y, m] = key.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
const C = { entrada: '#2a78d6', saida: '#e34948', sobra: '#1baf7a', casa: '#1baf7a', nathi: '#d4537e', ideal: '#c3c2b7', real: '#2a78d6', fixo: '#4a3aa7', var: '#eda100' }

export default function Graficos(props) {
  const { expenses = [], incomes = [], categories = [], houseTaxes = [], taxPayments = [], piggyYear = [] } = props
  const [person, setPerson] = useState('Ambos')
  const [nMonths, setNMonths] = useState(6)
  const [month, setMonth] = useState(props.month || new Date().toISOString().slice(0, 7))
  const [category, setCategory] = useState('')

  const dark = props.theme === 'dark'
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const pOk = (pb) => person === 'Ambos' || pb === person
  const expOk = (e) => counted(e) && !(e.piggy_deposit && e.from_cc === false) && pOk(e.paid_by) && (!category || e.category_id === category)

  const monthsList = useMemo(() => {
    const arr = []
    for (let i = nMonths - 1; i >= 0; i--) arr.push(shift(month, -i))
    return arr
  }, [month, nMonths])

  // 1) Fluxo de caixa
  const fluxo = useMemo(() => monthsList.map((k) => {
    const ent = incomes.filter((i) => i.month === k && pOk(i.person)).reduce((s, i) => s + Number(i.amount), 0)
    const sai = expenses.filter((e) => periodKey(e.date) === k && expOk(e)).reduce((s, e) => s + Number(e.amount), 0)
    return { mes: monthLabel(k), Entradas: Math.round(ent), Saídas: Math.round(sai), Sobra: Math.round(ent - sai) }
  }), [monthsList, incomes, expenses, person, category])

  // 2) Reservas (Casa + Nathi) ao longo dos meses
  const reservas = useMemo(() => monthsList.map((k) => {
    const [y, mm] = k.split('-').map(Number)
    const bal = (piggy, pers) => {
      const open = Number(piggyYear.find((p) => p.year === y && (p.piggy || 'casa') === piggy)?.opening || 0)
      const ap = expenses.filter((e) => (e.to_reserve || e.piggy_deposit) && e.paid_by === pers && Number((e.date || '').slice(0, 4)) === y && periodKey(e.date) <= k).reduce((s, e) => s + Number(e.amount), 0)
      const ids = new Set(houseTaxes.filter((t) => t.year === y && (t.piggy || 'casa') === piggy).map((t) => t.id))
      const paid = taxPayments.filter((t) => ids.has(t.tax_id) && t.paid && t.month <= mm).reduce((s, t) => s + Number(t.amount), 0)
      return Math.round(open + ap - paid)
    }
    return { mes: monthLabel(k), Casa: bal('casa', 'Gui'), Nathi: bal('nathi', 'Nathi') }
  }), [monthsList, expenses, houseTaxes, taxPayments, piggyYear])

  // 3) Orçado x realizado (mês selecionado)
  const orcado = useMemo(() => {
    const real = {}
    for (const e of expenses) if (periodKey(e.date) === month && counted(e) && pOk(e.paid_by)) real[e.category_id] = (real[e.category_id] || 0) + Number(e.amount)
    return categories.map((c) => ({ nome: c.name, Orçado: Math.round(Number(c.ideal || 0)), Realizado: Math.round(real[c.id] || 0) }))
      .filter((r) => r.Orçado > 0 || r.Realizado > 0)
      .sort((a, b) => b.Realizado - a.Realizado).slice(0, 10)
  }, [expenses, categories, month, person])

  // 4) Fixos x variáveis (mês)
  const fixVar = useMemo(() => {
    let fx = 0, vr = 0
    for (const e of expenses) if (periodKey(e.date) === month && expOk(e)) {
      if (e.fixed_id || e.piggy_deposit) fx += Number(e.amount); else vr += Number(e.amount)
    }
    return [{ name: 'Fixos', value: Math.round(fx) }, { name: 'Variáveis', value: Math.round(vr) }]
  }, [expenses, month, person, category])

  // 5) Top categorias (mês)
  const top = useMemo(() => {
    const m = {}
    for (const e of expenses) if (periodKey(e.date) === month && counted(e) && pOk(e.paid_by)) m[e.category_id] = (m[e.category_id] || 0) + Number(e.amount)
    return Object.entries(m).map(([id, v]) => ({ nome: catById[id]?.name || '—', valor: Math.round(v), color: catById[id]?.color }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8)
  }, [expenses, month, person, catById])

  // 6) Taxa de poupança (%)
  const poupanca = useMemo(() => fluxo.map((f) => ({
    mes: f.mes, taxa: f.Entradas > 0 ? Math.round((f.Sobra / f.Entradas) * 100) : 0,
  })), [fluxo])

  const eur = (v) => money(v)
  const tip = { contentStyle: { fontSize: 12, borderRadius: 8 }, formatter: (v) => eur(v) }

  return (
    <>
      <div className="card wide">
        <div className="filters">
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option>Ambos</option><option>Gui</option><option>Nathi</option>
          </select>
          <select value={nMonths} onChange={(e) => setNMonths(Number(e.target.value))}>
            <option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Categoria: todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="month-nav" style={{ marginTop: 4 }}>
          <button onClick={() => setMonth(shift(month, -1))}>‹</button>
          <span className="label">Mês: {monthLabel(month)}</span>
          <button onClick={() => setMonth(shift(month, 1))}>›</button>
        </div>
      </div>

      <div className="card wide">
        <h2>Fluxo de caixa (entradas × saídas)</h2>
        <div className="chart-box" style={{ height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={fluxo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f4" vertical={false} />
              <XAxis dataKey="mes" fontSize={12} /><YAxis fontSize={11} width={48} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Entradas" fill={dark ? 'transparent' : C.entrada} stroke={C.entrada} strokeWidth={dark ? 1.5 : 0} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Saídas" fill={dark ? 'transparent' : C.saida} stroke={C.saida} strokeWidth={dark ? 1.5 : 0} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Line dataKey="Sobra" stroke={C.sobra} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card wide">
        <h2>Evolução das reservas</h2>
        <div className="chart-box" style={{ height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={reservas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f4" vertical={false} />
              <XAxis dataKey="mes" fontSize={12} /><YAxis fontSize={11} width={48} />
              <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Area dataKey="Casa" stroke={C.casa} fill={C.casa} fillOpacity={dark ? 0 : 0.15} strokeWidth={2} />
              <Area dataKey="Nathi" stroke={C.nathi} fill={C.nathi} fillOpacity={dark ? 0 : 0.14} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card wide">
        <h2>Orçado × realizado — {monthLabel(month)}</h2>
        <div style={{ height: Math.max(180, orcado.length * 42 + 40) }}>
          <ResponsiveContainer>
            <BarChart data={orcado} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f4" horizontal={false} />
              <XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="nome" width={110} fontSize={12} />
              <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Orçado" fill={dark ? 'transparent' : C.ideal} stroke={C.ideal} strokeWidth={dark ? 1.5 : 0} radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="Realizado" fill={dark ? 'transparent' : C.real} stroke={C.real} strokeWidth={dark ? 1.5 : 0} radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Top categorias — {monthLabel(month)}</h2>
        <div style={{ height: Math.max(160, top.length * 40 + 30) }}>
          <ResponsiveContainer>
            <BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="nome" width={100} fontSize={12} />
              <Tooltip {...tip} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {top.map((d, i) => { const col = d.color || PALETTE[i % PALETTE.length]; return <Cell key={i} fill={dark ? 'transparent' : col} stroke={col} strokeWidth={dark ? 1.5 : 0} /> })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Fixos × variáveis — {monthLabel(month)}</h2>
        <div className="chart-box" style={{ height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={fixVar} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                <Cell fill={dark ? 'transparent' : C.fixo} stroke={C.fixo} strokeWidth={dark ? 2 : 1} /><Cell fill={dark ? 'transparent' : C.var} stroke={C.var} strokeWidth={dark ? 2 : 1} />
              </Pie>
              <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card wide">
        <h2>Taxa de poupança (% da renda)</h2>
        <div className="chart-box" style={{ height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={poupanca} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f4" vertical={false} />
              <XAxis dataKey="mes" fontSize={12} /><YAxis fontSize={11} width={40} unit="%" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => `${v}%`} />
              <Line dataKey="taxa" stroke={C.sobra} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
