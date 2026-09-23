// Dashboard.tsx — This component has been superseded by Home.tsx
// The legacy implementation had a React Hooks violation (useAppContext called inside a conditional).
// All routing in App.tsx directs 'dashboard' view to Home.tsx.
// This file is kept as a clean re-export for any legacy imports.
export { default } from '../home/Home';