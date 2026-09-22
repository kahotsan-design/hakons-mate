import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 可选手绘插画（如北极熊），与首页雪山同语言 */
  art?: string;
}

export default function EmptyState({ icon: Icon, title, desc, actionLabel, onAction, art }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 20px',
      color: 'var(--color-text-tertiary)',
    }}>
      {art ? (
        <img src={art} alt="" style={{ width: 110, height: 'auto', display: 'block', margin: '0 auto 12px', opacity: 0.92 }} />
      ) : (
        <Icon size={48} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        {desc}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-ice"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
