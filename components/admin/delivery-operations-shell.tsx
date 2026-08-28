'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DeliveryOperationsCenter as LegacyDeliveryOperationsCenter } from './delivery-operations-center'
import { DeliveryProviderNetwork } from './delivery-provider-network'

export function DeliveryOperationsShell({ data }: { data: any }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [aside, setAside] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const host = rootRef.current?.querySelector('aside') as HTMLElement | null
    if (!host) return
    host.classList.add('delivery-network-host')
    const legacyNetwork = host.querySelector(':scope > section:first-child')
    legacyNetwork?.classList.add('legacy-delivery-network')
    setAside(host)
    return () => {
      host.classList.remove('delivery-network-host')
      legacyNetwork?.classList.remove('legacy-delivery-network')
    }
  }, [])

  return <>
    <style jsx global>{`\n      .delivery-network-host { display: flex !important; flex-direction: column !important; }\n      .delivery-network-host > .legacy-delivery-network { display: none !important; }\n      .delivery-network-host > .delivery-provider-network { order: 1; }\n      .delivery-network-host > section:not(.delivery-provider-network) { order: 2; }\n    `}</style>
    <div ref={rootRef} className="contents">
      <LegacyDeliveryOperationsCenter data={data} />
      {aside ? createPortal(<DeliveryProviderNetwork data={data} />, aside) : null}
    </div>
  </>
}
