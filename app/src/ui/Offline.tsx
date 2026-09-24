import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Btn } from './kit';
import { Icon } from './Icon';

export function OfflineCard({ compact = false }: { compact?: boolean }) {
  const { status, reconnect, go } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div className={'offline-card ' + (compact ? 'compact' : '')}>
      <div className="offline-icon"><Icon name="wifiOff" size={compact ? 28 : 44} /></div>
      <div className="offline-title">Can't reach the game server</div>
      {!compact && <p className="offline-text">Check your internet connection and try again. You can still play Vs Computer and Pass &amp; Play offline.</p>}
      <div className="row-2">
        <Btn variant="yellow" size="sm" disabled={busy || status === 'connecting'} onClick={async () => { setBusy(true); await reconnect(); setBusy(false); }}>
          {busy || status === 'connecting' ? 'Connecting…' : 'Retry'}
        </Btn>
        {!compact && <Btn variant="white" size="sm" onClick={() => go({ id: 'settings' })}>Server settings</Btn>}
      </div>
    </div>
  );
}
