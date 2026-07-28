import { useEffect, useState } from 'react'
import { IconArrowUp } from './icons'

export default function ScrollTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const overlay = () => document.querySelector('.modal-overlay')
    const check = () => {
      const ov = overlay()
      const y = ov && ov.scrollTop > 0 ? ov.scrollTop : window.scrollY
      setShow(y > 300)
    }
    window.addEventListener('scroll', check, true)
    check()
    return () => window.removeEventListener('scroll', check, true)
  }, [])
  const toTop = () => {
    const ov = document.querySelector('.modal-overlay')
    if (ov && ov.scrollTop > 0) ov.scrollTo({ top: 0, behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  if (!show) return null
  return (
    <button className="scrolltop" onClick={toTop} aria-label="Voltar ao topo" title="Voltar ao topo">
      <IconArrowUp />
    </button>
  )
}
