import { useEffect, useState } from 'react'

export default function Splash() {
  const [phase, setPhase] = useState('in') // 'in' | 'out' | 'gone'
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('out'), 2600)
    const t2 = setTimeout(() => setPhase('gone'), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  if (phase === 'gone') return null
  return (
    <div className={`splash ${phase === 'out' ? 'out' : ''}`}>
      <img src="/logo2.svg" alt="Ruiva & Barba Financials" />
    </div>
  )
}
