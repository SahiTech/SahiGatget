'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DeliveryOperationsCenter as LegacyDeliveryOperationsCenter } from './delivery-operations-center'
import { DeliveryProviderNetwork } from './delivery-provider-network'

type DeliveryOperationsData = Parameters<typeof LegacyDeliveryOperationsCenter>[0]['data']

export function DeliveryOperationsShell({ data }: { data: DeliveryOperationsData }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [networkHost, setNetworkHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const host = rootRef.current?.querySelector<HTMLElement>('aside')
    if (!host) return

    const legacyNetwork = host.querySelector<HTMLElement>(':scope > section:first-child')
    legacyNetwork?.classList.add('legacy-delivery-network')
    setNetworkHost(host)

    return () => {
      legacyNetwork?.classList.remove('legacy-delivery-network')
    }
  }, [])

  return (
    <>
      <style jsx global>{`
        .delivery-network-host {
          display: flex !important;
          flex-direction: column !important;
        }

        .delivery-network-host > .legacy-delivery-network {
          display: none !important;
        }

        .delivery-network-host > .delivery-provider-network {
          order: 1;
        }

        .delivery-network-host > section:not(.delivery-provider-network) {
          order: 2;
        }
      `}</style>

      <div ref={rootRef} className="contents">
        <LegacyDeliveryOperationsCenter data={data} />
        {networkHost ? (
          <div className="delivery-network-host contents">
            {createPortal(<DeliveryProviderNetwork data={data} />, networkHost)}
          </div>
        ) : null}
      </div>
    </>
  )
}
