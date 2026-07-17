import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('E-mail ou senha incorretos.')
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">💶</div>
        <h1>Gastos do Casal</h1>
        <p className="tagline">Entre com seu e-mail e senha</p>
        {err && <div className="msg err">{err}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com" autoComplete="email" required />
          </div>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" required />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
