'use client'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null

  // This dialog is sometimes rendered inside a clickable <Link> card (e.g.
  // GoalCard). stopPropagation alone only stops React's synthetic bubbling —
  // it doesn't stop the browser's native default action, so a plain click
  // on Confirm/Cancel would still trigger the enclosing link's navigation.
  // preventDefault stops that; stopPropagation keeps the overlay's own
  // onClick (onCancel) from double-firing.
  const stop = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault()
    e.stopPropagation()
    action()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={(e) => stop(e, onCancel)}
    >
      <div
        className="card animate-fade-in"
        style={{ maxWidth: '400px', width: '100%', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '10px' }}>{title}</h3>
        <p style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: '1.5', marginBottom: '20px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={(e) => stop(e, onCancel)}>Cancel</button>
          <button className="btn btn-sm" style={{ background: '#dc2626', color: 'white' }} onClick={(e) => stop(e, onConfirm)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
