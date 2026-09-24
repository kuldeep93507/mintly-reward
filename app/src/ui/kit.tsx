import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { play } from '../audio/sfx';
import { useApp } from '../state/AppContext';
import { Icon } from './Icon';

type Variant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'white' | 'ghost';

export function Btn({ variant = 'green', size = 'md', className = '', onClick, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={(e) => { play('click'); onClick?.(e); }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconBtn({ icon, onClick, label, className = '', badge }:
  { icon: Parameters<typeof Icon>[0]['name']; onClick: () => void; label: string; className?: string; badge?: boolean }) {
  return (
    <button className={'icon-btn ' + className} aria-label={label} onClick={() => { play('click'); onClick(); }}>
      <Icon name={icon} size={22} />
      {badge && <span className="dot-badge" />}
    </button>
  );
}

/** Screen header with a back button and a title. */
export function Header({ title, right }: { title: string; right?: ReactNode }) {
  const { back } = useApp();
  return (
    <div className="header">
      <IconBtn icon="back" label="Back" onClick={back} />
      <h1 className="header-title">{title}</h1>
      <div className="header-right">{right}</div>
    </div>
  );
}

export function CoinPill({ amount, onClick, plus }: { amount: number | string; onClick?: () => void; plus?: boolean }) {
  return (
    <button className="coin-pill" onClick={() => { if (onClick) { play('click'); onClick(); } }} disabled={!onClick}>
      <Icon name="coin" size={24} />
      <span>{typeof amount === 'number' ? amount.toLocaleString() : amount}</span>
      {plus && <span className="coin-plus"><Icon name="plus" size={14} /></span>}
    </button>
  );
}

export function Modal({ children, onClose, title, className = '' }: { children: ReactNode; onClose?: () => void; title?: string; className?: string }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={'modal ' + className} onClick={(e) => e.stopPropagation()}>
        {title && <div className="modal-title">{title}</div>}
        {onClose && <button className="modal-close" aria-label="Close" onClick={() => { play('click'); onClose(); }}><Icon name="close" size={20} /></button>}
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }:
  { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'seg on' : 'seg'} onClick={() => { play('click'); onChange(o.value); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={'toggle-row'} onClick={() => { play('click'); onChange(!on); }} role="switch" aria-checked={on}>
      <span>{label}</span>
      <span className={on ? 'toggle on' : 'toggle'}><span className="knob" /></span>
    </button>
  );
}

export function Confirm({ title, text, yes, no = 'Cancel', onYes, onNo }:
  { title: string; text: string; yes: string; no?: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title={title} onClose={onNo} className="confirm">
      <p className="confirm-text">{text}</p>
      <div className="row-2">
        <Btn variant="white" onClick={onNo}>{no}</Btn>
        <Btn variant="red" onClick={onYes}>{yes}</Btn>
      </div>
    </Modal>
  );
}

export const COLOR_NAME = { red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue' } as const;
export const ordinal = (n: number) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
