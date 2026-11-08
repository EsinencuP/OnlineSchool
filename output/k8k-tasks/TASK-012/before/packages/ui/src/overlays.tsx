import { forwardRef, useId, useRef } from 'react';
import type { ComponentPropsWithoutRef, ReactElement, ReactNode, RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertPrimitive from '@radix-ui/react-alert-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Button, IconButton } from './controls.js';
import { Icon } from './icon.js';
import { useLocale } from './locale.js';

export type OverlayCloseReason =
  'escape' | 'outside' | 'close-button' | 'cancel-button' | 'primitive';
export type OverlayLifecycle = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Caller decides whether to discard input, wait, reconcile, or close. No write is cancelled here. */
  onRequestClose?: (reason: OverlayCloseReason) => void;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusRef?: RefObject<HTMLElement>;
};
type FocusEvent = { defaultPrevented: boolean; preventDefault: () => void };
function focusRef(event: FocusEvent, ref?: RefObject<HTMLElement>) {
  if (!event.defaultPrevented && ref?.current?.isConnected) {
    ref.current.focus({ preventScroll: true });
    if (ref.current.ownerDocument.activeElement === ref.current) event.preventDefault();
  }
}
function useLifecycle({ onOpenChange, onRequestClose }: OverlayLifecycle) {
  const reason = useRef<OverlayCloseReason>('primitive');
  return {
    reason,
    change(open: boolean) {
      const requested = reason.current;
      reason.current = 'primitive';
      if (open || !onRequestClose) onOpenChange(open);
      else onRequestClose(requested);
    },
  };
}
type DialogContentProps = Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'asChild' | 'forceMount' | 'children' | 'aria-labelledby' | 'aria-describedby'
>;
export type DialogProps = OverlayLifecycle & {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  trigger?: ReactElement;
  modal?: boolean;
  pending?: boolean;
  contentProps?: DialogContentProps;
};
type SurfaceProps = DialogProps & { drawer?: boolean };
const DialogSurface = /* @__PURE__ */ forwardRef<HTMLDivElement, SurfaceProps>(
  function DialogSurface(
    {
      open,
      onOpenChange,
      onRequestClose,
      title,
      description,
      children,
      trigger,
      modal = true,
      pending,
      initialFocusRef,
      returnFocusRef,
      contentProps = {},
      drawer = false,
    },
    ref,
  ) {
    const { t } = useLocale();
    const { reason, change } = useLifecycle({
      open,
      onOpenChange,
      ...(onRequestClose ? { onRequestClose } : {}),
    });
    const {
      className = '',
      onOpenAutoFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onInteractOutside,
      ...rest
    } = contentProps;
    return (
      <DialogPrimitive.Root open={open} onOpenChange={change} modal={modal}>
        {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
        <DialogPrimitive.Portal>
          {modal && <DialogPrimitive.Overlay className="k8k-overlay-backdrop" />}
          <DialogPrimitive.Content
            {...rest}
            ref={ref}
            className={`k8k-overlay-surface ${drawer ? 'k8k-drawer' : 'k8k-dialog'} ${className}`}
            aria-busy={pending || undefined}
            onOpenAutoFocus={(e) => {
              onOpenAutoFocus?.(e);
              focusRef(e, initialFocusRef);
            }}
            onCloseAutoFocus={(e) => {
              onCloseAutoFocus?.(e);
              focusRef(e, returnFocusRef);
            }}
            onEscapeKeyDown={(e) => {
              onEscapeKeyDown?.(e);
              if (!e.defaultPrevented) reason.current = 'escape';
            }}
            onInteractOutside={(e) => {
              onInteractOutside?.(e);
              if (!e.defaultPrevented) reason.current = 'outside';
            }}
          >
            <header className="k8k-overlay-header">
              <DialogPrimitive.Title className="k8k-overlay-title">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <IconButton
                  variant="ghost"
                  label={t('closeOverlay')}
                  onClick={() => {
                    reason.current = 'close-button';
                  }}
                >
                  <Icon name="close" />
                </IconButton>
              </DialogPrimitive.Close>
            </header>
            <DialogPrimitive.Description className="k8k-overlay-description">
              {description}
            </DialogPrimitive.Description>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  },
);
export const Dialog = /* @__PURE__ */ forwardRef<HTMLDivElement, DialogProps>(
  function Dialog(props, ref) {
    return <DialogSurface {...props} ref={ref} />;
  },
);
export const Drawer = /* @__PURE__ */ forwardRef<HTMLDivElement, DialogProps>(
  function Drawer(props, ref) {
    return <DialogSurface {...props} ref={ref} drawer />;
  },
);

type AlertContentProps = Omit<
  ComponentPropsWithoutRef<typeof AlertPrimitive.Content>,
  'asChild' | 'forceMount' | 'children' | 'aria-labelledby' | 'aria-describedby'
>;
export type ConfirmDialogProps = OverlayLifecycle & {
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
  trigger?: ReactElement;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  pendingDescription?: ReactNode;
  destructive?: boolean;
  contentProps?: AlertContentProps;
};
export const ConfirmDialog = /* @__PURE__ */ forwardRef<HTMLDivElement, ConfirmDialogProps>(
  function ConfirmDialog(
    {
      open,
      onOpenChange,
      onRequestClose,
      title,
      description,
      children,
      trigger,
      confirmLabel,
      cancelLabel,
      onConfirm,
      pending = false,
      pendingDescription,
      destructive = false,
      initialFocusRef,
      returnFocusRef,
      contentProps = {},
    },
    ref,
  ) {
    const { reason, change } = useLifecycle({
      open,
      onOpenChange,
      ...(onRequestClose ? { onRequestClose } : {}),
    });
    const {
      className = '',
      onOpenAutoFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      ...rest
    } = contentProps;
    return (
      <AlertPrimitive.Root open={open} onOpenChange={change}>
        {trigger && <AlertPrimitive.Trigger asChild>{trigger}</AlertPrimitive.Trigger>}
        <AlertPrimitive.Portal>
          <AlertPrimitive.Overlay className="k8k-overlay-backdrop" />
          <AlertPrimitive.Content
            {...rest}
            ref={ref}
            className={`k8k-overlay-surface k8k-dialog ${className}`}
            aria-busy={pending || undefined}
            onOpenAutoFocus={(e) => {
              onOpenAutoFocus?.(e);
              focusRef(e, initialFocusRef);
            }}
            onCloseAutoFocus={(e) => {
              onCloseAutoFocus?.(e);
              focusRef(e, returnFocusRef);
            }}
            onEscapeKeyDown={(e) => {
              onEscapeKeyDown?.(e);
              if (!e.defaultPrevented) reason.current = 'escape';
            }}
          >
            <AlertPrimitive.Title className="k8k-overlay-title">{title}</AlertPrimitive.Title>
            <AlertPrimitive.Description className="k8k-overlay-description">
              {description}
            </AlertPrimitive.Description>
            {children}
            <footer className="k8k-overlay-actions">
              <AlertPrimitive.Cancel asChild>
                <Button
                  variant="secondary"
                  onClick={() => {
                    reason.current = 'cancel-button';
                  }}
                >
                  {cancelLabel}
                </Button>
              </AlertPrimitive.Cancel>
              <AlertPrimitive.Action asChild>
                <Button
                  variant={destructive ? 'danger' : 'primary'}
                  pending={pending}
                  disabledReason={pendingDescription}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!pending) onConfirm();
                  }}
                >
                  {confirmLabel}
                </Button>
              </AlertPrimitive.Action>
            </footer>
          </AlertPrimitive.Content>
        </AlertPrimitive.Portal>
      </AlertPrimitive.Root>
    );
  },
);
export { ConfirmDialog as AlertDialog };

type PopoverContentProps = Omit<
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>,
  'asChild' | 'forceMount' | 'children' | 'aria-labelledby' | 'aria-describedby'
>;
export type PopoverProps = OverlayLifecycle & {
  title: ReactNode;
  description: ReactNode;
  trigger: ReactElement;
  children: ReactNode;
  modal?: boolean;
  contentProps?: PopoverContentProps;
};
export const Popover = /* @__PURE__ */ forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  {
    open,
    onOpenChange,
    onRequestClose,
    title,
    description,
    trigger,
    children,
    modal = false,
    initialFocusRef,
    returnFocusRef,
    contentProps = {},
  },
  ref,
) {
  const { t } = useLocale();
  const id = useId();
  const { reason, change } = useLifecycle({
    open,
    onOpenChange,
    ...(onRequestClose ? { onRequestClose } : {}),
  });
  const {
    className = '',
    onOpenAutoFocus,
    onCloseAutoFocus,
    onEscapeKeyDown,
    onInteractOutside,
    ...rest
  } = contentProps;
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={change} modal={modal}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={8}
          collisionPadding={16}
          {...rest}
          ref={ref}
          className={`k8k-overlay-surface k8k-popover ${className}`}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          onOpenAutoFocus={(e) => {
            onOpenAutoFocus?.(e);
            focusRef(e, initialFocusRef);
          }}
          onCloseAutoFocus={(e) => {
            onCloseAutoFocus?.(e);
            focusRef(e, returnFocusRef);
          }}
          onEscapeKeyDown={(e) => {
            onEscapeKeyDown?.(e);
            if (!e.defaultPrevented) reason.current = 'escape';
          }}
          onInteractOutside={(e) => {
            onInteractOutside?.(e);
            if (!e.defaultPrevented) reason.current = 'outside';
          }}
        >
          <header className="k8k-overlay-header">
            <h2 id={`${id}-title`} className="k8k-overlay-title">
              {title}
            </h2>
            <PopoverPrimitive.Close asChild>
              <IconButton
                variant="ghost"
                label={t('closeOverlay')}
                onClick={() => {
                  reason.current = 'close-button';
                }}
              >
                <Icon name="close" />
              </IconButton>
            </PopoverPrimitive.Close>
          </header>
          <p id={`${id}-description`} className="k8k-overlay-description">
            {description}
          </p>
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});

export type DropdownMenuItem = {
  id: string;
  label: string;
  textValue?: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Eligibility and every side effect stay with the caller (including account-ui). */
  onSelect: NonNullable<ComponentPropsWithoutRef<typeof MenuPrimitive.Item>['onSelect']>;
};
export type DropdownMenuProps = Omit<OverlayLifecycle, 'initialFocusRef'> & {
  trigger: ReactElement;
  label: string;
  items: readonly DropdownMenuItem[];
  modal?: boolean;
  contentProps?: Omit<
    ComponentPropsWithoutRef<typeof MenuPrimitive.Content>,
    'asChild' | 'forceMount' | 'children'
  >;
};
export const DropdownMenu = /* @__PURE__ */ forwardRef<HTMLDivElement, DropdownMenuProps>(
  function DropdownMenu(
    {
      open,
      onOpenChange,
      onRequestClose,
      trigger,
      label,
      items,
      modal = false,
      returnFocusRef,
      contentProps = {},
    },
    ref,
  ) {
    const { reason, change } = useLifecycle({
      open,
      onOpenChange,
      ...(onRequestClose ? { onRequestClose } : {}),
    });
    const {
      className = '',
      onCloseAutoFocus,
      onEscapeKeyDown,
      onInteractOutside,
      ...rest
    } = contentProps;
    return (
      <MenuPrimitive.Root open={open} onOpenChange={change} modal={modal}>
        <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>
        <MenuPrimitive.Portal>
          <MenuPrimitive.Content
            sideOffset={8}
            collisionPadding={16}
            {...rest}
            ref={ref}
            aria-label={label}
            className={`k8k-overlay-surface k8k-menu ${className}`}
            onCloseAutoFocus={(e) => {
              onCloseAutoFocus?.(e);
              focusRef(e, returnFocusRef);
            }}
            onEscapeKeyDown={(e) => {
              onEscapeKeyDown?.(e);
              if (!e.defaultPrevented) reason.current = 'escape';
            }}
            onInteractOutside={(e) => {
              onInteractOutside?.(e);
              if (!e.defaultPrevented) reason.current = 'outside';
            }}
          >
            <MenuPrimitive.Label className="k8k-menu-label">{label}</MenuPrimitive.Label>
            {items.map((item) => (
              <MenuPrimitive.Item
                key={item.id}
                className="k8k-menu-item"
                disabled={item.disabled || false}
                textValue={item.textValue ?? item.label}
                onSelect={item.onSelect}
              >
                <span>{item.label}</span>
                {item.disabled && item.disabledReason && <small>{item.disabledReason}</small>}
              </MenuPrimitive.Item>
            ))}
          </MenuPrimitive.Content>
        </MenuPrimitive.Portal>
      </MenuPrimitive.Root>
    );
  },
);
