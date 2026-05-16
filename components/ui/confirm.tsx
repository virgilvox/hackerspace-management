'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

// An accessible replacement for window.confirm(). Wrap the app once in
// <ConfirmProvider> and call `const confirm = useConfirm()` then
// `if (!(await confirm({ title, ... }))) return` at the call site, so the
// imperative shape stays close to the native confirm() it replaces.

type ConfirmOptions = {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = React.createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null)
  const resolverRef = React.useRef<((v: boolean) => void) | null>(null)

  const confirm = React.useCallback<ConfirmFn>((next) => {
    setOpts(next)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = React.useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOpts(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={opts !== null}
        onOpenChange={(open) => {
          if (!open) settle(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description ? (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {opts?.cancelText ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={
                opts?.destructive
                  ? buttonVariants({ variant: 'destructive' })
                  : undefined
              }
            >
              {opts?.confirmText ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
