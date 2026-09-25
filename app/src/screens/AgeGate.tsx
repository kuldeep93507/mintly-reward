import { useState } from 'react';
import { Btn, Modal } from '../ui/kit';
import { PRIVACY_POLICY_URL } from '../config';

/**
 * Neutral age screen shown once on first launch. The app is for players 13 and older
 * (store target audience + India's online gaming rules ask for age checks).
 */
export function AgeGate({ onOk }: { onOk: () => void }) {
  const [young, setYoung] = useState(false);
  if (young) {
    return (
      <Modal title="Sorry!" className="age-gate">
        <p className="age-text">Ludo Mintly is made for players aged 13 and older.</p>
        <p className="fine">Ask a parent or guardian, and come back when you're 13.</p>
        <Btn variant="white" onClick={() => setYoung(false)}>Back</Btn>
      </Modal>
    );
  }
  return (
    <Modal title="Welcome!" className="age-gate">
      <p className="age-text">How old are you?</p>
      <div className="age-btns">
        <Btn variant="white" onClick={() => setYoung(true)} data-testid="age-under">Under 13</Btn>
        <Btn variant="green" onClick={onOk} data-testid="age-ok">13 or older</Btn>
      </div>
      <p className="fine">
        Coins in this game are free and have no money value. By playing you agree to the{' '}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>.
      </p>
    </Modal>
  );
}
