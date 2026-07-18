import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { IconTrash } from './icons'
import { money, todayISO, counted, parseAmount, fmtDate, disponivelOf } from '../lib/helpers'

const PEOPLE = ['Gui', 'Nathi']

export default function Income({ incomes, expenses, month, balances, reload }) {
  const [person, setPerson] = useState('Gui')
  const [date, setDate] = useState(todayISO())
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [toReserve, setToReserve] = useState(false)
  const [editOpening, setEditOpening] = useState(false)
  const [openVals, setOpenVals] = useState({})

  const num = (v) => { const n = parseAmount(v); return Number.isFinite(n) ? n : 0 }

  const openingOf = (p) => Number(balances.find((b) => b.person === p)?.opening || 0)

  // Entradas e saidas do mes selecionado, por pessoa
  const monthIncome = (p) =>
    incomes.filter((i) => i.month === month && i.person === p)
      .reduce((s, i) => s + Number(i.amount), 0)
  const monthOut = (p) =>
    expenses.filter((e) => (e.date || '').startsWith(month) && e.paid_by === p && counted(e))
      .reduce((s, e) => s + Number(e.amount), 0)

  // Disponivel = saldo inicial + soma(entradas - saidas) de TODOS os meses ate o mes atual (inclusive)
  const disponivel = (p) => disponivelOf(p, { incomes, expenses, balances }, month)

  const monthIncomes = useMemo(
    () => incomes.filter((i) => i.month === month).sort((a, b) => a.person.localeCompare(b.person)),
    [incomes, month])

  const add = async (e) => {
    e.preventDefault()
    if (!amount) return
    setBusy(true)
    await supabase.from('incomes').insert({
      month: date.slice(0, 7), date, person,
      description: desc || 'Entrada', amount: num(amount), to_reserve: toReserve,
    })
    setDesc(''); setAmount(''); setToReserve(false); setBusy(false); reload()
  }
  const remove = async (id) => { await supabase.from('incomes').delete().eq('id', id); reload() }

  const saveOpening = async () => {
    for (const p of PEOPLE) {
      if (openVals[p] !== undefined)
        await supabase.from('balances').update({ opening: num(openVals[p]) }).eq('person', p)
    }
    setEditOpening(false); setOpenVals({}); reload()
  }

  return (
    <>
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
                +{money(monthIncome(p))} entrou · −{money(monthOut(p))} saiu (mês)
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12 }}>
            <input type="checkbox" checked={toReserve} onChange={(e) => setToReserve(e.target.checked)} />
            Enviar às reservas (poupança, não conta no Disponível)
          </label>
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
                  <div className="desc">{i.description}
                    {i.to_reserve && <span className="tag" style={{ marginLeft: 6, background: '#ccfbf1', color: '#0f766e' }}>→ reservas</span>}
                  </div>
                  <div className="meta">{i.person}{i.date ? ` · ${fmtDate(i.date)}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="amt" style={{ color: i.to_reserve ? 'var(--teal)' : 'var(--green)' }}>+{money(i.amount)}</span>
                <button className="x" title="excluir" onClick={() => remove(i.id)}><IconTrash /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
