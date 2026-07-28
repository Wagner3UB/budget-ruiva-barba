import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { PALETTE } from '../lib/helpers'
import { IconTrash, IconSun, IconMoon, IconLogout } from './icons'

export default function Settings({ categories, accounts, reload, theme, setTheme, onLogout, email }) {
  const [cat, setCat] = useState('')
  const [acc, setAcc] = useState('')
  const [msg, setMsg] = useState('')

  const addCat = async (e) => {
    e.preventDefault()
    if (!cat.trim()) return
    const color = PALETTE[categories.length % PALETTE.length]
    const { error } = await supabase.from('categories').insert({ name: cat.trim(), ideal: 0, color })
    if (error) setMsg('Erro: ' + error.message)
    else { setMsg(''); setCat(''); reload() }
  }
  const renameCat = async (c, name) => {
    if (name.trim() && name.trim() !== c.name) { await supabase.from('categories').update({ name: name.trim() }).eq('id', c.id); reload() }
  }
  const delCat = async (id) => { await supabase.from('categories').delete().eq('id', id); reload() }

  const addAcc = async (e) => {
    e.preventDefault()
    if (!acc.trim()) return
    const { error } = await supabase.from('accounts').insert({ name: acc.trim() })
    if (error) setMsg('Erro: ' + error.message)
    else { setMsg(''); setAcc(''); reload() }
  }
  const delAcc = async (id) => { await supabase.from('accounts').delete().eq('id', id); reload() }

  return (
    <>
      {msg && <div className="msg err">{msg}</div>}

      <div className="card">
        <h2>Preferências</h2>
        <div className="item">
          <span className="desc">Tema {theme === 'dark' ? 'escuro' : 'claro'}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'auto' }}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            {theme === 'dark' ? 'Mudar para claro' : 'Mudar para escuro'}
          </button>
        </div>
        <div className="item">
          <span className="desc">{email}</span>
          <button className="btn btn-sm btn-ghost" onClick={onLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'auto' }}>
            <IconLogout /> Sair
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Categorias ({categories.length})</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          Toque no nome para renomear. Excluir uma categoria não apaga os gastos — eles ficam sem categoria.
        </p>
        {categories.map((c) => (
          <div className="item" key={c.id}>
            <span className="info" style={{ gap: 8 }}>
              <span className="dot" style={{ background: c.color || '#94a3b8' }} />
              <input defaultValue={c.name} onBlur={(e) => renameCat(c, e.target.value)}
                style={{ border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', fontSize: 15, width: 180 }} />
            </span>
            <button className="x" title="excluir" onClick={() => delCat(c.id)}><IconTrash /></button>
          </div>
        ))}
        <form onSubmit={addCat} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <input style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}
            value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Nova categoria" />
          <button className="btn btn-sm">Adicionar</button>
        </form>
      </div>

      <div className="card">
        <h2>Contas / Bancos ({accounts.length})</h2>
        {accounts.map((a) => (
          <div className="item" key={a.id}>
            <span className="desc">{a.name}</span>
            <button className="x" title="excluir" onClick={() => delAcc(a.id)}><IconTrash /></button>
          </div>
        ))}
        <form onSubmit={addAcc} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <input style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}
            value={acc} onChange={(e) => setAcc(e.target.value)} placeholder="Nova conta (ex: Revolut)" />
          <button className="btn btn-sm">Adicionar</button>
        </form>
      </div>
    </>
  )
}
