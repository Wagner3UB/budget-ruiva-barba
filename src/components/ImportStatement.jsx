import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import { money, fmtDate } from '../lib/helpers'
import { IconClose } from './icons'

const WHO = ['Gui', 'Nathi', 'Casal']

// Regras de categorização por palavra-chave no texto do movimento
const CAT_RULES = [
  [/penny|md ferrara|\bmd\b|coop|conad|lidl|carrefour|eurospin|\baldi\b|esselunga|mercat|supermerc/i, 'Mercado'],
  [/amazon|amzn/i, 'Amazon'],
  [/farmacia|farmácia/i, 'Farmácia'],
  [/ristorant|pizz|\bbar\b|pasticc|gelateri|strabar|atlantic|gusto|glovo|deliveroo|just eat|mc ?donald|burger/i, 'Restaurante'],
  [/affitto/i, 'Aluguel'],
  [/condominio|condomínio/i, 'Condomínio'],
  [/\bhera\b/i, 'Hera'],
  [/volkswagen|installment|payment loan/i, 'Carro parcela'],
  [/worldpay|instant ink|hp inc/i, 'HP'],
  [/wind|vodafone|\btim\b|iliad|fastweb/i, 'Internet'],
  [/q8|\beni\b|agip|tamoil|esso|benzin|carburant|distributore/i, 'Carro gasolina'],
  [/trenital|italo|autostrad|pedagi|telepass|airbnb|booking|ryanair|easyjet|flixbus/i, 'Viagens'],
  [/palestr|\bgym\b|\bfit\b|academ/i, 'Academia'],
  [/netflix|spotify|disney|prime video|\bhbo\b|dazn/i, 'Extra'],
]
const guessCategory = (text) => {
  for (const [re, name] of CAT_RULES) if (re.test(text)) return name
  return 'Extra'
}

const parseImporto = (v) => {
  let s = String(v).replace(/eur/i, '').trim().replace(/\s/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  return parseFloat(s) || 0
}
const toISO = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const s = String(v).match(/(\d{4})-(\d{2})-(\d{2})/)
  return s ? s[0] : ''
}
// BBVA: "WWW.AMAZON.IT   LUXEMBOURG  LU" -> "WWW.AMAZON.IT"
const cleanBBVA = (causale) => String(causale || '')
  .replace(/\s{2,}\S+\s+[A-Z]{2}\s*$/, '').replace(/\s{2,}[A-Z]{2}\s*$/, '')
  .replace(/\s{2,}/g, ' ').trim()
// ING: extrai o comerciante/beneficiário da descrição longa
const cleanING = (causale, descr) => {
  const d = String(descr || '')
  let m = d.match(/presso\s+(.+?)(?:\s+-\s+Transazione|$)/i); if (m) return m[1].trim()
  m = d.match(/A favore di\s+(.+?)\s+IBAN/i); if (m) return m[1].trim()
  m = d.match(/Creditor id\.\s*\S+\s+(.+?)\s+Id Mandato/i); if (m) return m[1].trim()
  m = d.match(/Note:\s*(.+)$/i); if (m) return m[1].trim()
  return String(causale || '').trim()
}

function classify(text, amount) {
  const t = text.toLowerCase()
  if (t.includes('saldo inizial') || t.includes('saldo final')) return 'ignorar'
  if (t.includes('fixo') || t.includes('fixos')) return amount < 0 ? 'reserva' : 'ignorar'
  if (t.includes('giroconto') || t.includes('giro conto') || t.includes('trasferimento su conto')) return 'ignorar'
  return amount < 0 ? 'gasto' : 'entrada'
}

function parseCSV(text, delim) {
  const rows = []; let row = []; let cur = ''; let inq = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inq) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inq = false }
      else cur += ch
    } else {
      if (ch === '"') inq = true
      else if (ch === delim) { row.push(cur); cur = '' }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else if (ch === '\r') { /* ignora */ }
      else cur += ch
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}

export default function ImportStatement({ categories, accounts, expenses, incomes, reload }) {
  const [rows, setRows] = useState([])
  const [account, setAccount] = useState('')
  const [person, setPerson] = useState('Gui')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const catByName = useMemo(() => {
    const m = {}; for (const c of categories) m[c.name.toLowerCase()] = c; return m
  }, [categories])
  const matchCat = (name) => catByName[name.toLowerCase()]?.id || ''

  // mapa: valor -> lista de datas já existentes (p/ detectar duplicado por valor + data próxima)
  const existByAmount = useMemo(() => {
    const m = {}
    const add = (amt, date) => { const k = Math.abs(Number(amt)).toFixed(2); (m[k] = m[k] || []).push(date) }
    for (const e of expenses) add(e.amount, e.date)
    for (const i of incomes) add(i.amount, i.date)
    return m
  }, [expenses, incomes])
  const DUP_WINDOW = 4 // dias de tolerância entre datas
  const daysBetween = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg('')
    let data
    if (/\.csv$/i.test(file.name)) {
      const text = await file.text()
      const firstLine = text.split('\n')[0]
      const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ','
      data = parseCSV(text, delim)
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    }
    const hi = data.findIndex((r) => {
      const low = r.map((c) => String(c).toLowerCase())
      const bbva = low.some((h) => h.includes('importo')) && low.some((h) => h.includes('causale'))
      const ing = low.some((h) => h.includes('uscite')) && low.some((h) => h.includes('entrate'))
      return bbva || ing
    })
    if (hi < 0) { setMsg('Não reconheci o formato do extrato (BBVA ou ING).'); return }
    const head = data[hi].map((c) => String(c).toLowerCase())
    const col = (name) => head.findIndex((h) => h.includes(name))
    const isING = head.some((h) => h.includes('uscite'))
    const parsed = []
    const localMap = {}
    for (const k in existByAmount) localMap[k] = [...existByAmount[k]]
    const isDup = (amt, date) => {
      const k = Math.abs(amt).toFixed(2)
      const arr = localMap[k]
      return !!arr && arr.some((d) => d && daysBetween(d, date) <= DUP_WINDOW)
    }
    for (let r = hi + 1; r < data.length; r++) {
      const row = data[r]
      if (!row || row.every((c) => c === '' || c == null)) continue
      let date, amount, merchant, text
      if (isING) {
        const uscite = parseImporto(row[col('uscite')])
        const entrate = parseImporto(row[col('entrate')])
        amount = uscite ? uscite : entrate
        const causale = row[col('causale')]
        const descr = row[col('descrizione')]
        date = toISO(row[col('data valuta')] || row[col('data contabile')])
        merchant = cleanING(causale, descr)
        text = `${causale} ${descr}`
      } else {
        amount = parseImporto(row[col('importo')])
        date = toISO((row[col('data valuta')] !== '' ? row[col('data valuta')] : row[col('data')]))
        merchant = cleanBBVA(row[col('causale')])
        text = `${row[col('causale')]} ${row[col('movimento')]}`
      }
      if (!amount || !date) continue
      const type = classify(text, amount)
      const dup = isDup(amount, date)
      const k = Math.abs(amount).toFixed(2)
      ;(localMap[k] = localMap[k] || []).push(date)
      parsed.push({
        id: `${r}`, date, desc: merchant || text.trim().slice(0, 40), amount, type,
        categoryId: matchCat(guessCategory(text)), include: type !== 'ignorar' && !dup, dup,
      })
    }
    setRows(parsed)
    if (!parsed.length) setMsg('Nenhum movimento encontrado no arquivo.')
  }

  const upd = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const setMany = (list, val) => { const ids = new Set(list.map((r) => r.id)); setRows((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, include: val } : r))) }

  const ensureCat = async (name) => {
    const f = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (f) return f.id
    const { data } = await supabase.from('categories').insert({ name, ideal: 0, color: '#64748b' }).select().single()
    return data?.id || null
  }

  const doImport = async () => {
    const sel = rows.filter((r) => r.include && r.type !== 'ignorar')
    if (!sel.length) { setMsg('Nada selecionado para importar.'); return }
    setBusy(true)
    const exp = [], inc = []
    for (const r of sel) {
      if (r.type === 'entrada') {
        inc.push({ month: r.date.slice(0, 7), date: r.date, person, description: r.desc || 'Entrada', amount: Math.abs(r.amount) })
      } else {
        let catId = r.categoryId
        if (r.type === 'reserva') catId = await ensureCat(person === 'Nathi' ? 'Taxas Nathi' : 'Fixos Gui')
        exp.push({
          date: r.date, category_id: catId || null, description: r.desc, place: r.desc,
          amount: Math.abs(r.amount), paid_by: person, account, pay_status: 'Sim', to_reserve: r.type === 'reserva',
        })
      }
    }
    let err = null
    if (exp.length) { const { error } = await supabase.from('expenses').insert(exp); err = err || error }
    if (inc.length) { const { error } = await supabase.from('incomes').insert(inc); err = err || error }
    setBusy(false)
    if (err) { setMsg('Erro ao importar: ' + err.message); return }
    setMsg(`Importado: ${exp.length} gasto(s) e ${inc.length} entrada(s).`)
    setRows([]); reload()
  }

  const TYPES = ['gasto', 'entrada', 'reserva', 'ignorar']
  const nInc = rows.filter((r) => r.include && r.type !== 'ignorar').length
  const saidas = rows.filter((r) => r.amount < 0)
  const entradas = rows.filter((r) => r.amount >= 0)

  const renderRow = (r) => (
    <div className="item" key={r.id} style={{ opacity: r.include ? 1 : 0.5 }}>
      <div className="info" style={{ gap: 8 }}>
        <input type="checkbox" checked={r.include} onChange={(e) => upd(r.id, { include: e.target.checked })} />
        <div>
          <div className="desc">
            <input value={r.desc} onChange={(e) => upd(r.id, { desc: e.target.value })}
              style={{ border: 'none', borderBottom: '1px solid var(--border)', fontSize: 14, width: 130, background: 'transparent' }} />
            {r.dup && <span className="tag" style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e' }}>duplicado?</span>}
          </div>
          <div className="meta" style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span>{fmtDate(r.date)}</span>
            <select value={r.type} onChange={(e) => upd(r.id, { type: e.target.value, include: e.target.value !== 'ignorar' })}
              style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 4px' }}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            {r.type === 'gasto' && (
              <select value={r.categoryId} onChange={(e) => upd(r.id, { categoryId: e.target.value })}
                style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 4px' }}>
                <option value="">categoria…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>
      <span className="amt" style={{ color: r.amount < 0 ? 'var(--text)' : 'var(--green)' }}>
        {r.amount < 0 ? money(Math.abs(r.amount)) : '+' + money(r.amount)}
      </span>
    </div>
  )

  return (
    <>
      <div className="card">
        <h2>Importar extrato do banco</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          Aceita extratos do <b>BBVA</b> (.xlsx) e do <b>ING</b> (.csv). O app identifica tipo, categoria,
          data e valor. Revise e confirme. Movimentos já lançados aparecem como duplicados.
        </p>
        <div className="field">
          <label>Arquivo do extrato</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
        </div>
        {msg && <div className={`msg ${msg.startsWith('Importado') ? 'ok' : 'err'}`}>{msg}</div>}
      </div>

      {rows.length > 0 && (
        <div className="modal-overlay" onClick={() => setRows([])}>
        <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h2 style={{ margin: 0 }}>Revisar importação ({rows.length})</h2>
            <button className="icon-btn" title="fechar" onClick={() => setRows([])}><IconClose size={18} /></button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 8px' }}>
            Ajuste o que precisar. Nada é gravado até você confirmar.
          </p>
          <div className="row">
            <div className="field"><label>Conta / Banco</label>
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">Selecione…</option>
                {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select></div>
            <div className="field"><label>Pessoa</label>
              <select value={person} onChange={(e) => setPerson(e.target.value)}>
                {WHO.map((w) => <option key={w}>{w}</option>)}
              </select></div>
          </div>
          {rows.some((r) => r.dup) && (
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10, alignSelf: 'flex-start' }}
              onClick={() => setRows((rs) => rs.filter((r) => !r.dup))}>
              Remover duplicados ({rows.filter((r) => r.dup).length})
            </button>
          )}
          <div className="import-cols">
            <div className="import-col">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={saidas.length > 0 && saidas.every((r) => r.include)}
                  onChange={(e) => setMany(saidas, e.target.checked)} /> Saídas ({saidas.length})
              </h3>
              <div className="import-col-scroll">
                {saidas.length ? saidas.map(renderRow) : <div className="empty">—</div>}
              </div>
            </div>
            <div className="import-col">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={entradas.length > 0 && entradas.every((r) => r.include)}
                  onChange={(e) => setMany(entradas, e.target.checked)} /> Entradas ({entradas.length})
              </h3>
              <div className="import-col-scroll">
                {entradas.length ? entradas.map(renderRow) : <div className="empty">—</div>}
              </div>
            </div>
          </div>
          {!account && <div className="msg err" style={{ marginTop: 10 }}>Selecione a conta (no topo da tela) antes de importar.</div>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setRows([])}>Cancelar</button>
            <button className="btn" disabled={busy || !nInc || !account} onClick={doImport}>
              {busy ? 'Importando…' : `Importar ${nInc}`}
            </button>
          </div>
        </div>
        </div>
      )}
    </>
  )
}
