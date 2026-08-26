import { AssistantButton } from '@/components/assistant/assistant-button'
import { loadAssistantControlConfig } from '@/lib/assistant/config'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const assistantConfig = await loadAssistantControlConfig()
  return <><SiteHeader />{children}<AssistantButton enabled={assistantConfig.enabled} maintenanceMode={assistantConfig.maintenanceMode} maintenanceMessage={assistantConfig.maintenanceMessage} assistantName={assistantConfig.agentProfile.agentName || assistantConfig.assistantName} subtitle={assistantConfig.agentProfile.subtitle} buttonLabel={assistantConfig.buttonLabel} maxVisibleProductCards={assistantConfig.maxVisibleProductCards} showQuickPrompts={assistantConfig.showQuickPrompts} welcomeMessage={assistantConfig.agentProfile.welcomeMessage || assistantConfig.welcomeMessage} quickPrompts={assistantConfig.quickPrompts} /><SiteFooter /></>
}
