export function useEmailWarning() {
  const toast = useToast()

  return () => {
    if (import.meta.prod)
      toast.add({ title: 'Email disabled', description: 'Clone locally to test email features', color: 'warning' })
  }
}
