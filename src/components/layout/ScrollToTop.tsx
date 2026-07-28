// src/components/layout/ScrollToTop.tsx
// React Router doesn't reset scroll position on navigation by default —
// without this, going from the bottom of a long list page to a new route
// leaves the new page scrolled down too. Mounted once, near the top of the
// router tree.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};
