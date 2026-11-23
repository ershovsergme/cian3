import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Button, Icon } from '@/ui';
import { usePrototype } from '@/hooks/prototype-context';
import s from './Layout.module.css';

const navigation = [
  'Аренда',
  'Продажа',
  'Новостройки',
  'Дома и участки',
  'Коммерческая',
  'Ипотека',
  'Мой дом',
  'Сделка',
  'Сервисы',
];
export function Header() {
  const { favorites, showDemo } = usePrototype();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  return (
    <header className={s.header}>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <div className={s.topbar}>
        <button
          type="button"
          className={s.menuButton}
          aria-label="Меню"
          aria-expanded={menu}
          aria-controls="main-navigation"
          onClick={() => setMenu(!menu)}
        >
          <Icon name="Menu" size={24} />
        </button>
        <Link to="/" aria-label="Циан — главная" className={s.logo}>
          <img src="/images/logo.svg" alt="Циан" width="112" height="28" />
        </Link>
        <div className={s.actions}>
          <button className={s.assistant} onClick={() => showDemo('Умный помощник')}>
            <span>✦</span> Умный помощник
          </button>
          <button
            className={s.desktopIcon}
            aria-label="Сообщения"
            onClick={() => showDemo('Сообщения')}
          >
            <Icon name="Message" />
          </button>
          <Link
            to="/search?favorites=1"
            className={s.favoriteLink}
            aria-label={`Избранное: ${favorites.length}`}
          >
            <Icon name="Heart" />
            {favorites.length > 0 && <span>{favorites.length}</span>}
          </Link>
          <button
            className={s.desktopIcon}
            aria-label="Уведомления"
            onClick={() => showDemo('Уведомления')}
          >
            <Icon name="Bell" />
          </button>
          <Button size="XS" onClick={() => showDemo('Разместить объявление')}>
            <span className={s.desktopText}>+ Разместить за 0 ₽</span>
            <span className={s.mobileText}>Разместить</span>
          </Button>
          <span className={s.signin}>
            <Button size="XS" theme="main_secondary" onClick={() => showDemo('Войти')}>
              Войти
            </Button>
          </span>
        </div>
      </div>
      <nav
        id="main-navigation"
        aria-label="Основная навигация"
        className={clsx(s.nav, menu && s.navOpen)}
      >
        {navigation.map((label) =>
          label === 'Продажа' || label === 'Ипотека' ? (
            <NavLink
              key={label}
              to={label === 'Ипотека' ? '/mortgage' : '/search'}
              className={
                location.pathname.startsWith(label === 'Ипотека' ? '/mortgage' : '/search')
                  ? s.active
                  : undefined
              }
              onClick={() => setMenu(false)}
            >
              {label}
            </NavLink>
          ) : (
            <button
              key={label}
              onClick={() => {
                showDemo(label);
                setMenu(false);
              }}
            >
              {label}
            </button>
          ),
        )}
        <Link to="/ui" className={s.kitLink} onClick={() => setMenu(false)}>
          UI kit ↗
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  const { showDemo } = usePrototype();
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <div className={s.footerLinks}>
          {[
            'Справочный центр',
            'Юридические документы',
            'Поиск на карте',
            'Тарифы и цены',
            'Реклама на сайте',
            'Помощь',
            'Ипотечный калькулятор',
            'Карьера в Циане',
          ].map((label) =>
            label === 'Ипотечный калькулятор' ? (
              <Link key={label} to="/mortgage">
                {label}
              </Link>
            ) : (
              <button key={label} onClick={() => showDemo(label)}>
                {label}
              </button>
            ),
          )}
        </div>
        <p>
          Циан — база объявлений о продаже и аренде жилой, загородной и коммерческой недвижимости.
        </p>
        <div className={s.footerBottom}>
          <span>Учебный прототип · демонстрационные объявления</span>
          <Link to="/ui">Компоненты и состояния</Link>
          <Link to="/guide">Как создать свой экран</Link>
          <span>0+</span>
        </div>
      </div>
    </footer>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={s.shell}>
      <Header />
      <div className={s.content}>{children}</div>
      <Footer />
    </div>
  );
}
export function PageLayout({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <main id="main" className={clsx(s.page, className)}>
      {aside ? (
        <div className={s.columns}>
          <div className={s.primary}>{children}</div>
          <aside className={s.aside}>{aside}</aside>
        </div>
      ) : (
        children
      )}
    </main>
  );
}
export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Хлебные крошки" className={s.breadcrumbs}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && <Icon name="ActionChevronRight12" size={12} />}{' '}
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
