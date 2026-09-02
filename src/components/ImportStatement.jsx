import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import { money, fmtDate, disponivelOf, cofrinhoBalance, periodKey } from '../lib/helpers'
import { IconClose } from './icons'

const WHO = ['Gui', 'Nathi']

// Regras de categorização por palavra-chave no texto do movimento
const CAT_RULES = [
  [/penny|md ferrara|\bmd\b|coop|conad|lidl|carrefour|eurospin|\baldi\b|esselunga|mercat|supermerc|aspiag|despar|tosano|dispensa|iper mura|famila|interspar/i, 'Mercados'],
  [/amazon|amzn/i, 'Amazon'],
  [/farmacia|farmácia/i, 'Farmácia'],
  [/ristorant|pizz|\bbar\b|pasticc|gelateri|strabar|atlantic|gusto|glovo|deliveroo|just eat|mc ?donald|burger/i, 'Restaurante'],
  [/affitto/i, 'Aluguel'],
  [/condominio|condomínio/i, 'Condomínio'],
  [/\bhera\b/i, 'Hera'],
  [/volkswagen|installment|payment loan/i, 'Carro - Parcela'],
  [/worldpay|instant ink|hp inc/i, 'HP'],
  [/wind|vodafone|\btim\b|iliad|fastweb/i, 'Internet'],
  [/q8|\beni\b|agip|tamoil|esso|benzin|carburant|distributore|vega carburanti/i, 'Carro - Gasolina'],
  [/trenital|italo|autostrad|pedagi|telepass|airbnb|booking|ryanair|easyjet|flixbus/i, 'Viagens'],
  [/palestr|\bgym\b|\bfit\b|academ/i, 'Academia'],
  [/netflix|spotify|disney|prime video|\bhbo\b|dazn/i, 'Extras'],
]
const guessCategory = (text) => {
  for (const [re, name] of CAT_RULES) if (re.test(text)) return name
  return 'Extras'
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

// palavras-chave que denunciam transferência entre contas próprias
const TRANSFER_RE = /giro ?conto|trasferimento (su|da) conto|\bfixos? mes\b|\bfixo junho\b/i

function classify(text, amount, ownIbans = []) {
  const t = text.toLowerCase()
  if (t.includes('saldo inizial') || t.includes('saldo final')) return 'ignorar'
  // transferência entre contas próprias (identificada pelo IBAN cadastrado)
  for (const o of ownIbans) {
    if (o.iban && t.includes(o.iban)) {
      // conta poupança: sai da cc pra poupança = depósito; volta da poupança = retirada
      if (o.tipo === 'poupanca') return amount < 0 ? 'deposito' : 'retirada'
      // cc do casal: não existe segunda gastável, então é dinheiro passando entre nós dois = "sexo"
      return 'sexo'
    }
  }
  if (t.includes('fixo') || t.includes('fixos')) return amount < 0 ? 'deposito' : 'ignorar'
  if (TRANSFER_RE.test(t)) return 'ignorar'
  return amount < 0 ? 'gasto' : 'entrada'
}
const isTransferText = (text, ownIbans = []) =>
  TRANSFER_RE.test(text) || ownIbans.some((o) => o.iban && text.toLowerCase().includes(o.iban))

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

export default function ImportStatement({ categories, accounts, expenses, incomes, balances = [], adjustments = [], piggyYear = [], month = '', reload }) {
  const [rows, setRows] = useState([])
  const [account, setAccount] = useState('')
  const [person, setPerson] = useState('Gui')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [stmtBal, setStmtBal] = useState(null)   // saldo no FIM do extrato (mais recente)
  const [stmtInit, setStmtInit] = useState(null) // saldo no INÍCIO do extrato (mais antigo)
  const [popup, setPopup] = useState(null)     // { type:'ok'|'err', text }
  const [flashId, setFlashId] = useState(null)  // linha com campo a corrigir
  const [undoAsk, setUndoAsk] = useState(false) // confirmação de "desfazer último import"
  const accountSelRef = useRef(null)

  // Último import a desfazer. Preferimos o carimbo (import_batch); se o import foi
  // feito ANTES do carimbo existir, caímos no created_at (linhas gravadas juntas).
  const lastImport = useMemo(() => {
    let b = null
    for (const e of expenses) if (e.import_batch && (!b || e.import_batch > b)) b = e.import_batch
    for (const i of incomes) if (i.import_batch && (!b || i.import_batch > b)) b = i.import_batch
    if (b) return { kind: 'batch', key: b }
    let t = null
    for (const x of expenses) if (x.created_at && (!t || x.created_at > t)) t = x.created_at
    for (const x of incomes) if (x.created_at && (!t || x.created_at > t)) t = x.created_at
    return t ? { kind: 'time', key: t } : null
  }, [expenses, incomes])
  const undoWindowMs = lastImport?.kind === 'time' ? new Date(lastImport.key).getTime() - 8000 : null // janela de 8s (gasto+entrada gravados em statements separados)
  const undoWindowStart = undoWindowMs != null ? new Date(undoWindowMs).toISOString() : null
  const inLastImport = (x) => !lastImport ? false
    : lastImport.kind === 'batch' ? x.import_batch === lastImport.key
      : (x.created_at && new Date(x.created_at).getTime() >= undoWindowMs)
  const undoCount = useMemo(() =>
    (lastImport ? expenses.filter(inLastImport).length + incomes.filter(inLastImport).length : 0),
    [lastImport, expenses, incomes])
  const undoLast = async () => {
    if (!lastImport) return
    setBusy(true)
    let e1, e2
    if (lastImport.kind === 'batch') {
      e1 = (await supabase.from('expenses').delete().eq('import_batch', lastImport.key)).error
      e2 = (await supabase.from('incomes').delete().eq('import_batch', lastImport.key)).error
    } else {
      e1 = (await supabase.from('expenses').delete().gte('created_at', undoWindowStart)).error
      e2 = (await supabase.from('incomes').delete().gte('created_at', undoWindowStart)).error
    }
    setBusy(false); setUndoAsk(false)
    if (e1 || e2) { setPopup({ type: 'err', text: 'Erro ao desfazer: ' + (e1 || e2).message }); return }
    setPopup({ type: 'ok', text: `Último import desfeito (${undoCount} lançamento(s) removido(s)).` })
    reload()
  }

  const catByName = useMemo(() => {
    const m = {}; for (const c of categories) m[c.name.toLowerCase()] = c; return m
  }, [categories])
  const matchCat = (name) => catByName[name.toLowerCase()]?.id || ''
  // palavras-chave definidas por você (aba Ajustes) — têm prioridade sobre as regras padrão
  const catKeywords = useMemo(() => {
    const list = []
    for (const c of categories) {
      for (const kw of String(c.keywords || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
        list.push([kw, c.id])
      }
    }
    return list
  }, [categories])
  const matchCatByText = (text) => {
    const t = String(text).toLowerCase()
    for (const [kw, id] of catKeywords) if (t.includes(kw)) return id
    return matchCat(guessCategory(text)) // fallback nas regras padrão embutidas
  }
  const sexoCatId = useMemo(() => categories.find((c) => c.name === 'Sexo')?.id || null, [categories])

  // IBANs das contas próprias (p/ detectar transferência interna)
  const ownIbans = useMemo(
    () => accounts.filter((a) => a.iban).map((a) => ({ iban: String(a.iban).replace(/\s/g, '').toLowerCase(), tipo: a.tipo || 'gastavel' })),
    [accounts])

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
      const bbva = low.some((h) => h.includes('importo')) && (low.some((h) => h.includes('causale')) || low.some((h) => h.includes('parola chiave')))
      const ing = low.some((h) => h.includes('uscite')) && low.some((h) => h.includes('entrate'))
      return bbva || ing
    })
    if (hi < 0) { setMsg('Não reconheci o formato do extrato (BBVA, ING ou poupança).'); return }
    const head = data[hi].map((c) => String(c).toLowerCase())
    const col = (name) => head.findIndex((h) => h.includes(name))
    const isING = head.some((h) => h.includes('uscite'))
    // Extrato da POUPANÇA (formato "Movimenti": tem coluna Beneficiario) — só transferências de/para a cc
    const isPoupanca = head.some((h) => h.includes('beneficiario'))
    const parsed = []
    const localMap = {}
    for (const k in existByAmount) localMap[k] = [...existByAmount[k]]
    const isDup = (amt, date) => {
      const k = Math.abs(amt).toFixed(2)
      const arr = localMap[k]
      return !!arr && arr.some((d) => d && daysBetween(d, date) <= DUP_WINDOW)
    }
    const dispCol = col('disponibile')  // saldo do banco após cada movimento (BBVA)
    let stmt = null, stmtDate = null      // final (mais recente)
    let sInit = null, sInitDate = null    // inicial (mais antigo)
    for (let r = hi + 1; r < data.length; r++) {
      const row = data[r]
      if (!row || row.every((c) => c === '' || c == null)) continue
      let date, amount, merchant, text
      if (isPoupanca) {
        amount = parseImporto(row[col('importo')])
        date = toISO(row[col('data valuta')] !== '' ? row[col('data valuta')] : row[col('data')])
        const nota = row[col('movimento')]           // ex: "BOLLO TAIGO 2026", "FIXO JUNHO"
        const causale = row[col('causale')]           // "TRASFERIMENTO SU/DA CONTO"
        merchant = String(nota || causale || '').trim()
        text = `${causale} ${nota}`
      } else if (isING) {
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
        const mCol = col('causale') >= 0 ? col('causale') : col('parola chiave')
        const parola = String(row[mCol] || '').trim()          // "Bonifico ricevuto" ou o comerciante
        const mov = String(row[col('movimento')] || '').trim() // nota / "Pagamento con carta"
        const oss = col('osservazioni') >= 0 ? String(row[col('osservazioni')] || '').trim() : ''
        // Se a "parola chiave" é genérica (bonifico/transferência), completa o nome com o detalhe.
        if (/bonific|trasferiment|giro ?conto|accredito|addebito/i.test(parola)) {
          const detalhe = [mov, oss].filter((s) => s && s.toLowerCase() !== parola.toLowerCase())
            .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i).join(' · ')
          merchant = cleanBBVA(detalhe ? `${parola}: ${detalhe}` : parola)
        } else {
          merchant = cleanBBVA(parola)
        }
        text = `${parola} ${mov} ${oss}`
      }
      if (!amount || !date) continue
      // Linhas de saldo (ING) — NÃO são movimento: captura e não entra na lista
      if (/saldo inizial/i.test(text)) { sInit = amount; sInitDate = date; continue }
      if (/saldo final/i.test(text)) { stmt = amount; stmtDate = date; continue }
      // BBVA: calcula início/fim pela coluna Disponibile (saldo após cada movimento)
      if (dispCol >= 0) {
        const disp = parseImporto(row[dispCol])
        if (Number.isFinite(disp)) {
          if (stmtDate === null || date > stmtDate) { stmtDate = date; stmt = disp }               // fim = disp do mais recente
          if (sInitDate === null || date < sInitDate) { sInitDate = date; sInit = disp - amount }   // início = disp do mais antigo − o importo dele
        }
      }
      // poupança: + = depósito (cc->poupança), - = retirada (poupança->cc)
      const catId = matchCatByText(text)
      let type = isPoupanca ? (amount < 0 ? 'retirada' : 'deposito') : classify(text, amount, ownIbans)
      // se o movimento bate nas palavras-chave da categoria "Sexo", é transferência do casal
      if (!isPoupanca && sexoCatId && catId === sexoCatId) type = 'sexo'
      const transfer = !isPoupanca && type === 'ignorar' && isTransferText(text, ownIbans)
      const dup = type === 'sexo' ? false : isDup(amount, date)
      const k = Math.abs(amount).toFixed(2)
      ;(localMap[k] = localMap[k] || []).push(date)
      parsed.push({
        id: `${r}`, date, desc: merchant || text.trim().slice(0, 40), amount, type, transfer,
        categoryId: catId, include: type !== 'ignorar' && !dup, dup,
      })
    }
    // Auto-detecção da poupança: se TODOS os movimentos são transferências cc↔poupança,
    // é um extrato da poupança (mesmo sem a coluna Beneficiario) → vira depósito/retirada.
    if (!isPoupanca && parsed.length && parsed.every((r) => r.transfer)) {
      for (const r of parsed) { r.type = r.amount < 0 ? 'retirada' : 'deposito'; r.transfer = false; r.categoryId = ''; r.include = !r.dup }
    }
    setStmtBal(stmt)
    setStmtInit(sInit)
    setRows(parsed)
    if (!parsed.length) setMsg('Nenhum movimento encontrado no arquivo.')
  }

  const upd = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  // "selecionar todos" NUNCA marca duplicados (nem transferências/ignorados) — só desmarca todos.
  const setMany = (list, val) => {
    const ids = new Set(list.map((r) => r.id))
    setRows((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, include: val ? (!r.dup && r.type !== 'ignorar') : false } : r)))
  }

  const ensureCat = async (name) => {
    const f = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (f) return f.id
    const { data } = await supabase.from('categories').insert({ name, ideal: 0, color: '#64748b' }).select().single()
    return data?.id || null
  }

  const focusRow = (id) => {
    setFlashId(id)
    setTimeout(() => {
      const el = document.getElementById('cat-' + id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus()
    }, 60)
  }

  const doImport = async () => {
    if (!account) {
      setPopup({ type: 'err', text: 'Selecione a conta / banco (no topo da tela) antes de importar.' })
      accountSelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => accountSelRef.current?.focus(), 60)
      return
    }
    const sel = rows.filter((r) => r.include && r.type !== 'ignorar')
    if (!sel.length) { setPopup({ type: 'err', text: 'Nada selecionado para importar.' }); return }
    const semCat = sel.filter((r) => r.type === 'gasto' && !r.categoryId)
    if (semCat.length) {
      setPopup({ type: 'err', text: `Há ${semCat.length} gasto(s) selecionado(s) sem categoria. Defina a categoria do item destacado e tente de novo.` })
      focusRow(semCat[0].id)
      return
    }
    setBusy(true)
    const exp = [], inc = []
    const piggy = person === 'Nathi' ? 'nathi' : 'casa'
    const other = person === 'Nathi' ? 'Gui' : 'Nathi'
    // Transferências (sexo) já lançadas — consulta o BANCO na hora (dados em memória podem
    // estar velhos entre imports). Guardamos id e 'pending' pra poder CONFIRMAR pendentes.
    const { data: exTr } = await supabase.from('expenses').select('id,paid_by,amount,date,pending').eq('is_transfer', true)
    const { data: inTr } = await supabase.from('incomes').select('id,person,amount,date,pending').eq('is_transfer', true)
    const confirmExp = [], confirmInc = [] // ids de pernas pendentes que este extrato confirma
    // acha uma perna existente (no banco ou no lote atual). wantPending: true=só pendente, false=só confirmada, null=qualquer
    const findLeg = (isInc, pers, amt, d, wantPending) => {
      const db = (isInc ? (inTr || []) : (exTr || [])).find((x) =>
        Math.abs(Number(x.amount) - amt) < 0.005 && (isInc ? x.person === pers : x.paid_by === pers) &&
        x.date && daysBetween(x.date, d) <= DUP_WINDOW && (wantPending == null || !!x.pending === wantPending))
      if (db) return db
      return (isInc ? inc : exp).find((x) =>
        Math.abs(Number(x.amount) - amt) < 0.005 && (isInc ? x.person === pers : x.paid_by === pers) &&
        x.date && daysBetween(x.date, d) <= DUP_WINDOW && (wantPending == null || !!x.pending === wantPending))
    }
    let catSexo = null
    for (const r of sel) {
      if (r.type === 'sexo') {
        // transferência entre o casal: mexe no saldo dos dois, mas fora do orçamento.
        // A perna DESTE extrato é real (conta já). A contraparte entra PENDENTE — só passa a
        // contar no saldo da outra pessoa quando o extrato DELA confirmar o movimento.
        const a = Math.abs(r.amount)
        if (!catSexo) catSexo = await ensureCat('Sexo')
        const ownIsInc = r.amount > 0            // recebe = entrada; manda = despesa
        // 1) minha perna (real). Se já existe uma PENDENTE minha (criada quando o outro importou), confirma.
        const pend = findLeg(ownIsInc, person, a, r.date, true)
        if (pend?.id) { (ownIsInc ? confirmInc : confirmExp).push(pend.id) }
        else if (!findLeg(ownIsInc, person, a, r.date, false)) {
          if (ownIsInc) inc.push({ month: periodKey(r.date), date: r.date, person, description: r.desc, amount: a, is_transfer: true, pending: false })
          else exp.push({ date: r.date, category_id: catSexo, description: r.desc, place: r.desc, amount: a, paid_by: person, account, pay_status: 'Sim', is_transfer: true, pending: false })
        }
        // 2) contraparte do outro — só cria se ainda não existe nenhuma perna dele (pendente ou confirmada)
        if (!findLeg(!ownIsInc, other, a, r.date, null)) {
          if (ownIsInc) exp.push({ date: r.date, category_id: catSexo, description: `Sexo (para ${person})`, place: r.desc, amount: a, paid_by: other, pay_status: 'Sim', is_transfer: true, pending: true })
          else inc.push({ month: periodKey(r.date), date: r.date, person: other, description: `Sexo (de ${person})`, amount: a, is_transfer: true, pending: true })
        }
      } else if (r.type === 'entrada') {
        inc.push({ month: r.date.slice(0, 7), date: r.date, person, description: r.desc || 'Entrada', amount: Math.abs(r.amount) })
      } else if (r.type === 'deposito') {
        // poupança: cc -> poupança (abate Disponível, soma na reserva)
        exp.push({
          date: r.date, description: r.desc, place: r.desc, amount: Math.abs(r.amount),
          paid_by: person, pay_status: 'Sim', piggy, piggy_deposit: true, from_cc: true,
        })
      } else if (r.type === 'retirada') {
        // poupança -> cc (soma no Disponível, abate a reserva)
        exp.push({
          date: r.date, description: r.desc, place: r.desc, amount: Math.abs(r.amount),
          paid_by: person, pay_status: 'Sim', piggy, piggy_withdraw: true, to_cc: true,
        })
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
    const batch = 'imp_' + Date.now() // carimbo do lote — permite desfazer este import
    if (exp.length) { const { error } = await supabase.from('expenses').insert(exp.map((x) => ({ ...x, import_batch: batch }))); err = err || error }
    if (inc.length) { const { error } = await supabase.from('incomes').insert(inc.map((x) => ({ ...x, import_batch: batch }))); err = err || error }
    // confirma pernas pendentes que este extrato provou (passam a contar no saldo)
    if (confirmExp.length) { const { error } = await supabase.from('expenses').update({ pending: false }).in('id', confirmExp); err = err || error }
    if (confirmInc.length) { const { error } = await supabase.from('incomes').update({ pending: false }).in('id', confirmInc); err = err || error }
    setBusy(false)
    if (err) { setPopup({ type: 'err', text: 'Erro ao salvar os dados: ' + err.message }); return }
    const nConf = confirmExp.length + confirmInc.length
    setPopup({ type: 'ok', text: `Seus dados foram salvos — ${exp.length} gasto(s) e ${inc.length} entrada(s)${nConf ? `, ${nConf} transferência(s) confirmada(s)` : ''}.` })
    setMsg(''); setRows([]); reload()
  }

  const nInc = rows.filter((r) => r.include && r.type !== 'ignorar').length
  const needCat = rows.some((r) => r.include && r.type === 'gasto' && !r.categoryId)
  const saidas = rows.filter((r) => r.amount < 0)
  const entradas = rows.filter((r) => r.amount >= 0)

  // ---- Check de integridade: saldo do app após importar × saldo do banco (Disponibile) ----
  const selAcc = accounts.find((a) => a.name === account)
  const isPoupancaAcct = selAcc?.tipo === 'poupanca'
  const piggy = person === 'Nathi' ? 'nathi' : 'casa'
  const year = Number((month || '').slice(0, 4)) || new Date().getFullYear()
  const appNow = account
    ? (isPoupancaAcct ? cofrinhoBalance(piggy, { piggyYear, expenses }, year) : disponivelOf(person, { incomes, expenses, balances, adjustments }, month))
    : null
  const netSel = rows.filter((r) => r.include && r.type !== 'ignorar').reduce((s, r) => {
    const a = Math.abs(r.amount)
    if (r.type === 'sexo') return s + (r.amount < 0 ? -a : a) // afeta só o saldo desta conta
    if (isPoupancaAcct) return s + (r.type === 'deposito' ? a : r.type === 'retirada' ? -a : 0)
    if (r.type === 'entrada' || r.type === 'retirada') return s + a
    if (r.type === 'gasto' || r.type === 'deposito' || r.type === 'reserva') return s - a
    return s
  }, 0)
  const predicted = appNow != null ? appNow + netSel : null
  const balDiff = (stmtBal != null && predicted != null) ? Math.round((predicted - stmtBal) * 100) / 100 : null

  // só oferece os tipos coerentes com a direção do movimento
  const typesFor = (r) => (r.amount < 0
    ? ['gasto', 'deposito', 'retirada', 'sexo', 'ignorar']    // saída
    : ['entrada', 'deposito', 'retirada', 'sexo', 'ignorar']) // entrada
  const TYPE_LABEL = { gasto: 'despesa', entrada: 'entrada', deposito: '+ reserva', retirada: '- reserva', sexo: 'sexo', ignorar: 'ignorar' }

  const renderRow = (r) => (
    <div className="item" key={r.id} style={{ opacity: r.include ? 1 : 0.5 }}>
      <div className="info" style={{ gap: 8, flex: 1, minWidth: 0 }}>
        <input type="checkbox" checked={r.include} onChange={(e) => upd(r.id, { include: e.target.checked })} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="desc" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <input value={r.desc} onChange={(e) => upd(r.id, { desc: e.target.value })}
              style={{ border: 'none', borderBottom: '1px solid var(--border)', fontSize: 14, flex: 1, minWidth: 120, background: 'transparent' }} />
            {r.transfer && <span className="tag" style={{ marginLeft: 6, background: '#e0e7ff', color: '#3730a3' }}>transferência</span>}
            {r.dup && <span className="tag" style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e' }}>duplicado?</span>}
          </div>
          <div className="meta" style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span>{fmtDate(r.date)}</span>
            <select value={r.type} onChange={(e) => { const nt = e.target.value; upd(r.id, { type: nt, include: nt !== 'ignorar' && (nt === 'sexo' || !r.dup), dup: nt === 'sexo' ? false : r.dup }) }}
              style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 4px' }}>
              {typesFor(r).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            {r.type === 'gasto' && (
              <select id={`cat-${r.id}`} className={flashId === r.id ? 'flash-error' : ''}
                value={r.categoryId} onChange={(e) => { upd(r.id, { categoryId: e.target.value }); if (flashId === r.id) setFlashId(null) }}
                style={{ fontSize: 12, border: `1px solid ${r.include && !r.categoryId ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 6, padding: '1px 4px' }}>
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
          Aceita extratos do <b>BBVA</b> (.xlsx), <b>ING</b> (.csv) e da <b>poupança</b> (Movimenti). O app identifica
          tipo, categoria, data e valor. Na poupança: <b>+ = depósito</b> (cc→poupança), <b>− = retirada</b> (poupança→cc).
          Revise e confirme. Movimentos já lançados aparecem como duplicados.
        </p>
        <div className="field">
          <label>Arquivo do extrato</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
        </div>
        {msg && <div className={`msg ${msg.startsWith('Importado') ? 'ok' : 'err'}`}>{msg}</div>}
        {lastImport && undoCount > 0 && !undoAsk && (
          <button className="btn btn-sm" disabled={busy} onClick={() => setUndoAsk(true)}
            style={{ marginTop: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            ↶ Desfazer último import ({undoCount})
          </button>
        )}
        {undoAsk && (
          <div className="warn-banner" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <span>Remover os {undoCount} lançamento(s) do último import? Isso não pode ser desfeito.</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" disabled={busy} onClick={undoLast} style={{ background: 'var(--danger)', color: '#fff' }}>Sim, desfazer</button>
              <button className="btn btn-sm" onClick={() => setUndoAsk(false)}>Cancelar</button>
            </span>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="modal-overlay">
        <div className="modal import-modal">
          <div className="modal-head">
            <h2 style={{ margin: 0 }}>Revisar importação ({rows.length})</h2>
            <button className="icon-btn" title="fechar" onClick={() => setRows([])}><IconClose size={18} /></button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 8px' }}>
            Ajuste o que precisar. Nada é gravado até você confirmar.
          </p>
          {(stmtInit != null || stmtBal != null) && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, background: 'var(--hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
              {stmtInit != null && <span style={{ color: 'var(--muted)' }}>Saldo no início do extrato: <b style={{ color: 'var(--text)' }}>{money(stmtInit)}</b></span>}
              {stmtBal != null && <span style={{ color: 'var(--muted)' }}>Saldo atual (fim do extrato): <b style={{ color: 'var(--text)' }}>{money(stmtBal)}</b></span>}
            </div>
          )}
          <div className="row">
            <div className="field"><label>Conta / Banco</label>
              <select ref={accountSelRef} value={account} onChange={(e) => {
                const name = e.target.value; setAccount(name)
                const acc = accounts.find((a) => a.name === name)
                if (acc?.owner) setPerson(acc.owner) // pessoa segue o dono da conta
                const isP = acc?.tipo === 'poupanca'
                // conta poupança: todo movimento vira depósito(+)/retirada(−), qualquer formato de extrato
                if (isP) setRows((rs) => rs.map((r) => ({ ...r, type: r.amount < 0 ? 'retirada' : 'deposito', transfer: false, categoryId: '', include: !r.dup })))
              }}>
                <option value="">Selecione…</option>
                {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select></div>
            <div className="field"><label>Pessoa</label>
              <select value={person} onChange={(e) => setPerson(e.target.value)}>
                {WHO.map((w) => <option key={w}>{w}</option>)}
              </select></div>
          </div>
          {account && stmtBal != null && balDiff != null && (
            Math.abs(balDiff) < 0.01 ? (
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: 10, borderRadius: 10, fontSize: 13, marginBottom: 10 }}>
                ✓ Confere: após importar, o app fica em <b>{money(predicted)}</b>, igual ao saldo do banco no extrato.
              </div>
            ) : (
              <div className="warn-banner" style={{ marginBottom: 10 }}>
                ⚠️ <b>Saldos não batem.</b> Após importar, o app fica em <b>{money(predicted)}</b>, mas o banco mostra <b>{money(stmtBal)}</b> (diferença <b>{money(balDiff)}</b>). Provavelmente falta ou sobra algum lançamento — confira antes de confirmar.
              </div>
            )
          )}
          {rows.some((r) => r.dup) && (
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10, alignSelf: 'flex-start' }}
              onClick={() => setRows((rs) => rs.filter((r) => !r.dup))}>
              Remover duplicados ({rows.filter((r) => r.dup).length})
            </button>
          )}
          <div className="import-cols">
            <div className="import-col">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={saidas.some((r) => r.include) && saidas.filter((r) => !r.dup && r.type !== 'ignorar').every((r) => r.include)}
                  onChange={(e) => setMany(saidas, e.target.checked)} /> Saídas ({saidas.length})
              </h3>
              <div className="import-col-scroll">
                {saidas.length ? saidas.map(renderRow) : <div className="empty">—</div>}
              </div>
            </div>
            <div className="import-col">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={entradas.some((r) => r.include) && entradas.filter((r) => !r.dup && r.type !== 'ignorar').every((r) => r.include)}
                  onChange={(e) => setMany(entradas, e.target.checked)} /> Entradas ({entradas.length})
              </h3>
              <div className="import-col-scroll">
                {entradas.length ? entradas.map(renderRow) : <div className="empty">—</div>}
              </div>
            </div>
          </div>
          {!account && <div className="msg err" style={{ marginTop: 10 }}>Selecione a conta (no topo da tela) antes de importar.</div>}
          {needCat && <div className="msg err" style={{ marginTop: 10 }}>Há gastos selecionados sem categoria — defina a categoria deles.</div>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setRows([])}>Cancelar</button>
            <button className="btn" disabled={busy || !nInc || !account || needCat} onClick={doImport}>
              {busy ? 'Importando…' : `Importar ${nInc}`}
            </button>
          </div>
        </div>
        </div>
      )}

      {popup && (
        <div className="popup-overlay" onClick={() => setPopup(null)}>
          <div className={`popup ${popup.type}`} onClick={(e) => e.stopPropagation()}>
            <div className="popup-icon">{popup.type === 'ok' ? '✓' : '!'}</div>
            <p>{popup.text}</p>
            <button className="btn" autoFocus onClick={() => setPopup(null)}>OK</button>
          </div>
        </div>
      )}
    </>
  )
}
