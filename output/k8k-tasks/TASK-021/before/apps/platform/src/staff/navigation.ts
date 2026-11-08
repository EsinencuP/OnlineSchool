import { useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { roleNavigation } from '@online-school/ui';

export type StaffRole = 'TEACHER' | 'DIRECTOR' | 'TECH_OPERATOR';
export type StaffSection = 'overview' | 'lessons' | 'students' | 'homework' | 'tasks';
export type StaffObjectSection = Exclude<StaffSection, 'overview'>;
export const filters: Readonly<Record<StaffSection, readonly string[]>> = {
  overview: [],
  lessons: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'],
  students: [],
  homework: ['dated', 'undated'],
  tasks: ['OPEN', 'IN_PROGRESS'],
};

function readRoute(role: StaffRole) {
  const params = new URLSearchParams(location.search);
  const requested = params.get('section');
  const section = (roleNavigation[role].find((item) => item.id === requested)?.id ??
    'overview') as StaffSection;
  const filter = params.get('filter') ?? '';
  return {
    section,
    filter: filters[section].includes(filter) ? filter : '',
    id: section === 'overview' ? null : params.get('id'),
  };
}

export function useStaffNavigation(role: StaffRole) {
  const [route, setRoute] = useState(() => readRoute(role));
  const heading = useRef<HTMLHeadingElement>(null);
  const entry = useRef(0);
  const offsets = useRef(new Map<number, number>());
  const restore = useRef<number>();
  const focus = useRef(false);
  useLayoutEffect(() => {
    const original = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const initial: number | undefined = history.state?.staffEntry;
    entry.current = initial ?? Date.now();
    history.replaceState({ ...history.state, staffEntry: entry.current }, '');
    function pop() {
      offsets.current.set(entry.current, window.scrollY);
      entry.current = history.state?.staffEntry ?? Date.now();
      restore.current = offsets.current.get(entry.current) ?? history.state?.staffScroll ?? 0;
      setRoute(readRoute(role));
    }
    window.addEventListener('popstate', pop);
    return () => {
      history.scrollRestoration = original;
      window.removeEventListener('popstate', pop);
    };
  }, [role]);

  useLayoutEffect(() => {
    if (focus.current) heading.current?.focus({ preventScroll: true });
    if (restore.current !== undefined) window.scrollTo(0, restore.current);
    focus.current = false;
    restore.current = undefined;
  }, [route]);

  function href(section: StaffSection, id?: string, filter?: string) {
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.set('section', section);
    url.searchParams.delete('id');
    url.searchParams.delete('filter');
    if (id) url.searchParams.set('id', id);
    if (filter) url.searchParams.set('filter', filter);
    return url.pathname + url.search;
  }

  function navigate(destination: string, fromList = false, moveFocus = true) {
    if (destination === location.pathname + location.search) {
      if (moveFocus) heading.current?.focus({ preventScroll: true });
      return;
    }
    const staffScroll = window.scrollY;
    offsets.current.set(entry.current, staffScroll);
    history.replaceState({ ...history.state, staffScroll }, '');
    entry.current = Math.max(Date.now(), entry.current + 1);
    history.pushState({ staffEntry: entry.current, fromList }, '', destination);
    if (moveFocus) restore.current = 0;
    focus.current = moveFocus;
    setRoute(readRoute(role));
  }

  function link(destination: string, fromList = false, close?: () => void) {
    return {
      href: destination,
      onClick(event: MouseEvent<HTMLAnchorElement>) {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        close?.();
        navigate(destination, fromList);
      },
    };
  }

  function back() {
    const destination = href(route.section, undefined, route.filter);
    return {
      ...link(destination),
      onClick(event: MouseEvent<HTMLAnchorElement>) {
        if (!history.state?.fromList) return link(destination).onClick(event);
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        history.back();
      },
    };
  }

  return { route, heading, href, link, navigate, back };
}

export type StaffNavigation = ReturnType<typeof useStaffNavigation>;
