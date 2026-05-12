'use client'

import { useState } from 'react'

interface Props {
  plan: 'home' | 'pro' | 'addon_connector'
  annual: boolean
  highlight?: boolean
}

export default function StripeCheckoutButton({ plan, annual, highlight = false }: Props) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (isLoading) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, annual }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No URL returned from checkout session')
      }
    } catch (error) {
      console.error('Stripe checkout error:', error)
      // Optional: show error UI, but per requirements we don't implement error handling UI
    } finally {
      setIsLoading(false)
    }
  }

  const baseClasses = 'w-full py-2.5 rounded-lg font-semibold text-sm transition'
  const highlightClasses = 'bg-[#00C66F] text-black hover:bg-[#00b564]'
  const defaultClasses = 'border border-zinc-700 bg-transparent text-white hover:bg-zinc-800'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`${baseClasses} ${highlight ? highlightClasses : defaultClasses} ${
        isLoading ? 'opacity-75 cursor-not-allowed' : ''
      }`}
    >
      {isLoading ? 'Redirecting…' : 'Continue with Stripe'}
    </button>
  )
}