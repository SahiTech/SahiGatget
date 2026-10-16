import { Suspense } from 'react'
import { AssistantButton } from '@/components/assistant/assistant-button'
import { loadCachedAssistantControlConfig } from '@/lib/assistant/config'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'

async function AssistantSlot() {
  const assistantConfig = await loadCachedAssistantControlConfig()
  return <AssistantButton enabled={assistantConfig.enabled} maintenanceMode={assistantConfig.maintenanceMode} maintenanceMessage={assistantConfig.maintenanceMessage} assistantName={assistantConfig.agentProfile.agentName || assistantConfig.assistantName} subtitle={assistantConfig.agentProfile.subtitle} buttonLabel={assistantConfig.buttonLabel} maxVisibleProductCards={assistantConfig.maxVisibleProductCards} showQuickPrompts={assistantConfig.showQuickPrompts} welcomeMessage={assistantConfig.agentProfile.welcomeMessage || assistantConfig.welcomeMessage} quickPrompts={assistantConfig.quickPrompts} />
}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <>
    <SiteHeader />
    <div className="pb-16 lg:pb-0">{children}</div>
    <MobileBottomNav />
    <Suspense fallback={null}><AssistantSlot /></Suspense>
    <SiteFooter />
  </>
}
