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
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={onCancel}
    >
      <div
        className="card animate-fade-in"
        style={{ maxWidth: '400px', width: '100%', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '10px' }}>{title}</h3>
        <p style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: '1.5', marginBottom: '20px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-sm" style={{ background: '#dc2626', color: 'white' }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
