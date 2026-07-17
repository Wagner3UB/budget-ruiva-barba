import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseReady } from './supabaseClient'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Expenses from './components/Expenses'
import Income from './components/Income'
import Budgets from './components/Budgets'
import Goals from './components/Goals'
import PiggyBank from './components/PiggyBank'
import { monthKey } from './lib/helpers'

const TABS = [
  { id: 'resumo', label: 'Resumo', ic: '📊' },
  { id: 'gastos', label: 'Gastos', ic: '🧾' },
  { id: 'entradas', label: 'Entradas', ic: '💰' },
  { id: 'orcamento', label: 'Orçam.', ic: '🎯' },
  { id: 'metas', label: 'Metas', ic: '⭐' },
  { id: 'cofrinho', label: 'Cofrinho', ic: '🐷' },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumo')
  const [month, setMonth] = useState(monthKey())

  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [recurring, setRecurring] = useState([])
  const [goals, setGoals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [incomes, setIncomes] = useState([])
  const [balances, setBalances] = useState([])
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [houseTaxes, setHouseTaxes] = useState([])
  const [piggyYear, setPiggyYear] = useState([])
  const [taxPayments, setTaxPayments] = useState([])

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadAll = useCallback(async () => {
    if (!session) return
    const [c, e, r, g, a, i, b, fx, ht, py, tp] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('recurring').select('*').order('description'),
      supabase.from('goals').select('*').order('name'),
      supabase.from('accounts').select('*').order('name'),
      supabase.from('incomes').select('*').order('created_at', { ascending: false }),
      supabase.from('balances').select('*'),
      supabase.from('fixed_expenses').select('*').order('day_of_month'),
      supabase.from('house_taxes').select('*').order('due_month'),
      supabase.from('piggy_year').select('*'),
      supabase.from('tax_payments').select('*'),
    ])
    setCategories(c.data || [])
    setExpenses(e.data || [])
    setRecurring(r.data || [])
    setGoals(g.data || [])
    setAccounts(a.data || [])
    setIncomes(i.data || [])
    setBalances(b.data || [])
    setFixedExpenses(fx.data || [])
    setHouseTaxes(ht.data || [])
    setPiggyYear(py.data || [])
    setTaxPayments(tp.data || [])
  }, [session])

  useEffect(() => { loadAll() }, [loadAll])

  if (!supabaseReady) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="logo">⚙️</div>
          <h1>Falta configurar</h1>
          <p className="tagline">O app ainda não recebeu as chaves do Supabase.</p>
          <div className="msg err">
            Defina <b>VITE_SUPABASE_URL</b> e <b>VITE_SUPABASE_ANON_KEY</b> nas variáveis de
            ambiente (arquivo .env local ou nas configurações da Vercel) e recarregue. Veja o GUIA.md.
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="login-wrap"><div className="empty">Carregando…</div></div>
  if (!session) return <Login />

  const monthExpenses = expenses.filter((x) => (x.date || '').startsWith(month))

  const shared = {
    categories, expenses, monthExpenses, recurring, goals,
    accounts, incomes, balances, fixedExpenses, houseTaxes, piggyYear, taxPayments, month, reload: loadAll,
  }

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>💶 Gastos do Casal</h1>
          <div className="sub">{session.user.email}</div>
        </div>
        <button onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>

      <div className="content">
        {tab === 'resumo' && <Dashboard {...shared} setMonth={setMonth} />}
        {tab === 'gastos' && <Expenses {...shared} />}
        {tab === 'entradas' && <Income {...shared} />}
        {tab === 'orcamento' && <Budgets {...shared} />}
        {tab === 'metas' && <Goals {...shared} />}
        {tab === 'cofrinho' && <PiggyBank {...shared} />}
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="ic">{t.ic}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
