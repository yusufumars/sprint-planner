import posthog from 'posthog-js'

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
})

export function capture(event, properties = {}) {
  posthog.capture(event, properties)
}
