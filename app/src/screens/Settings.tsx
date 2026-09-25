import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { api } from '../net/api';
import { APP_VERSION, PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../config';
import { Btn, Confirm, Header, Toggle } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function SettingsScreen() {
  const app = useApp();
  const { settings } = app;
  const [url, setUrl] = useState(settings.serverUrl);
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Accept "192.168.1.5:3000" too, but only real http(s) addresses.
  const normUrl = (raw: string): string | null => {
    const t = raw.trim().replace(/\/+$/, '');
    try {
      const u = new URL(/^[a-z]+:\/\//i.test(t) ? t : `http://${t}`);
      return /^https?:$/.test(u.protocol) && u.hostname ? u.origin : null;
    } catch { return null; }
  };
  const testConn = async () => {
    const u = normUrl(url);
    if (!u) { setTest('fail'); return; }
    setTest('testing');
    try { const r = await api.health(u); setTest(r.ok === true ? 'ok' : 'fail'); } catch { setTest('fail'); }
  };
  const save = () => {
    const u = normUrl(url);
    if (!u) { app.toast('Enter an address like http://192.168.1.5:3000'); return; }
    setUrl(u);
    app.updateSettings({ serverUrl: u });
    app.toast('Server saved');
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
          <Toggle label="Break reminder (every hour)" on={settings.breakReminder !== false} onChange={(v) => app.updateSettings({ breakReminder: v })} />
        </div>

        <div className="card">
          <div className="card-title">Game server <span className={`status-dot ${app.status}`} /> <small>{app.status}</small></div>
          <p className="fine">Advanced: point a test phone at your PC, e.g. http://192.168.1.5:3000</p>
          <input className="text-input" value={url} onChange={(e) => { setUrl(e.target.value); setTest('idle'); }} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <div className="row-2">
            <Btn variant="white" size="sm" onClick={testConn} disabled={test === 'testing'}>{test === 'testing' ? 'Testing…' : 'Test connection'}</Btn>
            <Btn variant="blue" size="sm" disabled={url.trim() === settings.serverUrl} onClick={save}>Save</Btn>
          </div>
          {test === 'ok' && <div className="test-ok"><Icon name="check" size={16} /> Server reachable</div>}
          {test === 'fail' && <div className="test-fail"><Icon name="wifiOff" size={16} /> Can't reach that server</div>}
        </div>

        <div className="card">
          <button className="link-row" onClick={() => app.go({ id: 'themes' })}>Themes <Icon name="back" size={16} className="flip" /></button>
        </div>

        <div className="card">
          <a className="link-row" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">Privacy Policy <Icon name="back" size={16} className="flip" /></a>
          <a className="link-row" data-testid="contact"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ludo Mintly support')}&body=${encodeURIComponent(`Player ID: ${app.profile?.playerId ?? '-'}\nApp version: ${APP_VERSION}\n\nDescribe the problem, or the player you want to report:\n`)}`}>
            Contact us / Report a problem <Icon name="back" size={16} className="flip" />
          </a>
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
