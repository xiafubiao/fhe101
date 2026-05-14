import React from 'react';
import styles from './styles.module.css';

export default function LocaleDropdownNavbarItem() {
  const [isEnglish, setIsEnglish] = React.useState(false);

  React.useEffect(() => {
    setIsEnglish(window.location.pathname.startsWith('/en'));
  }, []);

  const handleSwitch = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentPath = window.location.pathname;
    const targetLocale = isEnglish ? '/' : '/en/';
    const newPath = currentPath.replace(/^\/(en\/)?/, targetLocale);
    window.location.href = newPath;
  };

  return (
    <a href="#" className={styles.toggleButton} onClick={handleSwitch}>
      <div className={styles.toggleContainer}>
        <span className={styles.toggleLabel}>{isEnglish ? '中文' : 'English'}</span>
        <div className={styles.toggleTrack}>
          <div className={`${styles.toggleThumb} ${isEnglish ? styles.toggleThumbRight : ''}`} />
        </div>
      </div>
    </a>
  );
}