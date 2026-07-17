import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { money, todayISO, parseAmount, fmtDate } from '../lib/helpers'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const CFG = {
  casa:  { depositor: 'Gui',   category: 'Fixos Gui',   label: 'Casa'  },
  nathi: { depositor: 'Nathi', category: 'Taxas Nathi', label: 'Nathi' },
}

export default function PiggyBank({ piggy = 'casa', expenses, houseTaxes, taxPayments, piggyYear, categories, reload }) {
  const cfg = CFG[piggy] || CFG.casa
  const [year, setYear] = useState(new Date().getFullYear())
  const [pop, setPop] = useState(null) // { text, x, y }
  const showPop = (ev, text) => {
    const r = ev.currentTarget.getBoundingClientRect()
    setPop({ text, x: r.left + r.width / 2, y: r.top })
  }
  const num = (v) => { const n = parseAmount(v); return Number.isFinite(n) ? n : 0 }

  const items = useMemo(
    () => houseTaxes.filter((t) => t.year === year && (t.piggy || 'casa') === piggy).sort((a, b) => a.name.localeCompare(b.name)),
    [houseTaxes, year, piggy])
  const itemIds = new Set(items.map((i) => i.id))
  const payments = useMemo(
    () => taxPayments.filter((p) => itemIds.has(p.tax_id)),
    [taxPayments, items])

  // paymentMap[tax_id][month] = payment
  const payMap = useMemo(() => {
    const m = {}
    for (const p of payments) { (m[p.tax_id] = m[p.tax_id] || {})[p.month] = p }
    return m
  }, [payments])

  const itemTotal = (id) => Object.values(payMap[id] || {}).reduce((s, p) => s + Number(p.amount), 0)
  const monthTotal = (mo) => payments.filter((p) => p.month === mo).reduce((s, p) => s + Number(p.amount), 0)
  const anualTotal = payments.reduce((s, p) => s + Number(p.amount), 0)
  const monthlyReserve = anualTotal / 12

  const opening = Number(piggyYear.find((y) => y.year === year && (y.piggy || 'casa') === piggy)?.opening || 0)
  const deposits = useMemo(
    () => expenses.filter((e) => e.piggy_deposit && (e.piggy || 'casa') === piggy && Number((e.date || '').slice(0, 4)) === year),
    [expenses, year, piggy])
  const depositsTotal = deposits.reduce((s, e) => s + Number(e.amount), 0)
  const paidTotal = payments.filter((p) => p.paid).reduce((s, p) => s + Number(p.amount), 0)
  const balance = opening + depositsTotal - paidTotal

  const pendingTransfers = payments
    .filter((p) => p.paid && !p.transferred)
    .map((p) => ({ ...p, name: items.find((i) => i.id === p.tax_id)?.name }))

  // ---------- acoes ----------
  const [editOpen, setEditOpen] = useState(false)
  const [openVal, setOpenVal] = useState('')
  const [openMsg, setOpenMsg] = useState('')
  const saveOpening = async () => {
    const n = parseAmount(openVal)
    if (openVal.trim() !== '' && !Number.isFinite(n)) {
      setOpenMsg('Valor inválido. Use vírgula para decimais — ex: 2120,36')
      return
    }
    const { error } = await supabase.from('piggy_year').upsert(
      { piggy, year, opening: Number.isFinite(n) ? n : 0 }, { onConflict: 'piggy,year' })
    if (error) { setOpenMsg('Erro ao salvar: ' + error.message); return }
    setOpenMsg(''); setEditOpen(false); setOpenVal(''); reload()
  }

  const togglePaid = async (p) => {
    await supabase.from('tax_payments').update({
      paid: !p.paid, paid_date: !p.paid ? todayISO() : null,
      transferred: !p.paid ? p.transferred : false,
    }).eq('id', p.id)
    reload()
  }
  const toggleTransferred = async (p) => {
    await supabase.from('tax_payments').update({ transferred: !p.transferred }).eq('id', p.id); reload()
  }

  // adicionar vencimento (cria taxa se nome novo)
  const [vName, setVName] = useState('')
  const [vMonth, setVMonth] = useState('')
  const [vAmount, setVAmount] = useState('')
  const [vNote, setVNote] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTaxId, setEditingTaxId] = useState(null)
  const clearForm = () => { setVName(''); setVMonth(''); setVAmount(''); setVNote(''); setEditingId(null); setEditingTaxId(null) }
  const addVencimento = async (e) => {
    e.preventDefault()
    if (!vName || !vMonth || !vAmount) return
    if (editingId) {
      await supabase.from('tax_payments').update({ month: Number(vMonth), amount: num(vAmount), note: vNote || null }).eq('id', editingId)
      if (editingTaxId) await supabase.from('house_taxes').update({ name: vName.trim() }).eq('id', editingTaxId)
      clearForm()
    } else {
      let item = items.find((i) => i.name.toLowerCase() === vName.trim().toLowerCase())
      let taxId = item?.id
      if (!taxId) {
        const { data } = await supabase.from('house_taxes').insert({ year, name: vName.trim(), piggy }).select().single()
        taxId = data?.id
      }
      if (taxId) await supabase.from('tax_payments').insert({ tax_id: taxId, month: Number(vMonth), amount: num(vAmount), note: vNote || null })
      setVAmount(''); setVNote('')
    }
    reload()
  }
  const editPayment = (p) => {
    const item = items.find((i) => i.id === p.tax_id)
    setVName(item?.name || ''); setVMonth(String(p.month)); setVAmount(String(p.amount)); setVNote(p.note || '')
    setEditingId(p.id); setEditingTaxId(p.tax_id)
    document.getElementById('venc-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const delPayment = async (p) => {
    await supabase.from('tax_payments').delete().eq('id', p.id)
    const others = payments.filter((x) => x.tax_id === p.tax_id && x.id !== p.id)
    if (others.length === 0) await supabase.from('house_taxes').delete().eq('id', p.tax_id)
    reload()
  }

  // ---------- deposito ----------
  const [depDate, setDepDate] = useState(todayISO())
  const [depAmount, setDepAmount] = useState('')
  const [depNote, setDepNote] = useState('')
  const [depMsg, setDepMsg] = useState('')
  const [depEditingId, setDepEditingId] = useState(null)
  const ensureDepositCategory = async () => {
    const found = categories.find((c) => c.name.toLowerCase() === cfg.category.toLowerCase())
    if (found) return found.id
    const { data } = await supabase.from('categories').insert({ name: cfg.category, ideal: 0, color: '#0f766e' }).select().single()
    return data?.id || null
  }
  const registerDeposit = async (e) => {
    e.preventDefault()
    const amt = depAmount ? num(depAmount) : Number(monthlyReserve.toFixed(2))
    if (!amt) { setDepMsg('Informe um valor.'); return }
    if (depEditingId) {
      const { error } = await supabase.from('expenses').update({
        date: depDate, amount: amt,
        description: depNote || 'Depósito reservas', place: depNote || 'Reservas',
      }).eq('id', depEditingId)
      if (error) { setDepMsg('Erro ao salvar: ' + error.message); return }
    } else {
      const catId = await ensureDepositCategory()
      const { error } = await supabase.from('expenses').insert({
        date: depDate, category_id: catId,
        description: depNote || 'Depósito reservas',
        place: depNote || 'Reservas',
        amount: amt, paid_by: cfg.depositor, pay_status: 'Sim', piggy_deposit: true, piggy,
      })
      if (error) { setDepMsg('Erro ao salvar: ' + error.message); return }
    }
    setDepMsg(''); setDepAmount(''); setDepNote(''); setDepEditingId(null); reload()
  }
  const editDeposit = (d) => {
    setDepDate(d.date); setDepAmount(String(d.amount))
    setDepNote(d.place && d.place !== 'Reservas' ? d.place : '')
    setDepEditingId(d.id)
    document.getElementById('dep-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const cancelDep = () => { setDepAmount(''); setDepNote(''); setDepEditingId(null); setDepMsg('') }
  const delDeposit = async (id) => { await supabase.from('expenses').delete().eq('id', id); reload() }

  return (
    <>
      {pop && (
        <div className="note-pop" style={{ left: pop.x, top: pop.y }}>{pop.text}</div>
      )}
      <div className="month-nav">
        <button onClick={() => setYear((y) => y - 1)}>‹</button>
        <span className="label">Ano {year}</span>
        <button onClick={() => setYear((y) => y + 1)}>›</button>
      </div>

      <div className="summary" style={{ marginBottom: 16 }}>
        <div className="box">
          <div className="label">Saldo das reservas</div>
          <div className="value" style={{ color: balance < 0 ? 'var(--danger)' : 'var(--teal)', fontSize: 22 }}>{money(balance)}</div>
          <div className="meta" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            inicial {money(opening)} + dep. {money(depositsTotal)} − pago {money(paidTotal)}
          </div>
        </div>
        <div className="box">
          <div className="label">Reserva mensal (fixos)</div>
          <div className="value" style={{ fontSize: 22 }}>{money(monthlyReserve)}</div>
          <div className="meta" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{money(anualTotal)} no ano ÷ 12</div>
        </div>
      </div>

      {pendingTransfers.length > 0 && (
        <div className="warn-banner">
          🔔 Transferências pendentes (reservas → conta):
          <div style={{ marginTop: 8 }}>
            {pendingTransfers.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span>{p.name} ({MESES[p.month - 1]}) — <b>{money(p.amount)}</b></span>
                <button className="btn btn-sm" onClick={() => toggleTransferred(p)}>já transferi ✓</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- MATRIZ DE VENCIMENTOS ---------- */}
      <div className="card wide">
        <h2>Calendário de vencimentos {year}</h2>
        {items.length === 0 ? (
          <div className="empty">Nenhuma taxa. Adicione um vencimento abaixo.</div>
        ) : (
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th className="name">Taxa</th>
                  {MESES.map((m) => <th key={m}>{m}</th>)}
                  <th>total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="name">{it.name}</td>
                    {MESES.map((m, idx) => {
                      const p = payMap[it.id]?.[idx + 1]
                      if (!p) return <td key={m} className="cell" />
                      const cls = p.paid ? (p.transferred ? 'cell has paid' : 'cell has pend') : 'cell has'
                      return (
                        <td key={m} className={cls}
                          title={p.paid ? 'pago (toque p/ desmarcar)' : 'toque p/ marcar pago'}
                          onClick={() => togglePaid(p)}
                          onMouseEnter={p.note ? (ev) => showPop(ev, p.note) : undefined}
                          onMouseLeave={p.note ? () => setPop(null) : undefined}>
                          {money(p.amount).replace(/\s?€/, '')}
                          {p.note && <sup className="info-i">ⓘ</sup>}
                        </td>
                      )
                    })}
                    <td className="tot">{money(itemTotal(it.id)).replace(/\s?€/, '')}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td className="name">Soma</td>
                  {MESES.map((m, idx) => <td key={m}>{monthTotal(idx + 1) ? money(monthTotal(idx + 1)).replace(/\s?€/, '') : ''}</td>)}
                  <td className="tot">{money(anualTotal).replace(/\s?€/, '')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          Toque numa célula para marcar/desmarcar como <b>paga</b>. Verde = paga e transferida · amarelo = paga, transferência pendente.
        </p>
      </div>

      {/* ---------- ADICIONAR VENCIMENTO ---------- */}
      <div className="card">
        <h2>{editingId ? 'Editar vencimento' : 'Adicionar vencimento'}</h2>
        <form id="venc-form" onSubmit={addVencimento}>
          <div className="field"><label>Taxa</label>
            <input list="taxlist" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="ex: Seguro Carro" />
            <datalist id="taxlist">{items.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          </div>
          <div className="row">
            <div className="field"><label>Mês</label>
              <select value={vMonth} onChange={(e) => setVMonth(e.target.value)}>
                <option value="">—</option>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select></div>
            <div className="field"><label>Valor (€)</label>
              <input inputMode="decimal" value={vAmount} placeholder="0,00" onChange={(e) => setVAmount(e.target.value)} /></div>
          </div>
          <div className="field"><label>Descrição (opcional)</label>
            <input value={vNote} onChange={(e) => setVNote(e.target.value)} placeholder="dica que aparece ao passar no valor" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }}>{editingId ? 'Salvar alteração' : 'Adicionar vencimento'}</button>
            {editingId && <button type="button" className="btn btn-ghost" style={{ flex: 0, padding: '13px 16px' }} onClick={clearForm}>Cancelar</button>}
          </div>
        </form>

        {items.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <h3>Gerir taxas</h3>
            {items.map((it) => (
              <div key={it.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>{it.name}</b>
                </div>
                <div style={{ marginTop: 4 }}>
                  {Object.values(payMap[it.id] || {}).sort((a, b) => a.month - b.month).map((p) => (
                    <div className="item" key={p.id} style={{ padding: '8px 0' }}>
                      <span className="desc">{MESES[p.month - 1]} — {money(p.amount)}</span>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {p.paid && (
                          <button className="icon-btn"
                            style={{ color: p.transferred ? 'var(--green)' : '#3b82f6', fontWeight: 600, fontSize: 13 }}
                            onClick={() => toggleTransferred(p)}>{p.transferred ? 'transferido' : 'transferir'}</button>
                        )}
                        <button className="icon-btn" title="editar" onClick={() => editPayment(p)}>✏️</button>
                        <button className="icon-btn" title={p.paid ? 'pago — clique p/ desmarcar' : 'a pagar — clique p/ marcar'}
                          style={{ color: p.paid ? 'var(--green)' : 'var(--danger)', fontWeight: 800, fontSize: 18 }}
                          onClick={() => togglePaid(p)}>€</button>
                        <button className="x" onClick={() => delPayment(p)}>✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- SALDO INICIAL ---------- */}
      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Saldo inicial do ano
          <button className="btn btn-sm btn-ghost" onClick={() => { setEditOpen((v) => !v); setOpenVal(String(opening)) }}>
            {editOpen ? 'fechar' : 'editar'}
          </button>
        </h2>
        {editOpen ? (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}
                inputMode="decimal" value={openVal} onChange={(e) => setOpenVal(e.target.value)} placeholder="0,00" />
              <button className="btn btn-sm" onClick={saveOpening}>Salvar</button>
            </div>
            {openMsg && <div className="msg err" style={{ marginTop: 8 }}>{openMsg}</div>}
          </>
        ) : (
          <div className="item"><span className="desc">Reservas no início de {year}</span><span className="amt">{money(opening)}</span></div>
        )}
      </div>

      {/* ---------- DEPÓSITO ---------- */}
      <div className="card">
        <h2>{depEditingId ? 'Editar depósito' : 'Registrar depósito nas reservas'}</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          Dinheiro que sai da conta do {cfg.depositor} pra reserva (abate do Disponível dele/dela).
        </p>
        <form id="dep-form" onSubmit={registerDeposit}>
          <div className="row">
            <div className="field"><label>Data</label>
              <input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} required /></div>
            <div className="field"><label>Valor (€)</label>
              <input inputMode="decimal" value={depAmount} placeholder={money(monthlyReserve)} onChange={(e) => setDepAmount(e.target.value)} /></div>
          </div>
          <div className="field"><label>Descrição (opcional)</label>
            <input value={depNote} onChange={(e) => setDepNote(e.target.value)} placeholder="ex: reserva de julho" /></div>
          {depMsg && <div className="msg err">{depMsg}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }}>{depEditingId ? 'Salvar alteração' : 'Registrar depósito'}</button>
            {depEditingId && <button type="button" className="btn btn-ghost" style={{ flex: 0, padding: '13px 16px' }} onClick={cancelDep}>Cancelar</button>}
          </div>
        </form>
        {deposits.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {deposits.map((d) => (
              <div className="item" key={d.id}>
                <div>
                  <div className="desc">{d.place || d.description || 'Depósito'}</div>
                  <div className="meta">{fmtDate(d.date)}</div>
                </div>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="amt" style={{ color: 'var(--teal)' }}>+{money(d.amount)}</span>
                  <button className="icon-btn" title="editar" onClick={() => editDeposit(d)}>✏️</button>
                  <button className="x" onClick={() => delDeposit(d.id)}>✕</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
