import { AssistantButton } from '@/components/assistant/assistant-button'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <><SiteHeader />{children}<AssistantButton /><SiteFooter /></>
}
