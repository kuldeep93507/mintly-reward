import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { api } from '../net/api';
import { APP_VERSION, PRIVACY_POLICY_URL } from '../config';
import { Btn, Confirm, Header, Toggle } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function SettingsScreen() {
  const app = useApp();
  const { settings } = app;
  const [url, setUrl] = useState(settings.serverUrl);
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const testConn = async () => {
    setTest('testing');
    try { await api.health(url.trim()); setTest('ok'); } catch { setTest('fail'); }
  };
  const del = async () => {
    setConfirmDel(false);
    setDeleting(true);
    const err = await app.deleteAccount();
    setDeleting(false);
    app.toast(err ? `Could not delete account: ${err}` : 'Account deleted. You are starting fresh.');
  };

  return (
    <div className="screen">
      <Header title="Settings" />
      <div className="settings">
        <div className="card">
          <Toggle label="Sound" on={settings.sound} onChange={(v) => app.updateSettings({ sound: v })} />
          <Toggle label="Vibration" on={settings.vibration} onChange={(v) => app.updateSettings({ vibration: v })} />
          <Toggle label="Auto move (when only one move)" on={settings.autoMove} onChange={(v) => app.updateSettings({ autoMove: v })} />
        </div>

        <div className="card">
          <div className="card-title">Game server <span className={`status-dot ${app.status}`} /> <small>{app.status}</small></div>
          <p className="fine">Advanced: point a test phone at your PC, e.g. http://192.168.1.5:3000</p>
          <input className="text-input" value={url} onChange={(e) => { setUrl(e.target.value); setTest('idle'); }} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <div className="row-2">
            <Btn variant="white" size="sm" onClick={testConn} disabled={test === 'testing'}>{test === 'testing' ? 'Testing…' : 'Test connection'}</Btn>
            <Btn variant="blue" size="sm" disabled={url.trim() === settings.serverUrl} onClick={() => { app.updateSettings({ serverUrl: url.trim() }); app.toast('Server saved'); }}>Save</Btn>
          </div>
          {test === 'ok' && <div className="test-ok"><Icon name="check" size={16} /> Server reachable</div>}
          {test === 'fail' && <div className="test-fail"><Icon name="wifiOff" size={16} /> Can't reach that server</div>}
        </div>

        <div className="card">
          <button className="link-row" onClick={() => app.go({ id: 'themes' })}>Themes <Icon name="back" size={16} className="flip" /></button>
        </div>

        <div className="card">
          <a className="link-row" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">Privacy Policy <Icon name="back" size={16} className="flip" /></a>
          <div className="link-row muted">Version <span>{APP_VERSION}</span></div>
        </div>

        {app.profile && app.status === 'online' && (
          <button className="danger-row" onClick={() => setConfirmDel(true)} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
        )}
      </div>
      {confirmDel && (
        <Confirm title="Delete account?" yes="Delete" onNo={() => setConfirmDel(false)} onYes={del}
          text="This permanently deletes your profile, coins and stats from the game server. This cannot be undone." />
      )}
    </div>
  );
}
