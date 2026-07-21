import { useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { IconEdit, IconTrash, IconGear, IconInfo } from './icons'
import { money, todayISO, monthKey, daysInMonth, fixedActiveIn, PALETTE, parseAmount, fmtDate } from '../lib/helpers'
import KpiSummary from './KpiSummary'

const PAY = ['Não', 'Sim', 'Não contabilizado']
const WHO = ['Gui', 'Nathi', 'Casal']

export default function Expenses(props) {
  const { categories, monthExpenses, accounts, fixedExpenses, month, reload } = props
  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  // ---------- Novo gasto avulso (variavel) ----------
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState('')
  const [place, setPlace] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState('Gui')
  const [account, setAccount] = useState('')
  const [payStatus, setPayStatus] = useState('Sim')
  const [toReserve, setToReserve] = useState(false)
  const [busy, setBusy] = useState(false)
  const amountRef = useRef(null)
  const [editingExpId, setEditingExpId] = useState(null)
  const [flash, setFlash] = useState('')
  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 3000) }
  const [pop, setPop] = useState(null) // { text, x, y } - ancorado ao item, nao ao mouse
  const showPop = (ev, text) => {
    const r = ev.currentTarget.getBoundingClientRect()
    setPop({ text, x: r.left + r.width / 2, y: r.top })
  }

  const addExpense = async (e) => {
    e.preventDefault()
    if (!categoryId || !amount) return
    setBusy(true)
    const payload = {
      date, category_id: categoryId,
      description: place || catById[categoryId]?.name || '',
      place, amount: parseAmount(amount),
      paid_by: paidBy, account: account || null, pay_status: payStatus, to_reserve: toReserve,
    }
    if (editingExpId) {
      await supabase.from('expenses').update(payload).eq('id', editingExpId)
      setEditingExpId(null); setPlace(''); setAmount(''); setPayStatus('Sim'); setToReserve(false); setBusy(false); reload(); showFlash('Gasto atualizado com sucesso ✓')
    } else {
      await supabase.from('expenses').insert({ ...payload, is_fixed: false })
      setPlace(''); setAmount(''); setPayStatus('Sim'); setToReserve(false); setBusy(false); reload(); showFlash('Gasto adicionado com sucesso ✓')
      amountRef.current?.focus()
    }
  }
  const editExpense = (e) => {
    setDate(e.date); setCategoryId(e.category_id || ''); setPlace(e.place || '')
    setAmount(String(e.amount)); setPaidBy(e.paid_by || 'Gui'); setAccount(e.account || '')
    setPayStatus(e.pay_status || 'Não'); setToReserve(!!e.to_reserve); setEditingExpId(e.id)
    document.getElementById('gasto-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const cancelExpEdit = () => { setEditingExpId(null); setPlace(''); setAmount(''); setPayStatus('Sim'); setToReserve(false) }
  const removeExpense = async (id) => { await supabase.from('expenses').delete().eq('id', id); reload() }

  // ---------- Fixos do mes ----------
  const paidFixedThisMonth = useMemo(() => {
    const m = {}
    for (const e of monthExpenses) if (e.fixed_id) m[e.fixed_id] = e
    return m
  }, [monthExpenses])

  const monthFixed = fixedExpenses
    .filter((f) => fixedActiveIn(f, month))
    .sort((a, b) => (a.day_of_month || 1) - (b.day_of_month || 1))

  const markPaid = async (f) => {
    const day = Math.min(f.day_of_month || 1, daysInMonth(month))
    await supabase.from('expenses').insert({
      date: `${month}-${String(day).padStart(2, '0')}`,
      category_id: f.category_id,
      description: f.description || catById[f.category_id]?.name || '',
      place: f.description || '',
      amount: Number(f.amount),
      paid_by: f.paid_by, account: f.account || null,
      is_fixed: true, pay_status: 'Sim', fixed_id: f.id,
    })
    reload()
  }
  const unmarkPaid = async (f) => {
    const row = paidFixedThisMonth[f.id]
    if (row) await supabase.from('expenses').delete().eq('id', row.id)
    reload()
  }

  // ---------- Gestao de fixos ----------
  const [manageFixed, setManageFixed] = useState(false)
  const [fCat, setFCat] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fWho, setFWho] = useState('Gui')
  const [fAcc, setFAcc] = useState('')
  const [fDay, setFDay] = useState('1')
  const [fStart, setFStart] = useState(monthKey())
  const [fEnd, setFEnd] = useState('')
  const [fToReserve, setFToReserve] = useState(false)

  const addFixed = async (e) => {
    e.preventDefault()
    if (!fCat || !fAmount) return
    await supabase.from('fixed_expenses').insert({
      category_id: fCat,
      description: catById[fCat]?.name || '',
      amount: parseAmount(fAmount),
      paid_by: fWho, account: fAcc || null,
      day_of_month: Number(fDay) || 1,
      start_month: fStart, end_month: fEnd || null, active: true, to_reserve: fToReserve,
    })
    setFCat(''); setFAmount(''); setFAcc(''); setFDay('1'); setFEnd(''); setFToReserve(false); reload()
  }
  const updateFixedAmount = async (f, val) => {
    await supabase.from('fixed_expenses').update({ amount: parseAmount(val) || 0 }).eq('id', f.id)
    reload()
  }
  const toggleFixedActive = async (f) => {
    await supabase.from('fixed_expenses').update({ active: !f.active }).eq('id', f.id); reload()
  }
  const toggleFixedReserve = async (f) => {
    await supabase.from('fixed_expenses').update({ to_reserve: !f.to_reserve }).eq('id', f.id); reload()
  }
  const setFixedEnd = async (f, val) => {
    await supabase.from('fixed_expenses').update({ end_month: val || null }).eq('id', f.id); reload()
  }
  const delFixed = async (id) => { await supabase.from('fixed_expenses').delete().eq('id', id); reload() }

  // ---------- Contas ----------
  const [manageAcc, setManageAcc] = useState(false)
  const [newAcc, setNewAcc] = useState('')

  // filtros/ordenacao da lista
  const [fPerson, setFPerson] = useState('')
  const [fAccount, setFAccount] = useState('')
  const [sortBy, setSortBy] = useState('data')
  const [fCategory, setFCategory] = useState('')
  const addAccount = async (e) => {
    e.preventDefault()
    if (!newAcc.trim()) return
    await supabase.from('accounts').insert({ name: newAcc.trim() }); setNewAcc(''); reload()
  }
  const delAccount = async (id) => { await supabase.from('accounts').delete().eq('id', id); reload() }

  const nameOf = (e) => e.place || catById[e.category_id]?.name || ''
  let variableExpenses = monthExpenses.filter((e) => !e.fixed_id && !e.piggy_deposit)
  if (fPerson) variableExpenses = variableExpenses.filter((e) => e.paid_by === fPerson)
  if (fAccount) variableExpenses = variableExpenses.filter((e) => (e.account || '') === fAccount)
  if (fCategory) variableExpenses = variableExpenses.filter((e) => e.category_id === fCategory)
  variableExpenses = [...variableExpenses].sort((a, b) => {
    if (sortBy === 'valor_desc') return Number(b.amount) - Number(a.amount)
    if (sortBy === 'valor_asc') return Number(a.amount) - Number(b.amount)
    if (sortBy === 'az') return nameOf(a).localeCompare(nameOf(b))
    return (b.date || '').localeCompare(a.date || '')
  })
  const shownTotal = variableExpenses
    .filter((e) => (e.pay_status ?? 'Não') !== 'Não contabilizado')
    .reduce((s, e) => s + Number(e.amount), 0)
  const fixedPaidTotal = Object.values(paidFixedThisMonth).reduce((s, e) => s + Number(e.amount), 0)
  const fixedPendingTotal = monthFixed
    .filter((f) => !paidFixedThisMonth[f.id])
    .reduce((s, f) => s + Number(f.amount), 0)

  return (
    <>
      {pop && (<div className="note-pop" style={{ left: pop.x, top: pop.y }}>{pop.text}</div>)}
      <KpiSummary {...props} />
      {/* ---------- FIXOS DO MES ---------- */}
      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Fixos do mês
          <button className="icon-btn" title={manageFixed ? 'fechar' : 'gerir'} onClick={() => setManageFixed((v) => !v)}><IconGear /></button>
        </h2>
        {(manageFixed ? fixedExpenses.length : monthFixed.length) === 0 ? (
          <div className="empty">Nenhum gasto fixo. Toque na engrenagem para cadastrar.</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
              Pago: {money(fixedPaidTotal)} · A pagar: {money(fixedPendingTotal)}
            </div>
            {(manageFixed
              ? [...fixedExpenses].sort((a, b) => (catById[a.category_id]?.name || '').localeCompare(catById[b.category_id]?.name || ''))
              : monthFixed
            ).map((f) => {
              const paidRow = paidFixedThisMonth[f.id]
              const isPaid = Boolean(paidRow)
              const shown = isPaid ? Number(paidRow.amount) : Number(f.amount)
              const i = categories.findIndex((x) => x.id === f.category_id)
              const activeNow = fixedActiveIn(f, month)
              return (
                <div key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="item" style={{ borderBottom: 'none', opacity: f.active ? 1 : 0.55 }}>
                    <div className="info">
                      <span className="dot" style={{ background: catById[f.category_id]?.color || PALETTE[(i + 12) % PALETTE.length] }} />
                      <div>
                        <div className="desc">{catById[f.category_id]?.name || f.description}{f.to_reserve && <span className="tag" style={{ marginLeft: 6, background: '#ccfbf1', color: '#0f766e' }}>→ reservas</span>}</div>
                        <div className="meta">dia {f.day_of_month} · {f.paid_by}{f.account ? ` · ${f.account}` : ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="amt" style={isPaid ? null : { color: 'var(--muted)' }}>{money(shown)}</span>
                      {activeNow && (
                        <button className="btn btn-sm" style={isPaid ? { background: '#dcfce7', color: '#166534' } : {}}
                          onClick={() => (isPaid ? unmarkPaid(f) : markPaid(f))}>
                          {isPaid ? 'pago ✓' : 'marcar pago'}
                        </button>
                      )}
                    </div>
                  </div>
                  {manageFixed && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 0 10px', fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
                      <span>valor:</span>
                      <input style={{ width: 90, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6 }}
                        inputMode="decimal" defaultValue={f.amount}
                        onBlur={(e) => e.target.value != f.amount && updateFixedAmount(f, e.target.value)} />
                      <span>fim:</span>
                      <input type="month" defaultValue={f.end_month || ''} style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6 }}
                        onChange={(e) => setFixedEnd(f, e.target.value)} />
                      <button className="btn btn-sm btn-ghost" style={f.to_reserve ? { color: '#0f766e', fontWeight: 600 } : {}}
                        onClick={() => toggleFixedReserve(f)}>{f.to_reserve ? '→ reservas ✓' : '→ reservas'}</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => toggleFixedActive(f)}>{f.active ? 'desativar' : 'reativar'}</button>
                      <button className="icon-btn" title="excluir" style={{ marginLeft: 'auto' }} onClick={() => delFixed(f.id)}><IconTrash /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {manageFixed && (
          <form onSubmit={addFixed} style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3>Adicionar gasto fixo</h3>
            <div className="field">
              <label>Categoria</label>
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} required>
                <option value="">Selecione…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="row">
              <div className="field"><label>Valor (€)</label>
                <input inputMode="decimal" value={fAmount} placeholder="0,00" onChange={(e) => setFAmount(e.target.value)} required /></div>
              <div className="field"><label>Dia</label>
                <input inputMode="numeric" value={fDay} onChange={(e) => setFDay(e.target.value)} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Quem</label>
                <select value={fWho} onChange={(e) => setFWho(e.target.value)}>{WHO.map((w) => <option key={w}>{w}</option>)}</select></div>
              <div className="field"><label>Conta</label>
                <select value={fAcc} onChange={(e) => setFAcc(e.target.value)}>
                  <option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select></div>
            </div>
            <div className="row">
              <div className="field"><label>Início</label>
                <input type="month" value={fStart} onChange={(e) => setFStart(e.target.value)} /></div>
              <div className="field"><label>Fim (opcional)</label>
                <input type="month" value={fEnd} onChange={(e) => setFEnd(e.target.value)} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: '4px 0 12px' }}>
              <input type="checkbox" checked={fToReserve} onChange={(e) => setFToReserve(e.target.checked)} />
              Enviar às reservas (ao pagar, entra na poupança)
            </label>
            <button className="btn btn-ghost">Adicionar gasto fixo</button>
          </form>
        )}
      </div>

      {/* ---------- NOVO GASTO AVULSO ---------- */}
      <div className="card">
        <h2>{editingExpId ? 'Editar gasto' : 'Novo gasto (avulso)'}</h2>
        <form id="gasto-form" onSubmit={addExpense}>
          <div className="row">
            <div className="field"><label>Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="field"><label>Valor (€)</label>
              <input ref={amountRef} inputMode="decimal" value={amount} placeholder="0,00" onChange={(e) => setAmount(e.target.value)} required /></div>
          </div>
          <div className="field"><label>Categoria</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Selecione…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="row">
            <div className="field"><label>Quem pagou</label>
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>{WHO.map((w) => <option key={w}>{w}</option>)}</select></div>
            <div className="field"><label>Conta / Banco</label>
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select></div>
          </div>
          <div className="field"><label>Descrição</label>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="ex: Penny, Amazon…" /></div>
          <div className="field"><label>Pago?</label>
            <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>{PAY.map((p) => <option key={p}>{p}</option>)}</select></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12 }}>
            <input type="checkbox" checked={toReserve} onChange={(e) => setToReserve(e.target.checked)} />
            Enviar à poupança (vai para as reservas de quem pagou)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} disabled={busy}>{busy ? 'Salvando…' : editingExpId ? 'Salvar alteração' : 'Adicionar gasto'}</button>
            {editingExpId && <button type="button" className="btn btn-ghost" style={{ flex: 0, padding: '13px 16px' }} onClick={cancelExpEdit}>Cancelar</button>}
          </div>
          {flash && <div className="msg ok" style={{ marginTop: 10 }}>{flash}</div>}
        </form>
      </div>

      {/* ---------- LISTA DE AVULSOS ---------- */}
      <div className="card">
        <h2>Gastos avulsos do mês</h2>
        <div className="filters">
          <select value={fPerson} onChange={(e) => setFPerson(e.target.value)}>
            <option value="">Quem: todos</option>
            {WHO.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={fAccount} onChange={(e) => setFAccount(e.target.value)}>
            <option value="">Banco: todos</option>
            {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
          <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
            <option value="">Tipo: todos</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="data">Data (recente)</option>
            <option value="valor_desc">Valor (maior)</option>
            <option value="valor_asc">Valor (menor)</option>
            <option value="az">A → Z</option>
          </select>
        </div>
        {variableExpenses.length === 0 ? (
          <div className="empty">Nenhum gasto avulso neste mês.</div>
        ) : (
          variableExpenses.map((e) => {
            const c = catById[e.category_id]
            const i = categories.findIndex((x) => x.id === e.category_id)
            const st = e.pay_status ?? 'Não'
            const badge = st === 'Sim' ? { t: 'pago', s: { background: '#dcfce7', color: '#166534' } }
              : st === 'Não contabilizado' ? { t: 'n/ contab.', s: { background: '#e2e8f0', color: '#475569' } }
              : { t: 'a pagar', s: { background: '#fee2e2', color: '#b91c1c' } }
            return (
              <div className="item" key={e.id}>
                <div className="info">
                  <span className="dot" style={{ background: c?.color || PALETTE[(i + 12) % PALETTE.length] }} />
                  <div>
                    <div className="desc">{e.place || c?.name}
                      {e.place && (
                        <span className="info-i" onMouseEnter={(ev) => showPop(ev, e.place)} onMouseLeave={() => setPop(null)}><IconInfo size={12} /></span>
                      )}
                      <span className="tag" style={{ marginLeft: 6, ...badge.s }}>{badge.t}</span></div>
                    <div className="meta">{c?.name} · {fmtDate(e.date)} · <span style={{ color: e.paid_by === 'Nathi' ? 'rgba(239,68,68,.65)' : e.paid_by === 'Gui' ? 'rgba(16,185,129,.9)' : 'inherit', fontWeight: 600 }}>{e.paid_by}</span>{e.account ? ` · ${e.account}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="amt" style={st === 'Não contabilizado' ? { textDecoration: 'line-through', color: 'var(--muted)' } : null}>{money(e.amount)}</span>
                  <button className="icon-btn" title="editar" onClick={() => editExpense(e)}><IconEdit /></button>
                  <button className="x" title="excluir" onClick={() => removeExpense(e.id)}><IconTrash /></button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="card">
        <h2>Gasto total mensal</h2>
        <div className="value" style={{ fontSize: 24, fontWeight: 700 }}>{money(shownTotal)}</div>
        {(fPerson || fAccount || fCategory) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>filtrado:</span>
            {fPerson && <span className="tag" style={{ background: '#e1f5ee', color: '#0f6e56' }}>{fPerson}</span>}
            {fAccount && <span className="tag" style={{ background: '#e1f5ee', color: '#0f6e56' }}>{fAccount}</span>}
            {fCategory && <span className="tag" style={{ background: '#e1f5ee', color: '#0f6e56' }}>{catById[fCategory]?.name}</span>}
          </div>
        )}
        <div className="meta" style={{ marginTop: 6 }}>{variableExpenses.length} lançamento(s) · não conta "não contabilizado"</div>
      </div>
    </>
  )
}
