import { useEffect, useState } from 'react';
import PublicSite from './components/PublicSite';
import QuoteModal from './components/QuoteModal';
import Manager from './components/Manager';

function currentView() {
  return window.location.pathname.startsWith('/manager') ? 'manager' : 'site';
}

export default function App() {
  const [view, setView] = useState(currentView());
  const [quoteOpen, setQuoteOpen] = useState(false);

  useEffect(() => {
    const handler = () => setView(currentView());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('modal-open', quoteOpen);
    return () => document.body.classList.remove('modal-open');
  }, [quoteOpen]);

  function navigate(next) {
    const path = next === 'manager' ? '/manager' : '/';
    window.history.pushState({}, '', path);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (view === 'manager') return <Manager onBack={() => navigate('site')} />;

  return (
    <>
      <PublicSite openQuote={() => setQuoteOpen(true)} openManager={() => navigate('manager')} />
      <QuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} />
    </>
  );
}
