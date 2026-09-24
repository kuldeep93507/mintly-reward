import { createRoot } from 'react-dom/client';
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/game.css';
import { App } from './App';
import { installAudioUnlock } from './audio/sfx';

installAudioUnlock();
createRoot(document.getElementById('root')!).render(<App />);
