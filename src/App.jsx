import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseReady } from './supabaseClient'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Expenses from './components/Expenses'
import Income from './components/Income'
import Budgets from './components/Budgets'
import PiggyBank from './components/PiggyBank'
import ImportStatement from './components/ImportStatement'
import Settings from './components/Settings'
import Graficos from './components/Graficos'
import { monthKey, periodKey } from './lib/helpers'
import { IconMenu, IconClose, IconLogout, IconSun, IconMoon, IconChart, IconReceipt, IconIncome, IconTarget, IconHome, IconGem, IconImport, IconGear, IconPie } from './components/icons'

const TABS = [
  { id: 'resumo', label: 'Resumo', Icon: IconChart },
  { id: 'gastos', label: 'Gastos', Icon: IconReceipt },
  { id: 'entradas', label: 'Entradas', Icon: IconIncome },
  { id: 'orcamento', label: 'Orçamento', Icon: IconTarget },
  { id: 'cofrinho', label: 'Casa', Icon: IconHome },
  { id: 'nathi', label: 'Nathi', Icon: IconGem },
  { id: 'graficos', label: 'Gráficos', Icon: IconPie },
  { id: 'importar', label: 'Importar', Icon: IconImport },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumo')
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved) return saved
    } catch (e) {}
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch (e) {}
  }, [theme])
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

  const monthExpenses = expenses.filter((x) => periodKey(x.date) === month)

  const shared = {
    categories, expenses, monthExpenses, recurring, goals,
    accounts, incomes, balances, fixedExpenses, houseTaxes, piggyYear, taxPayments, month, setMonth, theme, reload: loadAll,
  }

  return (
    <div className="app">
      <header className="appheader">
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div className="logo-mark">R&amp;B</div>
          <div style={{ minWidth: 0 }}>
            <h1>Ruiva &amp; Barba Financials</h1>
            <div className="sub">{session.user.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="hicon nav-burger" title="menu" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
          <button className="hicon" title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button className={`hicon ${tab === 'admin' ? 'hicon-on' : ''}`} title="Admin" onClick={() => setTab('admin')}><IconGear /></button>
          <button className="hicon" title="Sair" onClick={() => supabase.auth.signOut()}><IconLogout /></button>
        </div>
      </div>

      <nav className={`topnav ${menuOpen ? 'open' : ''}`}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''}
            onClick={() => { setTab(t.id); setMenuOpen(false) }}>
            <t.Icon /><span>{t.label}</span>
          </button>
        ))}
      </nav>
      </header>

      <div className="content">
        {tab === 'resumo' && <Dashboard {...shared} setMonth={setMonth} />}
        {tab === 'gastos' && <Expenses {...shared} />}
        {tab === 'entradas' && <Income {...shared} />}
        {tab === 'orcamento' && <Budgets {...shared} />}
        {tab === 'cofrinho' && <PiggyBank piggy="casa" {...shared} />}
        {tab === 'nathi' && <PiggyBank piggy="nathi" {...shared} />}
        {tab === 'graficos' && <Graficos {...shared} />}
        {tab === 'importar' && <ImportStatement {...shared} />}
        {tab === 'admin' && <Settings {...shared} />}
      </div>
    </div>
  )
}
