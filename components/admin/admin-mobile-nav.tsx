'use client'

import { useState, useEffect, useRef } from 'react'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'

export function AdminMobileNav({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close menu on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative md:hidden" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close admin navigation' : 'Open admin navigation'}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-11 z-50 w-64 rounded-xl border border-slate-200 bg-slate-950 p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col gap-1">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
