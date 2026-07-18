const base = (size) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  style: { display: 'block' },
})

export const IconEdit = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
export const IconTrash = ({ size = 16 }) => (
  <svg {...base(size)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)
export const IconGear = ({ size = 18 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)
export const IconInfo = ({ size = 13 }) => (
  <svg {...base(size)} style={{ display: 'inline', verticalAlign: 'middle' }}>
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

export const IconMenu = ({ size = 22 }) => (
  <svg {...base(size)}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
)
export const IconClose = ({ size = 22 }) => (
  <svg {...base(size)}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
)

export const IconChevronLeft = ({ size = 22 }) => (
  <svg {...base(size)}><polyline points="15 18 9 12 15 6" /></svg>
)

export const IconChart = ({ size = 18 }) => (
  <svg {...base(size)}><line x1="4" y1="20" x2="4" y2="12" /><line x1="10" y1="20" x2="10" y2="4" /><line x1="16" y1="20" x2="16" y2="15" /><line x1="3" y1="20" x2="21" y2="20" /></svg>
)
export const IconReceipt = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M5 3h14v18l-2.5-1.3L14 21l-2-1.3L10 21l-2.5-1.3L5 21z" /><line x1="8.5" y1="8" x2="15.5" y2="8" /><line x1="8.5" y1="12" x2="15.5" y2="12" /></svg>
)
export const IconIncome = ({ size = 18 }) => (
  <svg {...base(size)}><line x1="12" y1="4" x2="12" y2="15" /><polyline points="7 10 12 15 17 10" /><line x1="5" y1="20" x2="19" y2="20" /></svg>
)
export const IconTarget = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>
)
export const IconHome = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
)
export const IconUser = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
)
export const IconImport = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /><polyline points="8 11 12 15 16 11" /><line x1="12" y1="4" x2="12" y2="15" /></svg>
)

export const IconBerry = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M12 21c-3.6 0-6.5-2.9-6.5-6.4 0-2.8 2.9-4.6 6.5-4.6s6.5 1.8 6.5 4.6C18.5 18.1 15.6 21 12 21z" />
    <path d="M8.5 7.8C9.6 6.1 10.7 5.5 12 5.5s2.4.6 3.5 2.3" />
    <path d="M12 5.5V3" />
    <line x1="9.5" y1="14" x2="9.5" y2="14.2" />
    <line x1="12" y1="15.5" x2="12" y2="15.7" />
    <line x1="14.5" y1="14" x2="14.5" y2="14.2" />
  </svg>
)
