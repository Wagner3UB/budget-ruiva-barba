import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { money, counted } from '../lib/helpers'

export default function Budgets({ categories, monthExpenses, reload }) {
  const [editing, setEditing] = useState(null)
  const [val, setVal] = useState('')

  const spentByCat = useMemo(() => {
    const m = {}
    for (const e of monthExpenses) { if (!counted(e)) continue; m[e.category_id] = (m[e.category_id] || 0) + Number(e.amount) }
    return m
  }, [monthExpenses])

  const rows = categories
    .map((c) => ({ ...c, spent: spentByCat[c.id] || 0, ideal: Number(c.ideal || 0) }))
    .filter((c) => c.ideal > 0 || c.spent > 0)
    .sort((a, b) => (b.spent / (b.ideal || 1)) - (a.spent / (a.ideal || 1)))

  const totIdeal = rows.reduce((s, c) => s + c.ideal, 0)
  const totSpent = rows.reduce((s, c) => s + c.spent, 0)
  const over = rows.filter((c) => c.ideal > 0 && c.spent > c.ideal)

  const save = async (id) => {
    await supabase.from('categories').update({ ideal: Number(String(val).replace(',', '.')) || 0 }).eq('id', id)
    setEditing(null); setVal('')
    reload()
  }

  return (
    <>
      <div className="summary" style={{ marginBottom: 16 }}>
        <div className="box">
          <div className="label">Gasto / Ideal</div>
          <div className="value" style={{ fontSize: 18 }}>{money(totSpent)} <span style={{ color: 'var(--muted)', fontSize: 13 }}>/ {money(totIdeal)}</span></div>
        </div>
        <div className="box">
          <div className="label">Categorias estouradas</div>
          <div className="value" style={{ color: over.length ? 'var(--danger)' : 'var(--green)' }}>{over.length}</div>
        </div>
      </div>

      {over.length > 0 && (
        <div className="warn-banner">
          ⚠️ Você passou do orçamento em: {over.map((c) => c.name).join(', ')}.
        </div>
      )}

      <div className="card">
        <h2>Orçamento por categoria</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          Toque no valor "ideal" para editar.
        </p>
        {rows.map((c) => {
          const pct = c.ideal > 0 ? Math.min(100, (c.spent / c.ideal) * 100) : 100
          const isOver = c.ideal > 0 && c.spent > c.ideal
          const barColor = isOver ? 'var(--danger)' : pct > 80 ? 'var(--amber)' : 'var(--green)'
          return (
            <div className="budget-row" key={c.id}>
              <div className="top">
                <span>{c.name}</span>
                {editing === c.id ? (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <input style={{ width: 90, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
                      inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
                    <button className="btn btn-sm" onClick={() => save(c.id)}>ok</button>
                  </span>
                ) : (
                  <span className={isOver ? 'over' : ''}>
                    {money(c.spent)} /{' '}
                    <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                      onClick={() => { setEditing(c.id); setVal(String(c.ideal)) }}>
                      {money(c.ideal)}
                    </span>
                  </span>
                )}
              </div>
              <div className="progress"><span style={{ width: `${pct}%`, background: barColor }} /></div>
            </div>
          )
        })}
      </div>
    </>
  )
}
