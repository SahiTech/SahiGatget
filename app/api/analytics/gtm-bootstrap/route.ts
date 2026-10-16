import { NextResponse } from 'next/server'
import { getAnalyticsConfig } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

function validContainerId(value: string) {
  return /^GTM-[A-Z0-9]+(?:-[A-Z0-9]+)?$/i.test(value.trim())
}

export async function GET() {
  const config = await getAnalyticsConfig()
  const containerId = config.gtmContainerId.trim().toUpperCase()
  if (!config.enabled || !validContainerId(containerId)) {
    return new NextResponse('/* Analytics GTM disabled */', {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    })
  }
  const safeId = JSON.stringify(containerId)
  const source = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});w[l].push(['consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500}]);w.__COMMERCE_ANALYTICS_GTM__={id:i,status:'loading',startedAt:Date.now()};var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;j.onload=function(){w.__COMMERCE_ANALYTICS_GTM__.status='ready';w.__COMMERCE_ANALYTICS_GTM__.readyAt=Date.now();w.dispatchEvent(new CustomEvent('commerce-analytics-gtm-ready'))};j.onerror=function(){w.__COMMERCE_ANALYTICS_GTM__.status='error';w.__COMMERCE_ANALYTICS_GTM__.errorAt=Date.now();w.dispatchEvent(new CustomEvent('commerce-analytics-gtm-error'))};f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer',${safeId});`
  return new NextResponse(source, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300', 'X-Content-Type-Options': 'nosniff' },
  })
}