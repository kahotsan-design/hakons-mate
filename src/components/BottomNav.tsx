import { NavLink } from 'react-router-dom';
import { Home, GraduationCap, Briefcase, Dumbbell, User, CheckSquare, Snowflake, Mail } from 'lucide-react';
import { useLang } from '../i18n';

// 構建開關：朋友版（Cloudflare Pages，VITE_ENABLE_MAIL=false）不顯示郵箱入口；
// 自用版（Vercel）保留——郵件是獨立一級大類。
const ENABLE_MAIL = import.meta.env.VITE_ENABLE_MAIL !== 'false';

export default function BottomNav() {
  const { t } = useLang();
  const navItems = [
    { to: '/', icon: Home, label: t('nav.home') },
    { to: '/campus', icon: GraduationCap, label: t('nav.campus') },
    ...(ENABLE_MAIL ? [{ to: '/mail', icon: Mail, label: t('nav.mail') }] : []),
    { to: '/fitness', icon: Dumbbell, label: t('nav.fitness') },
    { to: '/work', icon: CheckSquare, label: t('nav.work') },
    { to: '/job', icon: Briefcase, label: t('nav.job') },
    { to: '/profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <div style={{ position: 'relative' }}>
                <Icon />
                {isActive && (
                  <Snowflake size={9} strokeWidth={2} style={{
                    position: 'absolute',
                    top: -7,
                    right: -9,
                    color: '#2E86B8',
                    opacity: 1,
                  }} />
                )}
              </div>
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
