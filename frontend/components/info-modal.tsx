"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { ReactNode } from "react"

interface InfoModalProps {
  trigger: ReactNode
  title: string
  content: string
}

export function InfoModal({ trigger, title, content }: InfoModalProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="hover:text-blue-600 transition-colors font-medium cursor-pointer focus:outline-none">
          {trigger}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-[90vw] max-w-md z-50 animate-pop-in border border-slate-100 focus:outline-none">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-slate-900">
              {title}
            </Dialog.Title>
            <Dialog.Close className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500 transition-colors">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
            {content}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
