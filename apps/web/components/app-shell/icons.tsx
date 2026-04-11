import type { ReactNode } from 'react';

function ShellIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

export function BoardIcon() {
  return (
    <ShellIcon>
      <rect x="3.5" y="4" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="12" rx="1.5" />
      <rect x="3.5" y="14" width="7" height="6" rx="1.5" />
      <path d="M13.5 19.5h7" />
    </ShellIcon>
  );
}

export function MembersIcon() {
  return (
    <ShellIcon>
      <path d="M15.5 19.5v-1a3.5 3.5 0 0 0-3.5-3.5h-2a3.5 3.5 0 0 0-3.5 3.5v1" />
      <circle cx="11" cy="8" r="3.5" />
      <path d="M18.5 10.5a2.5 2.5 0 0 1 0 5" />
      <path d="M18.5 19.5v-1c0-1.2-.55-2.28-1.42-3" />
    </ShellIcon>
  );
}

export function InvitationsIcon() {
  return (
    <ShellIcon>
      <path d="M4 7.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="m4.5 8 7.5 5 7.5-5" />
    </ShellIcon>
  );
}

export function InboxIcon() {
  return (
    <ShellIcon>
      <path d="M4 6.5h16v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 13.5h4l2 3h4l2-3h4" />
    </ShellIcon>
  );
}

export function CalendarIcon() {
  return (
    <ShellIcon>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M7.5 3.5v3" />
      <path d="M16.5 3.5v3" />
      <path d="M3.5 9.5h17" />
      <path d="M8 13h3" />
      <path d="M13 13h3" />
      <path d="M8 16.5h3" />
    </ShellIcon>
  );
}

export function SettingsIcon() {
  return (
    <ShellIcon>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 4.5v2.1" />
      <path d="M12 17.4v2.1" />
      <path d="M4.5 12h2.1" />
      <path d="M17.4 12h2.1" />
      <path d="m6.7 6.7 1.5 1.5" />
      <path d="m15.8 15.8 1.5 1.5" />
      <path d="m17.3 6.7-1.5 1.5" />
      <path d="m8.2 15.8-1.5 1.5" />
    </ShellIcon>
  );
}
