import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { money } from '../lib/helpers'

export default function Goals({ goals, reload }) {
  const [gName, setGName] = useState('')
  const [gTarget, setGTarget] = useState('')
  const num = (v) => Number(String(v).replace(',', '.')) || 0

  const addGoal = async (e) => {
    e.preventDefault()
    if (!gName || !gTarget) return
    await supabase.from('goals').insert({ name: gName, target: num(gTarget), saved: 0 })
    setGName(''); setGTarget(''); reload()
  }
  const addSaved = async (g, delta) => {
    await supabase.from('goals').update({ saved: Math.max(0, Number(g.saved) + delta) }).eq('id', g.id)
    reload()
  }
  const delGoal = async (id) => { await supabase.from('goals').delete().eq('id', id); reload() }

  return (
    <div className="card">
      <h2>⭐ Metas de economia</h2>
      {goals.length === 0 && <div className="empty">Nenhuma meta ainda.</div>}
      {goals.map((g) => {
        const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0
        return (
          <div className="budget-row" key={g.id}>
            <div className="top">
              <span>{g.name}</span>
              <span>{money(g.saved)} / {money(g.target)}</span>
            </div>
            <div className="progress"><span style={{ width: `${pct}%`, background: 'var(--teal)' }} /></div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => addSaved(g, 50)}>+50</button>
              <button className="btn btn-sm btn-ghost" onClick={() => addSaved(g, 100)}>+100</button>
              <button className="btn btn-sm btn-ghost" onClick={() => addSaved(g, -50)}>-50</button>
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => delGoal(g.id)}>excluir</button>
            </div>
          </div>
        )
      })}
      <form onSubmit={addGoal} style={{ marginTop: 8 }}>
        <div className="row">
          <div className="field"><input placeholder="Nome (ex: Viagem)" value={gName} onChange={(e) => setGName(e.target.value)} /></div>
          <div className="field"><input placeholder="Meta €" inputMode="decimal" value={gTarget} onChange={(e) => setGTarget(e.target.value)} /></div>
        </div>
        <button className="btn btn-ghost">Adicionar meta</button>
      </form>
    </div>
  )
}
