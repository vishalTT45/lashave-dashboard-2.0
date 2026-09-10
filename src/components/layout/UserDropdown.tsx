'use client';
import { Avatar, AvatarText } from '@/components/ui/avatar';
import { Dropdown, DropdownItem } from '@/components/ui/dropdown';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/roles';
import {
  Building2,
  ChevronDown,
  CreditCard,
  LogOut,
  PlusCircle,
  Radio,
  User as UserIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type MeResp = {
  user: { email: string; role: string; avatar_url?: string | null };
};

export function UserDropdown() {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [me, setMe] = useState<MeResp | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

 

  useEffect(() => {
    const fetchMe = () =>
      apiFetch<MeResp>('/admin/profile/me', { auth: true })
        .then(setMe)
        .catch(() => {});
    fetchMe();
    window.addEventListener('avatar-updated', fetchMe);
    return () => window.removeEventListener('avatar-updated', fetchMe);
  }, []);

   useEffect(() => {
     // Resets local UI-only state (a flag, warning, or preview value)
     // when the relevant prop/dependency changes — not deriving render
     // output from state.
     // eslint-disable-next-line react-hooks/set-state-in-effect
     setAvatarFailed(false);
   }, [me?.user.avatar_url]);

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }
  function closeDropdown() {
    setIsOpen(false);
  }

  const email = me?.user.email ?? '';
  const role = me?.user.role ?? '';

  return (
    <div className='relative'>
      <button
        onClick={toggleDropdown}
        className='dropdown-toggle flex items-center gap-2 text-gray-700 dark:text-gray-400'
      >
        {me?.user.avatar_url && !avatarFailed ? (
          <Avatar
            src={me.user.avatar_url}
            alt={email}
            size='small'
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <AvatarText name={email.split('@')[0]} className='h-9 w-9' />
        )}
        <ChevronDown
          className={`icon-small stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className='mt-4.25 flex w-65 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark'
      >
        <div className='px-1'>
          <span className='block truncate type-small font-medium text-gray-700 dark:text-gray-400'>
            {email}
          </span>
          <span className='mt-0.5 block type-caption capitalize text-gray-500 dark:text-gray-400'>
            {role}
          </span>
        </div>

        <ul className='flex flex-col gap-1 border-b border-gray-200 pb-3 pt-4 dark:border-gray-800'>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag='a'
              href='/channels'
              className='group flex items-center gap-3 rounded-(--radius-control) px-3 py-2 type-small font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'
            >
              <Radio className='icon-small.5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300' />
              Channels
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag='a'
              href='/profile'
              className='group flex items-center gap-3 rounded-(--radius-control) px-3 py-2 type-small font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'
            >
              <UserIcon className='icon-small.5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300' />
              Profile
            </DropdownItem>
          </li>
        </ul>

        {isSuperAdmin(role) && (
          <ul className='flex flex-col gap-1 border-b border-gray-200 py-3 dark:border-gray-800'>
            <li className='px-3 pb-1 type-caption font-semibold uppercase tracking-wide text-gray-400'>
              Super Admin
            </li>
            <li>
              <DropdownItem
                onItemClick={closeDropdown}
                tag='a'
                href='/super-admin/tenants'
                className='group flex items-center gap-3 rounded-(--radius-control) px-3 py-2 type-small font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'
              >
                <Building2 className='icon-small.5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300' />
                Tenants
              </DropdownItem>
            </li>
            <li>
              <DropdownItem
                onItemClick={closeDropdown}
                tag='a'
                href='/super-admin/create-tenant'
                className='group flex items-center gap-3 rounded-(--radius-control) px-3 py-2 type-small font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'
              >
                <PlusCircle className='icon-small.5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300' />
                Create Tenant
              </DropdownItem>
            </li>
            <li>
              <DropdownItem
                onItemClick={closeDropdown}
                tag='a'
                href='/super-admin/pricing'
                className='group flex items-center gap-3 rounded-(--radius-control) px-3 py-2 type-small font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'
              >
                <CreditCard className='icon-small.5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300' />
                Pricing
              </DropdownItem>
            </li>
          </ul>
        )}

        <button
          onClick={() => {
            closeDropdown();
            logout();
          }}
          className='group mt-3 flex items-center gap-3 rounded-(--radius-control) px-3 py-2 text-left type-small font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'
        >
          <LogOut className='icon-small.5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300' />
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
