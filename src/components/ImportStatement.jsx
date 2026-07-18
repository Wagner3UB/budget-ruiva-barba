import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import { money, fmtDate } from '../lib/helpers'

const WHO = ['Gui', 'Nathi', 'Casal']

// Regras de categorização por palavra-chave no texto do movimento
const CAT_RULES = [
  [/penny|md ferrara|\bmd\b|coop|changarro|esselunga|conad|lidl|carrefour|eurospin|\baldi\b|mercat|supermerc/i, 'Mercado'],
  [/amazon/i, 'Amazon'],
  [/farmacia|farmácia/i, 'Farmácia'],
  [/ristorant|pizz|\bbar\b|pasticc|strabar|atlantic|gusto|glovo|deliveroo|just eat|mc ?donald|burger/i, 'Restaurante'],
  [/q8|\beni\b|agip|tamoil|esso|benzin|carburant|distributore/i, 'Carro gasolina'],
  [/trenital|italo|autostrad|pedagi|telepass|airbnb|booking|ryanair|easyjet|flixbus/i, 'Viagens'],
  [/\btim\b|vodafone|\bwind\b|iliad|fastweb/i, 'Celular'],
  [/palestr|\bgym\b|\bfit\b|academ/i, 'Academia'],
  [/netflix|spotify|disney|prime video|hbo|dazn/i, 'Extra'],
]
const guessCategory = (text) => {
  for (const [re, name] of CAT_RULES) if (re.test(text)) return name
  return 'Extra'
}

const parseImporto = (v) => {
  let s = String(v).replace(/eur/i, '').trim().replace(/\s/g, '')
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.')
  else if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  return parseFloat(s) || 0
}
const toISO = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const s = String(v).match(/(\d{4})-(\d{2})-(\d{2})/)
  return s ? s[0] : ''
}
const cleanDesc = (causale) => String(causale || '')
  .replace(/\s{2,}[A-Z]{2}\s*$/, '')      // remove país no fim
  .replace(/\s{2,}\S+\s+\S{2}\s*$/, '')   // remove cidade + país
  .replace(/\s{2,}/g, ' ').trim()

function classify(causale, movimento, amount) {
  const t = `${causale} ${movimento}`.toLowerCase()
  if (t.includes('fixo') || t.includes('fixos')) return amount < 0 ? 'reserva' : 'ignorar'
  if (t.includes('giro conto') || t.includes('trasferimento su conto') || (t.includes('bonifico') && t.includes('trezub'))) return 'ignorar'
  return amount < 0 ? 'gasto' : 'entrada'
}

export default function ImportStatement({ categories, accounts, expenses, incomes, reload }) {
  const [rows, setRows] = useState([])
  const [account, setAccount] = useState('BBVA Gui')
  const [person, setPerson] = useState('Gui')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const catByName = useMemo(() => {
    const m = {}
    for (const c of categories) m[c.name.toLowerCase()] = c
    return m
  }, [categories])

  // assinaturas existentes p/ evitar duplicar
  const existing = useMemo(() => {
    const set = new Set()
    for (const e of expenses) set.add(`${e.date}|${Number(e.amount).toFixed(2)}`)
    for (const i of incomes) set.add(`${i.date}|${Number(i.amount).toFixed(2)}`)
    return set
  }, [expenses, incomes])

  const matchCat = (name) => catByName[name.toLowerCase()]?.id || ''

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg('')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    // acha a linha de cabeçalho (contém "Importo" e "Causale")
    let hi = data.findIndex((r) => r.some((c) => /importo/i.test(String(c))) && r.some((c) => /causale/i.test(String(c))))
    if (hi < 0) { setMsg('Não encontrei o cabeçalho do extrato (Causale/Importo).'); return }
    const head = data[hi].map((c) => String(c).toLowerCase())
    const col = (name) => head.findIndex((h) => h.includes(name))
    const ci = { dataVal: col('data valuta'), data: col('data'), causale: col('causale'), mov: col('movimento'), imp: col('importo') }
    const parsed = []
    for (let r = hi + 1; r < data.length; r++) {
      const row = data[r]
      if (!row || row.every((c) => c === '' || c == null)) continue
      const amount = parseImporto(row[ci.imp])
      if (!amount) continue
      const date = toISO(row[ci.dataVal] !== '' ? row[ci.dataVal] : row[ci.data])
      const causale = cleanDesc(row[ci.causale])
      const mov = String(row[ci.mov] || '')
      const type = classify(row[ci.causale], mov, amount)
      const catName = guessCategory(`${row[ci.causale]} ${mov}`)
      const dup = existing.has(`${date}|${Math.abs(amount).toFixed(2)}`)
      parsed.push({
        id: `${r}`, date, desc: causale || mov, amount, type,
        categoryId: matchCat(catName), include: type !== 'ignorar' && !dup, dup,
      })
    }
    setRows(parsed)
    if (!parsed.length) setMsg('Nenhum movimento encontrado no arquivo.')
  }

  const upd = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

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
          amount: Math.abs(r.amount), paid_by: person, account, pay_status: 'Sim',
          to_reserve: r.type === 'reserva',
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

  return (
    <>
      <div className="card">
        <h2>Importar extrato do banco</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
          Selecione o arquivo (.xlsx/.csv) do extrato. O app identifica tipo, categoria, data e valor.
          Revise e confirme. Movimentos já lançados aparecem marcados como duplicados.
        </p>
        <div className="row">
          <div className="field"><label>Conta / Banco</label>
            <select value={account} onChange={(e) => setAccount(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select></div>
          <div className="field"><label>Pessoa</label>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              {WHO.map((w) => <option key={w}>{w}</option>)}
            </select></div>
        </div>
        <div className="field">
          <label>Arquivo do extrato</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
        </div>
        {msg && <div className={`msg ${msg.startsWith('Importado') ? 'ok' : 'err'}`}>{msg}</div>}
      </div>

      {rows.length > 0 && (
        <div className="card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Prévia ({rows.length})
            <button className="btn btn-sm" disabled={busy || !nInc} onClick={doImport}>
              {busy ? 'Importando…' : `Importar ${nInc}`}
            </button>
          </h2>
          {rows.map((r) => (
            <div className="item" key={r.id} style={{ opacity: r.include ? 1 : 0.5 }}>
              <div className="info" style={{ gap: 8 }}>
                <input type="checkbox" checked={r.include} onChange={(e) => upd(r.id, { include: e.target.checked })} />
                <div>
                  <div className="desc">
                    <input value={r.desc} onChange={(e) => upd(r.id, { desc: e.target.value })}
                      style={{ border: 'none', borderBottom: '1px solid var(--border)', fontSize: 15, width: 160, background: 'transparent' }} />
                    {r.dup && <span className="tag" style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e' }}>duplicado</span>}
                  </div>
                  <div className="meta" style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span>{fmtDate(r.date)}</span>
                    <select value={r.type} onChange={(e) => upd(r.id, { type: e.target.value, include: e.target.value !== 'ignorar' })}
                      style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 4px' }}>
                      {TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    {(r.type === 'gasto') && (
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
          ))}
        </div>
      )}
    </>
  )
}
