import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import '../src/styles/firefly.css';
import { TraceLanding } from './TraceLanding';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <TraceLanding />
    </StrictMode>,
);
