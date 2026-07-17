import { money, disponivelOf, cofrinhoBalance } from '../lib/helpers'

// Resumo de 4 valores: Disponível Gui/Nathi e Cofrinho Casa/Nathi
export default function KpiSummary(props) {
  const { month } = props
  const year = Number((month || '').slice(0, 4)) || new Date().getFullYear()

  const dGui = disponivelOf('Gui', props, month)
  const dNathi = disponivelOf('Nathi', props, month)
  const cCasa = cofrinhoBalance('casa', props, year)
  const cNathi = cofrinhoBalance('nathi', props, year)

  const boxes = [
    { label: 'Disponível Gui', value: dGui, color: dGui < 0 ? 'var(--danger)' : 'var(--green)' },
    { label: 'Disponível Nathi', value: dNathi, color: dNathi < 0 ? 'var(--danger)' : 'var(--green)' },
    { label: 'Reservas Casa 🏠', value: cCasa, color: 'var(--teal)' },
    { label: 'Reservas Nathi 👩', value: cNathi, color: 'var(--teal)' },
  ]

  return (
    <div className="summary kpi4" style={{ marginBottom: 16 }}>
      {boxes.map((b) => (
        <div className="box" key={b.label}>
          <div className="label">{b.label}</div>
          <div className="value" style={{ color: b.color, fontSize: 20 }}>{money(b.value)}</div>
        </div>
      ))}
    </div>
  )
}
