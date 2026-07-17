import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { money, todayISO } from '../lib/helpers'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export default function PiggyBank({ expenses, houseTaxes, piggyYear, categories, reload }) {
  const [year, setYear] = useState(new Date().getFullYear())

  // ---------- calculos ----------
  const yearTaxes = useMemo(
    () => houseTaxes.filter((t) => t.year === year).sort((a, b) => (a.due_month || 0) - (b.due_month || 0)),
    [houseTaxes, year])

  const opening = Number(piggyYear.find((y) => y.year === year)?.opening || 0)

  const deposits = useMemo(
    () => expenses.filter((e) => e.piggy_deposit && Number((e.date || '').slice(0, 4)) === year),
    [expenses, year])
  const depositsTotal = deposits.reduce((s, e) => s + Number(e.amount), 0)

  const paidTotal = yearTaxes.filter((t) => t.paid).reduce((s, t) => s + Number(t.amount), 0)
  const balance = opening + depositsTotal - paidTotal

  const anualTotal = yearTaxes.reduce((s, t) => s + Number(t.amount), 0)
  const monthlyReserve = anualTotal / 12

  const pendingTransfers = yearTaxes.filter((t) => t.paid && !t.transferred)

  const num = (v) => Number(String(v).replace(',', '.')) || 0

  // ---------- saldo inicial ----------
  const [editOpen, setEditOpen] = useState(false)
  const [openVal, setOpenVal] = useState('')
  const saveOpening = async () => {
    await supabase.from('piggy_year').upsert({ year, opening: num(openVal) })
    setEditOpen(false); setOpenVal(''); reload()
  }

  // ---------- deposito ----------
  const [depDate, setDepDate] = useState(todayISO())
  const [depAmount, setDepAmount] = useState('')
  const ensureFixosCategory = async () => {
    const found = categories.find((c) => c.name.toLowerCase() === 'fixos gui')
    if (found) return found.id
    const { data } = await supabase.from('categories').insert({ name: 'Fixos Gui', ideal: 0, color: '#0f766e' }).select().single()
    return data?.id || null
  }
  const registerDeposit = async (e) => {
    e.preventDefault()
    const amt = depAmount ? num(depAmount) : Number(monthlyReserve.toFixed(2))
    if (!amt) return
    const catId = await ensureFixosCategory()
    await supabase.from('expenses').insert({
      date: depDate, category_id: catId, description: 'Depósito cofrinho',
      place: 'Cofrinho', amount: amt, paid_by: 'Gui', pay_status: 'Sim', piggy_deposit: true,
    })
    setDepAmount(''); reload()
  }
  const delDeposit = async (id) => { await supabase.from('expenses').delete().eq('id', id); reload() }

  // ---------- taxas ----------
  const [tName, setTName] = useState('')
  const [tAmount, setTAmount] = useState('')
  const [tMonth, setTMonth] = useState('')
  const addTax = async (e) => {
    e.preventDefault()
    if (!tName || !tAmount) return
    await supabase.from('house_taxes').insert({
      year, name: tName, amount: num(tAmount), due_month: tMonth ? Number(tMonth) : null,
    })
    setTName(''); setTAmount(''); setTMonth(''); reload()
  }
  const togglePaid = async (t) => {
    await supabase.from('house_taxes').update({
      paid: !t.paid, paid_date: !t.paid ? todayISO() : null,
      transferred: !t.paid ? t.transferred : false,
    }).eq('id', t.id)
    reload()
  }
  const toggleTransferred = async (t) => {
    await supabase.from('house_taxes').update({ transferred: !t.transferred }).eq('id', t.id); reload()
  }
  const delTax = async (id) => { await supabase.from('house_taxes').delete().eq('id', id); reload() }

  return (
    <>
      <div className="month-nav">
        <button onClick={() => setYear((y) => y - 1)}>‹</button>
        <span className="label">Ano {year}</span>
        <button onClick={() => setYear((y) => y + 1)}>›</button>
      </div>

      <div className="summary" style={{ marginBottom: 16 }}>
        <div className="box">
          <div className="label">Saldo do cofrinho</div>
          <div className="value" style={{ color: balance < 0 ? 'var(--danger)' : 'var(--teal)', fontSize: 22 }}>{money(balance)}</div>
          <div className="meta" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            inicial {money(opening)} + depósitos {money(depositsTotal)} − pago {money(paidTotal)}
          </div>
        </div>
        <div className="box">
          <div className="label">Reserva mensal (fixos)</div>
          <div className="value" style={{ fontSize: 22 }}>{money(monthlyReserve)}</div>
          <div className="meta" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {money(anualTotal)} no ano ÷ 12
          </div>
        </div>
      </div>

      {pendingTransfers.length > 0 && (
        <div className="warn-banner">
          🔔 Transferências pendentes do cofrinho → conta:
          <div style={{ marginTop: 8 }}>
            {pendingTransfers.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span>{t.name} — <b>{money(t.amount)}</b></span>
                <button className="btn btn-sm" onClick={() => toggleTransferred(t)}>já transferi ✓</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saldo inicial + Deposito */}
      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Saldo inicial do ano
          <button className="btn btn-sm btn-ghost" onClick={() => { setEditOpen((v) => !v); setOpenVal(String(opening)) }}>
            {editOpen ? 'fechar' : 'editar'}
          </button>
        </h2>
        {editOpen ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}
              inputMode="decimal" value={openVal} onChange={(e) => setOpenVal(e.target.value)} placeholder="0,00" />
            <button className="btn btn-sm" onClick={saveOpening}>Salvar</button>
          </div>
        ) : (
          <div className="item"><span className="desc">Reservas no início de {year}</span><span className="amt">{money(opening)}</span></div>
        )}
      </div>

      <div className="card">
        <h2>Registrar depósito no cofrinho</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          O "Fixos Gui": dinheiro que sai da conta do Gui pra reserva (abate do Disponível dele).
        </p>
        <form onSubmit={registerDeposit}>
          <div className="row">
            <div className="field"><label>Data</label>
              <input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} required /></div>
            <div className="field"><label>Valor (€)</label>
              <input inputMode="decimal" value={depAmount} placeholder={money(monthlyReserve)} onChange={(e) => setDepAmount(e.target.value)} /></div>
          </div>
          <button className="btn">Registrar depósito</button>
        </form>
        {deposits.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {deposits.map((d) => (
              <div className="item" key={d.id}>
                <span className="meta">{d.date}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="amt" style={{ color: 'var(--teal)' }}>+{money(d.amount)}</span>
                  <button className="x" onClick={() => delDeposit(d.id)}>✕</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Taxas da casa */}
      <div className="card">
        <h2>Taxas da casa {year}</h2>
        {yearTaxes.length === 0 ? (
          <div className="empty">Nenhuma taxa cadastrada neste ano.</div>
        ) : (
          yearTaxes.map((t) => (
            <div className="item" key={t.id}>
              <div className="info">
                <div>
                  <div className="desc">
                    {t.name}
                    {t.due_month && <span className="tag" style={{ marginLeft: 6 }}>{MESES[t.due_month - 1]}</span>}
                    {t.paid && !t.transferred && <span className="tag" style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e' }}>transf. pendente</span>}
                    {t.paid && t.transferred && <span className="tag" style={{ marginLeft: 6, background: '#dcfce7', color: '#166534' }}>ok</span>}
                  </div>
                  <div className="meta">reserva/mês {money(Number(t.amount) / 12)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="amt">{money(t.amount)}</span>
                <button className="btn btn-sm" style={t.paid ? { background: '#dcfce7', color: '#166534' } : {}} onClick={() => togglePaid(t)}>
                  {t.paid ? 'pago ✓' : 'pagar'}
                </button>
                <button className="x" onClick={() => delTax(t.id)}>✕</button>
              </div>
            </div>
          ))
        )}
        <form onSubmit={addTax} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="field"><label>Nome da taxa</label>
            <input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="ex: Seguro Carro" /></div>
          <div className="row">
            <div className="field"><label>Valor (€)</label>
              <input inputMode="decimal" value={tAmount} placeholder="0,00" onChange={(e) => setTAmount(e.target.value)} /></div>
            <div className="field"><label>Mês previsto</label>
              <select value={tMonth} onChange={(e) => setTMonth(e.target.value)}>
                <option value="">—</option>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select></div>
          </div>
          <button className="btn btn-ghost">Adicionar taxa</button>
        </form>
      </div>
    </>
  )
}
