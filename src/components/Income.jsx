import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { IconTrash } from './icons'
import { money, todayISO, counted, parseAmount, fmtDate, disponivelOf, periodKey, monthLabel, shiftMonth } from '../lib/helpers'

const PEOPLE = ['Gui', 'Nathi']

export default function Income({ incomes, expenses, month, setMonth, balances, adjustments = [], reload }) {
  const [person, setPerson] = useState('Gui')
  const [date, setDate] = useState(todayISO())
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [editOpening, setEditOpening] = useState(false)
  const [openVals, setOpenVals] = useState({})
  const [adjVals, setAdjVals] = useState({})
  const [adjBusy, setAdjBusy] = useState(false)

  const num = (v) => { const n = parseAmount(v); return Number.isFinite(n) ? n : 0 }

  const openingOf = (p) => Number(balances.find((b) => b.person === p)?.opening || 0)

  // Entradas e saidas do mes selecionado, por pessoa
  const monthIncome = (p) =>
    incomes.filter((i) => i.month === month && i.person === p)
      .reduce((s, i) => s + Number(i.amount), 0)
  const monthOut = (p) =>
    expenses.filter((e) => periodKey(e.date) === month && e.paid_by === p && counted(e) && !(e.piggy_deposit && e.from_cc === false))
      .reduce((s, e) => s + Number(e.amount), 0)
  const cumIn = (p) => incomes.filter((i) => i.person === p && i.month <= month).reduce((s, i) => s + Number(i.amount), 0)
  const cumOut = (p) => expenses.filter((e) => e.paid_by === p && counted(e) && !(e.piggy_deposit && e.from_cc === false) && periodKey(e.date) <= month).reduce((s, e) => s + Number(e.amount), 0)

  // ajuste manual do mês selecionado + acumulado até o mês
  const adjOf = (p) => Number(adjustments.find((a) => a.person === p && a.month === month)?.amount || 0)
  const cumAdj = (p) => adjustments.filter((a) => a.person === p && a.month <= month).reduce((s, a) => s + Number(a.amount), 0)

  // Disponivel = saldo inicial + soma(entradas - saidas + ajustes) de TODOS os meses ate o mes atual (inclusive)
  const disponivel = (p) => disponivelOf(p, { incomes, expenses, balances, adjustments }, month)

  const monthIncomes = useMemo(
    () => incomes.filter((i) => i.month === month).sort((a, b) => a.person.localeCompare(b.person)),
    [incomes, month])

  const add = async (e) => {
    e.preventDefault()
    if (!amount) return
    setBusy(true)
    await supabase.from('incomes').insert({
      month: periodKey(date), date, person,
      description: desc || 'Entrada', amount: num(amount),
    })
    setDesc(''); setAmount(''); setBusy(false); reload()
  }
  const remove = async (id) => { await supabase.from('incomes').delete().eq('id', id); reload() }

  const saveOpening = async () => {
    for (const p of PEOPLE) {
      if (openVals[p] !== undefined)
        await supabase.from('balances').update({ opening: num(openVals[p]) }).eq('person', p)
    }
    setEditOpening(false); setOpenVals({}); reload()
  }

  const saveAdj = async (p) => {
    const raw = adjVals[p]
    if (raw === undefined) return
    setAdjBusy(true)
    const val = num(raw)
    if (val === 0) {
      await supabase.from('adjustments').delete().eq('person', p).eq('month', month)
    } else {
      await supabase.from('adjustments').upsert({ person: p, month, amount: val }, { onConflict: 'person,month' })
    }
    setAdjVals((o) => { const n = { ...o }; delete n[p]; return n }); setAdjBusy(false); reload()
  }

  return (
    <>
      <div className="month-nav">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <span className="label">{monthLabel(month)}</span>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      <div className="summary" style={{ marginBottom: 16 }}>
        {PEOPLE.map((p) => {
          const d = disponivel(p)
          return (
            <div className="box" key={p}>
              <div className="label">Disponível {p}</div>
              <div className="value" style={{ color: d < 0 ? 'var(--danger)' : 'var(--green)', fontSize: 20 }}>
                {money(d)}
              </div>
              <div className="meta" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                inicial {money(openingOf(p))} + entradas {money(cumIn(p))} − saídas {money(cumOut(p))}
                {cumAdj(p) !== 0 ? ` ${cumAdj(p) < 0 ? '−' : '+'} ajustes ${money(Math.abs(cumAdj(p)))}` : ''}
              </div>
              <div className="meta" style={{ fontSize: 11, color: 'var(--muted)' }}>
                (mês: +{money(monthIncome(p))} · −{money(monthOut(p))})
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Saldo inicial
          <button className="btn btn-sm btn-ghost" onClick={() => setEditOpening((v) => !v)}>
            {editOpening ? 'fechar' : 'editar'}
          </button>
        </h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          Ponto de partida do "Disponível" (quanto cada um tinha antes de começar a usar o app).
        </p>
        {PEOPLE.map((p) => (
          <div className="item" key={p}>
            <span className="desc">{p}</span>
            {editOpening ? (
              <input style={{ width: 110, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8 }}
                inputMode="decimal" defaultValue={openingOf(p)}
                onChange={(e) => setOpenVals((o) => ({ ...o, [p]: e.target.value }))} />
            ) : (
              <span className="amt">{money(openingOf(p))}</span>
            )}
          </div>
        ))}
        {editOpening && <button className="btn" style={{ marginTop: 12 }} onClick={saveOpening}>Salvar saldo inicial</button>}
      </div>

      <div className="card">
        <h2>Ajuste manual — {monthLabel(month)}</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          Corrige o Disponível quando a realidade diferir do calculado (ex.: o app mostra 500 e você
          tem 525 → ajuste <b>+25</b>; se tem 480 → <b>-25</b>). Vale para este mês e segue somando nos seguintes.
        </p>
        {PEOPLE.map((p) => {
          const cur = adjOf(p)
          const val = adjVals[p] !== undefined ? adjVals[p] : (cur !== 0 ? String(cur).replace('.', ',') : '')
          return (
            <div className="item" key={p}>
              <span className="desc">
                {p}
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                  Disponível: {money(disponivel(p))}
                </span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input style={{ width: 90, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'right' }}
                  inputMode="decimal" placeholder="0,00" value={val}
                  onChange={(e) => setAdjVals((o) => ({ ...o, [p]: e.target.value }))} />
                <button className="btn btn-sm" disabled={adjBusy || adjVals[p] === undefined} onClick={() => saveAdj(p)}>salvar</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <h2>Nova entrada</h2>
        <form onSubmit={add}>
          <div className="row">
            <div className="field">
              <label>Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Valor (€)</label>
              <input type="text" inputMode="decimal" value={amount} placeholder="0,00"
                onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Quem</label>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              {PEOPLE.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Descrição</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ex: Salário, Extra, 13º…" />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Salvando…' : 'Adicionar entrada'}</button>
        </form>
      </div>

      <div className="card">
        <h2>Entradas do mês</h2>
        {monthIncomes.length === 0 ? (
          <div className="empty">Nenhuma entrada neste mês.</div>
        ) : (
          monthIncomes.map((i) => (
            <div className="item" key={i.id}>
              <div className="info">
                <div>
                  <div className="desc">{i.description}</div>
                  <div className="meta">{i.person}{i.date ? ` · ${fmtDate(i.date)}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="amt" style={{ color: 'var(--green)' }}>+{money(i.amount)}</span>
                <button className="x" title="excluir" onClick={() => remove(i.id)}><IconTrash /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
